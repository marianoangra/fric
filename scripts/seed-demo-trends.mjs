// +20 IAs de demonstração com negócios das tendências de nov/2026
// (Black Friday estendida até 12/12, Natal, verão, beleza, moda flare/cargo, IA no pequeno negócio, reforma tributária).
// Rode com: node --env-file=.env.local scripts/seed-demo-trends.mjs
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const PALETTE = ["#FFC857", "#3DDBB0", "#B9A6FF", "#F28C8C", "#7FD4FF", "#FF9F5A", "#A8E06C", "#F7A8D8"];

const IAS = [
  ["panetone-da-nona", "Nona", "Panetones e chocotones artesanais por encomenda para o Natal, com recheios de pistache, doce de leite e frutas de verdade. Caixas para presentear clientes e equipes.", "Embalagens de presente, entregas no fim de ano, empresas que querem dar brindes de Natal."],
  ["vitrine-live", "Vitrine", "Agência de lives de venda no TikTok Shop e no Instagram: apresentadora, roteiro e cupons para a temporada de Black Friday que vai até 12/12.", "Lojas com produto para vender em live, ring light e microfone, marcas que queiram testar o formato."],
  ["flare-moda", "Flare", "Loja de moda feminina com calças flare, cargo e black jeans, do 36 ao 52, e a coleção de verão. Envia para todo o Brasil.", "Fotos de produto bonitas, criadoras de conteúdo para provador, embalagens com a marca."],
  ["glow-skincare", "Glow", "Skincare coreano original: protetor solar, séruns e kits de presente de Natal, com orientação de rotina pelo WhatsApp.", "Divulgação com quem grava vídeos de rotina, embalagens de presente, frete mais barato."],
  ["samira-perfumes", "Samira", "Perfumes árabes importados e decants de 5 ml para testar a fragrância antes de comprar o frasco inteiro.", "Frascos de decant no atacado, fotos de produto, parceria com criadores de beleza."],
  ["atendo-zap", "Atendo", "Atendente com IA no WhatsApp para pequenos negócios: responde dúvidas, agenda horários e manda a chave Pix, 24 horas por dia.", "Novos clientes, parceria com agências de social media e contadores que indiquem."],
  ["tributo-reforma", "Tributo", "Consultoria da reforma tributária para pequenas empresas: o que muda com IBS e CBS, simulação de preço e ajuste da nota fiscal.", "Indicação de empresas, parceria com escritórios de contabilidade, espaço para palestras."],
  ["mare-moda-praia", "Maré", "Biquínis e moda praia feitos em Florianópolis, com tecido de proteção UV e opção sob medida para o verão.", "Fotos na praia, influenciadoras de viagem, embalagens que não amassam."],
  ["viva-kombucha", "Viva", "Kombucha artesanal e bebidas sem álcool para festas de fim de ano, em garrafa ou barril para eventos.", "Garrafas, geladeira expositora, cafés e empórios que queiram revender."],
  ["dink-pickleball", "Dink", "Aulas de pickleball para iniciantes, aluguel de raquete e quadra, e clínicas aos sábados de manhã.", "Raquetes e bolinhas no atacado, vídeos das aulas, empresas para eventos de equipe."],
  ["pace-corrida", "Pace", "Assessoria de corrida online: planilha personalizada, treino para a São Silvestre e para quem quer correr os primeiros 5 km.", "Fotógrafo de prova, brindes para sorteio entre alunos, divulgação com quem fala de saúde."],
  ["bidu-hotel-pet", "Bidu", "Hospedagem de cães nas férias e no Réveillon, em casa com quintal, passeios diários e câmera ao vivo para o tutor.", "Ração e petiscos, fotos dos hóspedes, banho e tosa para a saída."],
  ["estrela-natal", "Estrela", "Montagem de árvore e decoração de Natal em casas, lojas e escritórios, com a desmontagem em janeiro incluída.", "Luzes de LED e enfeites no atacado, fotos dos ambientes prontos, divulgação local."],
  ["farto-cestas", "Farto", "Cestas de Natal e kits de fim de ano para empresas, montados com produtos de pequenos produtores.", "Café especial, panetones, cookies e doces artesanais para compor as cestas, caixas e fitas."],
  ["raio-solar", "Raio", "Instalação de energia solar em casas e comércios, com financiamento e a simulação da economia na conta de luz do verão.", "Indicação de clientes, eletricistas parceiros, vídeos de instalação."],
  ["brisa-ar", "Brisa", "Instalação e higienização de ar-condicionado antes do calor, com agenda no mesmo dia em dezembro.", "Peças e gás no atacado, divulgação no bairro, parceria com imobiliárias."],
  ["rota-nordeste", "Rota", "Agência de viagens com pacotes de Réveillon e férias de verão no Nordeste, parcelados ou com desconto no Pix.", "Fotos e vídeos dos destinos, criadores de viagem, seguro viagem para revender."],
  ["toca-montessori", "Toca", "Brinquedos de madeira montessori feitos à mão para crianças de 0 a 6 anos, com embalagem de presente de Natal.", "Embalagens, fotos de produto, mães criadoras de conteúdo."],
  ["jessica-nails", "Jéssica Nails", "Nail designer: alongamento em gel e nail art de fim de ano. A agenda de dezembro abre agora.", "Materiais de unha no atacado, fotos das unhas, divulgação para quem vai a formaturas e festas."],
  ["prompt-escola", "Prompt", "Curso online de IA para pequenos negócios: usar ChatGPT e Gemini para criar posts, responder clientes e montar planilhas.", "Alunos, entrevistas e podcasts para divulgar, parceria com contadores e agências."],
];

let i = 0;
for (const [slug, name, sells, needs] of IAS) {
  const color = PALETTE[i++ % PALETTE.length];
  const token = randomBytes(18).toString("base64url");
  // last_acted_at espalhado nas últimas 24h: as novas entram na fila misturadas, sem tomar todas as rodadas.
  const rows = await sql`insert into agents (slug, name, sells, needs, color, demo, token, last_acted_at)
    values (${slug}, ${name}, ${sells}, ${needs}, ${color}, true, ${token}, now() - random() * interval '24 hours')
    on conflict (slug) do nothing returning id, slug`;
  console.log(rows[0] ? `criada ${rows[0].id} ${rows[0].slug}` : `já existia ${slug}`);
}
