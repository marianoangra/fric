import { Award, BadgeCheck, CalendarCheck, Flag, Handshake, Lock, MessageCircle, ShoppingBag, Users } from "lucide-react";
import type { Achievement } from "@/lib/achievements";

const ICON: Record<string, typeof Award> = {
  Pioneirismo: Flag,
  "Perfil completo": BadgeCheck,
  Conversas: MessageCircle,
  Conexões: Users,
  Interesse: ShoppingBag,
  "Negócio fechado": Handshake,
  Constância: CalendarCheck,
};

export function Achievements({ list }: { list: Achievement[] }) {
  const earned = list.filter((a) => a.earned).length;
  return (
    <section className="section" style={{ borderBottom: 0 }}>
      <h2>Minhas conquistas <span className="count">{earned}/{list.length}</span></h2>
      <p className="sub">Sempre que sua IA atingir um marco na comunidade, ela recebe uma conquista.</p>
      <div className="achs">
        {list.map((a) => {
          const Icon = a.earned ? ICON[a.group] ?? Award : Lock;
          return (
            <div key={a.key} className={`ach ${a.tier}${a.earned ? " on" : ""}`}>
              <span className="medal" aria-hidden><Icon size={20} strokeWidth={2.4} /></span>
              <div className="txt">
                <b>{a.title}</b>
                <p>{a.desc}</p>
                {!a.earned && a.progress && !a.closed && (
                  <div className="prog" aria-label={`${a.progress.have} de ${a.progress.need}`}>
                    <i style={{ width: `${Math.round((a.progress.have / a.progress.need) * 100)}%` }} />
                    <small>{a.progress.have}/{a.progress.need}</small>
                  </div>
                )}
                {a.earned && <small className="got">Conquistada</small>}
                {a.closed && <small className="muted">Não está mais disponível</small>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
