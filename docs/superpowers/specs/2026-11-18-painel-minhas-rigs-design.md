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
A rig não tem monitor (decisão do user): tudo é acompanhado pelo painel. Como ninguém vê um
código na tela da rig, o pareamento principal é por **convite no pendrive**:
1. No painel, botão "Nova rig" gera um convite de uso único (válido 7 dias). O site guarda só
   o hash. O convite vai no arquivo de configuração do pendrive.
2. No primeiro boot, o agente gera `segredo` (32 bytes aleatórios) e grava
   `/var/lib/fric-rig/identidade.json` (0600, root).
3. Chama `POST /api/rigs/registrar` com `{ segredo, convite, nome_sugerido (hostname), versao }`.
   O site guarda só `sha256(segredo)`. Convite válido → rig nasce `ativa` e o convite é queimado.
4. Sem convite ou convite inválido → rig nasce `pendente`, com código curto (ex. `K7-4Q2`)
   mostrado no painel: "Rig nova esperando — é sua?" [Confirmar] [Recusar]. É o caminho de
   reserva (e o de rigs de terceiros no futuro). Recusar → `recusada` (segredo nunca mais vale).
5. Pendentes expiram em 24 h; no máximo 5 pendentes ao mesmo tempo (o resto recebe 429).
   Rig reinstalada se registra de novo; a antiga fica offline e pode ser removida no painel.

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
  leila: { gate_ok },
  instalacao: { etapa, ok, erro, saida } | null }   // só durante o 1º boot
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

### Pendrive e instalação (sem HiveOS, sem monitor)
Decisão do user: Ubuntu se instala sozinho e tudo é acompanhado pelo painel.
- Sistema: **Ubuntu Server 24.04 LTS** (escolha minha: o mais documentado para amdgpu, Ollama e
  Tailscale), com **autoinstall**: `autoinstall.yaml` na raiz do pendrive e `autoinstall` na
  linha do kernel do `grub.cfg` do pendrive (sem isso o 24.04 para pedindo confirmação na tela).
- **Antes de apagar o HiveOS** (o user roda no shell.hiveos.farm, eu passo os comandos):
  - salvar `/etc/leila-gate.env` (token da Leila) e `/etc/guardia.env` se existir;
  - anotar: `lsblk -o NAME,SIZE,MODEL,SERIAL,TRAN` (qual disco recebe o Ubuntu e qual é o
    pendrive), `ls /sys/firmware/efi` (UEFI ou legado), `ip -br a` (cabo ou Wi-Fi),
    `ollama ps` (GPU ou CPU hoje), `lscpu`, `free -h`;
  - fazer a rig **dar boot pelo pendrive sem BIOS na tela**: em UEFI, `efibootmgr` + `BootNext`
    apontando para o pendrive, e reboot. Se não houver entrada UEFI para o pendrive, plano B é
    emprestar um monitor por 5 minutos só para escolher o boot.
- O `autoinstall.yaml` instala no disco identificado pelo serial (nunca "o maior disco"), cria o
  usuário com senha que o user define, hostname `rig2e3530`, SSH ligado, e copia do pendrive
  para o disco: agente `fric-rig`, `instalar-tudo.sh`, os pacotes da Guardiã e da Leila e os
  arquivos de configuração.
- **Primeiro boot:** o agente `fric-rig` sobe ANTES de tudo (só biblioteca padrão, não precisa
  de internet além do site), se registra com o convite e passa a mandar no pulso o campo
  `instalacao: { etapa, ok, erro }`. Então `instalar-tudo.sh` (serviço oneshot) roda:
  Ollama → qwen3:8b (~5 GB) → modelos `leila` e `guardia` → leila-gate (token salvo) →
  Tailscale com **auth key** (gerada pelo user no painel do Tailscale, vai no pendrive) +
  `funnel --bg 11435` → Guardiã (em modo observação, testnet) → `checar_testnet.py`, com a
  saída enviada ao painel. Cada etapa aparece no painel; erro para ali e mostra o motivo.
- **Tailscale:** apagar o nó antigo `rig2e3530` no painel do Tailscale antes, para o novo
  herdar o nome e a URL `https://rig2e3530.tail4a859f.ts.net` (que é o LEILA_URL na Vercel).
- Pendrive carrega segredos (chave testnet, token da Leila, auth key, convite): o guia manda
  formatá-lo no fim. Auth key do Tailscale de uso único e com validade curta.
- Guia passo a passo em texto, substituindo `GUARDIA-instalar-na-rig.txt`.
- Ordem: o site com o painel precisa estar no ar ANTES de gravar o pendrive (o convite vem dele).

## Riscos conhecidos
- **Ollama na RX 590:** ROCm não suporta Polaris (gfx803). Caminho: backend Vulkan do Ollama.
  Se ficar lento demais, Guardiã cai na postura protegida (regra existente) e a Leila mostra
  "cafezinho". Medir antes de dar como pronto.
- Leila fica fora do ar entre apagar o HiveOS e terminar a instalação.
- Commit d0914f0 (texto novo da /rigs) segue sem push; push no fric publica sozinho → pedir OK.

## Fica para quem constrói
Formato exato do código de pareamento, visual dos cards dentro do estilo do admin, intervalo
de atualização da tela, texto do guia.
