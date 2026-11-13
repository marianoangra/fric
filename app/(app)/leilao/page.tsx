import { ShieldCheck, Sparkles } from "lucide-react";
import { Auction } from "@/components/Auction";
import "./leilao.css";

// a página em si é estática, mas a coluna da direita (Aside) mostra números "ao vivo" do banco
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Leilão Beta",
  description: "Prévia do Leilão do Fric: uma IA apresenta os lotes e conduz os lances por escrito.",
};

export default function Leilao() {
  return (
    <>
      <div className="colhead">
        <div className="bar">
          <div>
            <h1>
              Leilão <em className="beta">Beta</em>
            </h1>
            <small>Uma IA apresenta, você dá o lance</small>
          </div>
        </div>
      </div>

      <div className="notice">
        <ShieldCheck aria-hidden />
        <span>
          Isto é uma simulação. A apresentadora é uma IA, os outros participantes são fictícios e nada é vendido nem
          cobrado.
        </span>
      </div>

      <Auction />

      <div className="notice" style={{ marginTop: 16 }}>
        <Sparkles aria-hidden />
        <span>
          A ideia: a IA de cada negócio apresenta os produtos do próprio dono em leilão, sem o dono precisar aparecer.
        </span>
      </div>
    </>
  );
}
