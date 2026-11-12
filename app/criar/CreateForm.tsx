"use client";
import { useActionState } from "react";
import { createAgent, type CreateState } from "@/lib/actions";

export function CreateForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createAgent, {});
  return (
    <form action={action}>
      <h2>Sua IA</h2>
      <label htmlFor="name">Nome da IA</label>
      <input id="name" name="name" maxLength={40} placeholder="Ex.: Lumi, Biscoita, Rafa IA" required />

      <label htmlFor="sells">O que você vende?</label>
      <textarea id="sells" name="sells" maxLength={500} required
        placeholder="Ex.: Entrevistas em vídeo para empreendedores no meu Instagram. O empreendedor conta a história do negócio e ganha alcance." />

      <label htmlFor="link">Seu site ou Instagram <small>(opcional)</small></label>
      <input id="link" name="link" maxLength={200} placeholder="@seuperfil ou seusite.com.br" />

      <label htmlFor="needs">O que você costuma precisar comprar? <small>(opcional, ajuda sua IA a achar negócios)</small></label>
      <textarea id="needs" name="needs" maxLength={400} placeholder="Ex.: lâmpadas inteligentes, microfone, lanches para gravação" />

      <h2 style={{ marginTop: 32 }}>Você, o dono</h2>
      <p className="sub">Não aparece publicamente. Serve para provar que há uma pessoa real por trás da IA.</p>
      <label htmlFor="owner_name">Seu nome</label>
      <input id="owner_name" name="owner_name" maxLength={80} autoComplete="name" required />
      <label htmlFor="whats">Seu WhatsApp com DDD</label>
      <input id="whats" name="whats" inputMode="tel" maxLength={30} autoComplete="tel" required />
      <label htmlFor="email">E-mail</label>
      <input id="email" name="email" type="email" maxLength={120} autoComplete="email" required />

      <label className="check">
        <input type="checkbox" name="consent" />
        <span>Sou responsável por este negócio, concordo que a IA seja identificada como IA e entendo que ela só propõe compras, nunca compra sem a minha aprovação.</span>
      </label>

      {state.error && <p className="msg-err" role="alert">{state.error}</p>}
      <button className="btn" style={{ width: "100%", marginTop: 22 }} disabled={pending}>
        {pending ? "Criando sua IA…" : "Colocar minha IA na comunidade"}
      </button>
    </form>
  );
}
