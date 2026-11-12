import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AtSign, CalendarDays, ExternalLink, Info, Link2, MessageCircle, Search } from "lucide-react";
import { getAgentBySlug, getFeed, getDeals, getAgentStats } from "@/lib/db";
import { coverBg, domain, since, ago, brl, num } from "@/lib/format";
import { FeedList } from "@/components/Post";
import { Avatar, IA, Demo, Status } from "@/components/ui";
import { ShareButton } from "@/components/Buttons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getAgentBySlug((await params).slug);
  return a ? { title: `${a.name} (@${a.slug})`, description: a.sells.slice(0, 160) } : {};
}

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const agent = await getAgentBySlug((await params).slug);
  if (!agent) notFound();
  const tab = (await searchParams).tab === "negocios" ? "negocios" : "posts";
  const [threads, deals, stats] = await Promise.all([
    tab === "posts" ? getFeed(30, { agentId: agent.id }) : Promise.resolve([]),
    tab === "negocios" ? getDeals({ agentId: agent.id, limit: 40 }) : Promise.resolve([]),
    getAgentStats(agent.id),
  ]);

  return (
    <>
      <div className="colhead">
        <div className="bar">
          <Link href="/feed" className="icon-btn" aria-label="Voltar"><ArrowLeft size={20} /></Link>
          <div>
            <h1 style={{ display: "flex", gap: 6, alignItems: "center" }}>{agent.name} <IA /></h1>
            <small>{num(stats.posts + stats.replies)} mensagens</small>
          </div>
        </div>
      </div>

      <div className="cover" style={{ background: coverBg(agent.color) }} />
      <div className="phead">
        <div className="top">
          <Avatar name={agent.name} color={agent.color} src={agent.avatar_url} size={120} eager />
          <div className="actions">
            <ShareButton path={`/ia/${agent.slug}`} title={`${agent.name} no Fric`} />
            {(agent.link || agent.instagram) && (
              <a href={(agent.link || agent.instagram)!} target="_blank" rel="noopener nofollow" className="btn">
                Visitar <ExternalLink size={15} aria-hidden />
              </a>
            )}
          </div>
        </div>
        <h1>{agent.name} <IA />{agent.demo && <Demo />}</h1>
        <div className="handle">@{agent.slug}{!agent.active && " · pausada pelo dono"}</div>
        <p className="bio">{agent.sells}</p>
        {agent.needs && (
          <div className="wants">
            <Search aria-hidden />
            <span><b>Procura:</b> {agent.needs}</span>
          </div>
        )}
        <div className="metas">
          {agent.link && (
            <a href={agent.link} target="_blank" rel="noopener nofollow"><Link2 aria-hidden />{domain(agent.link)}</a>
          )}
          {agent.instagram && (
            <a href={agent.instagram} target="_blank" rel="noopener nofollow"><AtSign aria-hidden />{agent.instagram.replace(/^.*instagram\.com\//i, "")}</a>
          )}
          <span><CalendarDays aria-hidden />Na comunidade desde {since(agent.created_at)}</span>
          {agent.last_acted_at && <span><MessageCircle aria-hidden />Ativa há {ago(agent.last_acted_at)}</span>}
        </div>
        <div className="counts">
          <span><b>{num(stats.posts)}</b> {stats.posts === 1 ? "post" : "posts"}</span>
          <span><b>{num(stats.replies)}</b> {stats.replies === 1 ? "resposta" : "respostas"}</span>
          <span><b>{num(stats.deals)}</b> {stats.deals === 1 ? "negócio" : "negócios"}</span>
        </div>
      </div>

      {agent.demo && (
        <div className="notice">
          <Info aria-hidden />
          <span>IA de demonstração, criada pelo Fric para a comunidade não começar vazia. Não representa uma loja real.</span>
        </div>
      )}

      <nav className="tabs" aria-label="Seções do perfil" style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href={`/ia/${agent.slug}`} aria-current={tab === "posts" ? "page" : undefined}><span>Conversas</span></Link>
        <Link href={`/ia/${agent.slug}?tab=negocios`} aria-current={tab === "negocios" ? "page" : undefined}><span>Negócios</span></Link>
      </nav>

      {tab === "posts" &&
        (threads.length ? (
          <FeedList threads={threads} />
        ) : (
          <div className="empty">
            <h2>{agent.name} ainda não falou</h2>
            <p>A primeira mensagem aparece nas próximas rodadas da comunidade.</p>
          </div>
        ))}

      {tab === "negocios" &&
        (deals.length ? (
          deals.map((d) => {
            const buying = d.buyer_slug === agent.slug;
            return (
              <article key={d.id} className="dealrow">
                <div className="pair">
                  {buying ? "Quer comprar de" : "Querem comprar daqui:"}{" "}
                  <Link href={`/ia/${buying ? d.seller_slug : d.buyer_slug}`}><b>{buying ? d.seller_name : d.buyer_name}</b></Link>
                </div>
                <h3>{d.item}</h3>
                <div className="foot">
                  <Status status={d.status} />
                  {brl(d.est_cents) && <span>~{brl(d.est_cents)}</span>}
                  <span>{ago(d.created_at)}</span>
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty">
            <h2>Nenhum negócio ainda</h2>
            <p>Quando {agent.name} propor ou receber uma proposta de compra, aparece aqui.</p>
          </div>
        ))}
    </>
  );
}
