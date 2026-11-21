import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gerarCodigo, hashSegredo, pulsoSchema, resultadoSchema, registrarSchema,
  estaOnline, comandoValido, TIPOS_COMANDO, gerarConvite,
} from "../lib/rigs-core.ts";

const pulsoCompleto = {
  versao: "0.1.0", uptime_s: 3600,
  gpu: { temp_c: 52, uso_pct: 37, vram_usada_mb: 2048 },
  cpu: { temp_c: 48, carga_1m: 0.7 },
  ollama: { ok: true, modelos_carregados: [{ nome: "leila:latest", vram_mb: 4768 }] },
  guardia: { servico: "ativa", pausada: false, ts_ultimo_ciclo: "2026-11-18T20:00:00+00:00", postura: "atencao",
             cor: "laranja", motivo: "CPI amanhã", pct_protegido: 0.85, margem: 0.6 },
  leila: { gate_ok: true },
};

test("gerarCodigo usa formato XX-XXX sem letras ambíguas", () => {
  for (let i = 0; i < 200; i++) assert.match(gerarCodigo(), /^[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{3}$/);
});

test("hashSegredo é sha256 hex", () => {
  assert.equal(hashSegredo("a"), "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
});

test("gerarConvite tem 43 chars base64url e muda a cada chamada", () => {
  const a = gerarConvite();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, gerarConvite());
});

test("pulsoSchema aceita completo, gpu null, guardia null e instalacao", () => {
  assert.ok(pulsoSchema.safeParse(pulsoCompleto).success);
  assert.ok(pulsoSchema.safeParse({ ...pulsoCompleto, gpu: null, guardia: null }).success);
  assert.ok(pulsoSchema.safeParse({ ...pulsoCompleto, instalacao: { etapa: "ollama", ok: null, erro: null, saida: null } }).success);
  assert.ok(pulsoSchema.safeParse({ ...pulsoCompleto, cpu: { temp_c: null, carga_1m: 0.1 } }).success);
});

test("pulsoSchema: terminal_url só do Tailscale, o resto vira null sem derrubar o pulso", () => {
  const ok = pulsoSchema.safeParse({ ...pulsoCompleto, terminal_url: "https://rig1660s.tail1234.ts.net/" });
  assert.equal(ok.success && ok.data.terminal_url, "https://rig1660s.tail1234.ts.net/");
  for (const ruim of ["https://evil.com/", "http://rig1660s.tail1234.ts.net/", "javascript:alert(1)", "https://x.ts.net.evil.com/"]) {
    const r = pulsoSchema.safeParse({ ...pulsoCompleto, terminal_url: ruim });
    assert.ok(r.success);
    assert.equal(r.data.terminal_url, null);
  }
  assert.equal(pulsoSchema.safeParse(pulsoCompleto).data?.terminal_url, undefined);
});

test("pulsoSchema rejeita lixo", () => {
  assert.equal(pulsoSchema.safeParse({ uptime_s: "x" }).success, false);
  assert.equal(pulsoSchema.safeParse("oi").success, false);
});

test("resultadoSchema limita texto a 8000", () => {
  assert.ok(resultadoSchema.safeParse({ comando_id: 1, ok: true, texto: "a".repeat(8000) }).success);
  assert.equal(resultadoSchema.safeParse({ comando_id: 1, ok: true, texto: "a".repeat(8001) }).success, false);
});

test("registrarSchema exige segredo longo", () => {
  assert.equal(registrarSchema.safeParse({ segredo: "curto", nome_sugerido: "rig", versao: "1" }).success, false);
  assert.ok(registrarSchema.safeParse({ segredo: "x".repeat(43), nome_sugerido: "rig", versao: "1" }).success);
});

test("estaOnline: até 180 s", () => {
  const agora = new Date("2026-11-18T20:00:00Z");
  assert.equal(estaOnline(new Date(agora.getTime() - 179_000), agora), true);
  assert.equal(estaOnline(new Date(agora.getTime() - 181_000), agora), false);
  assert.equal(estaOnline(null, agora), false);
});

test("comandoValido: até 600 s", () => {
  const agora = new Date("2026-11-18T20:00:00Z");
  assert.equal(comandoValido(new Date(agora.getTime() - 599_000), agora), true);
  assert.equal(comandoValido(new Date(agora.getTime() - 601_000), agora), false);
});

test("lista fechada de comandos", () => {
  assert.deepEqual([...TIPOS_COMANDO], ["pausar", "retomar", "reiniciar_guardia", "reiniciar_rig", "ver_log"]);
});
