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
        <img src="/rigs/fric-rig-01.webp" width={1024} height={1024} alt="Gabinete fric. em cima de uma mesa" />
      </figure>
      <div className="rig-pad" aria-hidden />
    </>
  );
}
