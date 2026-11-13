"use client";
/**
 * Leilão Beta — SIMULAÇÃO. Roteiro roda só no navegador: a apresentadora é um avatar de IA fictício,
 * os lances dos outros participantes são inventados aqui e nada é vendido, gravado ou cobrado.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, Camera, Palette, Gavel, Timer } from "lucide-react";
import { Avatar, IA } from "./ui";
import { coverBg, PALETTE } from "@/lib/format";

const HOST = { name: "Leila", src: "/cast/c01.webp", color: "#FFC857" };

type Lot = { title: string; desc: string; pitch: [string, string]; start: number; step: number; Icon: LucideIcon; color: string };

const LOTS: Lot[] = [
  {
    title: "Robô articulado impresso em 3D",
    desc: "Peça única de 28 cm, 22 articulações, pintada à mão.",
    pitch: [
      "Um robô impresso em 3D, camada por camada, com 22 articulações: ele faz qualquer pose.",
      "A pintura é feita à mão, então não existe outro igual a este.",
    ],
    start: 80,
    step: 10,
    Icon: Bot,
    color: "#B9A6FF",
  },
  {
    title: "Câmera analógica dos anos 80",
    desc: "Revisada, com lente 50 mm e um filme de 36 poses de brinde.",
    pitch: [
      "Uma câmera de filme dos anos 80, revisada por um técnico, com lente de 50 milímetros.",
      "E vem com um filme de 36 poses pra sair fotografando no mesmo dia.",
    ],
    start: 250,
    step: 20,
    Icon: Camera,
    color: "#FFC857",
  },
  {
    title: "Quadro original em acrílica, 60 × 90 cm",
    desc: "Pintura assinada, pronta para pendurar, com certificado.",
    pitch: [
      "Uma tela original de 60 por 90, pintada em acrílica e assinada pelo artista.",
      "Ela chega pronta pra pendurar, com certificado de autenticidade.",
    ],
    start: 300,
    step: 25,
    Icon: Palette,
    color: "#3DDBB0",
  },
];

type Who = { name: string; city: string; f: boolean; color: string; you?: boolean };
type Bidder = Who & { max: number };

const PEOPLE: Who[] = [
  ["Marina", "Recife", true],
  ["Caio", "Belo Horizonte", false],
  ["Júlia", "Curitiba", true],
  ["Bruno", "Porto Alegre", false],
  ["Letícia", "Salvador", true],
  ["Diego", "Goiânia", false],
  ["Paula", "Florianópolis", true],
  ["Tiago", "Manaus", false],
  ["Bia", "São Paulo", true],
  ["Renato", "Fortaleza", false],
].map(([name, city, f], i) => ({ name: name as string, city: city as string, f: f as boolean, color: PALETTE[i % PALETTE.length] }));

const YOU: Who = { name: "Você", city: "", f: false, color: "#7FD4FF", you: true };

type Msg =
  | { id: number; k: "ai"; text: string }
  | { id: number; k: "bid"; who: Who; v: number }
  | { id: number; k: "sys"; text: string };
type Say = { text: string; key?: "bid" | "call" };
type Phase = "intro" | "open" | "sold" | "break";

type Sim = {
  t: number;
  lot: number;
  phase: Phase;
  price: number | null;
  leader: Who | null;
  bids: number;
  endsAt: number;
  uma: boolean;
  duas: boolean;
  extended: boolean;
  bidders: Bidder[];
  nextBot: number;
  queue: Say[];
  speaking: { text: string; at: number; key?: Say["key"] } | null;
  idleUntil: number;
  breakUntil: number;
  last: string;
  log: Msg[];
  seq: number;
  bump: number;
  reduced: boolean;
};

// tempos em ms (relógio da simulação só anda com a aba visível)
const TICK = 50;
const CHAR = 28; // velocidade da "escrita"
const DOTS = 650; // "digitando…" antes de cada fala
const GAP = 450; // respiro entre falas
const OPEN = 30_000; // janela inicial de lances
const SNIPE = 10_000; // lance no fim estica o relógio pra isso
const UMA = 8_000;
const DUAS = 4_000;
const BREAK = 6_000;
const MAX_LOG = 60;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const reais = (v: number) => "R$ " + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const da = (w: Who) => (w.f ? "da" : "do");

function newSim(): Sim {
  return {
    t: 0, lot: 0, phase: "intro", price: null, leader: null, bids: 0, endsAt: 0,
    uma: false, duas: false, extended: false, bidders: [], nextBot: Infinity,
    queue: [], speaking: null, idleUntil: 0, breakUntil: 0, last: "", log: [], seq: 0, bump: 0, reduced: false,
  };
}

type NoId<T> = T extends unknown ? Omit<T, "id"> : never;

function log(s: Sim, m: NoId<Msg>) {
  s.log.push({ ...m, id: ++s.seq } as Msg);
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

function say(s: Sim, text: string, key?: Say["key"]) {
  // reação a lance velho perde a vez: só a mais recente fica na fila
  if (key === "bid") s.queue = s.queue.filter((q) => q.key !== "bid");
  s.queue.push({ text, key });
}

function startLot(s: Sim, lot: number, first: boolean) {
  const L = LOTS[lot];
  Object.assign(s, { lot, phase: "intro", price: null, leader: null, bids: 0, uma: false, duas: false, extended: false, nextBot: Infinity });
  const crowd = [...PEOPLE].sort(() => Math.random() - 0.5).slice(0, randInt(3, 4));
  s.bidders = crowd.map((p) => ({ ...p, max: L.start + L.step * randInt(3, 11) }));
  log(s, { k: "sys", text: `Lote ${lot + 1} de ${LOTS.length}` });
  say(
    s,
    first
      ? "Oi, eu sou a Leila, uma IA, e hoje sou eu que apresento o leilão. É uma simulação: os lances são fictícios e ninguém paga nada."
      : pick(["Bora pro próximo!", "Próximo lote, gente!", "Segura que vem coisa boa agora."]),
  );
  say(s, `Lote ${lot + 1}! ${L.pitch[0]}`);
  say(s, L.pitch[1]);
  say(s, `Lance inicial: ${reais(L.start)}. Está valendo!`);
}

function placeBid(s: Sim, who: Who, v: number) {
  const L = LOTS[s.lot];
  const prev = s.leader;
  s.price = v;
  s.leader = who;
  s.bids++;
  s.bump++;
  log(s, { k: "bid", who, v });
  // "dou-lhe uma" ficou velho: sai da fila e, se ela estava no meio da frase, é interrompida
  s.queue = s.queue.filter((q) => q.key !== "call");
  if (s.speaking?.key === "call") {
    s.speaking = null;
    s.idleUntil = s.t + 150;
  }
  s.uma = s.duas = false;
  if (s.endsAt - s.t < SNIPE) {
    s.endsAt = s.t + SNIPE;
    if (!s.extended) {
      s.extended = true;
      log(s, { k: "sys", text: "Lance nos últimos segundos estica o relógio" });
    }
  }
  const val = reais(v);
  const next = reais(v + L.step);
  let line: string;
  if (who.you) {
    line = pick([`Lance seu! ${val}, e por enquanto o lote é seu.`, `Olha você aí: ${val}! Quem cobre?`, `${val} vindo de você! Alguém dá ${next}?`]);
  } else if (prev?.you) {
    line = pick([`${who.name} passou você: ${val}. Vai deixar?`, `Ih! ${who.name}, de ${who.city}, cobriu seu lance: ${val}.`]);
  } else if (s.bids === 1) {
    line = `Primeiro lance! ${val} ${da(who)} ${who.name}, de ${who.city}.`;
  } else {
    line = pick([
      `${val} ${da(who)} ${who.name}, de ${who.city}! Quem dá ${next}?`,
      `${who.name} cobriu: ${val}. Alguém vai deixar barato assim?`,
      `Lance novo! ${val}, ${who.name} de ${who.city}.`,
      `Subiu pra ${val}! O próximo lance é ${next}.`,
      `Agora é ${who.name} na frente, com ${val}.`,
    ]);
  }
  say(s, line, "bid");
}

function step(s: Sim) {
  // fala: "digitando…" → texto letra a letra → vai pro histórico
  if (s.speaking) {
    if (s.t >= s.speaking.at + (s.reduced ? 0 : s.speaking.text.length * CHAR)) {
      log(s, { k: "ai", text: s.speaking.text });
      s.last = s.speaking.text;
      s.speaking = null;
      s.idleUntil = s.t + GAP;
    }
  } else if (s.queue.length && s.t >= s.idleUntil) {
    const q = s.queue.shift()!;
    s.speaking = { text: q.text, at: s.t + (s.reduced ? 0 : DOTS), key: q.key };
  }
  const quiet = !s.speaking && s.queue.length === 0;
  const L = LOTS[s.lot];

  switch (s.phase) {
    case "intro":
      if (quiet) {
        s.phase = "open";
        s.endsAt = s.t + OPEN;
        s.nextBot = s.t + rand(1500, 3500);
      }
      break;
    case "open": {
      if (s.t >= s.nextBot) {
        const need = s.price == null ? L.start : s.price + L.step;
        const cands = s.bidders.filter((b) => b.max >= need && b !== s.leader);
        if (cands.length) {
          const b = pick(cands);
          placeBid(s, b, Math.random() < 0.2 && b.max >= need + L.step ? need + L.step : need);
          s.nextBot = s.t + rand(2200, 5500);
        } else s.nextBot = Infinity;
      }
      const left = s.endsAt - s.t;
      if (s.leader && s.price != null) {
        if (left <= UMA && !s.uma) {
          s.uma = true;
          say(s, `Dou-lhe uma… ${reais(s.price)} para ${s.leader.you ? "você" : s.leader.name}!`, "call");
        }
        if (left <= DUAS && !s.duas) {
          s.duas = true;
          say(s, "Dou-lhe duas…", "call");
        }
      }
      if (left <= 0) {
        s.phase = "sold";
        const w = s.leader;
        if (w && s.price != null) {
          say(
            s,
            w.you
              ? `Vendido para você por ${reais(s.price)}! Lembrando: é uma simulação, nada foi cobrado.`
              : `Vendido! ${reais(s.price)} ${da(w)} ${w.name}, de ${w.city}. Parabéns!`,
          );
          log(s, { k: "sys", text: `Arrematado por ${reais(s.price)} · ${w.you ? "você" : w.name}` });
        } else {
          say(s, "Ninguém deu lance desta vez. O lote volta pro vendedor.");
        }
        say(s, "Já já começa o próximo lote.");
      }
      break;
    }
    case "sold":
      if (quiet) {
        s.phase = "break";
        s.breakUntil = s.t + BREAK;
      }
      break;
    case "break":
      if (s.t >= s.breakUntil) startLot(s, (s.lot + 1) % LOTS.length, false);
      break;
  }
}

function clock(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function Auction() {
  const ref = useRef<Sim | null>(null);
  if (!ref.current) ref.current = newSim();
  const [, render] = useState(0);
  const feed = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const seen = useRef(0);

  useEffect(() => {
    const s = newSim(); // recomeça limpo (inclusive no remount do modo estrito)
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current = s;
    startLot(s, 0, true);
    render((n) => n + 1);
    const id = window.setInterval(() => {
      if (document.hidden) return;
      s.t += TICK;
      step(s);
      render((n) => n + 1);
    }, TICK);
    return () => window.clearInterval(id);
  }, []);

  const s = ref.current!;

  useLayoutEffect(() => {
    const el = feed.current;
    if (el && s.seq !== seen.current) {
      seen.current = s.seq;
      if (stick.current) el.scrollTop = el.scrollHeight;
    }
  });

  const L = LOTS[s.lot];
  const need = s.price == null ? L.start : s.price + L.step;
  const left = s.phase === "open" ? Math.max(0, s.endsAt - s.t) : s.phase === "intro" ? OPEN : 0;
  const typing = s.speaking && s.t < s.speaking.at;
  const shown = s.speaking && !typing ? s.speaking.text.slice(0, Math.floor((s.t - s.speaking.at) / CHAR) + 1) : null;
  const leader = s.leader;
  const canBid = s.phase === "open" && !leader?.you;

  function bidNow() {
    if (!canBid) return;
    placeBid(s, YOU, need);
    s.nextBot = s.t + rand(2500, 5000); // dá tempo de ver a reação antes de alguém cobrir
    render((n) => n + 1);
  }

  return (
    <>
      <section className="lei-stage" aria-label="Palco do leilão">
        <div className="lei-host">
          <div className={`lei-face${s.speaking ? " on" : ""}`}>
            <Avatar name={HOST.name} color={HOST.color} src={HOST.src} size={92} ring live eager />
          </div>
          <div className="lei-who">
            <b>{HOST.name}</b>
            <IA />
            <span className="chip">apresentadora</span>
            <small>Leiloeira virtual do Fric · rosto gerado por IA</small>
          </div>
          <div className="lei-say" aria-hidden>
            {typing ? (
              <span className="lei-dots"><i /><i /><i /></span>
            ) : shown != null ? (
              <>
                {shown}
                <span className="lei-caret" />
              </>
            ) : (
              s.last || <span className="lei-dots"><i /><i /><i /></span>
            )}
          </div>
        </div>

        <div className="lei-lot">
          <div className="lei-art" style={{ background: coverBg(L.color) }}>
            <L.Icon strokeWidth={1.8} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="n">Lote {s.lot + 1} de {LOTS.length}</span>
            <h2>{L.title}</h2>
            <p>{L.desc}</p>
          </div>
        </div>

        <div className="lei-bid">
          <div className="lei-now">
            <div>
              <small>{s.price == null ? "Lance inicial" : s.phase === "open" ? "Lance atual" : "Arrematado por"}</small>
              <div key={s.bump} className={`lei-price${s.bump ? " bump" : ""}`}>{reais(s.price ?? L.start)}</div>
            </div>
            <div className="lei-lead">
              {leader ? (
                <>
                  <Avatar name={leader.name} color={leader.color} size={24} />
                  <span>
                    {leader.you ? <b>Você está na frente</b> : <><b>{leader.name}</b> · {leader.city}</>}
                  </span>
                </>
              ) : (
                <span className="muted">{s.phase === "intro" ? "Abre já já" : "Ninguém deu lance ainda"}</span>
              )}
            </div>
          </div>

          <div className="lei-clock">
            <div className="row">
              <span><Timer size={14} aria-hidden /> {s.phase === "intro" ? "Começa depois da apresentação" : s.phase === "open" ? "Encerra em" : "Encerrado"}</span>
              <b>{clock(left)}</b>
            </div>
            <div className={`lei-bar${s.phase === "open" && left <= DUAS ? " end" : s.phase === "open" && left <= SNIPE ? " hot" : ""}`}>
              <i style={{ width: `${Math.min(100, (left / OPEN) * 100)}%` }} />
            </div>
            <div className="row">
              <span>{s.bids} {s.bids === 1 ? "lance" : "lances"}</span>
              <span>Próximo: {reais(need)}</span>
            </div>
          </div>

          <div className="lei-cta">
            <button type="button" className="btn brand lg block" onClick={bidNow} disabled={!canBid}>
              <Gavel size={19} aria-hidden />
              {s.phase === "intro"
                ? "Aguarde o lance inicial"
                : s.phase === "open"
                  ? leader?.you
                    ? "Você está na frente"
                    : `Dar lance de ${reais(need)}`
                  : "Lote encerrado"}
            </button>
            <small>Simulação: seu lance não é real e nada é cobrado.</small>
          </div>
        </div>
      </section>

      <section className="lei-log" aria-label="Acontecendo no leilão">
        <h3>
          Acontecendo agora <span className="live-dot">simulação</span>
        </h3>
        <div
          className="lei-feed"
          ref={feed}
          role="log"
          aria-live="polite"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          }}
        >
          {s.log.map((m) =>
            m.k === "ai" ? (
              <div key={m.id} className="lei-m ai">
                <Avatar name={HOST.name} color={HOST.color} src={HOST.src} size={28} />
                <p>{m.text}</p>
              </div>
            ) : m.k === "bid" ? (
              <div key={m.id} className={`lei-m bid${m.who.you ? " you" : ""}`}>
                <Avatar name={m.who.name} color={m.who.color} size={28} />
                <span>
                  <b>{m.who.name}</b>
                  {m.who.city && <> · {m.who.city}</>} deu lance
                </span>
                <span className="v">{reais(m.v)}</span>
              </div>
            ) : (
              <div key={m.id} className="lei-m sys">{m.text}</div>
            ),
          )}
        </div>
      </section>
    </>
  );
}
