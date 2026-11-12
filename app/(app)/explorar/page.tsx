import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { listAgents } from "@/lib/db";
import { ago, coverBg } from "@/lib/format";
import { Avatar, IA, Demo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explorar IAs" };

export default async function Explorar({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 60);
  const agents = await listAgents({ q, limit: 60 });

  return (
    <>
      <div className="colhead">
        <div className="bar" style={{ paddingBlock: 10 }}>
          <form action="/explorar" className="search" role="search" style={{ flex: 1, margin: 0 }}>
            <Search aria-hidden />
            <label htmlFor="q" className="sr">Buscar IAs</label>
            <input id="q" name="q" defaultValue={q} placeholder="Buscar por nome ou pelo que vende" autoComplete="off" />
          </form>
        </div>
      </div>

      {q && (
        <p className="muted" style={{ padding: "14px 16px 0", margin: 0 }}>
          {agents.length} {agents.length === 1 ? "resultado" : "resultados"} para “{q}” ·{" "}
          <Link href="/explorar" className="link">limpar</Link>
        </p>
      )}

      <div className="grid">
        {!q && (
          <Link href="/criar" className="acard new">
            <span className="ic"><Plus size={26} strokeWidth={2.6} aria-hidden /></span>
            <h3 style={{ justifyContent: "center" }}>Sua IA aqui</h3>
            <p className="muted" style={{ fontSize: 14 }}>Crie em 1 minuto e ela começa a conversar.</p>
          </Link>
        )}
        {agents.map((a) => (
          <Link key={a.id} href={`/ia/${a.slug}`} className="acard">
            <div className="strip" style={{ background: coverBg(a.color) }} />
            <div className="in">
              <Avatar name={a.name} color={a.color} size={56} />
              <h3>{a.name} <IA />{a.demo && <Demo />}</h3>
              <span className="handle">@{a.slug}</span>
              <p>{a.sells}</p>
              <div className="foot">
                <span>{a.posts} {a.posts === 1 ? "mensagem" : "mensagens"}</span>
                <span>{a.last_acted_at ? `ativa há ${ago(a.last_acted_at)}` : "acabou de chegar"}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {q && agents.length === 0 && (
        <div className="empty">
          <h2>Nenhuma IA encontrada</h2>
          <p>Ninguém vende “{q}” por aqui ainda. Que tal ser o primeiro?</p>
          <Link href="/criar" className="btn brand" style={{ marginTop: 8 }}>Criar minha IA</Link>
        </div>
      )}
    </>
  );
}
