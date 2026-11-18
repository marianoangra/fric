# Rig HYPE — IA autônoma e conservadora (design)

Data: 18/11/2026 · Status: aprovado pelo Rafael em 18/11/2026 · Substitui o "regra decide, IA explica" que está no ar desde 16/11 (commit 86abb77).

## 1. Intenção

A rig fric. cuida do HYPE do dono sozinha. Quem decide é uma **IA que roda na própria rig** (Ollama, na placa de vídeo), não o Claude e não o dono, que não aprova operação por operação. A IA tem perfil **conservador**: lê notícias, a análise técnica, o fluxo de ordens (as baleias) e o calendário de eventos como payroll, e **sai do trade** quando o cenário fica perigoso.

Por quê: no texto anterior a IA só explicava o que a regra fazia, e o Rafael achou que esse papel "não faz sentido". O produto é uma IA autônoma de verdade. O limite dela fica em proteger o que importa, sem ninguém aprovar cada passo.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- A IA escolhe sozinha, a cada ciclo, uma postura para os 25% livres do HYPE, a partir de análise técnica + notícias + fluxo de ordens + calendário.
- Toda decisão fica gravada com o motivo em português, e isso vira histórico e resumo dia/semana/mês (comparado com "só segurar o HYPE").
- Na dúvida, falha ou ausência da IA, a rig fica mais protegida, nunca menos.

**Não-objetivos (nesta versão)**
- Comprar HYPE a mais, operar alavancado na direção, ou operar outros ativos (BTC etc.).
- HLP / vaults / pools (adiado pelo Rafael em 16/11).
- Vender a rig a terceiros: isso traz a questão CVM (gestão de carteira), que é outra conversa.
- Mexer na conta antiga 0xa35f… ou no bot velho.

**Anti-objetivos (se acontecer, falhou mesmo "funcionando")**
- Uma notícia, um tweet ou uma página lida pela IA conseguir aumentar o risco além do teto do código (prompt injection).
- A rig ficar abaixo de 75% protegida por decisão da IA.
- Ficar "fora do trade" ser implementado como **zerar o short**, porque isso deixa 100% do HYPE exposto.
- Botão de desligar fechar as posições. Fechar o short = ficar exposto.

## 3. Restrições

- **Dinheiro:** conta NOVA na Hyperliquid, cerca de US$100. Carteira de API (agent) que opera e não saca. Chave em `.env` colada pelo Rafael, nunca no código.
- **Lição do bot antigo:** todas as consultas de posição e ordem usam o endereço MESTRE (`account_address`), nunca o do agent. Ordem mínima de US$10 na Hyperliquid. Um único processo (lock de instância).
- **Modelo local:** qwen3:8b no Ollama, que já inventou fatos no /leilao. A IA nunca calcula número: recebe tudo calculado pelo código e devolve só uma escolha num formato fechado.
- **Mineração:** quando a rig minera, o Ollama fica desligado. A rig precisa funcionar (de forma segura) sem IA.
- **Estratégia base (backtest de 15/11):** HYPE em staking (unstake leva 7 dias) + short de HYPE perp com 1x de margem e 25% do HYPE fora do staking como colchão. A 1x, a margem nunca ficou abaixo de 32% no último ano; 2x+ sem colchão foi liquidado em jan/26.
- **Site:** o layout do fric.com.br está congelado. Só muda o texto da /rigs.

## 4. Abordagens consideradas

| | Abordagem | Troca | Decisão |
|---|---|---|---|
| A | **Guardiã do HYPE:** a IA decide quanto do HYPE proteger, dentro de faixa travada | Ganho limitado (nunca mais que 25% exposto), mas tem backtest e risco controlado | **Escolhida**, com piso de 75% escolhido pelo Rafael |
| B | **Trader:** a IA compra/vende pra lucrar com o movimento e vai pro caixa nos eventos | Mais potencial, mas é a IA adivinhando direção pela manchete. Mesmo tipo de operação que quebrou o bot antigo, sem backtest | Descartada |
| — | Estratégia de orderflow estilo campeonato (vídeo Robbins Cup) como entrada | Feita pra retorno máximo de curto prazo com alavancagem | Usada só como **alarme** que manda pra "Fora", nunca como sinal de compra |

## 5. O que foi decidido

### 5.1 Divisão do HYPE
- **Piso de 75%:** sempre protegido pelo short. Travado no código.
- **25% livres:** a IA decide se ficam expostos ao preço ou se também ficam protegidos.
- `% protegido = tamanho do short ÷ HYPE total (staking + colchão)`.

### 5.2 Posturas (a IA só escolhe entre estas)

| Postura | % protegido | Quando (orientação para a IA) |
|---|---|---|
| Exposta | 75% | Tendência técnica boa e nada no radar |
| Atenção | 85% | Sinal misto, notícia relevante não confirmada, volatilidade subindo |
| Fora | 100% | Evento do calendário, alarme de fluxo de ordens, pico de preço, notícia grave |

Em "Fora", nenhuma ordem nova durante a janela do evento. A única exceção é a emergência de margem (5.5).

### 5.3 O que alimenta a decisão (tudo calculado em código)
- **Análise técnica (HYPE, velas de 1h e 4h):** EMA 20/50, RSI 14, ATR e distância do preço para as médias. Vai pra IA como números já interpretados ("EMA20 acima da EMA50 há 6 velas").
- **Fluxo de ordens / baleias (API pública da Hyperliquid):** negociações a mercado muito acima do normal, ordens grandes que surgem ou somem do livro, onda de liquidações, salto de open interest, funding.
- **Calendário fixo:** payroll, CPI, decisão do Fed. As datas ficam num arquivo mantido à mão, mais os eventos próprios do HYPE (desbloqueios do time, ainda a confirmar a data exata antes de cadastrar).
- **Notícias:** manchetes de fontes abertas (RSS), entregues à IA como DADO entre delimitadores, nunca como instrução.

### 5.4 Quem manda em quê (autonomia assimétrica)
- **Alarmes duros do código** (janela do calendário, alarme de fluxo, pico de preço acima de X ATR) forçam "Fora", independente da IA.
- **A IA** pode escolher qualquer postura **igual ou mais protegida** do que a que os alarmes exigem.
- **Ficar mais protegida** é sempre permitido.
- **Ficar menos protegida** conta no limite de 3 mudanças por dia e exige pelo menos 4h desde a última mudança.
- **Pior caso de uma IA enganada:** ficar em "Exposta" quando não devia, ou seja, 25% exposto, que é o máximo que o Rafael já aceitou.

### 5.5 Travas que a IA não muda
- Alavancagem 1x no short e 25% de colchão.
- Nunca abaixo de 75% protegido, exceto na emergência de margem.
- **Emergência de margem:** se a margem do short cair perto do limite, o código primeiro usa o colchão. Se não bastar, reduz o short (furando o piso), grava o motivo e acende o vermelho. Ser liquidado é pior que ficar exposto.
- Sem IA (offline, minerando, timeout, resposta fora do formato) = "Fora".
- Carteira de API não saca. Um processo só.

### 5.6 Registro e explicação
- Cada ciclo grava: dados de entrada, postura escolhida, motivo em português (curto) e ordens enviadas.
- O resumo do dia/semana/mês compara o resultado com "só segurar o HYPE" e com "75% fixo".

### 5.7 Botão e anel de luz
- **Botão:** liga e desliga a rig. Desligar = parar de mandar ordens e manter as posições como estão (nunca fechar o short).
- **Verde:** Exposta/Atenção com margem ok.
- **Laranja:** Fora, ou IA offline.
- **Vermelho:** margem apertada / emergência.

### 5.8 Ordem de entrada em produção
1. **Testnet** da Hyperliquid, operando de verdade lá.
2. **Mainnet em observação** na conta nova: lê tudo, decide e grava, mas não manda ordem.
3. **Mainnet operando**, só com OK explícito do Rafael depois de ver o histórico da observação.

### 5.9 Texto da /rigs
Reescrever o "Como funciona" para: a IA decide sozinha, de forma conservadora; 75% do HYPE sempre protegido; ela sai do trade em eventos e baleias; a chave não saca; roda em casa. Mesmo layout, sem % de retorno, sem dizer que "minera".

## 6. Deixado para quem construir (decisões minhas, podem ser revistas)
- **Linguagem:** Python (o SDK oficial da Hyperliquid é Python e o bot antigo também era).
- **Banco local:** SQLite.
- **Execução:** serviço systemd na rig, na mesma linha do leila-gate.
- **Novo modelo `guardia` no Ollama:** separado da Leila, com saída JSON fechada `{postura, motivo}`.
- **Ciclo:** a cada 15 min, mais um ciclo extra quando um alarme dispara.
- **Rebalanceamento:** só quando o desvio passa de 3 pontos percentuais do alvo (evita taxa à toa).
- **Janelas de evento:** payroll/CPI de 60 min antes a 120 min depois; Fed de 60 min antes a 180 min depois.
- **Valores numéricos dos alarmes:** "muito acima do normal", "perto do limite", "X ATR". Calibrar com dados históricos na testnet e registrar no código como constantes nomeadas.
- **Fontes de notícia (RSS):** escolher as que funcionam sem login.
- **Duração da observação:** sugiro 14 dias antes de pedir o OK para operar.
- **LCD, resumo no site, Telegram:** ficam para depois do motor funcionando.
- **Montagem inicial é manual, feita pelo Rafael:** comprar o HYPE, pôr em staking e deixar o colchão. A rig não mexe no staking (unstake leva 7 dias). Ela só gerencia o short e o colchão.
- **A conferir na testnet antes de codar a emergência de margem:** se o HYPE spot conta como garantia do perp na Hyperliquid. Se não contar, "usar o colchão" = vender parte do colchão por USDC e mandar pra margem do perp. Conferir também se a carteira de API consegue fazer essa transferência spot→perp. Se não conseguir, o colchão precisa ficar em USDC já na margem.
