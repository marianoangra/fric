"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Maximize } from "lucide-react";
import type { Dict, Lang } from "./i18n";

type Labels = Dict["nav"];

/** Navegação do deck: teclado, contador, barra de progresso, tela cheia e PDF (imprimir). */
export default function DeckNav({ total, labels: L, lang, langs }: { total: number; labels: Labels; lang: Lang; langs: { id: Lang; label: string; href: string }[] }) {
  const [cur, setCur] = useState(1);

  const go = useCallback(
    (n: number) => {
      const i = Math.min(total, Math.max(1, n));
      document.querySelector(`[data-slide="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [total],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("deck-js");
    const slides = Array.from(document.querySelectorAll<HTMLElement>("[data-slide]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("dk-on");
          if (e.intersectionRatio >= 0.5) {
            const n = Number((e.target as HTMLElement).dataset.slide);
            setCur(n);
            history.replaceState(null, "", n === 1 ? location.pathname : `#${n}`);
          }
        }
      },
      { threshold: [0.2, 0.5] },
    );
    slides.forEach((s) => io.observe(s));

    // Abre direto no slide do link (ex.: /deck#9).
    const start = Number(location.hash.slice(1));
    if (start > 1) document.querySelector(`[data-slide="${start}"]`)?.scrollIntoView({ block: "start" });

    return () => {
      io.disconnect();
      root.classList.remove("deck-js");
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return; // filme aberto: teclas são do vídeo
      const k = e.key;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(k)) {
        e.preventDefault();
        go(cur + (e.shiftKey && k === " " ? -1 : 1));
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(k)) {
        e.preventDefault();
        go(cur - 1);
      } else if (k === "Home") {
        e.preventDefault();
        go(1);
      } else if (k === "End") {
        e.preventDefault();
        go(total);
      } else if (k === "f" || k === "F") {
        toggleFull();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, go, total]);

  return (
    <>
      <div className="dk-progress" aria-hidden>
        <i style={{ width: `${(cur / total) * 100}%` }} />
      </div>
      <a href="#s1" className="dk-brand" aria-label={L.home}>
        fric<i />
      </a>
      <nav className="dk-langs" aria-label={L.lang}>
        {langs.map((l) => (
          <a
            key={l.id}
            href={l.href}
            hrefLang={l.id}
            aria-current={l.id === lang ? "true" : undefined}
            onClick={(e) => {
              // Troca de idioma mantendo o slide atual.
              if (cur > 1) {
                e.preventDefault();
                location.href = `${l.href}#${cur}`;
              }
            }}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <nav className="dk-nav" aria-label={L.label}>
        <button onClick={() => go(cur - 1)} disabled={cur === 1} aria-label={L.prev}><ChevronUp size={18} /></button>
        <span className="dk-count" aria-live="polite">
          <b>{cur}</b> / {total}
        </span>
        <button onClick={() => go(cur + 1)} disabled={cur === total} aria-label={L.next}><ChevronDown size={18} /></button>
        <span className="dk-sep" />
        <button className="dk-fs" onClick={toggleFull} aria-label={L.full} title={L.full}><Maximize size={16} /></button>
        <button onClick={() => window.print()} aria-label={L.pdf} title={L.pdf}><Download size={16} /></button>
      </nav>
    </>
  );
}

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
