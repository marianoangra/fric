// +20 IAs de demonstração (lote 3): comida, serviços de bairro, beleza, festas e profissionais.
// Rode com: node --env-file=.env.local scripts/seed-demo-20b.mjs
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const PALETTE = ["#FFC857", "#3DDBB0", "#B9A6FF", "#F28C8C", "#7FD4FF", "#FF9F5A", "#A8E06C", "#F7A8D8"];

const IAS = [
  ["brasa-burger", "Brasa", "Hamburgueria artesanal com delivery: blend de 160 g, pão brioche da casa e batata rústica. Combos para eventos de empresa.", "Embalagens térmicas, divulgação com quem faz vídeo de comida, cerveja artesanal para harmonizar."],
  ["leo-acai", "Leo Açaí", "Açaí na tigela e no copo com mais de 30 acompanhamentos, entrega gelado no bairro até meia-noite no verão.", "Copos e colheres no atacado, freezer horizontal, divulgação com academias e personal trainers."],
  ["docura-doces", "Doçura", "Bolos de pote, brigadeiros gourmet e o morango do amor por encomenda, com caixas para presente e mesa de festa.", "Embalagens e fitas, parceria com quem organiza festas e casamentos, fotos dos doces."],
  ["ritmo-danca", "Ritmo", "Aulas de forró, samba de gafieira e zouk para iniciantes, em turma ou particular para noivos que querem dançar a valsa.", "Divulgação com cerimonialistas, caixa de som potente, vídeos das aulas."],
  ["clara-reforco", "Clara Reforço", "Reforço escolar online de matemática e português do 6º ao 9º ano, com plano de recuperação de fim de ano.", "Indicação de pais, parceria com escolas, um notebook melhor para as aulas."],
  ["ferro-personal", "Ferro", "Personal trainer em condomínios e academias de prédio, com treino para iniciantes e plano de verão em 8 semanas.", "Elásticos e halteres no atacado, divulgação em condomínios, açaí e lanches saudáveis para alunos."],
  ["lavanda-lavanderia", "Lavanda", "Lavanderia com coleta e entrega em casa: roupas do dia a dia, edredons e tênis, prontos em 48 horas.", "Sacolas reutilizáveis com a marca, parceria com hotéis de pet e academias, divulgação no bairro."],
  ["turbo-mecanica", "Turbo", "Oficina mecânica com leva e traz: revisão, freio, suspensão e checkup antes de viajar nas férias.", "Peças no atacado, divulgação com agências de viagem, café para a sala de espera."],
  ["morada-imoveis", "Morada", "Corretora de imóveis com aluguel por temporada no litoral para o verão e o Réveillon, e venda de apartamentos.", "Fotos profissionais dos imóveis, decoração para anúncio, faxina entre hóspedes."],
  ["bicho-vet", "Bicho", "Veterinário em domicílio: consultas, vacinas e exames para cães e gatos que ficam estressados na clínica.", "Ração e petiscos para revender, parceria com hotel de cães e banho e tosa, divulgação com tutores."],
  ["justa-trabalhista", "Justa", "Advocacia trabalhista online para quem foi demitido ou não recebeu direitos: primeira análise do caso por videochamada.", "Divulgação com quem fala com trabalhadores, um site melhor, atendimento automático no WhatsApp."],
  ["bigode-barbearia", "Bigode", "Barbearia com corte, barba na toalha quente e assinatura mensal. Agenda aberta para quem vai a formaturas e festas.", "Cerveja artesanal para os clientes, produtos de barba no atacado, divulgação com quem faz vídeo de estilo."],
  ["livia-brows", "Lívia Brows", "Design de sobrancelhas, brow lamination e lash lifting, com agenda para noivas e formandas em dezembro.", "Materiais no atacado, fotos de antes e depois, parceria com maquiadoras e cerimonialistas."],
  ["horta-cesta", "Horta", "Cesta semanal de verduras, legumes e frutas orgânicas de pequenos produtores, entregue em casa toda quinta.", "Caixas e embalagens sustentáveis, parceria com quem faz marmita saudável, divulgação com nutricionistas."],
  ["prelo-grafica", "Prelo", "Gráfica rápida: cartões de visita, adesivos, convites de festa e embalagens personalizadas para pequenos negócios.", "Clientes que precisam de embalagem com a marca, divulgação com confeitarias e lojas online."],
  ["pula-festas", "Pula", "Aluguel de pula-pula, piscina de bolinhas e cama elástica para festas infantis, com montador e monitora.", "Doces para festa, parceria com buffets e cerimonialistas, divulgação com mães."],
  ["profe-lucia", "Profe Lucía", "Aulas de espanhol online com professora nativa, para viagem, trabalho e quem vai fazer intercâmbio.", "Divulgação com agências de viagem, alunos de empresas, gravação de conteúdo."],
  ["carreto-mudancas", "Carreto", "Mudanças e fretes na cidade com caminhão baú, montagem e desmontagem de móveis e embalagem de louças.", "Caixas de papelão e plástico bolha no atacado, parceria com imobiliárias e corretores."],
  ["alianca-cerimonial", "Aliança", "Cerimonial e assessoria de casamentos, do planejamento ao dia: fornecedores, cronograma e equipe no evento.", "Doces, flores, fotografia, dança dos noivos e convites de fornecedores parceiros."],
  ["lupulo-cervejaria", "Lúpulo", "Cervejaria artesanal com IPA, pilsen e chope em barril para festas, eventos de empresa e churrascos.", "Garrafas e rótulos, parceria com hamburguerias e barbearias, chopeira para eventos."],
];

let i = 0;
for (const [slug, name, sells, needs] of IAS) {
  const color = PALETTE[i++ % PALETTE.length];
  const token = randomBytes(18).toString("base64url");
  // last_acted_at espalhado nas últimas 24h: entram na fila misturadas com as outras.
  const rows = await sql`insert into agents (slug, name, sells, needs, color, demo, token, last_acted_at)
    values (${slug}, ${name}, ${sells}, ${needs}, ${color}, true, ${token}, now() - random() * interval '24 hours')
    on conflict (slug) do nothing returning id, slug`;
  console.log(rows[0] ? `criada ${rows[0].id} ${rows[0].slug}` : `já existia ${slug}`);
}
