import Link from "next/link";
import { ShieldCheck, Sparkles, ExternalLink, Fingerprint, ListChecks } from "lucide-react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { sql } from "@/lib/db";
import {
  RULES, H, KINDS, REASON_TXT, candleUrl, fetchCandles, fetchPrice, indicators, periodOf, statsFor,
  type Candle, type Kind, type Reason, type Stats,
} from "@/lib/trade";
import "./trade.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Trade BTC",
  description: "A Leila, IA do Fric, opera uma carteira simulada de bitcoin com preço real e ensina cada decisão.",
};

const brl = (n: number, max = 2) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: max, minimumFractionDigits: max });
const pc = (n: number) =>
  Math.abs(n) < 0.005 ? "0,00%" : `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")}%`;
const tone = (n: number) => (n > 0.005 ? "up" : n < -0.005 ? "down" : "");
const when = (t: string | number) =>
  new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const KIND_LABEL: Record<Kind, string> = { "12h": "Últimas 12h", dia: "Dia", semana: "Semana", mes: "Mês" };
const KIND_NOW: Record<Kind, string> = { "12h": "Nestas 12 horas", dia: "Hoje", semana: "Nesta semana", mes: "Neste mês" };
const KIND_PREV: Record<Kind, string> = { "12h": "Fechamento das 12h anteriores", dia: "Fechamento de ontem", semana: "Fechamento da semana passada", mes: "Fechamento do mês passado" };

// o que um aluno deve olhar em cada janela de acompanhamento
const CHECK: Record<Kind, string[]> = {
  "12h": [
    "A carteira está comprada ou fora? Se comprada, onde está o stop?",
    "O preço está acima ou abaixo da média de 20h (linha azul do gráfico)?",
    "Alguma operação nova? Leia o motivo: foi a regra, nunca palpite.",
  ],
  dia: [
    "Resultado do dia contra o bitcoin parado: ganhou ou perdeu dele?",
    "Quantas operações e quanto foi de taxa. Muita operação come o lucro.",
    "Anote num caderno: data, resultado, o que você aprendeu.",
  ],
  semana: [
    "Maior queda desde o pico (drawdown): você aguentaria essa queda com dinheiro de verdade?",
    "Taxa de acerto das vendas. Dá pra ganhar acertando menos da metade, se as perdas forem pequenas.",
    "Quanto tempo a carteira ficou posicionada. Ficar fora também é decisão.",
  ],
  mes: [
    "Estratégia contra \"comprar e segurar\" desde o início. Esse é o teste de verdade.",
    "As regras foram seguidas em 100% das operações? (Confira pelos links da Binance.)",
    "Um mês é pouco. Só tire conclusão depois de vários meses e muitas operações.",
  ],
};

async function loadState() {
  try {
    const [s] = await sql`select * from trade_state where id = 1`;
    return s ?? null;
  } catch {
    return null; // tabelas ainda não existem
  }
}

export default async function Trade({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const p = (await searchParams).p;
  const kind: Kind = (KINDS as string[]).includes(p ?? "") ? (p as Kind) : "12h";

  const [state, price, candles] = await Promise.all([
    loadState(),
    fetchPrice(),
    fetchCandles(130).catch(() => [] as Candle[]),
  ]);
  const live = price ?? candles[candles.length - 1]?.c ?? null;

  return (
    <>
      <AutoRefresh seconds={60} />
      <div className="colhead">
        <div className="bar">
          <div>
            <h1>
              Trade BTC <em className="beta">Beta</em>
            </h1>
            <small>A Leila opera uma carteira simulada com preço real e ensina cada decisão</small>
          </div>
        </div>
      </div>

      <div className="notice">
        <ShieldCheck aria-hidden />
        <span>
          Simulação educativa: o preço é real (Binance, BTC/BRL), o dinheiro não. Nada aqui é recomendação de
          investimento. As decisões seguem regras fixas e públicas; a IA só explica.
        </span>
      </div>

      {!state ? (
        <div className="empty">
          <div className="ic"><Sparkles aria-hidden /></div>
          <h2>A carteira começa na próxima hora</h2>
          <p>Ela nasce com R$ 10 mil simulados e só opera daqui pra frente, sem olhar o passado.</p>
        </div>
      ) : (
        <Body state={state} live={live} candles={candles} kind={kind} />
      )}
      <div className="trd-pad" aria-hidden />
    </>
  );
}

async function Body({ state, live, candles, kind }: { state: Record<string, any>; live: number | null; candles: Candle[]; kind: Kind }) {
  const now = Date.now();
  const started = new Date(state.started_at).getTime();
  const period = periodOf(kind, now);
  const [fills, notes, cur, [lastNote], [{ n: totalOps }]] = await Promise.all([
    sql`select * from trade_fills order by candle_t desc limit 30`,
    sql`select * from trade_notes where kind = ${kind} order by ends desc limit 1`,
    statsFor(Math.max(period.start, started), now),
    sql`select body, created_at from (
          select note as body, created_at from trade_fills where note is not null
          union all select body, created_at from trade_notes
        ) x order by created_at desc limit 1`,
    sql`select count(*)::int as n from trade_fills`,
  ]);
  const prevNote = notes[0];

  const px = live ?? state.start_price;
  const equity = state.cash + state.btc * px;
  const total = (equity / RULES.startCash - 1) * 100;
  const hold = (px / state.start_price - 1) * 100;
  const inPos = state.btc > 0;
  const open = inPos ? ((px * (1 - RULES.feePct)) * state.btc - state.cost) : 0;
  const days = Math.max(1, Math.round((now - started) / (24 * H)));

  return (
    <>
      <section className="trd-card trd-hero">
        <span className="avatar photo ring live" style={{ width: 64, height: 64 }}>
          <img src="/cast/c01.webp" alt="" />
        </span>
        <div className="trd-who">
          <b>Leila</b>
          <span className={`pill ${inPos ? "mint" : "sun"}`}>{inPos ? "Comprada" : "Fora do mercado"}</span>
          <small>IA do Fric · carteira simulada desde {when(started)} ({days} {days === 1 ? "dia" : "dias"})</small>
        </div>
        <p className="trd-say">
          {lastNote?.body ??
            "Comecei agora. Vou seguir as regras abaixo, hora a hora, e explicar aqui cada vez que a carteira comprar ou vender. Se nada acontecer, também é aula: ficar de fora é uma decisão."}
        </p>
      </section>

      <section className="trd-kpis">
        <div className="trd-kpi">
          <small>Bitcoin agora</small>
          <b>{live ? brl(live, 0) : "—"}</b>
          <span className={tone(hold)}>{pc(hold)} desde o início</span>
        </div>
        <div className="trd-kpi">
          <small>Carteira simulada</small>
          <b>{brl(equity)}</b>
          <span className={tone(total)}>{pc(total)} desde o início</span>
        </div>
        <div className="trd-kpi">
          <small>Posição</small>
          {inPos ? (
            <>
              <b>{state.btc.toFixed(5)} BTC</b>
              <span>
                Compra {brl(state.entry, 0)} · stop {brl(state.stop, 0)}
                <br />
                <em className={tone(open)}>{open >= 0 ? "+" : ""}{brl(open)} em aberto</em>
              </span>
            </>
          ) : (
            <>
              <b>100% em reais</b>
              <span>{state.cooldown > 0 ? `Esperando ${state.cooldown}h depois da última venda` : "Esperando o sinal das regras"}</span>
            </>
          )}
        </div>
        <div className="trd-kpi">
          <small>Operações</small>
          <b>{totalOps}</b>
          <span>em {days} {days === 1 ? "dia" : "dias"}</span>
        </div>
      </section>

      {candles.length > 60 && <Chart candles={candles} fills={fills} />}

      <section className="trd-card">
        <h2 className="trd-h"><ListChecks aria-hidden /> Plano de acompanhamento</h2>
        <nav className="tabs trd-tabs" aria-label="Período">
          {KINDS.map((k) => (
            <Link key={k} href={k === "12h" ? "/trade" : `/trade?p=${k}`} aria-current={k === kind ? "page" : undefined} scroll={false}>
              <span>{KIND_LABEL[k]}</span>
            </Link>
          ))}
        </nav>
        {cur && <StatsGrid title={`${KIND_NOW[kind]} (ao vivo)`} st={cur} />}
        <div className="trd-note">
          <b>{KIND_PREV[kind]}</b>
          {prevNote ? (
            <>
              <p>{prevNote.body}</p>
              <small>
                {when(prevNote.starts)} a {when(prevNote.ends)} · carteira {pc(prevNote.stats.pct)} · bitcoin {pc(prevNote.stats.btcPct)}
              </small>
            </>
          ) : (
            <p className="muted">Ainda não fechou nenhum período desse tamanho desde que a carteira começou. A Leila comenta assim que fechar.</p>
          )}
        </div>
        <div className="trd-check">
          <b>O que olhar a cada {kind === "12h" ? "12 horas" : kind === "dia" ? "dia" : kind === "semana" ? "semana" : "mês"}</b>
          <ol>{CHECK[kind].map((c) => <li key={c}>{c}</li>)}</ol>
        </div>
      </section>

      <section className="trd-card">
        <h2 className="trd-h"><Fingerprint aria-hidden /> Operações registradas</h2>
        {fills.length === 0 ? (
          <p className="muted trd-in">Nenhuma operação ainda. As regras só compram quando a tendência de alta aparece.</p>
        ) : (
          <ol className="trd-fills">
            {fills.map((f) => (
              <li key={f.id} className={f.side === "compra" ? "buy" : "sell"}>
                <div className="trd-fhead">
                  <span className={`pill ${f.side === "compra" ? "mint" : "rose"}`}>{f.side === "compra" ? "Compra" : "Venda"}</span>
                  <b>{brl(f.price, 0)}</b>
                  {f.pnl != null && <em className={tone(f.pnl)}>{f.pnl >= 0 ? "+" : ""}{brl(f.pnl)}</em>}
                  <time>{when(new Date(f.candle_t).getTime() + H)}</time>
                </div>
                <p className="trd-why">{REASON_TXT[f.reason as Reason]}</p>
                {f.note && <p className="trd-lesson">{f.note}</p>}
                <div className="trd-proof">
                  <a href={candleUrl(new Date(f.candle_t).getTime())} target="_blank" rel="noopener noreferrer">
                    Conferir a vela na Binance <ExternalLink size={12} aria-hidden />
                  </a>
                  <span title={`Código desta operação: ${f.hash}\nCódigo da anterior: ${f.prev_hash || "(primeira)"}`}>
                    código {f.hash.slice(0, 10)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="trd-card">
        <h2 className="trd-h"><ShieldCheck aria-hidden /> As regras (sempre as mesmas)</h2>
        <ul className="trd-rules">
          <li>Preço real do par BTC/BRL na Binance, em velas de 1 hora. A decisão sai quando a vela fecha.</li>
          <li><b>Compra</b> quando a média das últimas 20h está acima da média de 50h, o preço fecha acima da média de 20h e o RSI está abaixo de 70 (não compra no exagero).</li>
          <li><b>Tamanho</b>: entra só com o valor que, se cair 3%, perde no máximo 1% da carteira (cerca de um terço dela).</li>
          <li><b>Stop móvel</b>: 3% abaixo do maior fechamento desde a compra. Ele só sobe, nunca desce.</li>
          <li><b>Vende</b> se tocar o stop ou se a média de 20h cruzar para baixo da de 50h. Depois espera 6h.</li>
          <li>Paga 0,1% de taxa em cada compra e venda, como numa corretora de verdade. Sem alavancagem.</li>
          <li>Cada operação tem um link para a vela exata da Binance e um código encadeado ao da operação anterior: se alguém editar o passado, a corrente quebra.</li>
        </ul>
      </section>

      <div className="notice">
        <Sparkles aria-hidden />
        <span>
          Estratégia simples de propósito: dá para conferir tudo. Resultado simulado não garante resultado real, e
          ganhar do bitcoin parado é difícil. É exatamente isso que a Leila quer mostrar.
        </span>
      </div>
    </>
  );
}

function StatsGrid({ title, st }: { title: string; st: Stats }) {
  const vs = st.pct - st.btcPct;
  return (
    <div className="trd-stats">
      <b className="trd-stitle">{title}</b>
      <dl>
        <div><dt>Carteira</dt><dd className={tone(st.pct)}>{pc(st.pct)}</dd></div>
        <div><dt>Bitcoin parado</dt><dd className={tone(st.btcPct)}>{pc(st.btcPct)}</dd></div>
        <div><dt>Contra o bitcoin</dt><dd className={tone(vs)}>{vs >= 0 ? "+" : ""}{vs.toFixed(2).replace(".", ",")} p.p.</dd></div>
        <div><dt>Operações</dt><dd>{st.trades}</dd></div>
        <div><dt>Vendas com lucro</dt><dd>{st.sells ? `${st.wins} de ${st.sells}` : "—"}</dd></div>
        <div><dt>Maior queda</dt><dd className={tone(st.maxDD)}>{pc(st.maxDD)}</dd></div>
        <div><dt>Taxas pagas</dt><dd>{brl(st.fees)}</dd></div>
        <div><dt>Tempo comprada</dt><dd>{st.hours ? `${st.exposure.toFixed(0)}%` : "—"}</dd></div>
      </dl>
    </div>
  );
}

/** Gráfico das últimas 72h: preço, média de 20h, média de 50h e as operações. SVG puro. */
function Chart({ candles, fills }: { candles: Candle[]; fills: Record<string, any>[] }) {
  const ind = indicators(candles);
  const N = 72;
  const cs = candles.slice(-N);
  const is = ind.slice(-N);
  const W = 600;
  const Ht = 220;
  const pad = { l: 6, r: 64, t: 12, b: 22 };
  const vals = [...cs.flatMap((c) => [c.h, c.l]), ...is.flatMap((i) => [i.emaF, i.emaS])];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => pad.l + (i / (cs.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (Ht - pad.t - pad.b);
  const line = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const t0 = cs[0].t;
  const marks = fills
    .map((f) => ({ f, i: Math.round((new Date(f.candle_t).getTime() - t0) / H) }))
    .filter(({ i }) => i >= 0 && i < cs.length);
  const last = cs[cs.length - 1];
  const ticks = [hi, (hi + lo) / 2, lo];
  const days = cs.map((c, i) => ({ c, i })).filter(({ c }) => new Date(c.t - 3 * H).getUTCHours() === 0);

  return (
    <section className="trd-card trd-chart">
      <div className="trd-legend">
        <span><i className="p" /> Preço</span>
        <span><i className="f" /> Média 20h</span>
        <span><i className="s" /> Média 50h</span>
        <span><i className="b" /> Compra</span>
        <span><i className="v" /> Venda</span>
        <small>Últimas 72h</small>
      </div>
      <svg viewBox={`0 0 ${W} ${Ht}`} role="img" aria-label="Gráfico do preço do bitcoin nas últimas 72 horas com médias e operações">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={W - pad.r + 6} y={y(v) + 4} className="tick">{Math.round(v / 1000)} mil</text>
          </g>
        ))}
        {days.map(({ c, i }) => (
          <text key={c.t} x={x(i)} y={Ht - 6} className="tick" textAnchor="middle">
            {new Date(c.t - 3 * H).toISOString().slice(8, 10)}/{new Date(c.t - 3 * H).toISOString().slice(5, 7)}
          </text>
        ))}
        <path d={line(is.map((i) => i.emaS))} className="ema-s" />
        <path d={line(is.map((i) => i.emaF))} className="ema-f" />
        <path d={line(cs.map((c) => c.c))} className="price" />
        {marks.map(({ f, i }) => (
          <circle key={f.id} cx={x(i)} cy={y(f.price)} r={5.5} className={f.side === "compra" ? "buy" : "sell"} />
        ))}
        <circle cx={x(cs.length - 1)} cy={y(last.c)} r={3.5} className="now" />
      </svg>
    </section>
  );
}
