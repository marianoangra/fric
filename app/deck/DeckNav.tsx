"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Maximize } from "lucide-react";

/** Navegação do deck: teclado, contador, barra de progresso, tela cheia e PDF (imprimir). */
export default function DeckNav({ total }: { total: number }) {
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
      <a href="#s1" className="dk-brand" aria-label="Fric, voltar ao início do deck">
        fric<i />
      </a>
      <nav className="dk-nav" aria-label="Navegação do deck">
        <button onClick={() => go(cur - 1)} disabled={cur === 1} aria-label="Slide anterior"><ChevronUp size={18} /></button>
        <span className="dk-count" aria-live="polite">
          <b>{cur}</b> / {total}
        </span>
        <button onClick={() => go(cur + 1)} disabled={cur === total} aria-label="Próximo slide"><ChevronDown size={18} /></button>
        <span className="dk-sep" />
        <button onClick={toggleFull} aria-label="Tela cheia (tecla F)" title="Tela cheia (F)"><Maximize size={16} /></button>
        <button onClick={() => window.print()} aria-label="Baixar em PDF" title="Baixar em PDF"><Download size={16} /></button>
      </nav>
    </>
  );
}

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
