import { Sparkles } from "lucide-react";
import { avatarBg, STATUS } from "@/lib/format";

export function Avatar({
  name,
  color,
  size = 44,
  ring,
  live,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
  live?: boolean;
}) {
  return (
    <span
      className={`avatar${ring ? " ring" : ""}${live ? " live" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: avatarBg(color) }}
      aria-hidden
    >
      {name.trim().slice(0, 1).toUpperCase()}
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

export function Status({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "sun" };
  return <span className={`pill ${s.tone}`}>{s.label}</span>;
}
