"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import { ADMIN_COOKIE, adminSessionValue, checkPassword, isAdmin, KYC } from "./admin";
import { CONVITE_DIAS, gerarConvite, hashSegredo, TIPOS_COMANDO } from "./rigs-core";

export async function adminLogin(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  // Atraso fixo deixa chute de senha lento.
  await new Promise((r) => setTimeout(r, 600));
  if (!checkPassword(String(form.get("password") ?? ""))) return { error: "Senha incorreta." };
  (await cookies()).set(ADMIN_COOKIE, adminSessionValue()!, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin");
}

export async function adminToggleAgent(form: FormData) {
  if (!(await isAdmin())) return;
  await sql`update agents set active = not active where id = ${Number(form.get("id"))}`;
  revalidatePath("/admin");
}

export async function adminSetKyc(form: FormData) {
  if (!(await isAdmin())) return;
  const status = String(form.get("kyc"));
  if (!(status in KYC)) return;
  await sql`update agents set kyc_status = ${status}, kyc_updated_at = now() where id = ${Number(form.get("id"))}`;
  revalidatePath("/admin");
}

// ---------- Rigs ----------

export async function adminNovoConvite(): Promise<{ convite?: string }> {
  if (!(await isAdmin())) return {};
  const convite = gerarConvite();
  await sql`insert into rig_convites (hash, expira_em)
    values (${hashSegredo(convite)}, now() + make_interval(days => ${CONVITE_DIAS}))`;
  return { convite };
}

export async function adminConfirmarRig(form: FormData) {
  if (!(await isAdmin())) return;
  await sql`update rigs set estado = 'ativa', confirmada_em = now(), codigo = null
    where id = ${Number(form.get("id"))} and estado = 'pendente'`;
  revalidatePath("/admin");
}

export async function adminRecusarRig(form: FormData) {
  if (!(await isAdmin())) return;
  await sql`update rigs set estado = 'recusada' where id = ${Number(form.get("id"))} and estado = 'pendente'`;
  revalidatePath("/admin");
}

/** Remover = recusar: o segredo daquela instalação nunca mais vale. */
export async function adminRemoverRig(form: FormData) {
  if (!(await isAdmin())) return;
  await sql`update rigs set estado = 'recusada' where id = ${Number(form.get("id"))}`;
  revalidatePath("/admin");
}

export async function adminComandoRig(form: FormData) {
  if (!(await isAdmin())) return;
  const tipo = String(form.get("tipo"));
  if (!(TIPOS_COMANDO as readonly string[]).includes(tipo)) return;
  await sql`insert into rig_comandos (rig_id, tipo)
    select id, ${tipo} from rigs where id = ${Number(form.get("id"))} and estado = 'ativa'`;
  revalidatePath("/admin");
}
