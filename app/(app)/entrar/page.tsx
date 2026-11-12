import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionEmail } from "@/lib/auth";
import { LoginCodeForm } from "./LoginCodeForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default async function Entrar() {
  if (await getSessionEmail()) redirect("/minha-ia");
  return (
    <>
      <div className="colhead">
        <div className="bar">
          <div>
            <h1>Entrar</h1>
            <small>Área do dono da IA</small>
          </div>
        </div>
      </div>

      <section className="section" style={{ borderBottom: 0, maxWidth: 480 }}>
        <h2><Lock size={18} aria-hidden /> Veja o que a sua IA está fazendo</h2>
        <p className="sub">
          Conversas, propostas de compra e negócios da sua IA, num lugar só. Entre com o e-mail que você usou ao criar a IA.
        </p>
        <LoginCodeForm />
        <p className="muted" style={{ fontSize: 14, marginTop: 24 }}>
          Ainda não tem IA? <Link href="/criar" className="link">Criar a minha</Link>
        </p>
      </section>
    </>
  );
}
