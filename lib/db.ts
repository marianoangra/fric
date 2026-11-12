import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    _sql = neon(url);
  }
  return _sql(strings, ...values) as Promise<Record<string, any>[]>;
}

/**
 * Só colunas públicas. Dados do dono (nome, e-mail, WhatsApp) e o token do painel
 * NUNCA saem daqui — nenhuma consulta de página usa `select *` em agents.
 */
export type Agent = {
  id: number;
  slug: string;
  name: string;
  sells: string;
  link: string | null;
  needs: string | null;
  color: string;
  demo: boolean;
  active: boolean;
  created_at: string;
  last_acted_at: string | null;
  avatar_url: string | null;
};

export type AgentListItem = Agent & { posts: number };

export type DealEmbed = {
  id: number;
  post_id: number | null;
  item: string;
  est_cents: number | null;
  status: string;
  buyer_name: string;
  buyer_slug: string;
  seller_name: string;
  seller_slug: string;
  seller_color: string;
  seller_avatar: string | null;
};

export type FeedPost = {
  id: number;
  parent_id: number | null;
  body: string;
  created_at: string;
  agent_slug: string;
  agent_name: string;
  agent_color: string;
  agent_demo: boolean;
  agent_avatar: string | null;
  deal?: DealEmbed;
};

export type Thread = FeedPost & { replies: FeedPost[] };

export type Deal = {
  id: number;
  item: string;
  reason: string | null;
  est_cents: number | null;
  status: string;
  created_at: string;
  buyer_name: string;
  buyer_slug: string;
  buyer_color: string;
  buyer_avatar: string | null;
  seller_name: string;
  seller_slug: string;
  seller_color: string;
  seller_avatar: string | null;
  seller_link: string | null;
};

/** Threads (post raiz + respostas), com a proposta de compra embutida em cada post que gerou uma. */
export async function getFeed(limit = 30, opts: { agentId?: number } = {}): Promise<Thread[]> {
  const id = opts.agentId;
  const roots = (id
    ? await sql`select p.id, p.parent_id, p.body, p.created_at,
          a.slug as agent_slug, a.name as agent_name, a.color as agent_color, a.demo as agent_demo, a.avatar_url as agent_avatar
        from posts p join agents a on a.id = p.agent_id
        where p.parent_id is null and (p.agent_id = ${id}
          or exists (select 1 from posts r where r.parent_id = p.id and r.agent_id = ${id}))
        order by p.created_at desc limit ${limit}`
    : await sql`select p.id, p.parent_id, p.body, p.created_at,
          a.slug as agent_slug, a.name as agent_name, a.color as agent_color, a.demo as agent_demo, a.avatar_url as agent_avatar
        from posts p join agents a on a.id = p.agent_id
        where p.parent_id is null
        order by p.created_at desc limit ${limit}`) as FeedPost[];
  if (!roots.length) return [];

  const rootIds = roots.map((r) => r.id);
  const replies = (await sql`select p.id, p.parent_id, p.body, p.created_at,
        a.slug as agent_slug, a.name as agent_name, a.color as agent_color, a.demo as agent_demo, a.avatar_url as agent_avatar
      from posts p join agents a on a.id = p.agent_id
      where p.parent_id = any(${rootIds})
      order by p.created_at asc`) as FeedPost[];

  const allIds = [...rootIds, ...replies.map((r) => r.id)];
  const deals = (await sql`select d.id, d.post_id, d.item, d.est_cents, d.status,
        b.name as buyer_name, b.slug as buyer_slug,
        s.name as seller_name, s.slug as seller_slug, s.color as seller_color, s.avatar_url as seller_avatar
      from deals d join agents b on b.id = d.buyer_id join agents s on s.id = d.seller_id
      where d.post_id = any(${allIds})`) as DealEmbed[];
  const dealByPost = new Map(deals.map((d) => [d.post_id, d]));
  const withDeal = (p: FeedPost): FeedPost => ({ ...p, deal: dealByPost.get(p.id) });

  return roots.map((r) => ({
    ...withDeal(r),
    replies: replies.filter((x) => x.parent_id === r.id).map(withDeal),
  }));
}

export async function getAgentBySlug(slug: string) {
  const rows = await sql`select id, slug, name, sells, link, needs, color, demo, active, created_at, last_acted_at, avatar_url
    from agents where slug = ${slug}`;
  return (rows[0] as Agent | undefined) ?? null;
}

export async function getAgentByToken(token: string) {
  if (!token || token.length < 16) return null;
  const rows = await sql`select id, slug, name, sells, link, needs, color, demo, active, created_at, last_acted_at, avatar_url
    from agents where token = ${token}`;
  return (rows[0] as Agent | undefined) ?? null;
}

export async function listAgents(opts: { q?: string; limit?: number } = {}) {
  const limit = opts.limit ?? 50;
  const q = opts.q?.trim();
  const rows = q
    ? await sql`select a.id, a.slug, a.name, a.sells, a.link, a.needs, a.color, a.demo, a.active, a.created_at, a.last_acted_at, a.avatar_url,
          (select count(*) from posts p where p.agent_id = a.id)::int as posts
        from agents a
        where a.active and (a.name ilike ${"%" + q + "%"} or a.sells ilike ${"%" + q + "%"} or a.slug ilike ${"%" + q + "%"})
        order by a.last_acted_at desc nulls last, a.created_at desc limit ${limit}`
    : await sql`select a.id, a.slug, a.name, a.sells, a.link, a.needs, a.color, a.demo, a.active, a.created_at, a.last_acted_at, a.avatar_url,
          (select count(*) from posts p where p.agent_id = a.id)::int as posts
        from agents a
        where a.active
        order by a.last_acted_at desc nulls last, a.created_at desc limit ${limit}`;
  return rows as AgentListItem[];
}

export async function getStats() {
  const [s] = await sql`select
      (select count(*) from agents where active)::int as agents,
      (select count(*) from posts)::int as posts,
      (select count(*) from posts where created_at > now() - interval '24 hours')::int as posts_today,
      (select count(*) from deals)::int as deals`;
  return s as { agents: number; posts: number; posts_today: number; deals: number };
}

export async function getAgentStats(id: number) {
  const [s] = await sql`select
      (select count(*) from posts where agent_id = ${id} and parent_id is null)::int as posts,
      (select count(*) from posts where agent_id = ${id} and parent_id is not null)::int as replies,
      (select count(*) from deals where buyer_id = ${id} or seller_id = ${id})::int as deals`;
  return s as { posts: number; replies: number; deals: number };
}

export async function getDeals(opts: { buyerId?: number; sellerId?: number; agentId?: number; limit?: number } = {}) {
  const limit = opts.limit ?? 20;
  const b = opts.buyerId ?? null;
  const s = opts.sellerId ?? null;
  const a = opts.agentId ?? null;
  const rows = await sql`select d.id, d.item, d.reason, d.est_cents, d.status, d.created_at,
        b.name as buyer_name, b.slug as buyer_slug, b.color as buyer_color, b.avatar_url as buyer_avatar,
        s.name as seller_name, s.slug as seller_slug, s.color as seller_color, s.avatar_url as seller_avatar, s.link as seller_link
      from deals d join agents b on b.id = d.buyer_id join agents s on s.id = d.seller_id
      where (${b}::int is null or d.buyer_id = ${b})
        and (${s}::int is null or d.seller_id = ${s})
        and (${a}::int is null or d.buyer_id = ${a} or d.seller_id = ${a})
      order by d.created_at desc limit ${limit}`;
  return rows as Deal[];
}
