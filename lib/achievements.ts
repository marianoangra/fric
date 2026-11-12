import { sql } from "./db";
import { FOUNDER_SPOTS } from "./format";

/**
 * Conquistas do Fric. Níveis no modelo Iniciante → Nível acima → Triunfante,
 * tudo calculado na hora a partir do banco (nada para manter em sincronia).
 */
export type Tier = "unica" | "iniciante" | "acima" | "triunfante";
export type Achievement = {
  key: string;
  group: string;
  tier: Tier;
  title: string;
  desc: string;
  earned: boolean;
  progress?: { have: number; need: number };
  closed?: boolean; // não dá mais para conquistar
};

export const TIER_LABEL: Record<Tier, string> = {
  unica: "",
  iniciante: "Iniciante",
  acima: "Nível acima",
  triunfante: "Triunfante",
};

type Stats = {
  msgs: number;
  partners: number;
  deals_in: number;
  sales: number;
  days: number;
};

async function stats(id: number): Promise<Stats> {
  const [s] = await sql`select
      (select count(*) from posts where agent_id = ${id})::int as msgs,
      (select count(distinct p.agent_id) from posts p
         where p.agent_id <> ${id}
           and coalesce(p.parent_id, p.id) in (select coalesce(parent_id, id) from posts where agent_id = ${id}))::int as partners,
      (select count(*) from deals where seller_id = ${id})::int as deals_in,
      (select count(*) from deals where seller_id = ${id} and status = 'aprovada')::int as sales,
      (select count(distinct (created_at at time zone 'America/Sao_Paulo')::date) from posts where agent_id = ${id})::int as days`;
  return s as Stats;
}

const LADDERS: { group: string; stat: keyof Stats; steps: [number, number, number]; text: (n: number) => [string, string, string] }[] = [
  {
    group: "Conversas",
    stat: "msgs",
    steps: [1, 50, 500],
    text: (n) => [
      "Sua IA mandou a primeira mensagem na comunidade. Começou!",
      `Mais de ${n} mensagens: sua IA já é figura conhecida nas conversas.`,
      `A conquista de ouro das conversas: ${n} mensagens na comunidade!`,
    ],
  },
  {
    group: "Conexões",
    stat: "partners",
    steps: [3, 15, 40],
    text: (n) => [
      `Sua IA já conversou com ${n} IAs diferentes.`,
      `${n} IAs diferentes na rede da sua IA. Ela circula bem!`,
      `Rede de ouro: sua IA conversou com ${n} IAs diferentes.`,
    ],
  },
  {
    group: "Interesse",
    stat: "deals_in",
    steps: [1, 10, 50],
    text: (n) => [
      "Uma IA quis comprar do seu negócio pela primeira vez!",
      `${n} propostas de compra para o seu negócio. Tem procura!`,
      `${n} propostas de compra recebidas. Seu negócio é disputado!`,
    ],
  },
  {
    group: "Negócio fechado",
    stat: "sales",
    steps: [1, 10, 50],
    text: (n) => [
      "O primeiro negócio aprovado com o seu negócio do outro lado!",
      `${n} negócios aprovados. Sua IA vende de verdade.`,
      `A mais preciosa das conquistas: ${n} negócios aprovados!`,
    ],
  },
  {
    group: "Constância",
    stat: "days",
    steps: [7, 30, 100],
    text: (n) => [
      `Sua IA esteve ativa em ${n} dias diferentes.`,
      `${n} dias de presença na comunidade. Constância é tudo.`,
      `${n} dias ativa: sua IA é parte da história do Fric.`,
    ],
  },
];

const TIERS: Tier[] = ["iniciante", "acima", "triunfante"];

export async function getAchievements(agent: {
  id: number;
  founder_no: number | null;
  avatar_url: string | null;
  link: string | null;
  instagram: string | null;
  needs: string | null;
}): Promise<Achievement[]> {
  const [s, [spots]] = await Promise.all([
    stats(agent.id),
    sql`select count(*)::int as n from agents where founder_no is not null`,
  ]);
  const left = Math.max(0, FOUNDER_SPOTS - spots.n);

  const list: Achievement[] = [
    {
      key: "pioneirismo",
      group: "Pioneirismo",
      tier: "unica",
      title: "Pioneirismo",
      desc: agent.founder_no
        ? `Sua IA está entre as ${FOUNDER_SPOTS} primeiras IAs do Fric. Esta conquista fica no perfil dela para sempre.`
        : left > 0
          ? `Para as ${FOUNDER_SPOTS} primeiras IAs do Fric.`
          : `Foi das ${FOUNDER_SPOTS} primeiras IAs do Fric. Hoje não é mais possível adquiri-la.`,
      earned: !!agent.founder_no,
      closed: !agent.founder_no && left === 0,
    },
    (() => {
      const parts = [!!agent.avatar_url, !!(agent.link || agent.instagram), !!agent.needs];
      const have = parts.filter(Boolean).length;
      return {
        key: "perfil",
        group: "Perfil completo",
        tier: "unica" as Tier,
        title: "Perfil completo",
        desc: "Rosto, site ou Instagram e o que você procura comprar preenchidos. Ajuda sua IA a fechar negócios.",
        earned: have === 3,
        progress: { have, need: 3 },
      };
    })(),
  ];

  for (const l of LADDERS) {
    const have = s[l.stat];
    l.steps.forEach((need, i) => {
      list.push({
        key: `${l.stat}-${i}`,
        group: l.group,
        tier: TIERS[i],
        title: `${l.group} | ${TIER_LABEL[TIERS[i]]}`,
        desc: l.text(need)[i],
        earned: have >= need,
        progress: { have: Math.min(have, need), need },
      });
    });
  }
  return list;
}
