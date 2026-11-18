# Painel "Minhas rigs" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rig RX 590 sem monitor instala Ubuntu sozinha pelo pendrive, se pareia com o fric.com.br e é vista/controlada pela seção "Minhas rigs" do admin.

**Architecture:** A rig chama o site (pulso a cada 60 s, Bearer com segredo próprio; comandos pendentes voltam na resposta). Site = Next 16 + Neon (repo `~/Desktop/fric`). Rig = agente Python só stdlib `fric-rig` + instalador de primeiro boot (repo `~/Desktop/fric-guardia`, pasta `agente/` e `rig/`).

**Tech Stack:** Next 16 (App Router, route handlers, server actions), `@neondatabase/serverless`, zod 4, `node --test` (Node 24, TS por strip-types); Python ≥3.10 stdlib + pytest; Ubuntu Server 24.04 autoinstall; systemd; Ollama (Vulkan); Tailscale.

**Spec:** `docs/superpowers/specs/2026-11-18-painel-minhas-rigs-design.md`

## Global Constraints
- Comandos: só `pausar`, `retomar`, `reiniciar_guardia`, `reiniciar_rig`, `ver_log`. Tipo desconhecido: o agente ignora e reporta erro.
- Corpo de pulso e de resultado ≤ 8 KB; acima → 413.
- Comando não entregue em 10 min expira. Offline = `visto_em` > 3 min. Pendentes expiram em 24 h; máx. 5 pendentes ao mesmo tempo (6º → 429).
- Convite: uso único, 7 dias. Site guarda só `sha256` de segredo e de convite.
- Rig `pendente`/`recusada` nunca recebe comando.
- Agente nunca lê `/etc/guardia.env` nem o diário; apaga `0x` + 64 hex de qualquer texto antes de enviar.
- `FRIC_URL=https://fric.com.br`. Hostname da rig `rig2e3530`.
- Admin: só acrescentar seção, no visual existente (layout congelado). Sem `confirm()` do navegador.
- Next 16 tem mudanças: ler `node_modules/next/dist/docs/01-app` (route handlers, server actions) antes de escrever rota.
- Push no repo fric publica na Vercel: só com OK explícito do user. Instalação na rig: quem roda é o user.

## Review Focus
- Pulso com JSON malformado, campos faltando ou `null` (GPU sem sensor): o site aceita o que valida, guarda, nunca 500 → teste em Task 1 (`pulsoSchema` aceita gpu null, rejeita lixo).
- Segredo de rig recusada/removida continua batendo: 401 sempre, sem comando → teste em Task 2.
- Comando criado com rig offline há 1 h: ao voltar, não executa (expirado) → teste em Task 1 (`comandoValido`).
- Site fora do ar / sem internet na rig: agente não trava nem derruba a Guardiã, faz backoff até 300 s → teste em Task 6.
- Log com chave privada dentro: chega ao site redigido → teste em Task 6 (`redigir`).

---

### Task 1: Núcleo puro das rigs + migração (fric)

**Files:**
- Create: `lib/rigs-core.ts` (sem imports de `server-only`/next; só `node:crypto` e zod)
- Create: `tests/rigs-core.test.ts`
- Modify: `scripts/setup-db.mjs` (acrescentar no fim)
- Modify: `package.json` (script `"test": "node --test --experimental-strip-types tests/"`)

**Interfaces:**
- Produces:
  - `type TipoComando = "pausar"|"retomar"|"reiniciar_guardia"|"reiniciar_rig"|"ver_log"`; `TIPOS_COMANDO: readonly TipoComando[]`
  - `hashSegredo(s: string): string` (sha256 hex)
  - `gerarCodigo(): string` formato `XX-XXX`, alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
  - `gerarConvite(): string` (32 bytes base64url)
  - `pulsoSchema` (zod) conforme spec: `versao` string, `uptime_s` number, `gpu` obj|null, `cpu` obj, `ollama {ok, modelos_carregados: {nome, vram_mb}[]}`, `guardia` obj|null, `leila {gate_ok}`, `instalacao {etapa, ok, erro, saida}`|null|ausente; números opcionais podem ser null
  - `resultadoSchema`: `{comando_id: int, ok: boolean, texto: string max 8000}`
  - `registrarSchema`: `{segredo: string min 32, convite?: string, nome_sugerido: string max 40, versao: string}`
  - `LIMITE_BYTES = 8192`, `estaOnline(vistoEm: Date|null, agora: Date): boolean` (≤ 180 s), `comandoValido(criadoEm: Date, agora: Date): boolean` (≤ 600 s)
- Tabelas (setup-db): `rigs(id serial pk, nome text, segredo_hash text unique not null, codigo text, estado text not null default 'pendente', dono_email text, versao text, ultimo_status jsonb, visto_em timestamptz, criada_em timestamptz default now(), confirmada_em timestamptz)`; `rig_convites(id serial pk, hash text unique not null, expira_em timestamptz not null, usado_em timestamptz, criado_em timestamptz default now())`; `rig_comandos(id serial pk, rig_id int references rigs(id) on delete cascade, tipo text not null, criado_em timestamptz default now(), entregue_em timestamptz, concluido_em timestamptz, ok boolean, resultado text)` + índice `(rig_id, entregue_em)`.

- [ ] **Step 1: Testes que falham** — `tests/rigs-core.test.ts`:
  - `gerarCodigo` casa `/^[A-HJ-NP-Z2-9]{2}-[A-HJ-NP-Z2-9]{3}$/` em 200 chamadas.
  - `hashSegredo("a")` = `"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"`.
  - `pulsoSchema` aceita exemplo completo, aceita `gpu: null` e `guardia: null`, rejeita `{uptime_s: "x"}`.
  - `resultadoSchema` rejeita texto de 8001 chars.
  - `estaOnline(agora-179s)` true, `(agora-181s)` false, `(null)` false.
  - `comandoValido(agora-599s)` true, `(agora-601s)` false.
- [ ] **Step 2:** `npm test` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `lib/rigs-core.ts` com as assinaturas acima.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Acrescentar tabelas em `scripts/setup-db.mjs`; rodar `npm run db:setup` (idempotente; só `create ... if not exists`). Esperado: termina sem erro.
- [ ] **Step 6: Commit** `feat(rigs): núcleo puro, schemas e tabelas`

### Task 2: Rotas da rig (fric)

**Files:**
- Create: `lib/rigs.ts` (`import "server-only"`; consultas)
- Create: `app/api/rigs/registrar/route.ts`, `app/api/rigs/pulso/route.ts`, `app/api/rigs/resultado/route.ts`
- Create: `scripts/testar-rotas-rigs.mjs` (teste de ponta a ponta contra `next dev`)

**Interfaces:**
- Consumes: Task 1.
- Produces (`lib/rigs.ts`):
  - `rigPorSegredo(segredo: string): Promise<{id, estado}|null>`
  - `registrarRig(d: z.infer<typeof registrarSchema>): Promise<{rig_id, estado, codigo|null} | {erro: "muitas_pendentes"}>` — convite válido (hash bate, não usado, não expirado) → `ativa` e queima convite na mesma consulta; senão `pendente` com `gerarCodigo()`. Antes, apaga pendentes com mais de 24 h. Segredo já existente → devolve a mesma rig (idempotente).
  - `gravarPulso(rigId, status): Promise<{id, tipo}[]>` — grava `ultimo_status`, `visto_em=now()`, `versao`; se `ativa`, marca `entregue_em=now()` e devolve comandos com `entregue_em is null and criado_em > now() - interval '10 minutes'`.
  - `gravarResultado(rigId, r): Promise<boolean>` — só no comando dessa rig.
- Rotas: `POST`; ler `req.text()`, >8192 bytes → 413; JSON inválido/schema → 400; Bearer ausente/desconhecido/rig `recusada` → 401. `pulso` responde `{estado, comandos}` (comandos `[]` se não ativa). `registrar` → 201 `{rig_id, estado, codigo}` ou 429.

- [ ] **Step 1: Teste que falha** — `scripts/testar-rotas-rigs.mjs` (usa `fetch` em `BASE=http://localhost:3000` e `sql` do Neon para preparar/limpar; todas as rigs criadas com `nome_sugerido` `teste-*` e apagadas no fim). Casos:
  - registrar sem convite → 201 `estado:"pendente"`, `codigo` presente; mesmo segredo de novo → mesmo `rig_id`.
  - pulso dessa pendente → 200 `comandos: []`, `visto_em` gravado.
  - insere convite (hash de valor conhecido) → registrar com ele → `ativa`; segundo uso → `pendente`.
  - insere comando `pausar` para a ativa → pulso devolve `[{tipo:"pausar"}]`; pulso seguinte `[]`.
  - comando com `criado_em = now()-11min` → não vem.
  - resultado → 200 e linha com `ok`/`concluido_em`; `comando_id` de outra rig → 404.
  - Bearer errado → 401; rig marcada `recusada` → 401; corpo 9000 bytes → 413; JSON lixo → 400.
  - 6 pendentes criadas seguidas → a 6ª dá 429.
- [ ] **Step 2:** `npm run dev` em outro terminal; `node --env-file=.env.local scripts/testar-rotas-rigs.mjs` → FAIL (404).
- [ ] **Step 3:** Implementar `lib/rigs.ts` e as 3 rotas.
- [ ] **Step 4:** Rodar de novo → todos OK; conferir que nenhuma rig `teste-*` sobrou.
- [ ] **Step 5: Commit** `feat(rigs): rotas registrar, pulso e resultado`

### Task 3: Seção "Minhas rigs" no admin (fric)

**Files:**
- Create: `app/admin/rigs/RigsPanel.tsx` (client: re-render a cada 15 s via `router.refresh()`), `app/admin/rigs/RigCard.tsx`
- Modify: `app/admin/page.tsx` (nova `<section className="panel">` "Minhas rigs" entre os KPIs e o gráfico)
- Modify: `lib/admin-actions.ts`, `lib/rigs.ts` (`listarRigs()`, `ultimoLog(rigId)`)
- Modify: `app/admin/admin.css` (só classes novas `rig-*`)

**Interfaces:**
- Consumes: Task 1–2.
- Produces (server actions, todas checam `isAdmin()`): `adminNovoConvite(): Promise<{convite: string}>` (grava hash com `expira_em = now() + 7 days`; mostra o convite uma vez, com botão copiar); `adminConfirmarRig(form)`, `adminRecusarRig(form)`, `adminRemoverRig(form)`, `adminComandoRig(form)` (valida `tipo ∈ TIPOS_COMANDO`).

Conteúdo do card (spec): nome, online/offline + "há X", GPU °C / uso %, CPU °C / carga, Ollama ok + se o modelo está na GPU (`vram_mb > 0`) ou CPU, Guardiã (serviço, pausada, postura, anel com a cor, motivo, % protegido, margem), Leila ok. Se `instalacao` presente: barra de etapas com a atual, erro em vermelho e `saida` num `<pre>`. Botões: Pausar/Retomar (conforme `pausada`), Reiniciar Guardiã, Reiniciar rig (1º clique vira "Confirmar reinício?" por 5 s), Ver log (mostra último resultado de `ver_log` em `<pre>`). Comando enviado mostra "aguardando a rig…" até `concluido_em`. Pendentes: código grande + Confirmar/Recusar.

- [ ] **Step 1:** Com `npm run dev` e uma rig de teste ativa (via script da Task 2 com flag `--manter`), abrir `/admin` no Chrome (MCP chrome-devtools) e confirmar que a seção ainda não existe.
- [ ] **Step 2:** Implementar.
- [ ] **Step 3: Verificação no navegador:** card aparece com dados do pulso; apertar Pausar cria linha em `rig_comandos`; simular pulso → card mostra "aguardando" e depois o resultado; Reiniciar rig exige 2 cliques; "Nova rig" mostra convite uma vez; rig pendente aparece com código e Confirmar a torna ativa; largura 390 px sem rolagem horizontal; screenshot claro/escuro.
- [ ] **Step 4:** `npm run build` → sem erro de tipo. Limpar rigs de teste.
- [ ] **Step 5: Commit** `feat(rigs): seção Minhas rigs no admin`
- [ ] **Step 6:** Pedir OK ao user para push (inclui d0914f0 pendente). Só após OK: `git push`, conferir deploy e `curl -X POST https://fric.com.br/api/rigs/pulso` → 401.

### Task 4: Guardiã grava status.json (fric-guardia)

**Files:**
- Modify: `guardia/main.py` (após cada ciclo, sucesso ou erro)
- Create: `guardia/status.py`; Test: `tests/test_status.py`

**Interfaces:**
- Produces: `escrever_status(caminho, *, ts: datetime, postura: str|None, cor: str, motivo: str, pct_protegido: float|None, margem: float|None, pausada: bool) -> None` — escrita atômica (tmp + `os.replace`), JSON com essas chaves (`ts` ISO UTC); OSError engolido como em `escrever_cor`.
- `rodar_ciclo` hoje devolve `(decisao, cor)`; ler `pct_protegido`/`margem` da última linha do diário (`entrada` JSON) em vez de mudar a assinatura.

- [ ] **Step 1:** Teste: escreve em `tmp_path`, lê de volta, chaves e valores iguais; diretório inexistente não levanta.
- [ ] **Step 2:** `pytest tests/test_status.py` → FAIL.
- [ ] **Step 3:** Implementar e chamar em `main.py` (no erro: `postura=None`, `cor="laranja"`, motivo = texto do erro).
- [ ] **Step 4:** `pytest` (todos, 105 + novos) → PASS; `python -m guardia.main --simulado --uma-vez` com `GUARDIA_RUN` temporário gera `status.json`.
- [ ] **Step 5: Commit** `feat: Guardiã publica status.json para o agente da rig`

### Task 5: Coleta do agente (fric-guardia)

**Files:**
- Create: `agente/__init__.py`, `agente/coleta.py`; Test: `tests/agente/test_coleta.py`, fixtures em `tests/agente/sysfs/`

**Interfaces:**
- Produces: `coletar(raiz: Path = Path("/"), ollama_url="http://127.0.0.1:11434", gate_url="http://127.0.0.1:11435", run_guardia=Path("/run/guardia"), http_get=urlopen_curto) -> dict` no formato do `pulsoSchema` (sem `instalacao`). Partes: `ler_gpu(raiz)` (primeiro `sys/class/drm/card*/device` com `vendor`=`0x1002`: `hwmon/hwmon*/temp1_input`/1000, `gpu_busy_percent`, `mem_info_vram_used`/2^20), `ler_cpu(raiz)` (`proc/loadavg`, hwmon com `name` `k10temp` ou `coretemp`), `ler_ollama`, `ler_leila` (qualquer resposta HTTP, inclusive 401/404, = vivo; conexão recusada = falso), `ler_guardia(run_guardia, systemctl_fn)`. Qualquer leitura que falhe → `None` no campo, nunca exceção.

- [ ] **Step 1:** Testes com sysfs falso: GPU AMD lida (52 °C, 37 %, 2048 MB); sem placa → `gpu: None`; card NVIDIA ignorado; ollama falso devolve `{"models":[{"name":"leila:latest","size_vram":5000000000}]}` → `vram_mb` 4768; gate que responde 401 → `gate_ok True`; porta fechada → `False`; status.json ausente → campos da guardiã `None` mas `servico` presente.
- [ ] **Step 2:** `pytest tests/agente` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(agente): coleta de status da rig`

### Task 6: Loop, identidade e comandos do agente (fric-guardia)

**Files:**
- Create: `agente/identidade.py`, `agente/comandos.py`, `agente/cliente.py`, `agente/main.py`; Tests: `tests/agente/test_comandos.py`, `tests/agente/test_loop.py`

**Interfaces:**
- Consumes: Task 5 `coletar`.
- Produces:
  - `carregar_ou_criar(caminho: Path) -> dict{segredo}` (cria com `secrets.token_urlsafe(32)`, modo 0600).
  - `redigir(texto: str) -> str` troca `0x[0-9a-fA-F]{64}` por `0x[REDIGIDO]`; corta em 8000 chars (mantém o fim).
  - `executar(tipo: str, run_guardia: Path, rodar=subprocess.run) -> tuple[bool, str, bool]` (ok, texto, reiniciar_depois). Mapa fixo do spec; `reiniciar_rig` devolve `(True, "reiniciando", True)` e o loop só chama `systemctl reboot` depois de enviar o resultado.
  - `Cliente(url, segredo, post=urlopen_json)`: `registrar(convite, nome, versao)`, `pulso(dados) -> list[dict]`, `resultado(id, ok, texto)`.
  - `main()`: lê `/etc/fric-rig.env` (`FRIC_URL`, `FRIC_CONVITE` opcional), identidade em `/var/lib/fric-rig/identidade.json`, registra até conseguir, depois loop 60 s; anexa `instalacao` lido de `/var/lib/fric-rig/instalacao.json` se existir. Falha de rede: espera 60, 120, 240, 300, 300… s; 401 → registra de novo (rig foi removida/recusada). `--uma-vez` para teste.

- [ ] **Step 1:** Testes: `redigir` apaga chave de 64 hex e mantém endereço de 40 hex; `executar("pausar")` cria `guardia.parar`; `"retomar"` remove; `"rm -rf /"` → `(False, "comando desconhecido", False)` e `rodar` nunca chamado; `"reiniciar_guardia"` chama exatamente `["systemctl","restart","guardia"]`. Loop contra servidor `http.server` em thread: registra, manda pulso com `uptime_s`, recebe `pausar`, executa, posta resultado; servidor desligado → próxima espera 120 s e o processo não sai.
- [ ] **Step 2:** `pytest tests/agente` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS + `pytest` completo.
- [ ] **Step 5:** Teste real contra `next dev` da Task 2: `FRIC_URL=http://localhost:3000 python -m agente.main --uma-vez` (identidade em pasta temporária) → rig aparece no admin local.
- [ ] **Step 6: Commit** `feat(agente): identidade, pulso e comandos fixos`

### Task 7: Pendrive — autoinstall e instalador de primeiro boot (fric-guardia)

**Files:**
- Create: `rig/autoinstall.yaml.modelo`, `rig/fric-rig.service`, `rig/fric-instalar.service`, `rig/instalar-tudo.sh`, `rig/ollama-vulkan.conf`, `scripts/montar_pendrive.py`; Test: `tests/test_montar_pendrive.py`
- Modify: `rig/instalar.sh` (vira a etapa "guardia" chamada pelo instalar-tudo; continua funcionando sozinho)

**Interfaces:**
- `instalar-tudo.sh` (root, oneshot, `ConditionPathExists=!/var/lib/fric-rig/instalado`): etapas `apt`, `ollama`, `modelo` (`ollama pull qwen3:8b`), `leila`, `tailscale`, `guardia`, `testnet`. Antes de cada uma grava `/var/lib/fric-rig/instalacao.json` `{etapa, ok:null}`; erro → `{etapa, ok:false, erro, saida: últimas 40 linhas}` e sai 1; fim → `{etapa:"pronto", ok:true, saida: saída do checar_testnet.py}` e cria `instalado`. `FRIC_DRY=1` só registra as etapas.
  - ollama: instalador oficial + `rig/ollama-vulkan.conf` em `/etc/systemd/system/ollama.service.d/` com `Environment=OLLAMA_VULKAN=1`.
  - leila: `scripts/rig/leila-gate.py` do repo fric (copiado para `pendrive/fric/leila/`), `leila-gate.env` salvo, Modelfile da Leila.
  - tailscale: script oficial, `tailscale up --authkey=$TS_AUTHKEY --hostname=rig2e3530`, `tailscale funnel --bg 11435`.
  - guardia: `rig/instalar.sh` + `/etc/guardia.env` do pendrive (testnet, observação), `systemctl enable --now guardia`.
  - testnet: `scripts/checar_testnet.py`.
- `montar_pendrive.py --destino E:\ --serial <SERIAL> --senha-hash <hash> --convite ... --ts-authkey ... --leila-env caminho --guardia-env caminho` (roda no PC Windows): preenche `autoinstall.yaml` a partir do modelo (storage `layout: {name: direct, match: {serial: ...}}`, identity com `hostname: rig2e3530`, usuário `rafael`, `ssh: {install-server: true}`, `late-commands` copiando `/cdrom/fric/*` para `/target/opt/fric-instalar/`, `/etc/fric-rig.env`, units e `systemctl enable fric-rig fric-instalar` via `curtin in-target`); grava em `<destino>/autoinstall.yaml`; acrescenta ` autoinstall` em toda linha `linux` de `<destino>/boot/grub/grub.cfg` (uma vez só) e muda `set timeout=` para `5`; copia pasta `fric/` com agente, guardia, leila e segredos. Recusa rodar se o destino não tiver `casper/` (não é pendrive do Ubuntu) ou se faltar serial.

- [ ] **Step 1:** Testes de `montar_pendrive` em pasta falsa com `casper/` e `boot/grub/grub.cfg` de exemplo: serial no YAML; `autoinstall` aparece uma vez por linha `linux` mesmo rodando 2×; sem `casper/` → erro; sem serial → erro; YAML resultante tem `version: 1` e `hostname: rig2e3530`. `bash -n rig/instalar-tudo.sh` sem erro; `FRIC_DRY=1` com `ESTADO_DIR` temporário termina com `{"etapa":"pronto","ok":true}`.
- [ ] **Step 2:** `pytest tests/test_montar_pendrive.py` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS + `pytest` completo.
- [ ] **Step 5: Commit** `feat(rig): pendrive com autoinstall e instalação acompanhada pelo painel`

### Task 8: Guia do user (fric-guardia + Área de Trabalho)

**Files:**
- Create: `docs/guia-pendrive.md`; copiar para `~/Desktop/RIG-instalar-ubuntu-pelo-pendrive.txt`
- Delete: `~/Desktop/GUARDIA-instalar-na-rig.txt` e `~/Desktop/guardia.tar.gz` (superados; avisar o user)
- Modify: `README.md` (instalação nova), `docs/painel-rigs.md` (status: construído)

Conteúdo, em blocos curtos para colar:
1. **Antes, no HiveOS** (shell.hiveos.farm): `cat /etc/leila-gate.env`, `cat /etc/guardia.env 2>/dev/null`, `lsblk -o NAME,SIZE,MODEL,SERIAL,TRAN`, `ls /sys/firmware/efi`, `ip -br a`, `ollama ps`, `lscpu | head -20`, `free -h` → mandar a saída para mim.
2. **No Tailscale** (navegador): apagar a máquina `rig2e3530`; criar auth key de uso único, validade 1 dia.
3. **No fric.com.br/admin**: "Nova rig" → copiar convite.
4. **No PC**: baixar `ubuntu-24.04.x-live-server-amd64.iso`, gravar com Rufus (modo ISO, GPT/UEFI), rodar `montar_pendrive.py` com o que veio do passo 1–3 (eu monto o comando).
5. **Boot sem monitor** (de volta no HiveOS, pendrive espetado): `efibootmgr -c -d /dev/sdX -p 1 -L pendrive -l '\EFI\boot\bootx64.efi'`, `efibootmgr -n <num>`, `reboot`. Plano B: monitor emprestado 5 min, F11/F12.
6. **Acompanhar** no painel: rig aparece em ~15 min do reboot; etapas até "pronto" (~30–60 min, o modelo tem ~5 GB). O que fazer se travar numa etapa.
7. **Depois**: tirar e formatar o pendrive; conferir Leila em /leilao.

- [ ] **Step 1:** Escrever o guia com os comandos exatos dos arquivos das Tasks 6–7.
- [ ] **Step 2:** Conferir cada comando do guia contra os scripts (nomes de arquivo, flags).
- [ ] **Step 3: Commit** `docs: guia do pendrive sem monitor`
