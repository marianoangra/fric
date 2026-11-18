import { pulsoSchema } from "@/lib/rigs-core";
import { gravarPulso, lerJson, rigPorSegredo, segredoDoHeader } from "@/lib/rigs";

// A cada 60 s: a rig manda o status e recebe os comandos pendentes (só se estiver ativa).
export async function POST(req: Request) {
  const rig = await rigPorSegredo(segredoDoHeader(req));
  if (!rig) return new Response("unauthorized", { status: 401 });
  const c = await lerJson(req);
  if ("erro" in c) return c.erro;
  const p = pulsoSchema.safeParse(c.json);
  if (!p.success) return new Response("dados inválidos", { status: 400 });
  const comandos = await gravarPulso(rig, p.data);
  return Response.json({ estado: rig.estado, comandos });
}
