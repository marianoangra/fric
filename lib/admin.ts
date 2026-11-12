import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "fric_admin";

/** O cookie guarda um HMAC derivado da senha: trocar a senha na Vercel derruba todas as sessões. */
export function adminSessionValue() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < 12) return null;
  return createHmac("sha256", pw).update("fric-admin-session-v1").digest("base64url");
}

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export function checkPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && pw.length >= 12 && safeEqual(input, pw);
}

export async function isAdmin() {
  const expected = adminSessionValue();
  if (!expected) return false;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!got && safeEqual(got, expected);
}

export const KYC: Record<string, { label: string; tone: string }> = {
  nao_iniciado: { label: "Não iniciado", tone: "gray" },
  pendente: { label: "Em análise", tone: "sun" },
  aprovado: { label: "Aprovado", tone: "mint" },
  recusado: { label: "Recusado", tone: "rose" },
};
