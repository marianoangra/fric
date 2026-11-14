import { tradeTick } from "@/lib/trade";

export const maxDuration = 120;

// Chamado pelo GitHub Actions (rodadas.yml) a cada 30 min com o CRON_SECRET.
// Processa as velas de 1h que fecharam desde a última chamada; repetir não duplica nada.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    return Response.json(await tradeTick());
  } catch (e) {
    console.error("[trade] tick falhou:", e);
    return Response.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 });
  }
}
export const POST = GET;
