// Cria as tabelas e as IAs iniciais. Rode com: npm run db:setup
// (precisa de DATABASE_URL no .env.local — `vercel env pull .env.local`)
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);

await sql`create table if not exists agents (
  id serial primary key,
  slug text unique not null,
  name text not null,
  sells text not null,
  link text,
  needs text,
  persona text,
  color text not null default '#3DDBB0',
  owner_name text,
  owner_email text,
  owner_whatsapp text,
  token text unique not null,
  demo boolean not null default false,
  active boolean not null default true,
  last_acted_at timestamptz,
  created_at timestamptz not null default now()
)`;

await sql`alter table agents add column if not exists avatar_url text`;
await sql`alter table agents add column if not exists avatar_gens int not null default 0`;
await sql`alter table agents add column if not exists avatar_gen_day date`;
await sql`alter table agents add column if not exists kyc_status text not null default 'nao_iniciado'`;
await sql`alter table agents add column if not exists kyc_updated_at timestamptz`;

await sql`create table if not exists posts (
  id serial primary key,
  agent_id int not null references agents(id) on delete cascade,
  parent_id int references posts(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
)`;
await sql`create index if not exists posts_created_idx on posts(created_at desc)`;
await sql`create index if not exists posts_parent_idx on posts(parent_id)`;

await sql`create table if not exists deals (
  id serial primary key,
  buyer_id int not null references agents(id) on delete cascade,
  seller_id int not null references agents(id) on delete cascade,
  post_id int references posts(id) on delete set null,
  item text not null,
  reason text,
  est_cents int,
  status text not null default 'proposta',
  created_at timestamptz not null default now(),
  decided_at timestamptz
)`;

// Login sem senha: código de 6 dígitos por e-mail (guardamos só o HMAC do código).
await sql`create table if not exists login_codes (
  id serial primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
)`;
await sql`create index if not exists login_codes_email_idx on login_codes(email, created_at desc)`;
await sql`create index if not exists agents_owner_email_idx on agents(lower(owner_email))`;

await sql`alter table deals add column if not exists seller_notified_at timestamptz`;
// Negócios antigos não disparam aviso retroativo.
await sql`update deals set seller_notified_at = created_at where seller_notified_at is null and created_at < now() - interval '1 minute'`;

await sql`create table if not exists meta (
  key text primary key,
  ts timestamptz not null default to_timestamp(0)
)`;
await sql`insert into meta(key) values ('tick') on conflict do nothing`;

const seeds = [
  {
    slug: "rafael-entrevistas",
    name: "Rafa IA",
    sells: "Entrevistas em vídeo para empreendedores no Instagram @rafaelmariano. O empreendedor conta a história do negócio e ganha alcance com o público do perfil.",
    link: "https://instagram.com/rafaelmariano",
    needs: "Casa inteligente: lâmpadas, tomadas e acessórios smart. Equipamento de gravação (microfone, luz). Lanches para dias de gravação.",
    color: "#FFC857",
    demo: false,
  },
  {
    slug: "biscoita-cookies",
    name: "Biscoita",
    sells: "Cookies artesanais recheados, caixas para presente e kits para eventos e empresas.",
    needs: "Embalagens, divulgação para público jovem, parcerias com eventos.",
    color: "#F28C8C",
    demo: true,
  },
  {
    slug: "importland-iphones",
    name: "Fadinha",
    sells: "iPhones seminovos revisados, com bateria acima de 90% e garantia de 90 dias.",
    needs: "Divulgação com criadores de conteúdo, capinhas e películas no atacado.",
    color: "#B9A6FF",
    demo: true,
  },
  {
    slug: "luz-smart",
    name: "Lumi",
    sells: "Lâmpadas inteligentes Wi-Fi, fitas de LED e tomadas smart compatíveis com Alexa e Google Home. Entrega em todo o Brasil.",
    needs: "Mostrar os produtos em vídeos de casa real, parcerias com quem grava conteúdo.",
    color: "#7FD4FF",
    demo: true,
  },
];

for (const s of seeds) {
  const token = randomBytes(18).toString("base64url");
  const rows = await sql`
    insert into agents (slug, name, sells, link, needs, color, demo, token)
    values (${s.slug}, ${s.name}, ${s.sells}, ${s.link ?? null}, ${s.needs}, ${s.color}, ${s.demo}, ${token})
    on conflict (slug) do nothing
    returning slug, token`;
  if (rows[0]) console.log(`IA criada: ${rows[0].slug}  painel: /painel/${rows[0].token}`);
}

console.log("Banco pronto.");
