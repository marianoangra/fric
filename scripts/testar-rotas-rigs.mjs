// Teste de ponta a ponta das rotas /api/rigs/* contra `npm run dev`.
// Rode: node --env-file=.env.local scripts/testar-rotas-rigs.mjs [--manter]
// Cria rigs com nome "teste-*" e apaga todas no fim (a não ser com --manter, que deixa 1 ativa).
import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);
const manter = process.argv.includes("--manter");
const h = (s) => createHash("sha256").update(s).digest("hex");
const seg = () => randomBytes(32).toString("base64url");

async function post(path, body, segredo) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(segredo ? { authorization: `Bearer ${segredo}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

const pulso = {
  versao: "0.1.0", uptime_s: 10,
  gpu: null, cpu: { temp_c: null, carga_1m: 0.2 },
  ollama: { ok: false, modelos_carregados: [] }, guardia: null, leila: { gate_ok: false },
};

let falhas = 0;
async function caso(nome, fn) {
  try { await fn(); console.log("ok  ", nome); }
  catch (e) { falhas++; console.log("FALHA", nome, "\n     ", e.message); }
}

await sql`delete from rigs where nome like 'teste-%'`;

const sA = seg();
let rigA;
await caso("registrar sem convite → pendente com código", async () => {
  const r = await post("/api/rigs/registrar", { segredo: sA, nome_sugerido: "teste-a", versao: "0.1.0" });
  assert.equal(r.status, 201);
  assert.equal(r.json.estado, "pendente");
  assert.match(r.json.codigo, /^[A-Z2-9]{2}-[A-Z2-9]{3}$/);
  rigA = r.json.rig_id;
});
await caso("mesmo segredo → mesma rig", async () => {
  const r = await post("/api/rigs/registrar", { segredo: sA, nome_sugerido: "teste-a", versao: "0.1.0" });
  assert.equal(r.json.rig_id, rigA);
});
await caso("pulso de pendente → sem comandos, visto_em gravado", async () => {
  await sql`insert into rig_comandos (rig_id, tipo) values (${rigA}, 'pausar')`;
  const r = await post("/api/rigs/pulso", pulso, sA);
  assert.equal(r.status, 200);
  assert.equal(r.json.estado, "pendente");
  assert.deepEqual(r.json.comandos, []);
  const [x] = await sql`select visto_em, ultimo_status from rigs where id = ${rigA}`;
  assert.ok(x.visto_em);
  assert.equal(x.ultimo_status.uptime_s, 10);
});

const convite = seg();
const sB = seg();
let rigB;
await caso("convite válido → ativa; segundo uso → pendente", async () => {
  await sql`insert into rig_convites (hash, expira_em) values (${h(convite)}, now() + interval '7 days')`;
  const r = await post("/api/rigs/registrar", { segredo: sB, convite, nome_sugerido: "teste-b", versao: "0.1.0" });
  assert.equal(r.status, 201);
  assert.equal(r.json.estado, "ativa");
  rigB = r.json.rig_id;
  const r2 = await post("/api/rigs/registrar", { segredo: seg(), convite, nome_sugerido: "teste-c", versao: "0.1.0" });
  assert.equal(r2.json.estado, "pendente");
});
await caso("convite expirado → pendente", async () => {
  const c = seg();
  await sql`insert into rig_convites (hash, expira_em) values (${h(c)}, now() - interval '1 minute')`;
  const r = await post("/api/rigs/registrar", { segredo: seg(), convite: c, nome_sugerido: "teste-d", versao: "0.1.0" });
  assert.equal(r.json.estado, "pendente");
  await sql`delete from rig_convites where hash = ${h(c)}`;
});

let cmdB;
await caso("ativa recebe comando uma vez só", async () => {
  [{ id: cmdB }] = await sql`insert into rig_comandos (rig_id, tipo) values (${rigB}, 'pausar') returning id`;
  const r = await post("/api/rigs/pulso", pulso, sB);
  assert.equal(r.json.estado, "ativa");
  assert.deepEqual(r.json.comandos, [{ id: cmdB, tipo: "pausar" }]);
  const r2 = await post("/api/rigs/pulso", pulso, sB);
  assert.deepEqual(r2.json.comandos, []);
});
await caso("comando com 11 min não vem", async () => {
  await sql`insert into rig_comandos (rig_id, tipo, criado_em) values (${rigB}, 'reiniciar_rig', now() - interval '11 minutes')`;
  const r = await post("/api/rigs/pulso", pulso, sB);
  assert.deepEqual(r.json.comandos, []);
});
await caso("resultado grava; comando de outra rig → 404", async () => {
  const r = await post("/api/rigs/resultado", { comando_id: cmdB, ok: true, texto: "pausada" }, sB);
  assert.equal(r.status, 200);
  const [x] = await sql`select ok, concluido_em, resultado from rig_comandos where id = ${cmdB}`;
  assert.equal(x.ok, true);
  assert.ok(x.concluido_em);
  assert.equal(x.resultado, "pausada");
  const r2 = await post("/api/rigs/resultado", { comando_id: cmdB, ok: true, texto: "x" }, sA);
  assert.equal(r2.status, 404);
});
await caso("Bearer errado → 401; sem Bearer → 401", async () => {
  assert.equal((await post("/api/rigs/pulso", pulso, seg())).status, 401);
  assert.equal((await post("/api/rigs/pulso", pulso)).status, 401);
});
await caso("rig recusada → 401 no pulso e no registrar devolve recusada", async () => {
  await sql`update rigs set estado = 'recusada' where id = ${rigA}`;
  assert.equal((await post("/api/rigs/pulso", pulso, sA)).status, 401);
  const r = await post("/api/rigs/registrar", { segredo: sA, nome_sugerido: "teste-a", versao: "0.1.0" });
  assert.equal(r.json.estado, "recusada");
  assert.equal(r.json.codigo ?? null, null);
});
await caso("corpo de 9000 bytes → 413", async () => {
  const r = await post("/api/rigs/pulso", JSON.stringify({ ...pulso, lixo: "a".repeat(9000) }), sB);
  assert.equal(r.status, 413);
});
await caso("JSON lixo → 400; schema errado → 400", async () => {
  assert.equal((await post("/api/rigs/pulso", "{nao é json", sB)).status, 400);
  assert.equal((await post("/api/rigs/pulso", { uptime_s: "x" }, sB)).status, 400);
  assert.equal((await post("/api/rigs/registrar", { segredo: "curto" })).status, 400);
});
await caso("6ª pendente → 429", async () => {
  await sql`delete from rigs where nome like 'teste-%' and estado = 'pendente'`;
  const st = [];
  for (let i = 0; i < 6; i++) {
    st.push((await post("/api/rigs/registrar", { segredo: seg(), nome_sugerido: `teste-p${i}`, versao: "0.1.0" })).status);
  }
  assert.deepEqual(st, [201, 201, 201, 201, 201, 429]);
});
await caso("pendente com mais de 24 h some no próximo registro", async () => {
  await sql`update rigs set criada_em = now() - interval '25 hours' where nome like 'teste-p%'`;
  const r = await post("/api/rigs/registrar", { segredo: seg(), nome_sugerido: "teste-nova", versao: "0.1.0" });
  assert.equal(r.status, 201);
  const [{ n }] = await sql`select count(*)::int as n from rigs where nome like 'teste-p%'`;
  assert.equal(n, 0);
});

if (manter) {
  await sql`delete from rigs where nome like 'teste-%' and id <> ${rigB}`;
  console.log(`\nMantida rig teste-b (id ${rigB}). Segredo: ${sB}`);
} else {
  await sql`delete from rigs where nome like 'teste-%'`;
  await sql`delete from rig_convites where hash = ${h(convite)}`;
}
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK");
process.exit(falhas ? 1 : 0);
