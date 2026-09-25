# Plano — Longe & Perto: Guia de poses para fotos e vídeos

Complemento com duas fases, um commit cada. A Fase 1 é independente; a Fase 2 usa a IA. Pode entrar depois do **Guia de posições** (reaproveita o mesmo tipo de tela) ou sozinho.

**Objetivo:** nas cartas que pedem foto ou vídeo (`midia` preenchido), dar ideias de pose, enquadramento e luz, para ninguém travar na hora de cumprir.

## Decisões

- O guia é **só texto**: nome, "como fazer", tipo (foto ou vídeo), nível e enquadramento.
- **Ícones opcionais**, colocados pelo Ricardo. A coluna `icone` recebe o nome de um arquivo em `icones/poses/`, igual ao guia de posições. O Claude Code não cria nem baixa imagens.
- **O app não recebe, não guarda e não envia fotos ou vídeos.** Tudo continua no WhatsApp, em visualização única.

## Fase 0 — SQL (já pronto)

O `016_poses.sql` é fornecido pronto. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda no SQL Editor.

Ele cria a tabela `poses`, que o app só lê, com 30 poses:

| Tipo | Leve | Picante | Pesado |
|---|---|---|---|
| Foto | 6 | 10 | 8 |
| Vídeo | – | 3 | 3 |

O `enquadramento` de cada pose é `close`, `meio`, `inteiro`, `espelho` ou `silhueta`.

## Fase 1 — Guia no app

1. **Carregar** as `poses` ativas ao abrir a sala.
2. **Botão "📸 Ideias de pose"** na carta. Aparece quando a carta tem `midia` igual a `foto` ou `video`, ou quando o texto tem "foto", "vídeo", "video", "nude" ou "selfie".
   - O botão abre o guia já filtrado pelo tipo da carta (foto ou vídeo) e pelo nível dela.
   - Carta Leve ou Criativa mostra poses Leves. Carta Picante mostra até Picante. Carta Pesada mostra todas.
3. **O guia**, num `<dialog>` de tela cheia no celular:
   - Filtros: tipo, nível e enquadramento.
   - Cada pose num cartão com nome, "como fazer", selo de enquadramento e, se tiver, o ícone.
   - Botão "🎲 Sortear pose", que respeita os filtros.
4. **Sorteio ou escolha.** "Sortear" ou "Usar esta" grava `estado.pose = { id, nome, como, por: eu }`. A pose aparece embaixo da carta nos dois aparelhos: "{nome} sugeriu a pose: {nome da pose}". Ela some quando a carta sai.
5. **Quem escolhe.** Qualquer um dos dois pode sortear ou escolher. Assim, quem vai receber a foto também pode escolher a pose.
6. **Cuidados antes de mandar.** No topo do guia, um bloco recolhível (`<details>`), fechado por padrão, com este texto fixo:
   - Deixe o rosto, tatuagens e objetos que identifiquem você fora do quadro nas fotos mais ousadas.
   - Mande sempre em visualização única e não salve o que receber.
   - Veja se a galeria não faz backup automático na nuvem (Google Fotos, por exemplo) ou use uma pasta bloqueada.
   - Ninguém é obrigado a mandar: dá para pular e pagar a prenda.
7. **Aba "Poses"** na Casa do casal, se a v5 estiver aplicada, para abrir o guia fora das cartas.

## Ícones (opcional)

Se `poses.icone` estiver preenchido, mostrar `<img src="icones/poses/{icone}">` com 56 px, `loading="lazy"` e `alt` igual ao nome. No tema claro, aplicar `filter: invert(1)` para ícones brancos. Sem ícone, mostrar só o selo de enquadramento.

## Aceite

- A carta "Mande uma foto no espelho, de costas, só de roupa íntima." mostra "📸 Ideias de pose", e o guia abre filtrado por foto até Pesado.
- Uma carta Picante nunca mostra poses Pesadas.
- Sortear mostra a mesma pose nos dois aparelhos.
- O bloco de cuidados está no topo, fechado por padrão.
- Nenhuma imagem é recebida, guardada ou enviada pelo app.

## Fase 2 — Ideias de pose pela IA (Mistral)

**Pré-requisito:** a Fase 1 deste plano e a função `gerar-cartas` do `plano-longe-perto-ia.md` já no ar, com deploy feito e testada.

A ideia é reaproveitar a mesma Edge Function, com o mesmo limite diário, os mesmos secrets e a mesma proteção de origem, só acrescentando um modo "pose". **Nenhum SQL novo.**

### Na Edge Function `gerar-cartas`

1. **Entrada nova:** `tipo: "pose"`, com o campo extra `formato` (`"foto"` ou `"video"`).
   - `nivel` aceita `leve`, `picante` ou `pesado`. Se vier `criativo`, tratar como `leve`.
   - `tema` e `quantidade` funcionam como nos outros tipos.
2. **Exemplos para não repetir:** até 15 linhas de `poses` com o mesmo `tipo` (foto ou vídeo) e o mesmo nível, mandando `nome` e `como`.
3. **Instrução de sistema:** acrescentar este bloco ao final do texto atual, sem mudar o resto:

   ```
   Modo pose (quando o tipo for "pose"):
   - Em vez de cartas, sugira poses para a pessoa tirar uma foto ou gravar um vídeo curto sozinha, em casa, para mandar à outra pessoa pelo WhatsApp em visualização única.
   - Cada pose tem: "nome" (até 40 caracteres), "como" (até 200 caracteres, dizendo posição do corpo, ângulo da câmera e luz) e "enquadramento" (um de: close, meio, inteiro, espelho, silhueta).
   - Tem de ser possível fazer sozinho(a), com o celular na mão, apoiado ou no espelho.
   - leve: fotos carinhosas e bonitas, sem nada sexual. picante: sensual, com roupa ou roupa íntima, sem nudez. pesado: nudez artística ou ousada.
   - Nas poses picantes e pesadas, prefira enquadramentos sem o rosto.
   - Para vídeo, descreva um movimento curto, de 5 a 15 segundos.
   - Responda somente com JSON no formato {"poses":[{"nome":"...","como":"...","enquadramento":"meio"}]}.
   ```

4. **Validação da resposta:**
   - Ler `poses`, cortar `nome` em 40 caracteres e `como` em 200.
   - Se o `enquadramento` vier fora da lista, usar `meio`.
   - Descartar as poses vazias e as que tiverem o `nome` igual a um exemplo.
   - As regras de nova tentativa, `recusado`, `falha` e de só contar no limite depois de uma resposta válida continuam as mesmas.
5. **Saída:** `{ "poses": [ { "nome", "como", "enquadramento" } ], "usadasHoje", "limite" }`.

### No app

6. No guia de poses, ao lado de "🎲 Sortear pose", o botão **"✨ Ideias da IA"** com o campo opcional "Tema" (até 60 caracteres, ex.: "luz de vela", "banheiro", "roupa vermelha").
   - Chama a função com o `formato` e o nível dos filtros atuais, e `quantidade: 3`.
7. As 3 sugestões aparecem como cartões iguais aos do guia, com o selo "✨ IA". O botão "Usar esta" grava em `estado.pose`, exatamente como uma pose do guia, e a pose aparece nos dois aparelhos.
8. **As sugestões não são salvas no banco.** Somem ao fechar o guia. Nesta versão, não há como guardar uma pose da IA.
9. Mensagens de erro e o contador "12 de 40 hoje" iguais aos do "✨ Ideias da IA" das cartas.
10. Só em sala fixa, como o resto da IA.

### Aceite da Fase 2

- `{"tipo":"pose","formato":"foto","nivel":"picante","quantidade":3}` devolve 3 poses em PT-BR, com enquadramento válido.
- `formato: "video"` devolve movimentos curtos.
- "Usar esta" mostra a pose da IA nos dois aparelhos.
- A geração de poses conta no mesmo limite diário das cartas.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-poses.md` na raiz do repositório. Crie a branch `poses` a partir da `main`, coloque `016_poses.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Depois aplique a Fase 1 num commit. A Fase 2 só se a função `gerar-cartas` já estiver no ar: atualize a função, pare para eu fazer o deploy de novo e então faça a parte do app, num segundo commit. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, sem dependências novas). Não crie nem baixe imagens. No fim, rode o aceite, me conte o resultado e não faça merge na `main`.
