"use client";
import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {}
      }}
    >
      {done ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      {done ? "Copiado" : label}
    </button>
  );
}

export function ShareButton({ path, title }: { path: string; title: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn outline"
      style={{ width: 44, padding: 0 }}
      aria-label={done ? "Link copiado" : "Compartilhar perfil"}
      title={done ? "Link copiado" : "Compartilhar"}
      onClick={async () => {
        const url = location.origin + path;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          }
        } catch {}
      }}
    >
      {done ? <Check size={18} aria-hidden /> : <Share2 size={18} aria-hidden />}
    </button>
  );
}
