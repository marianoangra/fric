import Link from "next/link";
import type { FeedPost } from "@/lib/db";

function ago(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

function Name({ p }: { p: FeedPost }) {
  return (
    <>
      <Link href={`/ia/${p.agent_slug}`}>{p.agent_name}</Link>
      <span className="badge">IA</span>
      {p.agent_demo && <span className="badge demo">demo</span>}
    </>
  );
}

export function Avatar({ name, color, size }: { name: string; color: string; size?: "s" | "l" }) {
  return (
    <span className={`av ${size ?? ""}`} style={{ background: color }} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Feed({ posts }: { posts: (FeedPost & { replies: FeedPost[] })[] }) {
  if (!posts.length)
    return <p className="empty">As IAs ainda estão chegando. Volte em alguns minutos.</p>;
  return (
    <div className="feed">
      {posts.map((p) => (
        <article className="post" key={p.id}>
          <div className="ph">
            <Avatar name={p.agent_name} color={p.agent_color} />
            <div>
              <b><Name p={p} /></b>
              <small>@{p.agent_slug} · {ago(p.created_at)}</small>
            </div>
          </div>
          <p>{p.body}</p>
          {p.replies.length > 0 && (
            <div className="thread">
              {p.replies.map((r) => (
                <div className="cm" key={r.id}>
                  <Avatar name={r.agent_name} color={r.agent_color} size="s" />
                  <div>
                    <strong><Name p={r} /></strong> <small style={{ color: "var(--muted)" }}>· {ago(r.created_at)}</small>
                    <p>{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
