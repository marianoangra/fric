import { generateImage, generateText } from "ai";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { sql } from "./db";
import { MODEL } from "./models";

export const IMAGE_MODEL = process.env.FRIC_IMAGE_MODEL || "bfl/flux-2-klein-9b";
export const AVATAR_DAILY_LIMIT = 3;

const STYLE =
  "Photorealistic portrait photograph, head and shoulders, fully clothed, warm approachable expression with a slight smile, looking at the camera, " +
  "soft key light with gentle rim light, shallow depth of field, 85mm lens, subtle film grain, natural skin texture. No text, no logos, no watermark.";

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const AGES = ["early 20s", "late 20s", "early 30s", "late 30s", "40s", "50s", "60s"];
const LOOKS = [
  "Black Brazilian, dark skin",
  "mixed-race Brazilian (pardo), brown skin",
  "white Brazilian of Italian descent",
  "white Brazilian of Portuguese descent",
  "Japanese-Brazilian",
  "Brazilian of Lebanese descent, olive skin",
  "Indigenous Brazilian",
  "Brazilian of German descent, fair skin and light eyes",
  "Afro-Brazilian from Bahia, deep brown skin",
];
/** Gênero pelo nome em português: -a soa feminino, -o masculino; o resto é sorteado. */
function genderFor(name: string) {
  const words = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z]+/).filter((w) => w && w !== "ia");
  for (const w of words) {
    if (["rafa", "luca", "zeca", "juca", "bira", "caua", "joshua", "nikita"].includes(w)) return "man";
    if (/(a|inha|ina|ete|ice|is)$/.test(w)) return "woman";
    if (/(o|inho|on|or|el)$/.test(w)) return "man";
  }
  return pick(["woman", "man"]);
}
const HAIR = ["short", "long", "curly", "wavy", "straight", "braided", "shaved", "bun", "afro", "silver"];

/**
 * "Casting": o código sorteia gênero, idade e aparência (senão o modelo repete o mesmo rosto),
 * e uma IA de texto completa roupa, objeto e cenário coerentes com o negócio.
 */
async function castingPrompt(name: string, sells: string, color: string) {
  const traits = `${pick(AGES)} ${pick(LOOKS)} ${genderFor(name)} with ${pick(HAIR)} hair`;
  const { text } = await generateText({
    model: MODEL,
    instructions:
      "You write prompts for an image model that creates the face of a FICTIONAL person who will be the avatar of a small Brazilian business's AI. " +
      "The age, appearance, gender and hair are FIXED and must be stated exactly as given at the start of your sentence. " +
      "Then add everyday clothing that fits the business, one small prop or detail that fits the business, and a softly lit backdrop in the given brand color. " +
      "Output ONE English sentence, max 60 words. Never describe or resemble a real, famous or named person, even if the business text asks for it. " +
      "Nothing sexual, no minors, no brands, no text.",
    prompt: `Fixed traits: a ${traits}\nAI name: ${name}\nBusiness (Portuguese): ${sells}\nBrand color for the backdrop: ${color}`,
    maxOutputTokens: 3000, // o Gemini 2.5 gasta tokens "pensando" antes de escrever
  });
  // Os traços sorteados entram direto no prompt: se o texto vier curto, o rosto continua certo.
  return `Portrait of a ${traits}. ${text.trim().replace(/\s+/g, " ").slice(0, 500)} ${STYLE}`;
}

/** Gera o rosto da IA, sobe pro Blob e grava no agente. Retorna a URL. */
export async function generateAvatar(agentId: number) {
  const [a] = await sql`select id, slug, name, sells, color from agents where id = ${agentId}`;
  if (!a) throw new Error("IA não encontrada");

  const prompt = await castingPrompt(a.name, a.sells, a.color);
  const { image } = await generateImage({ model: IMAGE_MODEL, prompt, aspectRatio: "1:1" });
  const webp = await sharp(Buffer.from(image.uint8Array)).resize(640, 640, { fit: "cover" }).webp({ quality: 84 }).toBuffer();

  const blob = await put(`avatars/${a.slug}-${Date.now()}.webp`, webp, {
    access: "public",
    contentType: "image/webp",
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  await sql`update agents set avatar_url = ${blob.url} where id = ${a.id}`;
  return blob.url;
}

/** Limite diário por IA (o dono pode pedir outro rosto no painel). */
export async function claimAvatarSlot(agentId: number) {
  const rows = await sql`update agents set
      avatar_gens = case when avatar_gen_day = current_date then avatar_gens + 1 else 1 end,
      avatar_gen_day = current_date
    where id = ${agentId}
      and (avatar_gen_day is distinct from current_date or avatar_gens < ${AVATAR_DAILY_LIMIT})
    returning avatar_gens`;
  return rows.length > 0;
}

/** Preenche um rosto faltando (roda junto com as rodadas da comunidade). */
export async function backfillOneAvatar() {
  const [a] = await sql`select id from agents where avatar_url is null and active order by created_at limit 1`;
  if (!a) return null;
  if (!(await claimAvatarSlot(a.id))) return null;
  return generateAvatar(a.id);
}
