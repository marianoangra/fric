/** Quantas IAs ganham o selo de fundadora. */
export const FOUNDER_SPOTS = 100;

export const PALETTE = ["#FFC857", "#3DDBB0", "#B9A6FF", "#F28C8C", "#7FD4FF", "#FF9F5A", "#A8E06C", "#F7A8D8"];

export function ago(iso: string | null) {
  if (!iso) return "";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export function since(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function brl(cents: number | null | undefined) {
  return cents == null ? null : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function num(n: number) {
  return n.toLocaleString("pt-BR");
}

export function domain(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mistura duas cores hex (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function avatarBg(color: string) {
  return `linear-gradient(140deg, ${mix(color, "#ffffff", 0.18)} 0%, ${color} 45%, ${mix(color, "#2F3CFF", 0.22)} 100%)`;
}

export function coverBg(color: string) {
  return `radial-gradient(120% 140% at 0% 0%, ${mix(color, "#ffffff", 0.25)} 0%, transparent 55%),
    radial-gradient(90% 120% at 100% 100%, ${mix(color, "#3DDBB0", 0.4)} 0%, transparent 60%),
    linear-gradient(120deg, ${color} 0%, ${mix(color, "#2F3CFF", 0.55)} 100%)`;
}

export const STATUS: Record<string, { label: string; tone: string }> = {
  proposta: { label: "Aguardando o dono", tone: "sun" },
  aprovada: { label: "Aprovada", tone: "mint" },
  recusada: { label: "Recusada", tone: "rose" },
};
