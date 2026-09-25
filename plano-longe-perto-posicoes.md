# Plano — Longe & Perto: Guia de posições

Complemento independente. Pode entrar depois da versão que estiver na `main` (precisa só das cartas no banco da v2 e dos avisos da v3). Uma única fase e um commit.

**Objetivo:** nas cartas que falam de posição ("escolha a posição…", "monte um cardápio de posições…", "eu escolho uma posição…"), o casal ter uma referência para escolher, sortear e montar listas, sem precisar sair do jogo.

## Decisão sobre imagens

O guia é só texto: nome, descrição curta, dificuldade e clima. Não tem imagens.

- O app não gera nem hospeda imagens de posições.
- Não subir imagens para o Supabase. Com a chave anon, qualquer arquivo ou linha do banco pode ser lido por quem souber o endereço. Imagem íntima ali ficaria exposta.
- Se o casal quiser uma referência visual, cada posição marcada pode guardar um link externo escolhido por eles (campo `link` em `posicoes_marcadas`), que abre fora do app.

## Fase 0 — SQL (já pronto)

O `010_posicoes.sql` é fornecido pronto. O Claude Code coloca em `supabase/` e não edita. O Ricardo roda no SQL Editor.

- Tabela `posicoes`: o guia, com 18 posições: nome, descrição, dificuldade (fácil, média, difícil), clima (romântica, intensa, aventura) e nível (Picante ou Pesado). Só leitura pelo app.
- Tabela `posicoes_marcadas`: marcas do casal por sala (favorita, queremos testar, já fizemos) e o link externo opcional. Com Realtime.

## Fase 1 — Guia no app

1. Carregar `posicoes` (ativas) e as `posicoes_marcadas` da sala ao abrir a sala.
2. Respeitar os níveis. O guia só aparece quando o nível Picante ou o Pesado estiver ativo na partida, e mostra as posições de cada nível só se esse nível estiver ativo.
3. Botão "📖 Posições" na carta. Aparece quando o texto da carta tiver "posição" ou "posições", sem diferenciar maiúsculas. Abre o guia num `<dialog>` de tela cheia no celular.
4. Guia:
   - Filtros: dificuldade, clima e marcas (Todas, Favoritas, Queremos testar, Já fizemos).
   - Cada posição aparece num cartão com nome, descrição, selos de dificuldade e clima, e as marcas ⭐ Favorita, 🎯 Queremos testar e ✅ Já fizemos. As marcas são do casal e sincronizam nos dois aparelhos.
   - Botão "🔗 Referência" para colar um link `https://` que abre fora do app (`target="_blank"`). O app valida só o `https://`.
5. **Sortear.** Botão "🎲 Sortear posição" no guia, que respeita os filtros ativos.
   - O resultado vai para `estado.posicao = { id, nome, descricao, por: eu }` e aparece nos dois aparelhos, embaixo da carta: "{nome} sorteou: {posição}".
6. **Escolher.** Em cada cartão, o botão "Escolher esta" faz o mesmo que o sorteio, com o texto "{nome} escolheu: {posição}". Serve para as cartas do tipo "eu escolho uma posição e você…".
7. **Cardápio.** Nas cartas que falam de cardápio ou de várias posições, o botão "Montar cardápio" deixa marcar até 5 posições no guia e mostra a lista para os dois.
   - Botão "Guardar para o reencontro" envia o cardápio para o cofre da v3, como um item com o texto da carta e as posições na nota.
8. **Limpeza.** `estado.posicao` e o cardápio somem quando a carta sai.
9. Aba "Posições" na Casa do casal (se a v5 já estiver aplicada), para abrir o guia fora das cartas. Sem a v5, fica acessível pelo menu da sala.

**Aceite:**
- Uma carta com "posição" mostra o botão, e o guia abre com filtros.
- Sortear ou escolher mostra a mesma posição nos dois aparelhos.
- As marcas sincronizam entre os aparelhos.
- O cardápio vai para o cofre.
- Com só Leve e Criativo ativos, o guia não aparece.
- Nenhuma imagem é carregada nem guardada pelo app.

## Prompt

Leia `plano-longe-perto-posicoes.md` na raiz do repositório. Crie a branch `posicoes` a partir da `main`, coloque `010_posicoes.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Depois aplique a Fase 1 num commit só, seguindo as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, sem dependências novas). Não adicione imagens ao projeto nem ao banco. No fim, rode o aceite, me conte o resultado e não faça merge na `main`.
