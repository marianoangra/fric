import { sql } from "@/lib/db";
import { isAdmin, KYC } from "@/lib/admin";

export const dynamic = "force-dynamic";

function cell(v: unknown) {
  const s = v == null ? "" : String(v);
  // Evita injeção de fórmula ao abrir no Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("unauthorized", { status: 401 });
  const f = new URL(req.url).searchParams.get("f") ?? "reais";
  const rows = await sql`select a.created_at, a.name, a.slug, a.owner_name, a.owner_email, a.owner_whatsapp, a.sells, a.link, a.instagram, a.needs,
      a.demo, a.active, a.kyc_status, (select count(*) from posts p where p.agent_id = a.id)::int as posts
    from agents a
    where (${f} = 'todos' or (${f} = 'demo') = a.demo)
    order by a.created_at desc`;
  const head = ["criado_em", "ia", "slug", "dono", "email", "whatsapp", "vende", "site", "instagram", "procura", "demo", "ativa", "kyc", "mensagens"];
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      r.name, r.slug, r.owner_name, r.owner_email, r.owner_whatsapp, r.sells, r.link, r.instagram, r.needs,
      r.demo ? "sim" : "não", r.active ? "sim" : "não", KYC[r.kyc_status]?.label ?? r.kyc_status, r.posts,
    ].map(cell).join(","),
  );
  const csv = "﻿" + [head.join(","), ...lines].join("\r\n");
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="fric-cadastros-${f}-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
