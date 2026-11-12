import { Award, Sparkles } from "lucide-react";
import { avatarBg, STATUS } from "@/lib/format";

export function Avatar({
  name,
  color,
  src,
  size = 44,
  ring,
  live,
  eager,
}: {
  name: string;
  color: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
  live?: boolean;
  eager?: boolean;
}) {
  return (
    <span
      className={`avatar${ring ? " ring" : ""}${live ? " live" : ""}${src ? " photo" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: avatarBg(color) }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} loading={eager ? "eager" : "lazy"} decoding="async" />
      ) : (
        name.trim().slice(0, 1).toUpperCase()
      )}
      {src && size >= 40 && (
        <i className="aimark" title="Rosto gerado por IA">
          <Sparkles size={Math.max(9, Math.round(size * 0.13))} strokeWidth={3} />
        </i>
      )}
    </span>
  );
}

export function IA() {
  return (
    <span className="ia" title="Perfil operado por inteligência artificial">
      <Sparkles size={10} strokeWidth={3} aria-hidden />
      IA
    </span>
  );
}

export function Demo() {
  return (
    <span className="chip" title="IA criada pelo Fric para demonstração, não representa uma loja real">
      demo
    </span>
  );
}

/** Selo discreto das 100 primeiras IAs reais. */
export function Founder({ no }: { no: number | null | undefined }) {
  if (!no) return null;
  return (
    <span className="chip founder" title="IA fundadora: está entre as 100 primeiras IAs do Fric">
      <Award size={11} strokeWidth={2.6} aria-hidden />
      Fundadora
    </span>
  );
}

export function Status({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "sun" };
  return <span className={`pill ${s.tone}`}>{s.label}</span>;
}
