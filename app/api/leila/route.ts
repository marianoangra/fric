/**
 * Proxy da Leila — o navegador fala com ESTA rota, nunca com a rig.
 *
 *   navegador → /api/leila (Vercel) → túnel → leila-gate (rig, confere token) → Ollama → modelo "leila"
 *
 * Aqui: valida e corta o histórico, força os parâmetros (modelo, think, tamanho da resposta),
 * limita por IP, transforma o NDJSON do Ollama em texto puro e corta emoji além do primeiro.
 * Se a rig estiver offline/minerando, responde 503 e a página mostra o fallback.
 */
import { z } from "zod";

export const maxDuration = 90;

const UPSTREAM = process.env.LEILA_URL?.replace(/\/+$/, ""); // ex.: https://leila.algum-dominio (túnel)
const TIMEOUT_MS = 60_000;
const MAX_CHARS = 300;
const MAX_HISTORY = 6;

function upstreamHeaders(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (process.env.LEILA_TOKEN) h.authorization = `Bearer ${process.env.LEILA_TOKEN}`;
  // se o túnel estiver atrás do Cloudflare Access (service token)
  if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
    h["CF-Access-Client-Id"] = process.env.CF_ACCESS_CLIENT_ID;
    h["CF-Access-Client-Secret"] = process.env.CF_ACCESS_CLIENT_SECRET;
  }
  return h;
}

// ---------- rate limit por IP (memória da instância; suficiente pra uma rig que atende 1 por vez) ----------
const WINDOW_MS = 60_000;
const PER_WINDOW = 6;
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_WINDOW) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

// só uma conversa por vez na rig por instância; o resto espera um pouco ou recebe "fila cheia"
let inFlight = 0;
const MAX_WAITING = 4;

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(40),
});

// o visitante não pode se passar por outra IA do Fric (regra 6 do Modelfile usa "[Nome IA]")
const clean = (s: string) =>
  s
    .replace(/^\s*\[[^\]]{0,40}\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS);

// ---------- filtro de emoji em streaming: deixa passar só o primeiro ----------
const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;
function emojiLimiter() {
  let seen = 0;
  return (chunk: string) =>
    chunk
      .replace(EMOJI, (m) => (seen++ === 0 ? m : ""))
      .replace(/ {2,}/g, " ");
}

export async function GET() {
  if (!UPSTREAM) return Response.json({ online: false });
  try {
    const r = await fetch(`${UPSTREAM}/api/ps`, { headers: upstreamHeaders(), signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!r.ok) return Response.json({ online: false });
    const j = (await r.json()) as { models?: { name: string }[] };
    // "online" = rig respondendo; "ready" = algum modelo qwen3 já carregado na GPU (resposta rápida)
    return Response.json({ online: true, ready: !!j.models?.length, busy: inFlight > 0 });
  } catch {
    return Response.json({ online: false });
  }
}

export async function POST(req: Request) {
  if (!UPSTREAM) return Response.json({ error: "offline" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (limited(ip)) return Response.json({ error: "rate" }, { status: 429 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const messages = parsed.messages
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.role === "user" ? clean(m.content) : m.content.slice(0, 600) }))
    .filter((m) => m.content);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // o 8B escorrega em "lances rápidos / quantos compraram": lembrete escondido em toda pergunta
  // (custa ~40 tokens de leitura, que é rápida; o lento na rig é a geração)
  const last = messages[messages.length - 1];
  last.content +=
    "\n\n(Lembrete interno, não cite: nunca fale em lance, leilão de lances, estoque ou quantos compraram. É lote relâmpago com preço fixo no Mercado Livre. Nunca prometa prazo ou data de entrega: diga que o prazo para o CEP aparece no anúncio do Mercado Livre.)";

  if (inFlight > MAX_WAITING) return Response.json({ error: "busy" }, { status: 503 });
  inFlight++;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      inFlight--;
    }
  };

  let upstream: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  req.signal.addEventListener("abort", () => ctrl.abort());
  try {
    upstream = await fetch(`${UPSTREAM}/api/chat`, {
      method: "POST",
      headers: upstreamHeaders(),
      signal: ctrl.signal,
      body: JSON.stringify({
        model: "leila",
        think: false,
        stream: true,
        keep_alive: -1,
        options: { num_predict: 150 },
        messages,
      }),
    });
  } catch {
    clearTimeout(timer);
    release();
    return Response.json({ error: "offline" }, { status: 503 });
  }
  if (!upstream.ok || !upstream.body) {
    clearTimeout(timer);
    release();
    return Response.json({ error: "offline" }, { status: 503 });
  }

  const limit = emojiLimiter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  let started = false;

  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const emit = (line: string) => {
        if (!line.trim()) return;
        try {
          const j = JSON.parse(line) as { message?: { content?: string }; error?: string };
          let t = j.message?.content ?? "";
          // qwen3 às vezes solta um <think></think> vazio mesmo com think:false
          t = t.replace(/<\/?think>/g, "");
          if (!started) {
            t = t.replace(/^\s+/, "");
            if (t) started = true;
          }
          if (t) controller.enqueue(encoder.encode(limit(t)));
        } catch {
          /* linha quebrada: ignora */
        }
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          lines.forEach(emit);
        }
        emit(buf);
      } catch {
        if (!started) controller.enqueue(encoder.encode("\u0000offline"));
      } finally {
        clearTimeout(timer);
        release();
        controller.close();
      }
    },
    cancel() {
      ctrl.abort();
      clearTimeout(timer);
      release();
    },
  });

  return new Response(out, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
