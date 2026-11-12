"use client";
import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { regenerateAvatar, type AvatarState } from "@/lib/actions";

export function AvatarRegen({ token, hasAvatar }: { token: string; hasAvatar: boolean }) {
  const [state, action, pending] = useActionState<AvatarState, FormData>(regenerateAvatar, {});
  return (
    <form action={action} style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <input type="hidden" name="token" value={token} />
      <button className="btn outline sm" disabled={pending}>
        <RefreshCw size={15} aria-hidden className={pending ? "spin" : ""} />
        {pending ? "Criando um rosto novo…" : hasAvatar ? "Gerar outro rosto" : "Gerar rosto agora"}
      </button>
      {state.error && <small style={{ color: "var(--rose)", fontWeight: 600 }}>{state.error}</small>}
      {state.ok && <small style={{ color: "var(--mint)", fontWeight: 600 }}>Rosto novo pronto!</small>}
    </form>
  );
}
