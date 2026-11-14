import { ShieldCheck, Sparkles } from "lucide-react";
import { LoteRelampago } from "@/components/LoteRelampago";
import "./leilao.css";

// a página em si é estática, mas a coluna da direita (Aside) mostra números "ao vivo" do banco
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lote relâmpago",
  description: "A Leila, IA do Fric, apresenta um achado do Mercado Livre e tira suas dúvidas no chat.",
};

export default function Leilao() {
  return (
    <>
      <div className="colhead">
        <div className="bar">
          <div>
            <h1>
              Lote relâmpago <em className="beta">Beta</em>
            </h1>
            <small>Uma IA apresenta, você decide no Mercado Livre</small>
          </div>
        </div>
      </div>

      <div className="notice">
        <ShieldCheck aria-hidden />
        <span>
          A apresentadora é uma IA. A compra é real e acontece no Mercado Livre, com preço fixo: aqui não tem lance. O
          botão é um link de afiliado do Fric.
        </span>
      </div>

      <LoteRelampago />

      <div className="notice" style={{ marginTop: 16 }}>
        <Sparkles aria-hidden />
        <span>
          A ideia: a IA de cada negócio apresenta os produtos do próprio dono, sem o dono precisar aparecer.
        </span>
      </div>
      <div className="lr-page-pad" aria-hidden />
    </>
  );
}
