// Núcleo puro das rigs: sem next, sem banco. Testado com `npm test`.
import { createHash, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";

export const TIPOS_COMANDO = ["pausar", "retomar", "reiniciar_guardia", "reiniciar_rig", "ver_log"] as const;
export type TipoComando = (typeof TIPOS_COMANDO)[number];

export const LIMITE_BYTES = 8192;
export const ONLINE_S = 180;
export const COMANDO_VALIDO_S = 600;
export const PENDENTE_EXPIRA_H = 24;
export const MAX_PENDENTES = 5;
export const CONVITE_DIAS = 7;

const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function hashSegredo(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function gerarCodigo(): string {
  const c = (n: number) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  return `${c(2)}-${c(3)}`;
}

export function gerarConvite(): string {
  return randomBytes(32).toString("base64url");
}

const num = z.number().finite().nullable();
const txt = (max: number) => z.string().max(max);

export const pulsoSchema = z.object({
  versao: txt(40),
  uptime_s: z.number().finite().nonnegative(),
  gpu: z.object({ temp_c: num, uso_pct: num, vram_usada_mb: num }).nullable(),
  cpu: z.object({ temp_c: num, carga_1m: num }),
  ollama: z.object({
    ok: z.boolean(),
    modelos_carregados: z.array(z.object({ nome: txt(80), vram_mb: num })).max(10),
  }),
  guardia: z.object({
    servico: txt(20),
    pausada: z.boolean(),
    ts_ultimo_ciclo: txt(40).nullable(),
    postura: txt(20).nullable(),
    cor: txt(20).nullable(),
    motivo: txt(500).nullable(),
    pct_protegido: num,
    margem: num,
  }).nullable(),
  leila: z.object({ gate_ok: z.boolean() }),
  instalacao: z.object({
    etapa: txt(40),
    ok: z.boolean().nullable(),
    erro: txt(500).nullable(),
    saida: txt(4000).nullable(),
  }).nullable().optional(),
  // Botão Terminal no /admin: só endereço do Tailscale (rig comprometida não vira link de phishing).
  // Endereço inválido vira null em vez de derrubar o pulso inteiro.
  terminal_url: z.string().max(200).regex(/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.ts\.net\/?$/).nullable().optional().catch(null),
});
export type Pulso = z.infer<typeof pulsoSchema>;

export const resultadoSchema = z.object({
  comando_id: z.number().int().positive(),
  ok: z.boolean(),
  texto: z.string().max(8000),
});

export const registrarSchema = z.object({
  segredo: z.string().min(32).max(200),
  convite: z.string().max(200).optional(),
  nome_sugerido: z.string().min(1).max(40),
  versao: txt(40),
});

export function estaOnline(vistoEm: Date | null, agora: Date): boolean {
  return !!vistoEm && agora.getTime() - vistoEm.getTime() <= ONLINE_S * 1000;
}

export function comandoValido(criadoEm: Date, agora: Date): boolean {
  return agora.getTime() - criadoEm.getTime() <= COMANDO_VALIDO_S * 1000;
}
