"use client";
import { useActionState, useState } from "react";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";
import { requestCode, verifyCode, type LoginState } from "@/lib/auth-actions";

export function LoginCodeForm() {
  const [sent, sendAction, sending] = useActionState<LoginState, FormData>(requestCode, {});
  const [checked, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCode, {});
  const [back, setBack] = useState(0);

  // Etapa atual: o último estado que respondeu manda.
  const last = checked.step && checked.email === sent.email ? checked : sent;
  const onCode = last.step === "code" && back < 1;
  const email = last.email ?? "";

  if (!onCode) {
    return (
      <form action={(f) => { setBack(0); return sendAction(f); }}>
        <div className="field">
          <label htmlFor="email">Seu e-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            defaultValue={email}
            placeholder="o mesmo que você usou ao criar a IA"
            autoComplete="email"
            inputMode="email"
            autoFocus
            required
          />
        </div>
        {sent.error && <p className="formerr">{sent.error}</p>}
        <button className="btn brand block lg" style={{ marginTop: 16 }} disabled={sending}>
          <Mail size={18} aria-hidden /> {sending ? "Enviando…" : "Receber código por e-mail"}
        </button>
        <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
          Sem senha: a cada acesso mandamos um código de 6 números para o seu e-mail.
        </p>
      </form>
    );
  }

  return (
    <div>
      {last.info && !checked.error && <p className="muted" style={{ fontSize: 14, margin: "14px 0 0" }}>{last.info}</p>}
      <form action={verifyAction}>
        <input type="hidden" name="email" value={email} />
        <div className="field">
          <label htmlFor="code">Código enviado para <b>{email}</b></label>
          <input
            id="code"
            name="code"
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            placeholder="000000"
            style={{ fontSize: 26, letterSpacing: ".4em", textAlign: "center", fontWeight: 800 }}
            autoFocus
            required
          />
        </div>
        {checked.error && checked.email === email && <p className="formerr">{checked.error}</p>}
        <button className="btn brand block lg" style={{ marginTop: 16 }} disabled={verifying}>
          <KeyRound size={18} aria-hidden /> {verifying ? "Conferindo…" : "Entrar"}
        </button>
      </form>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn soft sm" onClick={() => setBack(1)}>
          <ArrowLeft size={15} aria-hidden /> Trocar e-mail
        </button>
        <form action={(f) => { setBack(0); return sendAction(f); }}>
          <input type="hidden" name="email" value={email} />
          <button className="btn outline sm" disabled={sending}>{sending ? "Enviando…" : "Mandar outro código"}</button>
        </form>
      </div>
    </div>
  );
}
