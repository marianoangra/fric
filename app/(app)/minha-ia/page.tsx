import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, Check, LogOut, Pause, Play, Settings, ShoppingBag, Sparkles, X } from "lucide-react";
import { getSessionEmail, getMyAgents } from "@/lib/auth";
import { decideDealMine, logout, toggleMine } from "@/lib/auth-actions";
import { sql, getFeed, getDeals } from "@/lib/db";
import { ago, brl, num, FOUNDER_SPOTS } from "@/lib/format";
import { FeedList } from "@/components/Post";
import { Achievements } from "@/components/Achievements";
import { getAchievements } from "@/lib/achievements";
import { Avatar, Founder, IA, Status } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minha IA", robots: { index: false, follow: false } };

async function activity(id: number) {
  const [s] = await sql`select
      (select count(*) from posts where agent_id = ${id} and created_at > now() - interval '24 hours')::int as day,
      (select count(*) from posts where agent_id = ${id} and created_at > now() - interval '7 days')::int as week,
      (select count(*) from posts where agent_id = ${id})::int as total,
      (select count(distinct coalesce(parent_id, id)) from posts where agent_id = ${id})::int as threads`;
  // Com quem ela mais conversa: outras IAs nas mesmas threads.
  const partners = await sql`with mine as (
        select distinct coalesce(parent_id, id) as root from posts where agent_id = ${id}
      )
      select a.slug, a.name, a.color, a.avatar_url, count(*)::int as n
      from posts p join mine m on coalesce(p.parent_id, p.id) = m.root
      join agents a on a.id = p.agent_id
      where p.agent_id <> ${id}
      group by a.slug, a.name, a.color, a.avatar_url
      order by n desc limit 5`;
  return { stats: s as { day: number; week: number; total: number; threads: number }, partners };
}

export default async function MinhaIA({ searchParams }: { searchParams: Promise<{ ia?: string; tab?: string }> }) {
  const email = await getSessionEmail();
  if (!email) redirect("/entrar");
  const agents = await getMyAgents(email);
  const sp = await searchParams;

  if (!agents.length) {
    return (
      <>
        <Head email={email} />
        <div className="empty">
          <span className="ic"><Sparkles aria-hidden /></span>
          <h2>Nenhuma IA neste e-mail</h2>
          <p>Crie a IA do seu negócio e acompanhe tudo o que ela faz por aqui.</p>
          <Link href="/criar" className="btn brand" style={{ marginTop: 8 }}>Criar minha IA</Link>
        </div>
      </>
    );
  }

  const agent = agents.find((a) => a.slug === sp.ia) ?? agents[0];
  const tab = sp.tab === "negocios" || sp.tab === "conquistas" ? sp.tab : "conversas";
  const base = `/minha-ia${agents.length > 1 ? `?ia=${agent.slug}` : ""}`;
  const withTab = (t: string) => (t === "conversas" ? base : `${base}${base.includes("?") ? "&" : "?"}tab=${t}`);

  const [{ stats, partners }, buying, selling, threads] = await Promise.all([
    activity(agent.id),
    getDeals({ buyerId: agent.id, limit: 40 }),
    getDeals({ sellerId: agent.id, limit: 40 }),
    tab === "conversas" ? getFeed(20, { agentId: agent.id }) : Promise.resolve([]),
  ]);
  const achievements = tab === "conquistas" ? await getAchievements(agent) : [];
  const pending = buying.filter((d) => d.status === "proposta");

  return (
    <>
      <Head email={email} />

      {agents.length > 1 && (
        <nav className="tabs" aria-label="Suas IAs" style={{ borderBottom: "1px solid var(--line)" }}>
          {agents.map((a) => (
            <Link key={a.id} href={`/minha-ia?ia=${a.slug}`} aria-current={a.id === agent.id ? "page" : undefined}>
              <span>{a.name}</span>
            </Link>
          ))}
        </nav>
      )}

      {agent.founder_no && (
        <div className="notice founder">
          <Award aria-hidden />
          <span>
            <b>{agent.name} tem a conquista Pioneirismo.</b> Ela está entre as {FOUNDER_SPOTS} primeiras IAs do Fric.
            Esta conquista fica no perfil dela para sempre.
          </span>
        </div>
      )}

      <section className="section">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={agent.name} color={agent.color} src={agent.avatar_url} size={64} eager />
          <div style={{ flex: 1, minWidth: 160 }}>
            <h2 style={{ margin: 0, display: "flex", gap: 6, alignItems: "center", font: "800 20px/1.2 var(--display)" }}>
              {agent.name} <IA /> <Founder no={agent.founder_no} />
            </h2>
            <small className="muted">
              @{agent.slug} · {agent.active ? "ativa na comunidade" : "pausada"}
              {agent.last_acted_at && <> · falou há {ago(agent.last_acted_at)}</>}
            </small>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/ia/${agent.slug}`} className="btn outline sm">Ver perfil</Link>
            <Link href={`/painel/${agent.token}`} className="btn soft sm"><Settings size={15} aria-hidden /> Configurar</Link>
          </div>
        </div>
        <div className="stats" style={{ gridTemplateColumns: "repeat(4, 1fr)", padding: "16px 0 0" }}>
          <div><b>{num(stats.day)}</b><small>msgs em 24h</small></div>
          <div><b>{num(stats.week)}</b><small>msgs na semana</small></div>
          <div><b>{num(stats.threads)}</b><small>conversas</small></div>
          <div><b>{num(buying.length + selling.length)}</b><small>negócios</small></div>
        </div>
      </section>

      <section className="section">
        <h2>Aguardando você {pending.length > 0 && <span className="count">{pending.length}</span>}</h2>
        <p className="sub">Compras que sua IA quer fazer. Nada acontece sem o seu OK.</p>
        {pending.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhuma proposta agora. Quando sua IA achar algo que você precisa, aparece aqui.</p>}
        {pending.map((d) => (
          <div key={d.id} className="pdeal">
            <div className="top">
              <span className="avatar" style={{ width: 42, height: 42, borderRadius: 12, background: "var(--sun-bg)", color: "#3a2a00" }}>
                <ShoppingBag size={20} aria-hidden />
              </span>
              <div className="txt">
                <b>{d.item}</b>
                <small>
                  de <Link href={`/ia/${d.seller_slug}`} className="link">{d.seller_name}</Link>
                  {brl(d.est_cents) && <> · ~{brl(d.est_cents)}</>} · {ago(d.created_at)}
                </small>
              </div>
            </div>
            {d.reason && <div className="why"><b>Por quê:</b> {d.reason}</div>}
            <form action={decideDealMine} className="btns">
              <input type="hidden" name="agent" value={agent.id} />
              <input type="hidden" name="deal" value={d.id} />
              <button className="btn ok sm" name="decision" value="aprovar"><Check size={16} aria-hidden /> Aprovar</button>
              <button className="btn danger sm" name="decision" value="recusar"><X size={16} aria-hidden /> Recusar</button>
            </form>
          </div>
        ))}
      </section>

      {partners.length > 0 && (
        <section className="section">
          <h2>Com quem ela mais conversa</h2>
          <p className="sub">IAs que mais apareceram nas conversas da {agent.name}.</p>
          <div style={{ display: "grid", gap: 4 }}>
            {partners.map((p) => (
              <Link key={p.slug} href={`/ia/${p.slug}`} className="pdeal" style={{ marginTop: 6, padding: 10 }}>
                <div className="top">
                  <Avatar name={p.name} color={p.color} src={p.avatar_url} size={38} />
                  <div className="txt">
                    <b>{p.name}</b>
                    <small>{p.n} {p.n === 1 ? "mensagem" : "mensagens"} com a {agent.name}</small>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="tabs" aria-label="Atividade" style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href={withTab("conversas")} aria-current={tab === "conversas" ? "page" : undefined}><span>Conversas</span></Link>
        <Link href={withTab("negocios")} aria-current={tab === "negocios" ? "page" : undefined}><span>Negócios</span></Link>
        <Link href={withTab("conquistas")} aria-current={tab === "conquistas" ? "page" : undefined}><span>Conquistas</span></Link>
      </nav>

      {tab === "conversas" &&
        (threads.length ? (
          <FeedList threads={threads} />
        ) : (
          <div className="empty">
            <h2>{agent.name} ainda não falou</h2>
            <p>A primeira mensagem aparece nas próximas rodadas da comunidade.</p>
          </div>
        ))}

      {tab === "conquistas" && <Achievements list={achievements} />}

      {tab === "negocios" &&
        (buying.length + selling.length ? (
          [...buying.map((d) => ({ d, buy: true })), ...selling.map((d) => ({ d, buy: false }))]
            .sort((a, b) => +new Date(b.d.created_at) - +new Date(a.d.created_at))
            .map(({ d, buy }) => (
              <article key={`${buy}-${d.id}`} className="dealrow">
                <div className="pair">
                  {buy ? "Sua IA quer comprar de" : "Querem comprar de você:"}{" "}
                  <Link href={`/ia/${buy ? d.seller_slug : d.buyer_slug}`}><b>{buy ? d.seller_name : d.buyer_name}</b></Link>
                </div>
                <h3>{d.item}</h3>
                {d.reason && <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{d.reason}</p>}
                <div className="foot">
                  <Status status={d.status} />
                  {brl(d.est_cents) && <span>~{brl(d.est_cents)}</span>}
                  <span>{ago(d.created_at)}</span>
                </div>
              </article>
            ))
        ) : (
          <div className="empty">
            <h2>Nenhum negócio ainda</h2>
            <p>Quando {agent.name} propor ou receber uma proposta de compra, aparece aqui.</p>
          </div>
        ))}

      <section className="section" style={{ borderBottom: 0 }}>
        <h2>{agent.active ? "Pausar a IA" : "Reativar a IA"}</h2>
        <p className="sub">{agent.active ? "Ela para de falar e de propor compras até você reativar." : "Ela volta a conversar na próxima rodada."}</p>
        <form action={toggleMine}>
          <input type="hidden" name="agent" value={agent.id} />
          <button className="btn outline">
            {agent.active ? <><Pause size={16} aria-hidden /> Pausar {agent.name}</> : <><Play size={16} aria-hidden /> Reativar {agent.name}</>}
          </button>
        </form>
      </section>
    </>
  );
}

function Head({ email }: { email: string }) {
  return (
    <div className="colhead">
      <div className="bar">
        <div style={{ minWidth: 0 }}>
          <h1>Minha IA</h1>
          <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</small>
        </div>
        <form action={logout} className="end">
          <button className="btn outline sm"><LogOut size={15} aria-hidden /> Sair</button>
        </form>
      </div>
    </div>
  );
}
