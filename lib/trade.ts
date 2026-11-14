/**
 * Trade BTC — carteira SIMULADA da Leila com preço REAL (Binance, par BTC/USDT, velas de 1h, valores em dólar).
 *
 * Quem decide são regras públicas e fixas (ver RULES). A IA só explica: cada operação e cada
 * período (12h, dia, semana, mês) ganham um comentário da Leila. Nada de dinheiro de verdade.
 *
 * "Verificável": toda operação guarda a vela da Binance que a gerou (qualquer um confere pelo
 * link) e um código (hash) encadeado com a operação anterior — editar o passado quebra a corrente.
 */
import "server-only";
import { createHash } from "node:crypto";
import { generateText } from "ai";
import { sql } from "./db";
import { MODEL } from "./models";

import {
  API, H, RULES, KINDS, REASON_TXT, periodOf, indicators, step, longLevels,
  type Candle, type Fill, type Kind, type Reason, type SimState,
} from "./trade-core";

export * from "./trade-core";

export async function fetchCandles(limit = 300, interval: string = RULES.interval): Promise<Candle[]> {
  const r = await fetch(`${API}/klines?symbol=${RULES.symbol}&interval=${interval}&limit=${limit}`, {
    // velas diárias/semanais mudam devagar: cache de 10 min
    ...(interval === RULES.interval ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`binance ${r.status}`);
  const rows = (await r.json()) as [number, string, string, string, string][];
  return rows.map(([t, o, h, l, c]) => ({ t, o: +o, h: +h, l: +l, c: +c }));
}

export async function fetchPrice(): Promise<number | null> {
  try {
    const r = await fetch(`${API}/ticker/price?symbol=${RULES.symbol}`, {
      next: { revalidate: 20 },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return +((await r.json()) as { price: string }).price;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- banco
export async function ensureSchema() {
  await sql`create table if not exists trade_state (
    id int primary key default 1,
    cash float8 not null, btc float8 not null default 0, cost float8 not null default 0,
    entry float8 not null default 0, stop float8 not null default 0, peak float8 not null default 0,
    cooldown int not null default 0,
    last_t timestamptz not null, started_at timestamptz not null, start_price float8 not null,
    last_hash text not null default '', lock_at timestamptz
  )`;
  await sql`create table if not exists trade_fills (
    id serial primary key,
    candle_t timestamptz unique not null,
    side text not null, price float8 not null, qty float8 not null, fee float8 not null,
    cash_after float8 not null, btc_after float8 not null, equity_after float8 not null,
    pnl float8, reason text not null, ind jsonb not null,
    prev_hash text not null, hash text not null,
    note text, created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists trade_marks (
    t timestamptz primary key, close float8 not null, equity float8 not null, in_pos boolean not null,
    ema_f float8 not null, ema_s float8 not null, rsi float8 not null
  )`;
  await sql`create table if not exists trade_notes (
    id serial primary key, kind text not null, period_key text not null,
    starts timestamptz not null, ends timestamptz not null, stats jsonb not null,
    body text not null, by_ai boolean not null default true, created_at timestamptz not null default now(),
    unique (kind, period_key)
  )`;
}

const hashOf = (prev: string, f: Fill) =>
  createHash("sha256")
    .update(prev + JSON.stringify([f.t, f.side, f.price, f.qty, f.fee, f.reason]))
    .digest("hex");

const iso = (t: number) => new Date(t).toISOString();

/** Processa as velas fechadas que ainda não viraram decisão. Chamado pelo cron. */
export async function tradeTick() {
  await ensureSchema();
  const all = await fetchCandles(300);
  const ind = indicators(all);
  const now = Date.now();
  const closed = all.map((c, i) => ({ c, i })).filter(({ c }) => c.t + H <= now);
  if (!closed.length) return { ok: false, why: "sem velas" };
  const lastClosed = closed[closed.length - 1].c;

  // primeira vez: a carteira nasce AGORA, sem olhar o passado (nada de operar com o resultado já sabido)
  await sql`insert into trade_state (id, cash, last_t, started_at, start_price)
    values (1, ${RULES.startCash}, ${iso(lastClosed.t)}, ${iso(lastClosed.t + H)}, ${lastClosed.c})
    on conflict (id) do nothing`;

  // trava simples contra duas execuções ao mesmo tempo
  const [row] = await sql`update trade_state set lock_at = now()
    where id = 1 and (lock_at is null or lock_at < now() - interval '3 minutes') returning *`;
  if (!row) return { ok: false, why: "ocupado" };
  try {
    let s: SimState = {
      cash: row.cash, btc: row.btc, cost: row.cost, entry: row.entry, stop: row.stop, peak: row.peak, cooldown: row.cooldown,
    };
    let lastT = new Date(row.last_t).getTime();
    let hash: string = row.last_hash;
    const todo = closed.filter(({ c }) => c.t > lastT);
    const fills: Fill[] = [];
    for (const { c, i } of todo) {
      const r = step(s, c, ind[i]);
      s = r.s;
      const m = r.mark;
      await sql`insert into trade_marks (t, close, equity, in_pos, ema_f, ema_s, rsi)
        values (${iso(m.t)}, ${m.close}, ${m.equity}, ${m.inPos}, ${m.emaF}, ${m.emaS}, ${m.rsi})
        on conflict (t) do nothing`;
      if (r.fill) {
        const f = r.fill;
        const h = hashOf(hash, f);
        await sql`insert into trade_fills (candle_t, side, price, qty, fee, cash_after, btc_after, equity_after, pnl, reason, ind, prev_hash, hash)
          values (${iso(f.t)}, ${f.side}, ${f.price}, ${f.qty}, ${f.fee}, ${f.cash}, ${f.btc}, ${f.equity}, ${f.pnl},
                  ${f.reason}, ${JSON.stringify(f.ind)}, ${hash}, ${h})
          on conflict (candle_t) do nothing`;
        hash = h;
        fills.push(f);
      }
      lastT = c.t;
    }
    await sql`update trade_state set cash = ${s.cash}, btc = ${s.btc}, cost = ${s.cost}, entry = ${s.entry},
      stop = ${s.stop}, peak = ${s.peak}, cooldown = ${s.cooldown}, last_t = ${iso(lastT)}, last_hash = ${hash}
      where id = 1`;
    const notes = await writeNotes();
    return { ok: true, candles: todo.length, fills: fills.length, notes };
  } finally {
    await sql`update trade_state set lock_at = null where id = 1`;
  }
}

export type Stats = {
  from: number;
  to: number;
  eqStart: number;
  eqEnd: number;
  pct: number;
  btcStart: number;
  btcEnd: number;
  btcPct: number;
  trades: number;
  buys: number;
  sells: number;
  wins: number;
  realized: number;
  fees: number;
  maxDD: number; // em % (negativo)
  exposure: number; // % das horas com posição aberta
  hours: number;
};

/** Números de um intervalo. Velas são marcadas pelo horário de abertura. */
export async function statsFor(from: number, to: number): Promise<Stats | null> {
  const [state] = await sql`select started_at, start_price from trade_state where id = 1`;
  if (!state) return null;
  const started = new Date(state.started_at).getTime();
  const marks = await sql`select t, close, equity, in_pos from trade_marks
    where t >= ${iso(from - H)} and t < ${iso(to - H)} order by t`;
  const [before] = await sql`select close, equity from trade_marks where t < ${iso(from - H)} order by t desc limit 1`;
  const fills = await sql`select side, pnl, fee from trade_fills where candle_t >= ${iso(from - H)} and candle_t < ${iso(to - H)}`;
  const first = before ?? (from <= started ? { close: state.start_price, equity: RULES.startCash } : marks[0]);
  if (!first) return null;
  const last = marks[marks.length - 1] ?? first;
  let peak = first.equity;
  let maxDD = 0;
  for (const m of marks) {
    peak = Math.max(peak, m.equity);
    maxDD = Math.min(maxDD, (m.equity / peak - 1) * 100);
  }
  const sells = fills.filter((f) => f.side === "venda");
  return {
    from, to,
    eqStart: first.equity, eqEnd: last.equity, pct: (last.equity / first.equity - 1) * 100,
    btcStart: first.close, btcEnd: last.close, btcPct: (last.close / first.close - 1) * 100,
    trades: fills.length, buys: fills.length - sells.length, sells: sells.length,
    wins: sells.filter((f) => (f.pnl ?? 0) > 0).length,
    realized: sells.reduce((a, f) => a + (f.pnl ?? 0), 0),
    fees: fills.reduce((a, f) => a + f.fee, 0),
    maxDD,
    exposure: marks.length ? (marks.filter((m) => m.in_pos).length / marks.length) * 100 : 0,
    hours: marks.length,
  };
}

// ---------------------------------------------------------------- a Leila explica
const usd = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
const pc = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`;

const LEILA = `Você é a Leila, a IA do Fric. Você opera uma carteira SIMULADA de bitcoin (dinheiro de mentira, US$ 10 mil no início) com o preço REAL do par BTC/USDT na Binance, tudo em dólar, seguindo regras fixas e públicas, e usa isso para ENSINAR quem acompanha.
Regras da carteira: compra quando a média móvel de 20 horas está acima da de 50 horas, o preço fecha acima da média de 20 e o RSI está abaixo de 70; usa só o tamanho que arrisca 1% da carteira com stop de 3%; o stop sobe junto (3% abaixo do maior fechamento); vende no stop ou quando a média de 20 cruza para baixo da de 50; taxa de 0,1% por operação; depois de vender espera 6 horas.
Como escrever:
- Português do Brasil, tom de professora calma e honesta. Frases curtas. Sem emoji, sem markdown, sem listas.
- Use SÓ os números que vierem na mensagem. Não invente número, notícia ou motivo externo.
- Nunca recomende comprar ou vender, nunca preveja preço, nunca prometa ganho. Fale do que a carteira simulada fez e por quê.
- Ensine UM conceito por vez (média móvel, RSI, stop, tamanho de posição, regra de 1%, taxa, drawdown, comparar com "comprar e segurar", disciplina de não operar) ligado aos números.
- Termine com uma dica curta do que observar no próximo acompanhamento.
- No máximo 550 caracteres.`;

/** Médias de longo prazo (200 dias e 4 anos) para a Leila dar contexto. */
async function longContext(): Promise<string> {
  try {
    const [d, w] = await Promise.all([fetchCandles(400, "1d"), fetchCandles(240, "1w")]);
    const lv = longLevels(d, w);
    const px = d[d.length - 1].c;
    const rel = (v: number) => `${px >= v ? "acima" : "abaixo"} (${pc((px / v - 1) * 100)})`;
    return `
Contexto de longo prazo: preço ${usd(px)}; média de 200 dias ${usd(lv.ma200d)}, preço ${rel(lv.ma200d)}; média de 4 anos ${usd(lv.ma4y)}, preço ${rel(lv.ma4y)}. Use isso só se ajudar a ensinar.`;
  } catch {
    return "";
  }
}

async function ask(prompt: string): Promise<string | null> {
  try {
    const { text } = await generateText({ model: MODEL, instructions: LEILA, prompt, maxOutputTokens: 3000 });
    const t = text.replace(/[*#_`]/g, "").replace(/\s+/g, " ").trim();
    return t.length > 40 ? t.slice(0, 700) : null;
  } catch (e) {
    console.error("[trade] leila falhou:", String(e).slice(0, 200));
    return null;
  }
}

function fillPrompt(f: Record<string, any>) {
  const ind = f.ind as Fill["ind"];
  const head =
    f.side === "compra"
      ? `A carteira simulada acabou de COMPRAR ${f.qty.toFixed(6)} BTC a ${usd(f.price)}. Stop de proteção em ${usd(ind.stop)}.`
      : `A carteira simulada acabou de VENDER a ${usd(f.price)}. Resultado desta operação: ${usd(f.pnl ?? 0)}.`;
  return `${head}
Motivo pela regra: ${REASON_TXT[f.reason as Reason]}
Média 20h: ${usd(ind.emaF)} | Média 50h: ${usd(ind.emaS)} | RSI: ${ind.rsi.toFixed(0)} | Taxa paga: ${usd(f.fee)}
Carteira agora: ${usd(f.equity_after)} (começou com ${usd(RULES.startCash)}).
Explique para um iniciante o que aconteceu e o que isso ensina.`;
}

const KIND_TXT: Record<Kind, string> = {
  "12h": "das últimas 12 horas",
  dia: "do dia",
  semana: "da semana",
  mes: "do mês",
};

function statsPrompt(kind: Kind, st: Stats) {
  return `Fechamento ${KIND_TXT[kind]} da carteira simulada.
Carteira: ${usd(st.eqStart)} → ${usd(st.eqEnd)} (${pc(st.pct)}).
Bitcoin no mesmo período: ${usd(st.btcStart)} → ${usd(st.btcEnd)} (${pc(st.btcPct)}).
Operações: ${st.trades} (${st.buys} compras, ${st.sells} vendas, ${st.wins} vendas com lucro). Resultado realizado: ${usd(st.realized)}. Taxas: ${usd(st.fees)}.
Maior queda desde o pico (drawdown): ${pc(st.maxDD)}. Tempo posicionada: ${st.exposure.toFixed(0)}% das horas.
Faça o resumo do período como aula: compare com o bitcoin e diga o que isso ensina.`;
}

function fallbackFill(f: Record<string, any>) {
  return f.side === "compra"
    ? `Compra simulada a ${usd(f.price)}. ${REASON_TXT[f.reason as Reason]} O stop ficou em ${usd(f.ind.stop)}: se o preço tocar ali, a carteira sai. Repare que só entrou com uma parte da carteira, para arriscar no máximo 1%.`
    : `Venda simulada a ${usd(f.price)}, resultado de ${usd(f.pnl ?? 0)}. ${REASON_TXT[f.reason as Reason]} Sair pela regra, sem discutir com o preço, é o que mantém a perda pequena quando o mercado vira.`;
}

function fallbackStats(kind: Kind, st: Stats) {
  return `Fechamento ${KIND_TXT[kind]}: a carteira foi de ${usd(st.eqStart)} para ${usd(st.eqEnd)} (${pc(st.pct)}), enquanto o bitcoin fez ${pc(st.btcPct)}. Foram ${st.trades} operações e a maior queda desde o pico foi de ${pc(st.maxDD)}. Compare sempre com o bitcoin parado: é assim que se sabe se a estratégia está ajudando.`;
}

/** Comentários pendentes: operações sem nota e períodos recém-fechados. No máximo 3 chamadas de IA por rodada. */
async function writeNotes() {
  let budget = 3;
  let written = 0;
  let ctx: string | null = null;
  const withCtx = async (p: string) => p + (ctx ??= await longContext());
  const pending = await sql`select * from trade_fills where note is null order by candle_t limit 5`;
  for (const f of pending) {
    const body = (budget-- > 0 ? await ask(await withCtx(fillPrompt(f))) : null) ?? fallbackFill(f);
    await sql`update trade_fills set note = ${body} where id = ${f.id}`;
    written++;
  }
  const [state] = await sql`select started_at, last_t from trade_state where id = 1`;
  const started = new Date(state.started_at).getTime();
  const dataUntil = new Date(state.last_t).getTime() + H; // fechamento da última vela processada
  for (const kind of KINDS) {
    const cur = periodOf(kind, dataUntil - 1);
    const prev = periodOf(kind, cur.start - 1); // o período que acabou de fechar
    if (prev.end <= started || prev.end > dataUntil) continue;
    const [has] = await sql`select 1 from trade_notes where kind = ${kind} and period_key = ${prev.key}`;
    if (has) continue;
    const st = await statsFor(Math.max(prev.start, started), prev.end);
    if (!st) continue;
    const ai = budget-- > 0 ? await ask(await withCtx(statsPrompt(kind, st))) : null;
    await sql`insert into trade_notes (kind, period_key, starts, ends, stats, body, by_ai)
      values (${kind}, ${prev.key}, ${iso(prev.start)}, ${iso(prev.end)}, ${JSON.stringify(st)}, ${ai ?? fallbackStats(kind, st)}, ${!!ai})
      on conflict (kind, period_key) do nothing`;
    written++;
  }
  return written;
}
