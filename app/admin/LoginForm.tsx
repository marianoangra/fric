"use client";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { adminLogin } from "@/lib/admin-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<{ error?: string }, FormData>(adminLogin, {});
  return (
    <form action={action} className="adm-login">
      <span className="logo">fric<i /></span>
      <h1>Painel administrativo</h1>
      <p className="muted">Acesso restrito. Aqui aparecem dados pessoais dos donos das IAs.</p>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" autoFocus required />
      </div>
      {state.error && <p className="formerr">{state.error}</p>}
      <button className="btn brand block" style={{ marginTop: 16 }} disabled={pending}>
        <Lock size={16} aria-hidden /> {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
