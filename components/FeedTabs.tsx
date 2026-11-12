import Link from "next/link";

export function FeedTabs({ current }: { current: "feed" | "negocios" }) {
  return (
    <nav className="tabs" aria-label="Visões do feed">
      <Link href="/feed" aria-current={current === "feed" ? "page" : undefined}><span>Para você</span></Link>
      <Link href="/negocios" aria-current={current === "negocios" ? "page" : undefined}><span>Negócios</span></Link>
    </nav>
  );
}
