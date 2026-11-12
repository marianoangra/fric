"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { sendLoginCode } from "./email";
import { notifyBuyerSellerOk } from "./notify";
import {
  CODE_MINUTES,
  MAX_ATTEMPTS,
  codeMatches,
  endSession,
  getSessionEmail,
  hashCode,
  isEmail,
  newCode,
  normalizeEmail,
  ownsAgent,
  startSession,
} from "./auth";

export type LoginState = { step?: "email" | "code"; email?: string; error?: string; info?: string };

const GENERIC = "Se esse e-mail tiver uma IA no Fric, o código chega em até 1 minuto. Olhe também o spam.";

export async function requestCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = normalizeEmail(form.get("email"));
  if (!isEmail(email)) return { step: "email", error: "Digite um e-mail válido." };

  // Limites: 1 código a cada 45 s e no máximo 5 por hora para o mesmo e-mail.
  const [lim] = await sql`select
      count(*) filter (where created_at > now() - interval '1 hour')::int as hour,
      count(*) filter (where created_at > now() - interval '45 seconds')::int as recent
    from login_codes where email = ${email}`;
  if (lim.recent > 0) return { step: "code", email, info: "Acabamos de mandar um código. Espere alguns segundos para pedir outro." };
  if (lim.hour >= 5) return { step: "email", email, error: "Muitos pedidos de código. Tente de novo daqui a uma hora." };

  // Não dizemos se o e-mail tem IA ou não (ninguém descobre quem é dono de quê).
  const [has] = await sql`select count(*)::int as n from agents where lower(owner_email) = ${email}`;
  if (has.n > 0) {
    const code = newCode();
    await sql`insert into login_codes (email, code_hash, expires_at)
      values (${email}, ${hashCode(email, code)}, now() + make_interval(mins => ${CODE_MINUTES}))`;
    const ok = await sendLoginCode(email, code);
    if (!ok) return { step: "email", email, error: "Não conseguimos mandar o e-mail agora. Tente de novo em instantes." };
  } else {
    // Registra a tentativa para o limite valer igual, sem código válido.
    await sql`insert into login_codes (email, code_hash, expires_at, used) values (${email}, '-', now(), true)`;
  }
  return { step: "code", email, info: GENERIC };
}

export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = normalizeEmail(form.get("email"));
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!isEmail(email)) return { step: "email", error: "Digite seu e-mail de novo." };
  if (code.length !== 6) return { step: "code", email, error: "O código tem 6 números." };

  const [row] = await sql`select id, code_hash, attempts from login_codes
    where email = ${email} and not used and expires_at > now()
    order by created_at desc limit 1`;
  if (!row) return { step: "code", email, error: "Código expirado ou inválido. Peça um novo." };
  if (row.attempts >= MAX_ATTEMPTS) return { step: "code", email, error: "Tentativas demais. Peça um código novo." };

  if (!codeMatches(email, code, row.code_hash)) {
    await sql`update login_codes set attempts = attempts + 1 where id = ${row.id}`;
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return { step: "code", email, error: left > 0 ? `Código errado. Você tem mais ${left} ${left === 1 ? "tentativa" : "tentativas"}.` : "Tentativas demais. Peça um código novo." };
  }

  await sql`update login_codes set used = true where email = ${email} and not used`;
  await startSession(email);
  redirect("/minha-ia");
}

export async function logout() {
  await endSession();
  redirect("/entrar");
}

async function mine(form: FormData) {
  const email = await getSessionEmail();
  const agentId = Number(form.get("agent"));
  if (!email || !agentId || !(await ownsAgent(email, agentId))) return null;
  return agentId;
}

export async function decideDealMine(form: FormData) {
  const agentId = await mine(form);
  if (!agentId) return;
  const status = form.get("decision") === "aprovar" ? "aprovada" : "recusada";
  await sql`update deals set status = ${status}, decided_at = now()
    where id = ${Number(form.get("deal"))} and buyer_id = ${agentId} and status = 'proposta'`;
  revalidatePath("/minha-ia");
}

/** Dono da IA vendedora responde ao interesse de outra IA. */
export async function respondInterestMine(form: FormData) {
  const agentId = await mine(form);
  if (!agentId) return;
  const resp = form.get("decision") === "ok" ? "ok" : "nao";
  const rows = await sql`update deals set seller_response = ${resp}, seller_responded_at = now()
    where id = ${Number(form.get("deal"))} and seller_id = ${agentId} and seller_response is null
    returning id`;
  if (rows[0] && resp === "ok") await notifyBuyerSellerOk(rows[0].id).catch(() => {});
  revalidatePath("/minha-ia");
}

export async function toggleMine(form: FormData) {
  const agentId = await mine(form);
  if (!agentId) return;
  await sql`update agents set active = not active where id = ${agentId}`;
  revalidatePath("/minha-ia");
}
