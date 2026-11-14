/** Parte pura do Trade BTC (sem banco, sem rede): regras, indicadores, simulação e períodos. */
// ---------------------------------------------------------------- regras (públicas)
export const RULES = {
  symbol: "BTCBRL",
  interval: "1h",
  startCash: 10_000,
  emaFast: 20,
  emaSlow: 50,
  rsiLen: 14,
  rsiMax: 70,
  stopPct: 0.03, // stop móvel 3% abaixo do maior fechamento desde a compra
  riskPct: 0.01, // arrisca no máximo 1% da carteira por operação
  feePct: 0.001, // 0,1% de taxa em cada compra e venda
  cooldown: 6, // depois de vender, espera 6 velas antes de poder comprar de novo
};

export const H = 3_600_000;
export const API = "https://data-api.binance.vision/api/v3";

export type Candle = { t: number; o: number; h: number; l: number; c: number };
export type Ind = { emaF: number; emaS: number; rsi: number };

/** Link público que devolve exatamente a vela usada na decisão. */
export const candleUrl = (t: number) =>
  `${API}/klines?symbol=${RULES.symbol}&interval=${RULES.interval}&startTime=${t}&limit=1`;

// ---------------------------------------------------------------- indicadores
export function indicators(cs: Candle[]): Ind[] {
  const ema = (n: number) => {
    const k = 2 / (n + 1);
    const out: number[] = [];
    let e = cs[0]?.c ?? 0;
    cs.forEach((x, i) => {
      e = i === 0 ? x.c : x.c * k + e * (1 - k);
      out.push(e);
    });
    return out;
  };
  const f = ema(RULES.emaFast);
  const s = ema(RULES.emaSlow);
  // RSI de Wilder
  const n = RULES.rsiLen;
  const rsi: number[] = [];
  let g = 0;
  let l = 0;
  cs.forEach((x, i) => {
    if (i === 0) return rsi.push(50);
    const d = x.c - cs[i - 1].c;
    const up = Math.max(d, 0);
    const dn = Math.max(-d, 0);
    if (i <= n) {
      g += up / n;
      l += dn / n;
    } else {
      g = (g * (n - 1) + up) / n;
      l = (l * (n - 1) + dn) / n;
    }
    rsi.push(i < n ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l));
  });
  return cs.map((_, i) => ({ emaF: f[i], emaS: s[i], rsi: rsi[i] }));
}

// ---------------------------------------------------------------- simulação (função pura)
export type SimState = {
  cash: number;
  btc: number;
  cost: number; // quanto custou a posição aberta (com taxa)
  entry: number;
  stop: number;
  peak: number;
  cooldown: number;
};

export type Reason = "entrada" | "stop" | "tendencia";
export type Fill = {
  t: number; // abertura da vela (ms) que gerou a decisão
  side: "compra" | "venda";
  price: number;
  qty: number;
  fee: number;
  cash: number;
  btc: number;
  equity: number;
  pnl: number | null;
  reason: Reason;
  ind: Ind & { stop: number; close: number };
};
export type Mark = { t: number; close: number; equity: number; inPos: boolean } & Ind;

export function step(s: SimState, c: Candle, ind: Ind): { s: SimState; fill: Fill | null; mark: Mark } {
  const st = { ...s };
  let fill: Fill | null = null;
  const sell = (price: number, reason: Reason) => {
    const gross = st.btc * price;
    const fee = gross * RULES.feePct;
    const qty = st.btc;
    st.cash += gross - fee;
    const pnl = gross - fee - st.cost;
    st.btc = 0;
    fill = {
      t: c.t, side: "venda", price, qty, fee, cash: st.cash, btc: 0, equity: st.cash, pnl, reason,
      ind: { ...ind, stop: st.stop, close: c.c },
    };
    st.cost = st.entry = st.stop = st.peak = 0;
    st.cooldown = RULES.cooldown;
  };

  if (st.btc > 0) {
    if (c.l <= st.stop) sell(Math.min(st.stop, c.o), "stop"); // abriu abaixo do stop = vende na abertura
    else if (ind.emaF < ind.emaS) sell(c.c, "tendencia");
    else {
      st.peak = Math.max(st.peak, c.c);
      st.stop = Math.max(st.stop, st.peak * (1 - RULES.stopPct));
    }
  } else if (st.cooldown > 0) {
    st.cooldown--;
  } else if (ind.emaF > ind.emaS && c.c > ind.emaF && ind.rsi < RULES.rsiMax) {
    const spend = Math.min(st.cash, (st.cash * RULES.riskPct) / RULES.stopPct);
    const fee = spend * RULES.feePct;
    const qty = (spend - fee) / c.c;
    st.cash -= spend;
    st.btc = qty;
    st.cost = spend;
    st.entry = st.peak = c.c;
    st.stop = c.c * (1 - RULES.stopPct);
    fill = {
      t: c.t, side: "compra", price: c.c, qty, fee, cash: st.cash, btc: qty, equity: st.cash + qty * c.c, pnl: null,
      reason: "entrada", ind: { ...ind, stop: st.stop, close: c.c },
    };
  }
  const mark: Mark = { t: c.t, close: c.c, equity: st.cash + st.btc * c.c, inPos: st.btc > 0, ...ind };
  return { s: st, fill, mark };
}

export const REASON_TXT: Record<Reason, string> = {
  entrada: "Média de 20h acima da de 50h, preço acima da média curta e RSI abaixo de 70.",
  stop: "O preço tocou o stop de proteção.",
  tendencia: "A média de 20h cruzou para baixo da de 50h: a tendência de alta acabou.",
};

// ---------------------------------------------------------------- períodos (horário de Brasília, UTC-3)
export type Kind = "12h" | "dia" | "semana" | "mes";
export const KINDS: Kind[] = ["12h", "dia", "semana", "mes"];
const BRT = 3 * H;

export function periodOf(kind: Kind, t: number) {
  const d = new Date(t - BRT); // "relógio" de Brasília lido com getters UTC
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const day = d.getUTCDate();
  const p2 = (n: number) => String(n).padStart(2, "0");
  let start: number;
  let end: number;
  let key: string;
  if (kind === "12h") {
    const half = d.getUTCHours() < 12 ? 0 : 12;
    start = Date.UTC(y, mo, day, half) + BRT;
    end = start + 12 * H;
    key = `${y}-${p2(mo + 1)}-${p2(day)}-${half ? "tarde" : "manha"}`;
  } else if (kind === "dia") {
    start = Date.UTC(y, mo, day) + BRT;
    end = start + 24 * H;
    key = `${y}-${p2(mo + 1)}-${p2(day)}`;
  } else if (kind === "semana") {
    const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
    start = Date.UTC(y, mo, day - dow) + BRT;
    end = start + 7 * 24 * H;
    const s = new Date(start - BRT);
    key = `sem-${s.getUTCFullYear()}-${p2(s.getUTCMonth() + 1)}-${p2(s.getUTCDate())}`;
  } else {
    start = Date.UTC(y, mo, 1) + BRT;
    end = Date.UTC(y, mo + 1, 1) + BRT;
    key = `${y}-${p2(mo + 1)}`;
  }
  return { key, start, end };
}

