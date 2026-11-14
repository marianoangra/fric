"use client";
/**
 * Lote relâmpago — a Leila (IA rodando na rig do Rafael, via /api/leila) apresenta UM produto real
 * do Mercado Livre e tira dúvidas no chat. A compra acontece no Mercado Livre, pelo link de afiliado.
 *
 * Regras (ver docs/LEILA_HANDOFF.md §3): nada de lance, comprador, estoque ou urgência fictícios aqui.
 * O único relógio é a contagem real até o Natal.
 */
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Gift, SendHorizonal, Truck, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { Avatar, IA } from "./ui";
import { coverBg } from "@/lib/format";

const HOST = { name: "Leila", src: "/cast/c01.webp", color: "#FFC857" };

// dado editável: o preço muda no Mercado Livre, por isso a data de consulta aparece na tela
export const LOTE = {
  title: "Guirlanda de Natal 27 cm com laço",
  desc: "Festão verde com pontas brancas (efeito nevado) e laço vermelho. Artificial, sem luz, 1 unidade.",
  price: 19.9,
  from: 59.9,
  checkedAt: "14/11/2026",
  seller: "Loja oficial Eletrodey · +5 mil vendas · garantia de 90 dias",
  href: "https://meli.la/34jd969",
  img: null as string | null, // foto do produto, quando houver (public/lotes/...)
  color: "#3DDBB0",
  // vídeo da Leila apresentando o lote (feito pela IA de vídeo). null = página mostra só o avatar.
  // src: mp4 no Vercel Blob (lotes/<slug>.mp4) · poster: 1º quadro (jpg) · vtt: legenda PT (opcional)
  video: null as { src: string; poster?: string; vtt?: string } | null,
};

function LeilaVideo({ v }: { v: NonNullable<typeof LOTE.video> }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  return (
    <div className="lr-video">
      {/* autoplay só funciona mudo; a legenda carrega a mensagem até a pessoa ligar o som */}
      <video ref={ref} src={v.src} poster={v.poster} autoPlay muted={muted} loop playsInline preload="metadata">
        {v.vtt && <track kind="subtitles" src={v.vtt} srcLang="pt-BR" label="Português" default />}
      </video>
      <span className="lr-video-tag">Vídeo gerado por IA</span>
      <button
        type="button"
        className="lr-video-sound"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          const next = !muted;
          setMuted(next);
          el.muted = next;
          if (!next) {
            el.currentTime = 0;
            el.play().catch(() => {});
          }
        }}
      >
        {muted ? <><Volume2 size={16} aria-hidden /> Ouvir a Leila</> : <><VolumeX size={16} aria-hidden /> Sem som</>}
      </button>
    </div>
  );
}

// falas de abertura já prontas: aparecem na hora, sem esperar a rig
const INTRO = [
  "Lote relâmpago na mesa! Eu sou a Leila, uma IA, e hoje apresento uma coisa só.",
  "Guirlanda de Natal de 27 cm, verde nevado com laço vermelho. Compacta, cabe em porta de apartamento, mas mede antes!",
  "Tá R$ 19,90 com frete grátis no Mercado Livre, vendida pela loja oficial Eletrodey. Pergunta o que quiser aqui embaixo.",
];

const SUGGEST = ["É grande?", "É confiável?", "Chega antes do Natal?", "Serve pra parede?"];

const OFFLINE = "A Leila foi tomar um cafezinho, volta já! Enquanto isso, tudo sobre o lote está no anúncio do Mercado Livre.";
const BUSY = "Tem bastante gente falando com a Leila agora. Espera uns segundinhos e manda de novo?";

type Msg = { id: number; who: "leila" | "you"; text: string; pending?: boolean; intro?: boolean };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const off = Math.floor((1 - LOTE.price / LOTE.from) * 100);

function daysToXmas() {
  const now = new Date();
  const y = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
  const xmas = new Date(y, 11, 25);
  return Math.max(0, Math.ceil((xmas.getTime() - now.getTime()) / 86_400_000));
}

export function LoteRelampago() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [days, setDays] = useState<number | null>(null);
  const seq = useRef(0);
  const feed = useRef<HTMLDivElement>(null);

  // abertura roteirizada (instantânea) + status real da rig
  useEffect(() => {
    setDays(daysToXmas());
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = INTRO.map((t, i) =>
      window.setTimeout(() => setMsgs((m) => [...m, { id: ++seq.current, who: "leila", text: t, intro: true }]), reduced ? 0 : 500 + i * 1700),
    );
    let alive = true;
    const ping = () =>
      fetch("/api/leila", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { online?: boolean }) => alive && setStatus(j.online ? "online" : "offline"))
        .catch(() => alive && setStatus("offline"));
    ping();
    const iv = window.setInterval(ping, 60_000);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    const el = feed.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send(q: string) {
    const question = q.trim().slice(0, 300);
    if (!question || busy) return;
    setText("");
    setBusy(true);
    const mine: Msg = { id: ++seq.current, who: "you", text: question };
    const replyId = ++seq.current;
    // histórico real da conversa (sem as falas roteirizadas da abertura)
    const history = [...msgs.filter((m) => !m.intro), mine]
      .filter((m) => !m.pending && m.text)
      .slice(-6)
      .map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text }));
    setMsgs((m) => [...m, mine, { id: replyId, who: "leila", text: "", pending: true }]);
    const put = (t: string, pending = false) =>
      setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, text: t, pending } : x)));

    try {
      const r = await fetch("/api/leila", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!r.ok || !r.body) {
        if (r.status === 503 || r.status === 502) setStatus("offline");
        put(r.status === 429 || (await r.json().catch(() => ({}))).error === "busy" ? BUSY : OFFLINE);
        return;
      }
      setStatus("online");
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        if (acc.includes("\u0000offline")) {
          acc = "";
          break;
        }
        put(acc, true);
      }
      put(acc.trim() || OFFLINE);
      if (!acc.trim()) setStatus("offline");
    } catch {
      put(OFFLINE);
      setStatus("offline");
    } finally {
      setBusy(false);
    }
  }

  const waiting = msgs.some((m) => m.pending && !m.text);

  return (
    <>
      <section className="lei-stage" aria-label="Lote relâmpago">
        {LOTE.video && <LeilaVideo v={LOTE.video} />}
        <div className="lei-host">
          <div className={`lei-face${busy ? " on" : ""}`}>
            <Avatar name={HOST.name} color={HOST.color} src={HOST.src} size={92} ring live={status === "online"} eager />
          </div>
          <div className="lei-who">
            <b>{HOST.name}</b>
            <IA />
            <span className={`chip lr-status ${status}`}>
              <i aria-hidden />
              {status === "online" ? "online" : status === "offline" ? "volta já" : "conectando"}
            </span>
            <small>Apresentadora do Fric · IA rodando num computador próprio, não na nuvem</small>
          </div>
        </div>

        <div className="lei-lot">
          <div className="lei-art" style={LOTE.img ? undefined : { background: coverBg(LOTE.color) }}>
            {LOTE.img ? <img src={LOTE.img} alt="" /> : <Gift strokeWidth={1.8} aria-hidden />}
          </div>
          <div style={{ minWidth: 0 }}>
            <span className="n">Lote relâmpago</span>
            <h2>{LOTE.title}</h2>
            <p>{LOTE.desc}</p>
          </div>
        </div>

        <div className="lei-bid">
          <div className="lei-now">
            <div>
              <small>Preço no Mercado Livre</small>
              <div className="lei-price">{brl(LOTE.price)}</div>
              <span className="lr-from">
                <s>{brl(LOTE.from)}</s> · {off}% OFF
              </span>
            </div>
            <div className="lr-facts">
              <span><Truck size={14} aria-hidden /> Frete grátis</span>
              {days != null && <span><Gift size={14} aria-hidden /> {days === 0 ? "Hoje é Natal!" : `Faltam ${days} dias pro Natal`}</span>}
            </div>
          </div>
          <p className="lr-seller">
            <ShieldCheck size={14} aria-hidden /> {LOTE.seller}
          </p>
          <div className="lei-cta lr-cta">
            <a className="btn brand lg block" href={LOTE.href} target="_blank" rel="sponsored nofollow noopener">
              Arrematar no Mercado Livre <ExternalLink size={17} aria-hidden />
            </a>
            <small>
              Link de afiliado: o Fric pode ganhar uma comissão, sem custo extra pra você. Preço consultado em {LOTE.checkedAt} e
              pode mudar; vale o que estiver no Mercado Livre.
            </small>
          </div>
        </div>
      </section>

      <section className="lei-log" aria-label="Conversa com a Leila">
        <h3>
          Pergunte à Leila <span className="lr-hint">responde em uns 15 s</span>
        </h3>
        <div className="lei-feed lr-feed" ref={feed} role="log" aria-live="polite">
          {msgs.map((m) =>
            m.who === "leila" ? (
              <div key={m.id} className="lei-m ai">
                <Avatar name={HOST.name} color={HOST.color} src={HOST.src} size={28} />
                {m.pending && !m.text ? (
                  <p className="lr-typing">
                    <span className="lei-dots"><i /><i /><i /></span>
                    <span className="lr-sr">Leila está digitando…</span>
                  </p>
                ) : (
                  <p>
                    {m.text}
                    {m.pending && <span className="lei-caret" />}
                  </p>
                )}
              </div>
            ) : (
              <div key={m.id} className="lei-m lr-you">
                <p>{m.text}</p>
              </div>
            ),
          )}
        </div>
        {!msgs.some((m) => m.who === "you") && (
          <div className="lr-suggest">
            {SUGGEST.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="lr-form"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            placeholder={waiting ? "Leila está digitando…" : "Escreva sua pergunta"}
            aria-label="Sua pergunta para a Leila"
            enterKeyHint="send"
            autoComplete="off"
          />
          <button type="submit" className="btn brand" disabled={busy || !text.trim()} aria-label="Enviar">
            <SendHorizonal size={18} aria-hidden />
          </button>
        </form>
        <p className="lr-foot">A Leila é uma IA e pode errar. Não envie dados pessoais nem de pagamento.</p>
      </section>

      {/* botão fixo no celular: o CTA nunca some ao rolar o chat */}
      <div className="lr-sticky">
        <a className="btn brand lg block" href={LOTE.href} target="_blank" rel="sponsored nofollow noopener">
          Arrematar por {brl(LOTE.price)} <ExternalLink size={17} aria-hidden />
        </a>
      </div>
    </>
  );
}
