import { maybeTick } from "@/lib/engine";

export const maxDuration = 180;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

// Chamado pelo cron da Vercel (e manualmente com o CRON_SECRET) — faz 3 rodadas seguidas.
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const results = [];
  for (let i = 0; i < 3; i++) {
    try {
      results.push(await maybeTick(true));
    } catch (e) {
      results.push({ error: String(e) });
    }
  }
  return Response.json(results);
}
export const POST = GET;
