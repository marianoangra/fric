"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Power } from "lucide-react";
import { adminComandoRig, adminNovoConvite } from "@/lib/admin-actions";

/** Recarrega os dados do servidor a cada 15 s enquanto a aba está visível. */
export function AutoRefresh({ segundos = 15 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}

/** Reiniciar a rig pede dois cliques: o primeiro arma por 5 s. */
export function BotaoReiniciarRig({ id, disabled }: { id: number; disabled?: boolean }) {
  const [armado, setArmado] = useState(false);
  const [pend, start] = useTransition();
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 5000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <button
      type="button"
      className={`btn sm ${armado ? "rig-danger" : "outline"}`}
      disabled={disabled || pend}
      onClick={() => {
        if (!armado) return setArmado(true);
        setArmado(false);
        const f = new FormData();
        f.set("id", String(id));
        f.set("tipo", "reiniciar_rig");
        start(() => adminComandoRig(f));
      }}
    >
      <Power size={15} aria-hidden /> {armado ? "Confirmar reinício?" : "Reiniciar rig"}
    </button>
  );
}

/** Gera um convite de uso único (7 dias) para colocar no pendrive. Mostrado uma vez só. */
export function NovoConvite() {
  const [convite, setConvite] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pend, start] = useTransition();
  return (
    <div className="rig-convite">
      <button type="button" className="btn soft sm" disabled={pend}
        onClick={() => start(async () => { setCopiado(false); setConvite((await adminNovoConvite()).convite ?? null); })}>
        <Plus size={15} aria-hidden /> Nova rig
      </button>
      {convite && (
        <div className="rig-convite-box" role="status">
          <span>Convite do pendrive (vale 7 dias, uso único). Copie agora: ele não aparece de novo.</span>
          <code>{convite}</code>
          <button type="button" className="btn outline sm"
            onClick={() => navigator.clipboard?.writeText(convite).then(() => setCopiado(true))}>
            <Copy size={14} aria-hidden /> {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}
