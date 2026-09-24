# Longe & Perto

Verdade ou desafio para casal a distância. Um cria a sala, manda o link pelo WhatsApp, o outro entra, e a roleta gira igual nos dois celulares. Site estático (GitHub Pages) + Supabase Realtime, sem login.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Telas de entrada e de jogo |
| `style.css` | Visual (claro e escuro automático) |
| `app.js` | Salas, roleta sincronizada, vez, placar |
| `config.js` | URL e chave anon do Supabase (**preencher**) |
| `supabase/schema.sql` | Tabela `salas`, políticas RLS e Realtime |
| `supabase/002_cartas.sql` | Tabela `cartas` (verdades, desafios e prendas), políticas e Realtime |
| `supabase/003_seed_cartas.sql` | As 376 cartas padrão do jogo |

## Colocar no ar (uma vez)

1. **Supabase (conta pessoal):** crie um projeto → SQL Editor → cole e rode, nesta ordem, `supabase/schema.sql`, `supabase/002_cartas.sql` e `supabase/003_seed_cartas.sql`. O último mostra a contagem de cartas por tipo e nível.
2. **Chaves:** Project Settings → API → copie a *Project URL* e a chave *anon* (ou *publishable*) para o `config.js`.
3. **GitHub:** suba os arquivos para a branch `main` deste repositório.
4. **GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save. Em 1–2 minutos o site fica em `https://ricardodynt-tech.github.io/Longe-Perto/`.

## Como jogar

- Pessoa 1 abre o site, digita o nome e toca em **Criar sala** → **Convidar no WhatsApp**.
- Pessoa 2 abre o link, digita o nome e entra.
- Na sua vez: gire (ou escolha verdade/desafio), cumpra na chamada de vídeo e toque em **Cumpri** ou **Pular**. A vez passa sozinha.
- **Pontos:** verdade vale 1 (leve e criativo), 2 (picante) ou 3 (pesado); desafio vale 2, 2, 3 ou 4. Prenda vale 0.
- **Pulos:** cada pessoa tem 3 pulos grátis de verdade e 3 de desafio por partida (o botão mostra "Pular (2 grátis)"). Pulo grátis descarta a carta, sem ponto, e passa a vez. Do 4º em diante ("Pular (paga prenda)"), a carta vira uma **prenda** obrigatória para a mesma pessoa: desafio pulado dá prenda um nível acima (pesado fica pesado), verdade pulada dá prenda do mesmo nível, nunca acima do nível mais alto ligado. A prenda final de quem perde sai do nível mais alto ligado. Prenda vale 0 e não pode ser pulada.
- **Liberar da prenda:** com uma prenda na tela (por pulo ou a final), o adversário pode tocar em **Liberar da prenda**: sem ponto, a vez passa e conta em "Liberadas". Os dois veem o aviso "{fulano} liberou {ciclano} da prenda."
- **Meta:** 10, 20 ou 30 pontos (só muda com o placar zerado). Quem chegar primeiro vence, e quem perdeu cumpre uma **prenda final**. **Nova partida** zera o placar e mantém níveis e cartas de vocês.
- Qualquer um pode ligar/desligar níveis; muda para os dois.
- **+ Adicionar carta** (abaixo dos níveis): qualquer um cria verdade, desafio ou prenda, com nível e, se quiser, aviso de foto/vídeo/áudio. A carta vai para a tabela `cartas` com o código da sala, aparece na lista **Cartas de vocês** dos dois, entra no sorteio e mostra "carta de {autor}". Qualquer um pode apagar. Limite de 300 por sala; as cartas ficam na sala (para manter, reusem o mesmo código).
- Para voltar a uma sala (recarregou, trocou de aba), entre com o **mesmo nome**.

## Como funciona

Cada sala é uma linha em `public.salas` com o estado do jogo em `estado` (jsonb): jogadores, níveis, vez, placar (pontos, verdades, desafios, prendas e pulos de cada um), meta, vencedor, último giro e carta atual. As cartas (padrão e de vocês) ficam na tabela `cartas`, que também é sincronizada pelo Realtime. Cada ação grava o estado e os dois aparelhos recebem o `UPDATE` pelo Realtime. As cartas não se repetem até acabar o nível escolhido.

## Observações

- A chave anon fica pública no site; isso é normal no Supabase. As políticas deixam qualquer pessoa com o código ler e jogar numa sala — adequado para um jogo entre vocês dois, não guarde nada sensível ali.
- Limpeza opcional de salas paradas: a última linha comentada do `schema.sql`.
- Se o Realtime não sincronizar, confira em *Database → Publications* se `salas` está em `supabase_realtime`.
- **Cartas padrão:** ficam na tabela `cartas` (com `sala` vazia). Para editar, use o Table Editor do Supabase; para tirar uma do jogo sem apagar, marque `ativa = false`.
