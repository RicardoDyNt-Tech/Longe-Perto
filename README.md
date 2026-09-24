# Longe & Perto

Verdade ou desafio para casal a distância. Um cria a sala, manda o link pelo WhatsApp, o outro entra, e a roleta gira igual nos dois celulares. Site estático (GitHub Pages) + Supabase Realtime, sem login.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Telas de entrada e de jogo |
| `style.css` | Visual (claro e escuro automático) |
| `app.js` | Salas, roleta sincronizada, vez, placar |
| `conteudo.js` | As 46 verdades e 100 desafios por nível — edite aqui para adicionar |
| `config.js` | URL e chave anon do Supabase (**preencher**) |
| `supabase/schema.sql` | Tabela `salas`, políticas RLS e Realtime |

## Colocar no ar (uma vez)

1. **Supabase (conta pessoal):** crie um projeto → SQL Editor → cole e rode `supabase/schema.sql`.
2. **Chaves:** Project Settings → API → copie a *Project URL* e a chave *anon* (ou *publishable*) para o `config.js`.
3. **GitHub:** suba os arquivos para a branch `main` deste repositório.
4. **GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save. Em 1–2 minutos o site fica em `https://ricardodynt-tech.github.io/Longe-Perto/`.

## Como jogar

- Pessoa 1 abre o site, digita o nome e toca em **Criar sala** → **Convidar no WhatsApp**.
- Pessoa 2 abre o link, digita o nome e entra.
- Na sua vez: gire (ou escolha verdade/desafio), cumpra na chamada de vídeo e toque em **Cumpri** (ganha ponto) ou **Pular**. A vez passa sozinha.
- Qualquer um pode ligar/desligar níveis; muda para os dois.
- Em **Cartas de vocês**, qualquer um escreve verdades e desafios próprios (tipo + nível). Elas entram no sorteio para os dois, aparecem com "carta de …" e ficam guardadas no celular de quem escreveu, voltando automaticamente nas próximas salas. Dá para remover pela lista.
- Para voltar a uma sala (recarregou, trocou de aba), entre com o **mesmo nome**.

## Como funciona

Cada sala é uma linha em `public.salas` com o estado do jogo em `estado` (jsonb): jogadores, níveis, vez, placar, último giro, carta atual e as cartas criadas por vocês (`extras`). Cada ação grava o estado e os dois aparelhos recebem o `UPDATE` pelo Realtime. As cartas não se repetem até acabar o nível escolhido.

## Observações

- A chave anon fica pública no site; isso é normal no Supabase. As políticas deixam qualquer pessoa com o código ler e jogar numa sala — adequado para um jogo entre vocês dois, não guarde nada sensível ali.
- Limpeza opcional de salas paradas: a última linha comentada do `schema.sql`.
- Se o Realtime não sincronizar, confira em *Database → Publications* se `salas` está em `supabase_realtime`.
