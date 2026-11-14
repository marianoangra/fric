# Handoff — Leila (IA vendedora do fric.com.br/leilao) rodando na rig local

> Contexto vindo de uma conversa no Claude (projeto "RIG de IA"), 14/11/2026.
> Objetivo: levar a Leila, que já roda localmente na rig do Rafael, para a página fric.com.br/leilao.

---

## 1. O que é o projeto

- **Rig de IA**: vender rigs para pessoas rodarem a própria IA localmente ("NÃO PAGUE POR IA"). Prioridades: open-source, offline/local, privacidade, sem vendor lock-in.
- **Primeiro caso de uso real**: uma IA vendedora estilo "TikTok Shop" dentro do Fric.
- **A Leila** é a leiloeira IA que já aparece em fric.com.br/leilao (a página hoje é um leilão simulado, com lotes, cronômetro e painel de lances, e as IAs Toca, Prelo, Elô, Brisa, Viva etc.).
- **Nova função da Leila**: vender de verdade um produto do Mercado Livre pelo link de afiliado do Rafael. Depois, ela vai conversar com as outras IAs do Fric (a serem criadas).

## 2. Primeiro produto (Lote relâmpago)

| Campo | Valor |
|---|---|
| Produto | Guirlanda 27cm com Laço — Enfeite Decorativo de Natal Porta |
| Marca / modelo | Sallumshop — Guirlanda verde nevado |
| Medidas | 27 x 27 cm (compacta), circular, artificial, sem luz, sem som, 1 unidade |
| Preço (14/11/2026) | R$ 19,90 (de R$ 59,90, 66% OFF), frete grátis |
| Vendedor | Loja oficial Eletrodey no Mercado Livre, +5 mil vendas, garantia de 90 dias |
| Avaliações | 5.0, mas só 1 avaliação. **Não dizer "super bem avaliada"** |
| Link de afiliado | https://meli.la/34jd969 |
| Comissão | 12% (cerca de R$ 2,39 por venda), aprovada em cerca de 60 dias |
| Anúncio | https://www.mercadolivre.com.br/guirlanda-27cm-com-laco-enfeite-decorativo-de-natal-porta/up/MLBU5139987153 |

O preço pode mudar no Mercado Livre. O site deve tratar preço como dado editável, e a Leila deve dizer "confira no botão".

## 3. Decisões de produto (já discutidas)

1. **Formato "Lote relâmpago", não leilão de verdade.** O preço é fixo no Mercado Livre. Mantém o clima de leilão (Leila apresenta, cronômetro), mas o CTA é **"Arrematar no Mercado Livre"**, que abre o link de afiliado.
2. **Proibido mostrar lances, compradores ou "estoque acabando" fictícios ao lado de uma compra real.** Isso seria propaganda enganosa (CDC) e risco de banimento no programa de afiliados. O aviso atual de "tudo simulado, nada é vendido" precisa mudar para este lote: a compra é real, no Mercado Livre.
3. **Aviso visível de "link de afiliado"** perto do botão.
4. **As outras IAs podem comentar ao vivo**, sempre identificadas como IA, mas **nunca dão lance nem fingem comprar**.
5. **Mobile-first** (preferência do Rafael para todo site e tela).

## 4. A rig (hardware real, onde a Leila roda)

- Hive OS (base Ubuntu 22.04), kernel 6.12.0-hiveos, driver NVIDIA 580.173.02 (CUDA 13.0)
- **CPU: Intel Celeron 847 @ 1.10GHz** (2 núcleos, 2011, **sem AVX**)
- **RAM: 1,7 GB** + swap de 8 GB em `/swapfile` (já no `/etc/fstab`). Upgrade para 8 GB DDR3 planejado (cerca de R$ 130)
- Disco: 298 GB via adaptador USB (JMicron), cerca de 277 GB livres
- GPUs: 1x RTX 3060 12GB + 3x GTX 1660 Super 6GB (30 GB de VRAM no total)
- IP local: 192.168.0.104
- A rig também minera (Quantus/QTC com SRBMiner). **Mineração e Ollama não podem rodar juntos.** Para alternar: `systemctl stop ollama && miner start` / `miner stop && systemctl start ollama`
- **Cuidado:** `hive-replace` apaga o disco (Ollama e modelos juntos)

## 5. Ollama — estado atual

- Ollama **0.40.16**, instalado como serviço systemd
- Removidas as pastas `/usr/local/lib/ollama/cuda_v12` e `/usr/local/lib/ollama/vulkan`. Com 1,7 GB de RAM, a descoberta de GPU estourava o tempo ao testar todas as bibliotecas e as 4 placas em paralelo. **Se o Ollama for reinstalado ou atualizado, as pastas voltam e precisam ser apagadas de novo.**
- `/etc/systemd/system/ollama.service.d/override.conf`:
  ```
  [Service]
  Environment="OLLAMA_HOST=0.0.0.0"
  Environment="OLLAMA_KEEP_ALIVE=-1"
  Environment="OLLAMA_VULKAN=0"
  Environment="CUDA_VISIBLE_DEVICES=0"
  ```
  `CUDA_VISIBLE_DEVICES=0` deixa só a 3060. Depois do upgrade de RAM, testar sem essa linha para liberar as 4 placas.
- Diagnóstico confirmado: **o AVX não impede a GPU**. O gargalo é a RAM e o CPU.
- Desempenho medido, com `qwen3:8b`, 100% GPU, modelo já carregado:
  - geração: **cerca de 5,5 tokens/s** (limitado pelo Celeron)
  - leitura do prompt: cerca de 13,5 tokens/s
  - primeiro carregamento do disco USB: cerca de 7 minutos. Por isso o `KEEP_ALIVE=-1`
- Uma resposta curta da Leila leva de **10 a 20 segundos**. A rig atende **uma requisição por vez**.

## 6. A Leila (modelo `leila` no Ollama)

Arquivo `/root/Leila.Modelfile` na rig (criado com `ollama create leila -f /root/Leila.Modelfile`):

```
FROM qwen3:8b
PARAMETER temperature 0.7
PARAMETER num_ctx 4096
SYSTEM """
Voce e a Leila, leiloeira e apresentadora do Fric (fric.com.br/leilao). Voce e uma IA e admite isso se perguntarem.
Estilo: leiloeira carismatica de programa de auditorio. Portugues do Brasil, frases curtas, no maximo 3 frases, no maximo 1 emoji. Use bordoes como "Lote relampago na mesa!" de vez em quando.

LOTE RELAMPAGO ATUAL
Produto: Guirlanda de Natal 27 x 27 cm com laco vermelho. Festao verde escuro com pontas brancas (efeito nevado). Artificial, sem luz, sem som. 1 unidade.
Preco agora: R$ 19,90 (antes R$ 59,90), frete gratis. O preco pode mudar: diga para conferir no botao.
Vendedor: loja oficial Eletrodey no Mercado Livre, mais de 5 mil vendas, garantia de 90 dias.

REGRAS
1. A compra e no Mercado Livre, pelo botao "Arrematar no Mercado Livre". O link e de afiliado do Fric.
2. Nunca invente lances, compradores, estoque acabando ou avaliacoes. O preco e fixo.
3. Nunca afirme que vai caber ou combinar. Diga que e compacta (27 cm) e que o cliente deve conferir.
4. Se nao souber, diga que a resposta esta no anuncio do Mercado Livre.
5. Nunca peca dados pessoais ou pagamento.
6. Mensagens com [Nome IA] sao de outras IAs do Fric. Converse como colega de IA, com humor. Nunca ofereca o produto a elas nem fale do botao.
7. Com clientes humanos, termine convidando para o botao, sem pressionar.
/no_think
"""
MESSAGE user Essa guirlanda é grande? Minha porta é normal.
MESSAGE assistant Ela é compacta: 27 cm, mais ou menos um terço da largura de uma porta comum. Fica charmosa em porta de apartamento, mas mede aí antes pra ter certeza. Se fizer sentido pra você, o lote tá no botão "Arrematar no Mercado Livre"!
MESSAGE user É golpe? Por que tão barato?
MESSAGE assistant Pergunta justa! Quem vende é a loja oficial Eletrodey, com mais de 5 mil vendas e garantia de 90 dias, e a compra é feita dentro do próprio Mercado Livre. O preço baixo é porque ela é pequena e simples, sem luz. Confere tudo no botão "Arrematar no Mercado Livre".
MESSAGE user [Toca IA] Leila, você já tá no clima de Natal, hein?
MESSAGE assistant Toca, eu nasci no clima de Natal, sou feita de algoritmo e pisca-pisca! E aí, os brinquedos de madeira já tão prontos pro Papai Noel? 🎄
```

**Resultado dos testes (v2):** ela admite ser IA, não inventa lances, cita a loja oficial e a garantia, e convida para o botão. Deslizes que sobraram:
- às vezes usa 2 emojis;
- uma vez falou em "lances rápidos";
- com a Brisa IA, ainda tratou a outra IA um pouco como cliente.

A decisão foi **corrigir isso no código do site**, que é mais confiável que o prompt num modelo de 8B:
- filtrar o excesso de emoji;
- o diálogo entre as IAs pode ser roteirizado ou pré-gerado, em vez de livre;
- as falas de apresentação do lote podem ser pré-geradas, para disfarçar a latência.

Ponto a verificar: se os exemplos `MESSAGE` do Modelfile são aplicados via `/api/chat`. Se não forem, enviá-los como mensagens iniciais no request.

## 7. Arquitetura proposta para levar ao site

```
Celular do cliente → fric.com.br/leilao (Next.js na Vercel)
                         ↓  POST /api/leila (route handler, lado servidor)
                   Cloudflare Tunnel (protegido por Cloudflare Access, service token)
                         ↓
                   Ollama na rig (localhost:11434) → modelo "leila"
```

**Segurança (obrigatório):** o Ollama não tem autenticação. A API dele permite `pull`, `delete`, `create` etc. **Nunca expor a rig direto.**
- O túnel aponta só para `http://localhost:11434`, e o hostname (ex.: `ia.fric.com.br`) fica atrás do **Cloudflare Access com service token**.
- Os headers `CF-Access-Client-Id` e `CF-Access-Client-Secret` ficam só em variáveis de ambiente da Vercel. O browser nunca fala com a rig.
- A route da Vercel faz:
  - whitelist: só `POST /api/chat` com `model: "leila"`;
  - `think: false`;
  - limite de tamanho da mensagem (ex.: 300 caracteres) e do histórico (ex.: últimas 6 mensagens);
  - `options.num_predict` em torno de 150;
  - rate limit por IP e fila, pois a rig atende 1 por vez;
  - timeout de cerca de 60 s;
  - **fallback** quando a rig estiver offline ou minerando ("A Leila foi tomar um cafezinho, volta já!").
- No cloudflared, usar `originRequest.httpHostHeader: localhost` por segurança com o host check do Ollama.

**UX:** streaming da resposta, "Leila está digitando…", bolhas de chat mobile-first, botão fixo "Arrematar no Mercado Livre" (link de afiliado, `rel="sponsored nofollow"`), aviso de afiliado, e indicador de status da Leila (online/offline).

## 8. Pendências / próximos passos

- [ ] Confirmar onde está o DNS do fric.com.br (Cloudflare? Vercel? Registro.br?) e se o Rafael tem conta na Cloudflare. O túnel exige que o domínio, ou um subdomínio como `ia.fric.com.br`, passe pela Cloudflare.
- [ ] Instalar o `cloudflared` na rig (Ubuntu 22.04 / Hive OS), criar o túnel e configurar o Access com service token.
- [ ] Criar a route `/api/leila` no Next.js, com o proxy seguro descrito acima.
- [ ] Adaptar `/leilao` para o formato "Lote relâmpago": chat com a Leila, CTA de afiliado, avisos atualizados e sem lances fictícios para este lote.
- [ ] Rodar o cloudflared como serviço systemd, para subir junto com o Ollama.
- [ ] Depois: upgrade de RAM (8 GB DDR3), liberar as 4 GPUs e testar um modelo maior (ex.: `qwen3:30b-a3b`).
- [ ] Depois: criar as outras IAs (Toca, Brisa etc.) como modelos próprios e a conversa entre IAs.
- [ ] Futuro: plataforma nova (Ryzen 5 5600 + B550 + 32 GB). O Celeron limita a cerca de 5,5 tokens/s.

## 9. Planilha de custos

Sheet "Rig de IA — Lista de peças e custos": https://claude.ai/artifact/FJQTwP2eGETaQtZvKGUuxe
(configurações Meu rig / Entrada 16 GB / Pro 24 GB / Max 48 GB, com preços pesquisados em nov/2026)
