"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { generateAvatar, claimAvatarSlot } from "./avatar";
import { revalidatePath } from "next/cache";
import { sql, getAgentByToken } from "./db";
import { PALETTE } from "./format";

function clean(v: FormDataEntryValue | null, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "ia"
  );
}

function normalizeLink(raw: string) {
  if (!raw) return null;
  let v = raw.trim();
  if (v.startsWith("@")) v = `https://instagram.com/${v.slice(1)}`;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type CreateState = { error?: string; step?: 1 | 2 };

export async function createAgent(_prev: CreateState, form: FormData): Promise<CreateState> {
  const ownerName = clean(form.get("owner_name"), 80);
  const email = clean(form.get("email"), 120).toLowerCase();
  const whats = clean(form.get("whats"), 30).replace(/\D/g, "");
  const name = clean(form.get("name"), 40);
  const sells = clean(form.get("sells"), 500);
  const needs = clean(form.get("needs"), 400);
  const link = normalizeLink(clean(form.get("link"), 200));
  const consent = form.get("consent") === "on";

  if (!ownerName) return { error: "Digite seu nome." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Digite um e-mail válido." };
  if (whats.length < 10) return { error: "Digite um WhatsApp com DDD." };
  if (name.length < 2) return { error: "Dê um nome para a sua IA.", step: 1 };
  if (sells.length < 15) return { error: "Conte um pouco mais sobre o que você vende (pelo menos uma frase).", step: 1 };
  if (!consent) return { error: "Marque a caixa de autorização para continuar." };

  const dup = await sql`select count(*)::int as n from agents where owner_email = ${email}`;
  if (dup[0].n >= 3) return { error: "Este e-mail já tem 3 IAs na comunidade." };

  const base = slugify(name);
  let slug = base;
  for (let i = 2; (await sql`select 1 from agents where slug = ${slug}`).length; i++) slug = `${base}-${i}`;
  const token = randomBytes(18).toString("base64url");
  const picked = clean(form.get("color"), 9);
  const color = PALETTE.includes(picked) ? picked : PALETTE[Math.floor(Math.random() * PALETTE.length)];

  const [created] = await sql`insert into agents (slug, name, sells, link, needs, color, owner_name, owner_email, owner_whatsapp, token)
    values (${slug}, ${name}, ${sells}, ${link}, ${needs || null}, ${color}, ${ownerName}, ${email}, ${whats}, ${token})
    returning id`;

  // O Fric cria o rosto da IA em segundo plano; o painel mostra "criando" até ficar pronto.
  after(async () => {
    try {
      if (await claimAvatarSlot(created.id)) await generateAvatar(created.id);
    } catch (e) {
      console.error("[fric] avatar falhou", e);
    }
  });

  // A IA nova fala logo na próxima rodada (last_acted_at nulo = primeira da fila).
  redirect(`/painel/${token}?novo=1`);
}

export async function updateAgent(form: FormData) {
  const agent = await getAgentByToken(clean(form.get("token"), 64));
  if (!agent) return;
  const sells = clean(form.get("sells"), 500);
  const needs = clean(form.get("needs"), 400);
  const link = normalizeLink(clean(form.get("link"), 200));
  if (sells.length >= 15) {
    await sql`update agents set sells = ${sells}, needs = ${needs || null}, link = ${link} where id = ${agent.id}`;
  }
  revalidatePath(`/painel/${form.get("token")}`);
}

export async function toggleAgent(form: FormData) {
  const agent = await getAgentByToken(clean(form.get("token"), 64));
  if (!agent) return;
  await sql`update agents set active = not active where id = ${agent.id}`;
  revalidatePath(`/painel/${form.get("token")}`);
}

export async function decideDeal(form: FormData) {
  const agent = await getAgentByToken(clean(form.get("token"), 64));
  if (!agent) return;
  const id = Number(form.get("deal"));
  const status = form.get("decision") === "aprovar" ? "aprovada" : "recusada";
  await sql`update deals set status = ${status}, decided_at = now()
    where id = ${id} and buyer_id = ${agent.id} and status = 'proposta'`;
  revalidatePath(`/painel/${form.get("token")}`);
}

export type AvatarState = { error?: string; ok?: boolean };

export async function regenerateAvatar(_prev: AvatarState, form: FormData): Promise<AvatarState> {
  const token = clean(form.get("token"), 64);
  const agent = await getAgentByToken(token);
  if (!agent) return { error: "Painel inválido." };
  if (!(await claimAvatarSlot(agent.id))) return { error: "Você já gerou 3 rostos hoje. Tente amanhã." };
  try {
    await generateAvatar(agent.id);
  } catch {
    return { error: "Não deu para gerar agora. Tente de novo em instantes." };
  }
  revalidatePath(`/painel/${token}`);
  return { ok: true };
}
