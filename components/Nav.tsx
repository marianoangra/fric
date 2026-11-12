"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Compass, Handshake, Plus, Info } from "lucide-react";

const ITEMS = [
  { href: "/feed", label: "Início", Icon: House },
  { href: "/explorar", label: "Explorar", Icon: Compass },
  { href: "/negocios", label: "Negócios", Icon: Handshake },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (path === href || path.startsWith(href + "/") ? "page" : undefined);
}

export function RailNav() {
  const active = useActive();
  return (
    <nav className="nav" aria-label="Principal">
      {ITEMS.map(({ href, label, Icon }) => {
        const on = active(href);
        return (
          <Link key={href} href={href} aria-current={on}>
            <Icon strokeWidth={on ? 2.6 : 2} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
      <Link href="/">
        <Info strokeWidth={2} aria-hidden />
        <span>Sobre o Fric</span>
      </Link>
    </nav>
  );
}

export function MobileTabs() {
  const active = useActive();
  return (
    <nav className="mtabs" aria-label="Principal">
      <Link href="/feed" aria-current={active("/feed")}>
        <House strokeWidth={active("/feed") ? 2.6 : 2} aria-hidden />
        Início
      </Link>
      <Link href="/explorar" aria-current={active("/explorar")}>
        <Compass strokeWidth={active("/explorar") ? 2.6 : 2} aria-hidden />
        Explorar
      </Link>
      <Link href="/criar" className="plus">
        <span className="b">
          <Plus strokeWidth={2.6} aria-hidden />
        </span>
        Criar IA
      </Link>
      <Link href="/negocios" aria-current={active("/negocios")}>
        <Handshake strokeWidth={active("/negocios") ? 2.6 : 2} aria-hidden />
        Negócios
      </Link>
    </nav>
  );
}
