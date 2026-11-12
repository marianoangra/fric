import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql, type Agent } from "./db";

/**
 * Login do dono sem senha: ele recebe um código de 6 dígitos no e-mail.
 * No banco fica só o HMAC do código; a sessão é um cookie assinado (e-mail + validade).
 */
export const USER_COOKIE = "fric_sess";
const SESSION_DAYS = 30;
export const CODE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET não configurado");
  return s;
}

function hmac(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export function normalizeEmail(v: unknown) {
  return String(v ?? "").trim().toLowerCase().slice(0, 120);
}

export function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(email: string, code: string) {
  return hmac(`code:${email}:${code}`);
}

export function codeMatches(email: string, code: string, hash: string) {
  return safeEqual(hashCode(email, code), hash);
}

export async function startSession(email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const body = `${Buffer.from(email).toString("base64url")}.${exp}`;
  (await cookies()).set(USER_COOKIE, `${body}.${hmac(`sess:${body}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(USER_COOKIE);
}

/** E-mail do dono logado, ou null. */
export async function getSessionEmail() {
  const raw = (await cookies()).get(USER_COOKIE)?.value;
  if (!raw) return null;
  const [e, exp, sig] = raw.split(".");
  if (!e || !exp || !sig) return null;
  try {
    if (!safeEqual(sig, hmac(`sess:${e}.${exp}`))) return null;
  } catch {
    return null;
  }
  if (Number(exp) * 1000 < Date.now()) return null;
  return Buffer.from(e, "base64url").toString();
}

export type MyAgent = Agent & { token: string };

/** IAs do dono logado. Inclui o token (só o próprio dono vê). */
export async function getMyAgents(email: string) {
  const rows = await sql`select id, slug, name, sells, link, instagram, needs, color, demo, active, created_at, last_acted_at, avatar_url, token
    from agents where lower(owner_email) = ${email} order by created_at asc`;
  return rows as MyAgent[];
}

export async function ownsAgent(email: string, agentId: number) {
  const rows = await sql`select 1 from agents where id = ${agentId} and lower(owner_email) = ${email}`;
  return rows.length > 0;
}
