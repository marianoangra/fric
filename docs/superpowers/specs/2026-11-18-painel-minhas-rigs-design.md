# Painel "Minhas rigs" — design (18/11/2026)

## Intenção
O Rafael quer ver e controlar a rig dele (RX 590, Guardiã + Leila) pelo fric.com.br, sem
entrar em shell. Primeiro é só a rig dele, mas desenhada para virar produto: rigs de outras
pessoas ligadas ao mesmo site no futuro. Por isso o "fio" rig↔site já nasce multi-rig.

Decisão do user no mesmo dia: **sem HiveOS**. A rig deixa de minerar; vira máquina só da
Guardiã e da Leila, com Linux comum instalado do zero pelo pendrive.

## Objetivos
- Painel no admin com cada rig: online/offline (e desde quando), temperatura e uso da GPU
  e da CPU, Ollama de pé ou não, Guardiã (ativa, pausada, última postura, cor do anel,
  motivo, % protegido, margem) e hora do último contato.
- Botões fixos: pausar Guardiã, retomar Guardiã, reiniciar Guardiã, reiniciar rig, ver log.
- Pendrive que instala tudo e faz a rig aparecer no painel sozinha; o dono só confirma.

## Não-objetivos
- Cadastro de outros donos, login de cliente, página pública de rigs.
- Terminal remoto ou qualquer comando livre.
- Mineração, LCD, configuração da Guardiã pelo site (piso, modo, chaves).

## Anti-objetivos (falha mesmo funcionando)
- O site conseguir fazer a rig executar algo fora da lista fixa.
- A chave da Hyperliquid (ou qualquer conteúdo de /etc/guardia.env) sair da rig.
- Um "reiniciar rig" apertado com a rig offline disparar horas depois.
- Rig não confirmada recebendo comando.

## Abordagens consideradas
- **A. A rig liga para o site (ESCOLHIDA pelo user).** Pulso a cada 60 s com o status; a
  resposta traz os comandos pendentes. Sem porta aberta, sem Tailscale para o painel, funciona
  atrás de qualquer roteador e serve para rigs de terceiros. Custo: botão leva até ~60 s.
- B. Site liga para a rig pelo túnel (como a Leila). Instantâneo, mas cada rig precisa de
  Tailscale e porta exposta. Ruim para rigs de cliente.
- C. Conexão persistente (WebSocket). A Vercel não segura; exigiria servidor extra. Descartada.

## Como funciona

### Identidade e pareamento
1. No primeiro boot, o agente gera `segredo` (32 bytes aleatórios) e grava
   `/var/lib/fric-rig/identidade.json` (0600, root).
2. Chama `POST /api/rigs/registrar` com `{ segredo, nome_sugerido (hostname), versao }`.
   O site guarda só `sha256(segredo)`, cria a rig como `pendente` e devolve `{ rig_id, codigo }`
   (código curto legível, ex. `K7-4Q2`, sem letras ambíguas).
3. O agente mostra o código no log e na tela do monitor (`/etc/issue`, aparece no console).
4. No painel aparece "Rig nova esperando — código K7-4Q2 — é sua?" [Confirmar] [Recusar].
   Confirmar → `ativa`. Recusar → `recusada` (o segredo dela nunca mais vale).
5. Pendentes expiram em 24 h; no máximo 5 pendentes ao mesmo tempo (o resto recebe 429).
   Rig que perdeu a identidade (reinstalada) simplesmente se registra de novo; a antiga fica
   offline e pode ser removida no painel.

### Pulso (a cada 60 s)
`POST /api/rigs/pulso`, `Authorization: Bearer <segredo>`, corpo JSON validado por zod e
limitado a 8 KB:
```
{ versao, uptime_s,
  gpu: { temp_c, uso_pct, vram_usada_mb } | null,
  cpu: { temp_c, carga_1m },
  ollama: { ok, modelos_carregados: [..] },
  guardia: { servico: "ativa"|"parada"|"falhou", pausada, ts_ultimo_ciclo, postura, cor,
             motivo, pct_protegido, margem } | null,
  leila: { gate_ok } }
```
Resposta: `{ comandos: [{ id, tipo }] }` só se a rig estiver `ativa`; pendente/recusada recebe
`{ estado }` e nenhum comando. O site grava `ultimo_status` (jsonb) e `visto_em`.
Offline no painel = `visto_em` há mais de 3 min.

### Comandos
Lista fechada: `pausar`, `retomar`, `reiniciar_guardia`, `reiniciar_rig`, `ver_log`.
- O site só grava a linha; a rig busca no pulso. Comando não entregue em 10 min expira.
- O agente mapeia cada tipo para uma ação local fixa (tipo desconhecido = ignora e reporta erro):
  - pausar: `touch /run/guardia/guardia.parar` · retomar: remove o arquivo
  - reiniciar_guardia: `systemctl restart guardia`
  - reiniciar_rig: responde o resultado primeiro, depois `systemctl reboot`
  - ver_log: `journalctl -u guardia -n 80 --no-pager` + as últimas 20 linhas do fric-rig
- Resultado: `POST /api/rigs/resultado` `{ comando_id, ok, texto }` (texto até 8 KB).
  O agente apaga do texto qualquer `0x` + 64 hex (formato de chave privada) antes de enviar.
- "Reiniciar rig" no painel pede confirmação em dois cliques (sem `confirm()` do navegador).

### Status da Guardiã
Mudança pequena na Guardiã: ao fim de cada ciclo ela grava `/run/guardia/status.json`
(ts, postura, cor, motivo, pct_protegido, margem, pausada). O agente só lê esse arquivo e
`systemctl is-active guardia`; nunca abre o `.env` nem o diário.

### Site (repo fric)
- Tabelas: `rigs` (id, nome, segredo_hash unique, codigo, estado pendente|ativa|recusada,
  dono_email nulo por enquanto, versao, ultimo_status jsonb, visto_em, criada_em, confirmada_em)
  e `rig_comandos` (id, rig_id, tipo, criado_em, entregue_em, concluido_em, ok, resultado).
  Migração em `scripts/setup-db.mjs`, no mesmo estilo das outras.
- Rotas: `/api/rigs/registrar`, `/api/rigs/pulso`, `/api/rigs/resultado` (sem cookie, só Bearer)
  e ações do admin protegidas por `isAdmin()`.
- Tela: seção nova "Minhas rigs" no admin existente, no visual atual (layout do admin é
  congelado: só acrescentar). Atualiza sozinha a cada ~15 s.

### Agente na rig (repo fric-guardia, pasta `agente/`)
- Python só com biblioteca padrão (urllib, json, sqlite3 não precisa), serviço systemd
  `fric-rig` rodando como root (precisa de reboot e restart), `Restart=always`.
- GPU: lê `amdgpu` em `/sys/class/drm/card*/device/` (hwmon temp, `gpu_busy_percent`,
  `mem_info_vram_used`); CPU: `/proc/loadavg` + hwmon `k10temp`/`coretemp`. Campo ausente = null.
- Ollama: `GET 127.0.0.1:11434/api/ps`. Leila: `GET 127.0.0.1:11435` (gate responde 401/404 = vivo).
- Endereço do site em `/etc/fric-rig.env` (`FRIC_URL=https://fric.com.br`).
- Sem internet: segue tentando com espera crescente até 5 min; nunca trava a Guardiã.

### Pendrive e instalação (sem HiveOS)
- Sistema: **Ubuntu Server 24.04 LTS** (escolha minha: o mais documentado para amdgpu, Ollama e
  Tailscale).
- Antes de apagar o HiveOS (o user roda no shell do HiveOS): salvar `/etc/leila-gate.env` e
  `/etc/guardia.env` (se existir) no pendrive; anotar `ollama ps` (GPU ou CPU hoje), `lscpu`,
  `free -h`, `lsblk`.
- Depois do Ubuntu instalado: um `instalar-tudo.sh` do pendrive instala Ollama, baixa
  qwen3:8b, cria os modelos `leila` e `guardia`, reinstala leila-gate (com o token salvo),
  Tailscale + Funnel (login aparece como link na tela), Guardiã e agente `fric-rig`.
- Guia passo a passo em texto, como o atual, substituindo `GUARDIA-instalar-na-rig.txt`.

## Riscos conhecidos
- **Ollama na RX 590:** ROCm não suporta Polaris (gfx803). Caminho: backend Vulkan do Ollama.
  Se ficar lento demais, Guardiã cai na postura protegida (regra existente) e a Leila mostra
  "cafezinho". Medir antes de dar como pronto.
- Leila fica fora do ar entre apagar o HiveOS e terminar a instalação.
- Commit d0914f0 (texto novo da /rigs) segue sem push; push no fric publica sozinho → pedir OK.

## Fica para quem constrói
Formato exato do código de pareamento, visual dos cards dentro do estilo do admin, intervalo
de atualização da tela, texto do guia.
