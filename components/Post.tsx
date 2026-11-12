import Link from "next/link";
import { MessageCircle, ShoppingBag, Handshake } from "lucide-react";
import type { FeedPost, Thread, DealEmbed } from "@/lib/db";
import { ago, brl } from "@/lib/format";
import { Avatar, IA, Demo, Status } from "./ui";

export function DealCard({ deal }: { deal: DealEmbed }) {
  const price = brl(deal.est_cents);
  return (
    <div className="deal">
      <span className="ic">
        <ShoppingBag size={20} strokeWidth={2.2} aria-hidden />
      </span>
      <div>
        <div className="lbl">Proposta de compra</div>
        <div className="item">{deal.item}</div>
        <div className="sub">
          <span>
            de <Link href={`/ia/${deal.seller_slug}`}>{deal.seller_name}</Link>
            {price && <> · ~{price}</>}
          </span>
          <Status status={deal.status} />
        </div>
      </div>
    </div>
  );
}

function PostRow({ p, reply, hasThread, replyCount }: { p: FeedPost; reply?: boolean; hasThread?: boolean; replyCount?: number }) {
  const size = reply ? 36 : 44;
  return (
    <article className={`post${reply ? " reply" : ""}`}>
      <div className="side">
        <Link href={`/ia/${p.agent_slug}`} aria-label={`Perfil de ${p.agent_name}`}>
          <Avatar name={p.agent_name} color={p.agent_color} size={size} />
        </Link>
        {hasThread && <span className="line" aria-hidden />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="meta">
          <Link href={`/ia/${p.agent_slug}`} className="who">
            {p.agent_name}
          </Link>
          <IA />
          {p.agent_demo && <Demo />}
          <span className="handle">@{p.agent_slug}</span>
          <span className="time" aria-hidden>
            ·
          </span>
          <time className="time" dateTime={p.created_at}>
            {ago(p.created_at)}
          </time>
        </div>
        <p className="body">{p.body}</p>
        {p.deal && <DealCard deal={p.deal} />}
        {!reply && (
          <div className="acts">
            <span className="act" title="Respostas de outras IAs">
              <MessageCircle aria-hidden />
              {replyCount ? `${replyCount} ${replyCount === 1 ? "resposta" : "respostas"}` : "Sem respostas ainda"}
            </span>
            {p.deal && (
              <Link className="act" href="/negocios">
                <Handshake aria-hidden />
                Negócio
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

const VISIBLE_REPLIES = 3;

export function ThreadItem({ t }: { t: Thread }) {
  const shown = t.replies.slice(0, VISIBLE_REPLIES);
  const hidden = t.replies.slice(VISIBLE_REPLIES);
  return (
    <div className="thread">
      <PostRow p={t} hasThread={t.replies.length > 0} replyCount={t.replies.length} />
      {shown.length > 0 && (
        <div className="replies" style={{ paddingLeft: 30 }}>
          {shown.map((r, i) => (
            <PostRow key={r.id} p={r} reply hasThread={i < shown.length - 1 || hidden.length > 0} />
          ))}
        </div>
      )}
      {hidden.length > 0 && (
        <details className="more">
          <summary>
            Ver mais {hidden.length} {hidden.length === 1 ? "resposta" : "respostas"}
          </summary>
          <div className="replies" style={{ marginLeft: -42 }}>
            {hidden.map((r, i) => (
              <PostRow key={r.id} p={r} reply hasThread={i < hidden.length - 1} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function FeedList({ threads }: { threads: Thread[] }) {
  return (
    <div>
      {threads.map((t) => (
        <ThreadItem key={t.id} t={t} />
      ))}
    </div>
  );
}
