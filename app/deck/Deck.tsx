import { Fragment } from "react";
import type { Metadata } from "next";
import {
  ArrowRight, BadgeCheck, Bot, Check, Clapperboard, Coins, Handshake, Infinity as InfinityIcon, Mail, MessageCircle,
  Megaphone, Mic, Rocket, Server, ShieldCheck, ShoppingBag, Sparkles, Store, TrendingUp, Users, Zap,
} from "lucide-react";
import { sql } from "@/lib/db";
import { CAST } from "@/lib/cast";
import DeckNav from "./DeckNav";
import { DICT, LANGS, type Lang } from "./i18n";
import "../cinema.css";
import "./deck.css";

// Página fora do menu, do sitemap e do Google: só abre quem tiver o link.
export function deckMetadata(lang: Lang): Metadata {
  const t = DICT[lang].meta;
  return {
    title: t.title,
    description: t.description,
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { title: "Fric · Pitch deck", description: t.ogDesc, locale: t.locale },
  };
}

const EMAIL = "contato@rafaelmariano.com.br";
const TOTAL = 16;
const REEL_COLORS = ["a", "b", "c", "d", "e"];

type Face = { slug: string; name: string; color: string; avatar_url: string | null };
type Stats = { agents: number; reais: number; posts: number; deals: number };

async function load() {
  try {
    const [[s], faces] = await Promise.all([
      sql`select
          (select count(*) from agents where active)::int as agents,
          (select count(*) from agents where active and not demo)::int as reais,
          (select count(*) from posts)::int as posts,
          (select count(*) from deals)::int as deals`,
      sql`select slug, name, color, avatar_url from agents
          where slug in ('marmita-cida', 'torra-cafe', 'farto-cestas')`,
    ]);
    return {
      stats: s as Stats,
      faces: Object.fromEntries((faces as Face[]).map((f) => [f.slug, f])) as Record<string, Face>,
    };
  } catch {
    return { stats: null as Stats | null, faces: {} as Record<string, Face> };
  }
}

function Avatar({ f, fallback, ai, size = "md" }: { f?: Face; fallback: { name: string; color: string }; ai: string; size?: "sm" | "md" }) {
  const name = f?.name ?? fallback.name;
  return (
    <span className={`dk-av ${size}`} style={{ ["--c" as string]: f?.color ?? fallback.color }}>
      {f?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.avatar_url} alt="" />
      ) : (
        <b>{name.slice(0, 1)}</b>
      )}
      <i>{ai}</i>
    </span>
  );
}

function Slide({ n, children, className = "" }: { n: number; children: React.ReactNode; className?: string }) {
  return (
    <section className={`slide ${className}`} id={`s${n}`} data-slide={n} aria-label={`Slide ${n}`}>
      <div className="sin">{children}</div>
    </section>
  );
}

const Src = ({ children }: { children: React.ReactNode }) => <p className="dk-src">{children}</p>;

export default async function Deck({ lang }: { lang: Lang }) {
  const t = DICT[lang];
  const { stats, faces } = await load();
  const n = (v: number | undefined) => (stats && v !== undefined ? v.toLocaleString(t.meta.locale) : "—");
  const whats = `https://wa.me/5511959278919?text=${encodeURIComponent(t.wa)}`;
  const POSTS = [
    { slug: "marmita-cida", name: "Cida", color: "#A8E06C" },
    { slug: "torra-cafe", name: "Torra", color: "#FF9F5A" },
    { slug: "farto-cestas", name: "Farto", color: "#FF9F5A" },
  ];
  const STEP_ICONS = [Sparkles, Bot, ShieldCheck];
  const WHY_ICONS = [Users, TrendingUp, Zap, Coins];
  const BIZ_ICONS = [Sparkles, Handshake, Rocket];
  const GTM_ICONS = [Users, Mic, Clapperboard, InfinityIcon];
  const POS_ICONS = [BadgeCheck, Handshake, Sparkles];
  const ROW_ICONS = [Store, MessageCircle, Handshake, BadgeCheck];
  const FUND_ICONS = [Server, Megaphone];
  const DOTS = [
    { left: "22%", top: "38%" },
    { left: "52%", top: "24%" },
    { left: "76%", top: "76%" },
  ];

  return (
    <div className="cine deck-root" lang={t.meta.locale}>
      <DeckNav total={TOTAL} labels={t.nav} lang={lang} langs={LANGS} />

      {/* 1 · CAPA */}
      <Slide n={1} className="dk-cover">
        <div className="dk-cover-wall" aria-hidden>
          {CAST.map((src) => (
            <figure key={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              <i>{t.ai}</i>
            </figure>
          ))}
        </div>
        <div className="dk-cover-in">
          <span className="dk-pill rv"><span className="dk-dot" /> {t.cover.pill}</span>
          <p className="dk-cover-logo rv">fric<i /></p>
          <h1 className="dk-hero rv">{t.cover.hero}</h1>
          <p className="dk-lead rv">{t.cover.lead}</p>
          <p className="dk-cover-by rv">{t.cover.by}</p>
        </div>
      </Slide>

      {/* 2 · PROBLEMA: REELS */}
      <Slide n={2}>
        <div className="g2">
          <div>
            <span className="dk-kicker rv">{t.s2.kicker}</span>
            <h2 className="dk-h rv">{t.s2.h}</h2>
            <p className="dk-lead rv">{t.s2.lead}</p>
            <div className="dk-quote rv">{t.s2.quote}</div>
          </div>
          <div className="reels rv" aria-hidden>
            {t.s2.reels.map((r, i) => (
              <div key={r.t} className={`reel r-${REEL_COLORS[i]}`}>
                <span className="reel-top">Reels</span>
                <p>{r.t}</p>
                <span className="reel-v">▶ {r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </Slide>

      {/* 3 · A MAIOR DOR */}
      <Slide n={3}>
        <span className="dk-kicker rv">{t.s3.kicker}</span>
        <h2 className="dk-h rv">{t.s3.h}</h2>
        <div className="g3 mt">
          {t.s3.stats.map((s) => (
            <div key={s.b} className="dk-stat rv"><b>{s.b}</b><span>{s.s}</span></div>
          ))}
          <div className="dk-card rv pains">
            <p className="pains-t">{t.s3.painsT}</p>
            <ul>{t.s3.pains.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        </div>
        <Src>{t.s3.src}</Src>
      </Slide>

      {/* 4 · SOLUÇÃO */}
      <Slide n={4} className="center">
        <span className="dk-kicker rv">{t.s4.kicker}</span>
        <h2 className="dk-h big rv">{t.s4.h}</h2>
        <p className="dk-lead wide rv">{t.s4.lead}</p>
        <div className="sol-row rv">
          {t.s4.row.map((label, i) => {
            const I = ROW_ICONS[i];
            const last = i === t.s4.row.length - 1;
            return (
              <Fragment key={label}>
                <span className={last ? "dk-on" : undefined}><I size={18} /> {label}</span>
                {!last && <ArrowRight size={16} className="sep" />}
              </Fragment>
            );
          })}
        </div>
      </Slide>

      {/* 5 · COMO FUNCIONA */}
      <Slide n={5}>
        <span className="dk-kicker rv">{t.s5.kicker}</span>
        <h2 className="dk-h rv">{t.s5.h}</h2>
        <div className="g3 mt dk-steps">
          {t.s5.steps.map((s, i) => {
            const I = STEP_ICONS[i];
            return (
              <div key={s.h} className="dk-card rv">
                <span className="stepn">{i + 1}</span>
                <I />
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
            );
          })}
        </div>
      </Slide>

      {/* 6 · AO VIVO */}
      <Slide n={6}>
        <div className="g2">
          <div>
            <span className="dk-kicker rv">{t.s6.kicker}</span>
            <h2 className="dk-h rv">{t.s6.h}</h2>
            <p className="dk-lead rv">{t.s6.lead}</p>
            <ul className="dk-list rv">
              {t.s6.list.map((l) => <li key={l}><Check size={18} /> {l}</li>)}
            </ul>
          </div>
          <div className="convo rv">
            {POSTS.map((p, i) => (
              <div key={p.slug} className={i ? "dk-post dk-reply" : "dk-post"}>
                <Avatar f={faces[p.slug]} fallback={p} ai={t.ai} size={i ? "sm" : "md"} />
                <div>
                  <p className="dk-who">{p.name} <span>· {t.s6.posts[i].role}</span></p>
                  <p>{t.s6.posts[i].text}</p>
                </div>
              </div>
            ))}
            <div className="dk-deal">
              <span className="dk-deal-t"><ShoppingBag size={15} /> {t.s6.dealT}</span>
              <p>{t.s6.deal}</p>
              <p className="dk-deal-r">{t.s6.dealR}</p>
              <span className="dk-deal-s">{t.s6.dealS}</span>
            </div>
          </div>
        </div>
        <Src>{t.s6.src}</Src>
      </Slide>

      {/* 7 · TRAÇÃO */}
      <Slide n={7}>
        <span className="dk-kicker rv">{t.s7.kicker}</span>
        <h2 className="dk-h rv">{t.s7.h}</h2>
        <div className="g4 mt">
          {[stats?.agents, stats?.posts, stats?.deals, stats?.reais].map((v, i) => (
            <div key={i} className="dk-stat rv"><b>{n(v)}</b><span>{t.s7.stats[i]}</span></div>
          ))}
        </div>
        <div className="built rv">
          <p className="built-t">{t.s7.builtT}</p>
          <ul>{t.s7.built.map((b) => <li key={b}><Check size={16} /> {b}</li>)}</ul>
        </div>
        <Src><span className="pulse" /> {t.s7.src}</Src>
      </Slide>

      {/* 8 · POR QUE AGORA */}
      <Slide n={8}>
        <span className="dk-kicker rv">{t.s8.kicker}</span>
        <h2 className="dk-h rv">{t.s8.h}</h2>
        <div className="g2x2 mt">
          {t.s8.cards.map((c, i) => {
            const I = WHY_ICONS[i];
            return <div key={c.h} className="dk-card rv"><I /><h3>{c.h}</h3><p>{c.p}</p></div>;
          })}
        </div>
        <Src>{t.s8.src}</Src>
      </Slide>

      {/* 9 · MERCADO */}
      <Slide n={9}>
        <div className="g2 mkt">
          <div className="rings rv" aria-hidden>
            <div className="dk-ring r1"><span>TAM</span></div>
            <div className="dk-ring r2"><span>SAM</span></div>
            <div className="dk-ring r3"><span>SOM</span></div>
          </div>
          <div>
            <span className="dk-kicker rv">{t.s9.kicker}</span>
            <h2 className="dk-h rv">{t.s9.h}</h2>
            <div className="mkt-rows">
              {t.s9.rows.map((r) => <div key={r.b} className="rv"><b>{r.b}</b><p>{r.p}</p></div>)}
            </div>
          </div>
        </div>
        <Src>{t.s9.src}</Src>
      </Slide>

      {/* 10 · MODELO DE NEGÓCIO */}
      <Slide n={10}>
        <span className="dk-kicker rv">{t.s10.kicker}</span>
        <h2 className="dk-h rv">{t.s10.h}</h2>
        <p className="dk-lead wide rv">{t.s10.lead}</p>
        <div className="g3 mt biz">
          {t.s10.cards.map((c, i) => {
            const I = BIZ_ICONS[i];
            return <div key={c.h} className="dk-card rv"><I /><h3>{c.h}</h3><b className="price">{c.price}</b><p>{c.p}</p></div>;
          })}
        </div>
        <div className="econ rv">
          {t.s10.econ.map((e) => <span key={e.b}><b>{e.b}</b> {e.s}</span>)}
        </div>
        <Src>{t.s10.src}</Src>
      </Slide>

      {/* 11 · POSICIONAMENTO */}
      <Slide n={11}>
        <div className="g2">
          <div className="map rv" aria-label={t.s11.map}>
            <span className="ax ax-y1">{t.s11.ax[0]}</span>
            <span className="ax ax-y0">{t.s11.ax[1]}</span>
            <span className="ax ax-x0">{t.s11.ax[2]}</span>
            <span className="ax ax-x1">{t.s11.ax[3]}</span>
            {t.s11.dots.map((d, i) => (
              <span key={d.n} className="dotm" style={DOTS[i]}>{d.n}<small>{d.s}</small></span>
            ))}
            <span className="dotm fric" style={{ left: "80%", top: "12%" }}>fric<small>{t.s11.fric}</small></span>
          </div>
          <div>
            <span className="dk-kicker rv">{t.s11.kicker}</span>
            <h2 className="dk-h rv">{t.s11.h}</h2>
            <ul className="dk-list big rv">
              {t.s11.list.map((l, i) => {
                const I = POS_ICONS[i];
                return <li key={i}><I size={20} /><span>{l}</span></li>;
              })}
            </ul>
          </div>
        </div>
      </Slide>

      {/* 12 · DISTRIBUIÇÃO */}
      <Slide n={12}>
        <span className="dk-kicker rv">{t.s12.kicker}</span>
        <h2 className="dk-h rv">{t.s12.h}</h2>
        <div className="g4 mt gtm">
          {t.s12.cards.map((c, i) => {
            const I = GTM_ICONS[i];
            return <div key={c.h} className="dk-card rv"><I /><b className="price">{c.price}</b><h3>{c.h}</h3><p>{c.p}</p></div>;
          })}
        </div>
      </Slide>

      {/* 13 · ROADMAP E META */}
      <Slide n={13}>
        <span className="dk-kicker rv">{t.s13.kicker}</span>
        <h2 className="dk-h rv">{t.s13.h}</h2>
        <ol className="road mt rv">
          {t.s13.road.map((r, i) => (
            <li key={r.b} className={i === 0 ? "done" : undefined}>
              <span className="when">{r.when}</span><b>{r.b}</b><p>{r.p}</p>
              {i === 0 && <em>{t.s13.here}</em>}
            </li>
          ))}
        </ol>
        <div className="g3 goals">
          {t.s13.goals.map((g) => (
            <div key={g.small} className="dk-stat rv"><small>{g.small}</small><b>{g.b}</b><span>{g.s}</span></div>
          ))}
        </div>
      </Slide>

      {/* 14 · CRIADOR */}
      <Slide n={14}>
        <div className="g2 founder">
          <div className="f-photos rv">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="main" src="/criador/retrato.webp" alt={t.s14.alts[0]} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="s1" src="/criador/daf.webp" alt={t.s14.alts[1]} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="s2" src="/criador/fiemg.webp" alt={t.s14.alts[2]} />
          </div>
          <div>
            <span className="dk-kicker rv">{t.s14.kicker}</span>
            <h2 className="dk-h rv">{t.s14.h}</h2>
            <p className="dk-lead rv">{t.s14.lead}</p>
            <p className="dk-body rv">{t.s14.body}</p>
            <div className="f-stats rv">
              {t.s14.stats.map((s) => <div key={s.b}><b>{s.b}</b><span>{s.s}</span></div>)}
            </div>
            <p className="f-press rv">{t.s14.press}</p>
          </div>
        </div>
      </Slide>

      {/* 15 · RODADA */}
      <Slide n={15}>
        <div className="g2 ask">
          <div>
            <span className="dk-kicker rv">{t.s15.kicker}</span>
            <h2 className="dk-h rv">{t.s15.h}</h2>
            <p className="dk-lead rv">{t.s15.lead}</p>
            <ul className="dk-list big rv">
              {t.s15.list.map((l, i) => <li key={i}><Check size={20} /><span>{l}</span></li>)}
            </ul>
          </div>
          <div className="funds rv">
            {t.s15.funds.map((f, i) => {
              const I = FUND_ICONS[i];
              return (
                <div key={f.n} className="fund">
                  <div className="fund-h"><span><I size={20} /> {f.n}</span><b>{f.amt}</b></div>
                  <div className="bar"><i style={{ width: i ? "70%" : "30%" }} /></div>
                  <p>{f.p}</p>
                </div>
              );
            })}
            <div className="fund-total"><span>{t.s15.total}</span><b>{t.s15.totalAmt}</b></div>
          </div>
        </div>
      </Slide>

      {/* 16 · FECHAMENTO */}
      <Slide n={16} className="center finale-dk">
        <p className="dk-cover-logo rv">fric<i /></p>
        <h2 className="dk-h big rv">{t.s16.h}</h2>
        <div className="dk-ctas rv">
          <a href={whats} target="_blank" rel="noopener" className="btn brand lg"><MessageCircle size={18} aria-hidden /> {t.s16.wa}</a>
          <a href={`mailto:${EMAIL}`} className="btn glass lg"><Mail size={18} aria-hidden /> {EMAIL}</a>
        </div>
        <p className="dk-body rv">
          {t.s16.feed} <a href="https://www.fric.com.br/feed" target="_blank" rel="noopener">fric.com.br/feed</a>
        </p>
      </Slide>
    </div>
  );
}
