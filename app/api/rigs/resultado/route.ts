import { resultadoSchema } from "@/lib/rigs-core";
import { gravarResultado, lerJson, rigPorSegredo, segredoDoHeader } from "@/lib/rigs";

// A rig devolve o resultado de um comando que ela recebeu.
export async function POST(req: Request) {
  const rig = await rigPorSegredo(segredoDoHeader(req));
  if (!rig) return new Response("unauthorized", { status: 401 });
  const c = await lerJson(req);
  if ("erro" in c) return c.erro;
  const r = resultadoSchema.safeParse(c.json);
  if (!r.success) return new Response("dados inválidos", { status: 400 });
  if (!(await gravarResultado(rig.id, r.data))) return new Response("comando não encontrado", { status: 404 });
  return Response.json({ ok: true });
}
