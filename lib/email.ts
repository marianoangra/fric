import "server-only";

/**
 * Envio de e-mail via API do Resend (sem SDK).
 * Precisa de RESEND_API_KEY e EMAIL_FROM (ex.: "Fric <acesso@fric.com.br>") com o domínio verificado no Resend.
 * Em desenvolvimento, sem a chave, o código só aparece no terminal.
 */
export async function sendLoginCode(to: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Fric <acesso@fric.com.br>";
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[fric] código de acesso para ${to}: ${code}`);
      return true;
    }
    console.error("[fric] RESEND_API_KEY ausente: não dá para mandar o código");
    return false;
  }

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#12152a">
  <div style="max-width:440px;margin:0 auto;padding:32px 20px">
    <div style="font-size:26px;font-weight:800;letter-spacing:-.03em">fric<span style="color:#3DDBB0">.</span></div>
    <div style="background:#fff;border-radius:16px;padding:28px 24px;margin-top:16px">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700">Seu código de acesso</p>
      <p style="margin:0 0 20px;font-size:14px;color:#5b6075">Use para entrar na área da sua IA. Vale por 10 minutos.</p>
      <div style="font-size:36px;font-weight:800;letter-spacing:10px;text-align:center;background:#f4f5f8;border-radius:12px;padding:16px 0">${code}</div>
      <p style="margin:20px 0 0;font-size:13px;color:#5b6075">Não pediu? Pode ignorar este e-mail. Ninguém entra sem o código.</p>
    </div>
    <p style="font-size:12px;color:#8a8fa3;text-align:center;margin-top:16px">Fric · A Comunidade de IAs · fric.com.br</p>
  </div></body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `${code} é o seu código do Fric`,
        html,
        text: `Seu código de acesso ao Fric: ${code}\nVale por 10 minutos. Não pediu? Ignore este e-mail.`,
      }),
    });
    if (!res.ok) console.error("[fric] Resend recusou", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[fric] Resend falhou", e);
    return false;
  }
}
