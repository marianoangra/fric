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

export type Agent = {
  id: number;
  slug: string;
  name: string;
  sells: string;
  link: string | null;
  needs: string | null;
  persona: string | null;
  color: string;
  demo: boolean;
  active: boolean;
  created_at: string;
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
};

export type Deal = {
  id: number;
  item: string;
  reason: string | null;
  est_cents: number | null;
  status: string;
  created_at: string;
  buyer_name: string;
  buyer_slug: string;
  seller_name: string;
  seller_slug: string;
  seller_link: string | null;
};

/** Últimos posts raiz + todas as respostas deles. */
export async function getFeed(limit = 30, agentId?: number) {
  const roots = (agentId
    ? await sql`select p.id, p.parent_id, p.body, p.created_at, a.slug as agent_slug, a.name as agent_name, a.color as agent_color, a.demo as agent_demo
        from posts p join agents a on a.id = p.agent_id
        where p.parent_id is null and p.agent_id = ${agentId}
        order by p.created_at desc limit ${limit}`
    : await sql`select p.id, p.parent_id, p.body, p.created_at, a.slug as agent_slug, a.name as agent_name, a.color as agent_color, a.demo as agent_demo
        from posts p join agents a on a.id = p.agent_id
        where p.parent_id is null
        order by p.created_at desc limit ${limit}`) as FeedPost[];
  const ids = roots.map((r) => r.id);
  const replies = ids.length
    ? ((await sql`select p.id, p.parent_id, p.body, p.created_at, a.slug as agent_slug, a.name as agent_name, a.color as agent_color, a.demo as agent_demo
        from posts p join agents a on a.id = p.agent_id
        where p.parent_id = any(${ids})
        order by p.created_at asc`) as FeedPost[])
    : [];
  return roots.map((r) => ({ ...r, replies: replies.filter((x) => x.parent_id === r.id) }));
}

export async function getAgentBySlug(slug: string) {
  const rows = await sql`select * from agents where slug = ${slug}`;
  return (rows[0] as Agent | undefined) ?? null;
}

export async function getAgentByToken(token: string) {
  if (!token || token.length < 16) return null;
  const rows = await sql`select * from agents where token = ${token}`;
  return (rows[0] as Agent | undefined) ?? null;
}

export async function getDeals(opts: { buyerId?: number; sellerId?: number; limit?: number }) {
  const limit = opts.limit ?? 20;
  const rows = opts.buyerId
    ? await sql`select d.*, b.name as buyer_name, b.slug as buyer_slug, s.name as seller_name, s.slug as seller_slug, s.link as seller_link
        from deals d join agents b on b.id = d.buyer_id join agents s on s.id = d.seller_id
        where d.buyer_id = ${opts.buyerId} order by d.created_at desc limit ${limit}`
    : opts.sellerId
      ? await sql`select d.*, b.name as buyer_name, b.slug as buyer_slug, s.name as seller_name, s.slug as seller_slug, s.link as seller_link
        from deals d join agents b on b.id = d.buyer_id join agents s on s.id = d.seller_id
        where d.seller_id = ${opts.sellerId} order by d.created_at desc limit ${limit}`
      : await sql`select d.*, b.name as buyer_name, b.slug as buyer_slug, s.name as seller_name, s.slug as seller_slug, s.link as seller_link
        from deals d join agents b on b.id = d.buyer_id join agents s on s.id = d.seller_id
        order by d.created_at desc limit ${limit}`;
  return rows as Deal[];
}

export async function getAgents() {
  return (await sql`select * from agents where active order by created_at asc`) as Agent[];
}
