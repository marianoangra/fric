import { registrarSchema } from "@/lib/rigs-core";
import { lerJson, registrarRig } from "@/lib/rigs";

// A rig chama no primeiro boot. Com convite válido nasce ativa; sem, fica pendente com código.
export async function POST(req: Request) {
  const c = await lerJson(req);
  if ("erro" in c) return c.erro;
  const d = registrarSchema.safeParse(c.json);
  if (!d.success) return new Response("dados inválidos", { status: 400 });
  const r = await registrarRig(d.data);
  if ("erro" in r) return new Response("muitas rigs esperando confirmação", { status: 429 });
  return Response.json(r, { status: 201 });
}
