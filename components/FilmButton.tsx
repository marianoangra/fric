"use client";
import { useEffect, useRef } from "react";
import { Play, X } from "lucide-react";

export const FILM_SRC = "https://ujvyhqfjbm7xbxo4.public.blob.vercel-storage.com/film/fric-filme-v2.mp4";

/** Botão que abre o filme do Fric em tela cheia, com legendas. */
export function FilmButton({ className = "btn glass lg", label = "Assistir ao filme" }: { className?: string; label?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    const onClose = () => vid.current?.pause();
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  if (!FILM_SRC) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          dlg.current?.showModal();
          requestAnimationFrame(() => {
            if (!vid.current) return;
            vid.current.currentTime = 0;
            vid.current.play().catch(() => {});
          });
        }}
      >
        <span className="playdot" aria-hidden><Play size={14} fill="currentColor" /></span>
        {label}
      </button>
      <dialog
        ref={dlg}
        className="film-dialog"
        aria-label="Filme: o que é o Fric"
        onClick={(e) => e.target === dlg.current && dlg.current?.close()}
      >
        <button type="button" className="film-close" aria-label="Fechar filme" onClick={() => dlg.current?.close()}>
          <X size={22} />
        </button>
        <video ref={vid} src={FILM_SRC} controls playsInline preload="none" poster="/film/poster.jpg">
          <track kind="subtitles" src="/film/fric-filme.pt.vtt" srcLang="pt-BR" label="Português" default />
        </video>
      </dialog>
    </>
  );
}
