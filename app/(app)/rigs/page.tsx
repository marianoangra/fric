import "./rigs.css";

export const metadata = {
  title: "Rigs",
  description: "Uma rig que cuida do seu HYPE sozinha: staking na Hyperliquid com proteção, regra que decide e IA que explica.",
};

export default function Rigs() {
  return (
    <>
      <div className="colhead">
        <div className="bar">
          <div>
            <h1>
              Rigs <em className="beta">Beta</em>
            </h1>
          </div>
        </div>
      </div>

      <section className="rig-card rig-intro">
        <h2>Uma rig que cuida do seu HYPE sozinha.</h2>
        <p>
          Ela fica ligada na sua casa, 24 horas por dia. Seu HYPE fica em staking na Hyperliquid, rendendo a recompensa
          da rede, e parte dele fica protegida por uma posição contrária: quando o preço sobe, você ainda aproveita; quando
          cai, o tombo é menor.
        </p>
      </section>

      <figure className="rig-card rig-fig">
        <img src="/rigs/fric-rig-02.webp" width={654} height={618} alt="Gabinete fric. em cima de uma mesa" />
      </figure>
      <figure className="rig-card rig-fig rig-fig-light">
        <img src="/rigs/fric-rig-aberta-2.webp" width={832} height={816} alt="Rig fric. aberta com botão de power metálico" />
      </figure>
      <details className="rig-card rig-how">
        <summary>Como funciona</summary>
        <h3>Quem decide é a regra, não a IA</h3>
        <p>
          As ordens seguem regras fixas, escritas no código e iguais todos os dias. A IA não aposta, não tenta adivinhar
          preço e não mexe no seu dinheiro. A rig usa uma chave que só opera e nunca saca: o dinheiro continua na sua conta.
        </p>
        <h3>O papel da IA é deixar tudo claro</h3>
        <ul>
          <li>Explica cada movimento em português, no momento em que ele acontece.</li>
          <li>Responde suas perguntas, como &ldquo;por que hoje eu tenho menos HYPE?&rdquo;.</li>
          <li>Vigia o que a regra não vê: taxa virando contra, validador com problema, margem chegando perto do limite.</li>
          <li>Faz um resumo do dia, da semana e do mês, comparando com quanto teria rendido só segurando o HYPE.</li>
        </ul>
        <h3>Roda em casa, não na nuvem</h3>
        <p>Seus dados não saem dali, e a IA roda na placa de vídeo que estava parada na gaveta.</p>
        <h3>Um botão faz tudo</h3>
        <p>
          Ele liga e desliga a rig, e o anel de luz mostra a saúde da operação: verde quando está tudo certo, laranja
          quando pede atenção e vermelho quando a margem está apertada.
        </p>
      </details>

      <p className="rig-note">Protótipo de uso próprio, não está à venda. Não é recomendação de investimento: cripto oscila e pode dar prejuízo.</p>
      <div className="rig-pad" aria-hidden />
    </>
  );
}
