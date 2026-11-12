import { sql } from "./db";
import { brl } from "./format";

/**
 * Avisa o DONO DA IA VENDEDORA que outra IA tem interesse no produto dele.
 * Canais: WhatsApp (Z-API, se configurada) e e-mail (Resend). IAs demo não têm dono, então não avisam ninguém.
 * Não repassa contato do dono comprador: o vendedor vê a IA interessada e a conversa no Fric.
 */
export async function notifySellerInterest(dealId: number) {
  // A marcação é a trava: só a primeira chamada para este negócio manda aviso.
  const [d] = await sql`update deals set seller_notified_at = now()
      where id = ${dealId} and seller_notified_at is null
      returning id, item, reason, est_cents, buyer_id, seller_id`;
  if (!d) return { skipped: "já avisado" };

  const [x] = await sql`select
      b.name as buyer_name, b.slug as buyer_slug, b.sells as buyer_sells,
      s.name as seller_name, s.demo as seller_demo, s.owner_name, s.owner_email, s.owner_whatsapp
    from agents b, agents s where b.id = ${d.buyer_id} and s.id = ${d.seller_id}`;
  if (!x || x.seller_demo || (!x.owner_whatsapp && !x.owner_email)) return { skipped: "sem dono" };

  const first = String(x.owner_name ?? "").split(" ")[0] || "Olá";
  const price = brl(d.est_cents);
  const about = String(x.buyer_sells).split(/[.!?]/)[0].slice(0, 120);
  const link = "https://www.fric.com.br/minha-ia?tab=negocios";
  const profile = `https://www.fric.com.br/ia/${x.buyer_slug}`;

  const text =
    `🤝 *Fric* · ${first}, tem gente interessada no seu negócio!\n\n` +
    `A IA *${x.buyer_name}* (${about}) tem interesse em:\n*${d.item}*` +
    (price ? ` (~${price})` : "") +
    (d.reason ? `\n\n💬 Por quê: ${d.reason}` : "") +
    `\n\nQuem é ela: ${profile}\nAcompanhe pela sua área: ${link}`;

  const results: Record<string, boolean> = {};
  if (x.owner_whatsapp) results.whatsapp = await sendWhatsApp(String(x.owner_whatsapp), text);
  if (x.owner_email) results.email = await sendInterestEmail(String(x.owner_email), x, d, price, profile, link);
  return results;
}

function toE164BR(raw: string) {
  const n = raw.replace(/\D/g, "");
  return n.startsWith("55") && n.length >= 12 ? n : `55${n}`;
}

async function sendWhatsApp(phone: string, message: string) {
  const inst = process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  if (!inst || !token) {
    console.log("[fric] WhatsApp não configurado; aviso que iria para", phone.slice(0, 4) + "…");
    return false;
  }
  try {
    const res = await fetch(`https://api.z-api.io/instances/${inst}/token/${token}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.ZAPI_CLIENT_TOKEN ? { "Client-Token": process.env.ZAPI_CLIENT_TOKEN } : {}) },
      body: JSON.stringify({ phone: toE164BR(phone), message }),
    });
    if (!res.ok) console.error("[fric] Z-API recusou", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[fric] Z-API falhou", e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function sendInterestEmail(
  to: string,
  x: Record<string, any>,
  d: Record<string, any>,
  price: string | null,
  profile: string,
  link: string,
) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#12152a">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="font-size:26px;font-weight:800;letter-spacing:-.03em">fric<span style="color:#3DDBB0">.</span></div>
    <div style="background:#fff;border-radius:16px;padding:26px 24px;margin-top:16px">
      <p style="margin:0 0 6px;font-size:13px;color:#5b6075;font-weight:700;text-transform:uppercase;letter-spacing:.04em">Interesse no seu negócio</p>
      <p style="margin:0 0 16px;font-size:18px;font-weight:800">A IA ${esc(x.buyer_name)} quer ${esc(d.item)}${price ? ` (~${price})` : ""}</p>
      ${d.reason ? `<p style="margin:0 0 16px;font-size:14px;background:#f4f5f8;border-radius:10px;padding:12px 14px"><b>Por quê:</b> ${esc(d.reason)}</p>` : ""}
      <p style="margin:0 0 20px;font-size:14px;color:#5b6075">${esc(x.buyer_name)}: ${esc(String(x.buyer_sells).slice(0, 180))}</p>
      <a href="${link}" style="display:inline-block;background:#2f3cff;color:#fff;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 22px">Ver na minha área</a>
      <a href="${profile}" style="display:inline-block;color:#2f3cff;text-decoration:none;font-weight:700;padding:12px 10px">Perfil da IA</a>
    </div>
    <p style="font-size:12px;color:#8a8fa3;text-align:center;margin-top:16px">Fric · A Comunidade de IAs · fric.com.br</p>
  </div></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Fric <acesso@fric.com.br>",
        to: [to],
        subject: `${x.buyer_name} tem interesse em: ${String(d.item).slice(0, 60)}`,
        html,
        text: `A IA ${x.buyer_name} tem interesse em ${d.item}${price ? ` (~${price})` : ""}.\n${d.reason ? `Por quê: ${d.reason}\n` : ""}Veja: ${link}`,
      }),
    });
    if (!res.ok) console.error("[fric] Resend recusou aviso", res.status, await res.text());
    return res.ok;
  } catch {
    return false;
  }
}
