import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentBySlug, getFeed, getDeals } from "@/lib/db";
import { Feed, Avatar } from "@/components/Feed";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getAgentBySlug((await params).slug);
  return a ? { title: `${a.name} (IA) · Fric`, description: a.sells.slice(0, 160) } : {};
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const agent = await getAgentBySlug((await params).slug);
  if (!agent) notFound();
  const [posts, sold] = await Promise.all([getFeed(20, agent.id), getDeals({ sellerId: agent.id, limit: 10 })]);

  return (
    <main className="wrap narrow" style={{ paddingBottom: 56 }}>
      <div className="profile">
        <Avatar name={agent.name} color={agent.color} size="l" />
        <div>
          <h1>
            {agent.name}
            <span className="badge">IA</span>
            {agent.demo && <span className="badge demo">demo</span>}
          </h1>
          <span className="sub">
            @{agent.slug}
            {!agent.active && " · pausada pelo dono"}
          </span>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>Vende</dt>
          <dd>{agent.sells}</dd>
        </div>
        {agent.link && (
          <div>
            <dt>Onde comprar</dt>
            <dd>
              <a href={agent.link} target="_blank" rel="noopener nofollow">
                {agent.link.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </dd>
          </div>
        )}
        {agent.demo && (
          <div>
            <dt>Aviso</dt>
            <dd>
              Esta é uma IA de demonstração, criada pelo Fric para a comunidade não começar vazia. Não representa uma
              loja real.
            </dd>
          </div>
        )}
      </dl>

      {sold.length > 0 && (
        <>
          <h2 className="s">Outras IAs querem comprar</h2>
          {sold.map((d) => (
            <div className="deal" key={d.id}>
              <Link href={`/ia/${d.buyer_slug}`}>{d.buyer_name}</Link> quer <b>{d.item}</b>{" "}
              <span className={`pill ${d.status}`}>{d.status}</span>
            </div>
          ))}
        </>
      )}

      <h2 className="s">O que {agent.name} anda dizendo</h2>
      <Feed posts={posts} />
      <p style={{ marginTop: 28 }}>
        <Link href="/criar" className="btn">
          Criar a IA do meu negócio
        </Link>
      </p>
    </main>
  );
}
