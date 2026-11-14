# Vídeo da Leila — especificação para a IA de vídeo

O que a página fric.com.br/leilao espera receber por lote. A página já tem o player pronto
(`LOTE.video` em `components/LoteRelampago.tsx`); com `null`, mostra só o avatar.

## Arquivos (por lote)

| Arquivo | Formato | Obrigatório |
|---|---|---|
| `<slug>.mp4` | H.264 + AAC, **9:16 (1080x1920 ou 720x1280)**, 24–30 fps, **até 8 MB** | sim |
| `<slug>.jpg` | primeiro quadro, mesmo tamanho, para o poster | recomendado |
| `<slug>.pt.vtt` | legenda WebVTT em português, sincronizada com a fala | **sim** |

- Duração: **20 a 40 s**. O vídeo roda em loop.
- Legenda é obrigatória: o vídeo começa **mudo** (regra dos navegadores), então quem não liga o
  som só entende pela legenda. Não queimar a legenda na imagem (a página já desenha a do .vtt).
- Deixar livre de texto importante: os **120 px de cima** (selo "Vídeo gerado por IA" e botão de
  som ficam ali) e os **200 px de baixo** (onde a legenda aparece).
- Compressão sugerida: `ffmpeg -i in.mp4 -vf scale=720:1280 -c:v libx264 -crf 26 -preset slow -c:a aac -b:a 96k -movflags +faststart <slug>.mp4`
  (`+faststart` é importante: o vídeo começa a tocar antes de baixar tudo).

## Roteiro (regras — as mesmas da Leila no chat)

1. **Abrir dizendo que é IA**: "Eu sou a Leila, uma IA do Fric…" nos primeiros 5 s.
2. **Nada de lance, leilão de lances, "últimas unidades", "estoque acabando", "X pessoas compraram"**
   nem contador de urgência. É "lote relâmpago" com **preço fixo no Mercado Livre**.
3. **Preço**: falar o preço consultado e "confira no botão", porque muda no ML. Não prometer prazo de entrega.
4. **Só fatos do anúncio** (medidas, material, loja, garantia). Nunca "super bem avaliada" sem avaliações para isso.
5. **Fechar convidando para o botão** "Arrematar no Mercado Livre", sem pressão.
6. Rosto/voz da Leila são de IA: nada de imitar pessoa real, marca ou personagem existente.

Exemplo (guirlanda, ~25 s):
> Lote relâmpago na mesa! Eu sou a Leila, uma IA do Fric. Hoje é uma guirlanda de Natal de 27 centímetros,
> verde com pontinhas brancas e laço vermelho. É compacta, então mede sua porta antes. Quem vende é a loja
> oficial Eletrodey, com garantia de 90 dias, e estava R$ 19,90 com frete grátis quando eu conferi.
> O preço certinho está no botão "Arrematar no Mercado Livre".

## Entrega

Mandar os 3 arquivos (pasta local ou link). A publicação é: upload no Vercel Blob em `lotes/<slug>.*`
→ preencher `LOTE.video = { src, poster, vtt }` → push. Sem mexer em layout.
