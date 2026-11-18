import "server-only";
import type { z } from "zod";
import { sql } from "./db";
import {
  COMANDO_VALIDO_S, gerarCodigo, hashSegredo, LIMITE_BYTES, MAX_PENDENTES, PENDENTE_EXPIRA_H,
  type Pulso, type registrarSchema, type resultadoSchema,
} from "./rigs-core";

export type EstadoRig = "pendente" | "ativa" | "recusada";

// ---------- HTTP (rotas da rig) ----------

/** Lê o corpo com limite de tamanho. Devolve o JSON ou uma Response de erro pronta. */
export async function lerJson(req: Request): Promise<{ json: unknown } | { erro: Response }> {
  const texto = await req.text();
  if (Buffer.byteLength(texto) > LIMITE_BYTES) return { erro: new Response("grande demais", { status: 413 }) };
  try {
    return { json: JSON.parse(texto) };
  } catch {
    return { erro: new Response("json inválido", { status: 400 }) };
  }
}

export function segredoDoHeader(req: Request): string | null {
  const m = /^Bearer (.{32,200})$/.exec(req.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

/** Rig dona do segredo, se existir e não estiver recusada. */
export async function rigPorSegredo(segredo: string | null): Promise<{ id: number; estado: EstadoRig } | null> {
  if (!segredo) return null;
  const [r] = await sql`select id, estado from rigs where segredo_hash = ${hashSegredo(segredo)} and estado <> 'recusada'`;
  return (r as { id: number; estado: EstadoRig } | undefined) ?? null;
}

export async function registrarRig(
  d: z.infer<typeof registrarSchema>,
): Promise<{ rig_id: number; estado: EstadoRig; codigo: string | null } | { erro: "muitas_pendentes" }> {
  await sql`delete from rigs where estado = 'pendente' and criada_em < now() - make_interval(hours => ${PENDENTE_EXPIRA_H})`;
  const hash = hashSegredo(d.segredo);

  const [existe] = await sql`select id, estado, codigo from rigs where segredo_hash = ${hash}`;
  if (existe) {
    return { rig_id: existe.id, estado: existe.estado, codigo: existe.estado === "pendente" ? existe.codigo : null };
  }

  if (d.convite) {
    const [conv] = await sql`update rig_convites set usado_em = now()
      where hash = ${hashSegredo(d.convite)} and usado_em is null and expira_em > now() returning id`;
    if (conv) {
      const [r] = await sql`insert into rigs (nome, segredo_hash, estado, versao, confirmada_em)
        values (${d.nome_sugerido}, ${hash}, 'ativa', ${d.versao}, now()) returning id`;
      return { rig_id: r.id, estado: "ativa", codigo: null };
    }
  }

  const [{ n }] = await sql`select count(*)::int as n from rigs where estado = 'pendente'`;
  if (n >= MAX_PENDENTES) return { erro: "muitas_pendentes" };
  const codigo = gerarCodigo();
  const [r] = await sql`insert into rigs (nome, segredo_hash, codigo, estado, versao)
    values (${d.nome_sugerido}, ${hash}, ${codigo}, 'pendente', ${d.versao}) returning id`;
  return { rig_id: r.id, estado: "pendente", codigo };
}

/** Grava o status e, se a rig estiver ativa, entrega (uma vez só) os comandos ainda válidos. */
export async function gravarPulso(rig: { id: number; estado: EstadoRig }, status: Pulso) {
  await sql`update rigs set ultimo_status = ${JSON.stringify(status)}::jsonb, visto_em = now(), versao = ${status.versao}
    where id = ${rig.id}`;
  if (rig.estado !== "ativa") return [];
  const rows = await sql`update rig_comandos set entregue_em = now()
    where rig_id = ${rig.id} and entregue_em is null
      and criado_em > now() - make_interval(secs => ${COMANDO_VALIDO_S})
    returning id, tipo`;
  return (rows as { id: number; tipo: string }[]).sort((a, b) => a.id - b.id);
}

export async function gravarResultado(rigId: number, r: z.infer<typeof resultadoSchema>): Promise<boolean> {
  const rows = await sql`update rig_comandos set ok = ${r.ok}, resultado = ${r.texto}, concluido_em = now()
    where id = ${r.comando_id} and rig_id = ${rigId} returning id`;
  return rows.length > 0;
}
