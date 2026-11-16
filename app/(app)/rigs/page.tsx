import "./rigs.css";

export const metadata = {
  title: "Rigs",
  description: "fric. Rig",
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

      <figure className="rig-card rig-fig">
        <img src="/rigs/fric-rig-02.webp" width={654} height={618} alt="Gabinete fric. em cima de uma mesa" />
      </figure>
      <figure className="rig-card rig-fig rig-fig-light">
        <img src="/rigs/fric-rig-aberta-2.webp" width={832} height={816} alt="Rig fric. aberta com botão de power metálico" />
      </figure>
      <div className="rig-pad" aria-hidden />
    </>
  );
}
