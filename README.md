# Longe & Perto

Verdade ou desafio para casal a distância. Um cria a sala, manda o link pelo WhatsApp, o outro entra, e a roleta gira igual nos dois celulares. Site estático (GitHub Pages) + Supabase Realtime, sem login.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | Telas de entrada e de jogo |
| `style.css` | Visual (claro e escuro automático) |
| `app.js` | Salas, roleta sincronizada, vez, placar |
| `manifest.webmanifest`, `sw.js`, `icons/` | App na tela inicial (PWA): manifest, service worker (página pela rede, arquivos em cache) e ícones gerados de `icons/icon.svg` |
| `config.js` | URL e chave anon do Supabase (**preencher**) |
| `supabase/schema.sql` | Tabela `salas`, políticas RLS e Realtime |
| `supabase/002_cartas.sql` | Tabela `cartas` (verdades, desafios e prendas), políticas e Realtime |
| `supabase/003_seed_cartas.sql` | As 376 cartas padrão do jogo |
| `supabase/004_v3.sql` | v3: nomes de sala fixa, tabelas `partidas`, `cofre` e `musicas` (RLS, limite e Realtime) |

## Colocar no ar (uma vez)

1. **Supabase (conta pessoal):** crie um projeto → SQL Editor → cole e rode, nesta ordem, `supabase/schema.sql`, `supabase/002_cartas.sql`, `supabase/003_seed_cartas.sql` e `supabase/004_v3.sql`. O último mostra a contagem de cartas por tipo e nível.
2. **Chaves:** Project Settings → API → copie a *Project URL* e a chave *anon* (ou *publishable*) para o `config.js`.
3. **GitHub:** suba os arquivos para a branch `main` deste repositório.
4. **GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save. Em 1–2 minutos o site fica em `https://ricardodynt-tech.github.io/Longe-Perto/`.

## Como jogar

- Pessoa 1 abre o site, digita o nome e toca em **Criar sala** → **Convidar no WhatsApp**.
- Pessoa 2 abre o link, digita o nome e entra.
- Na sua vez: gire (ou escolha verdade/desafio), cumpra na chamada de vídeo e toque em **Cumpri** ou **Pular**. A vez passa sozinha.
- **Pontos:** verdade vale 1 (leve e criativo), 2 (picante) ou 3 (pesado); desafio vale 2, 2, 3 ou 4. Prenda vale 0.
- **Pulos:** cada pessoa tem N pulos grátis de verdade e N de desafio por partida ("Pulos por tipo": 0, 1, 2, 3, 5 ou 10). O botão mostra "Pular (2 grátis)"; pulo grátis descarta a carta, sem ponto, e passa a vez. Com o contador em 0 ("Pular (paga prenda)"), a carta vira uma **prenda** obrigatória para a mesma pessoa: desafio pulado dá prenda um nível acima (pesado fica pesado), verdade pulada dá prenda do mesmo nível, nunca acima do nível mais alto ligado.
- **Cumprir prenda** vale 0 ponto e devolve pulos do tipo pulado: leve e criativo 1, picante 2, pesado 3 (sem passar do máximo), com aviso nos dois aparelhos.
- **Liberar da prenda:** com uma prenda na tela, só o adversário vê esse botão. Sem ponto, sem devolver pulos, a vez passa e conta em "Liberadas".
- **Meta:** 10, 20 ou 30 pontos. Meta e pulos por tipo só mudam com o placar zerado. Quem chegar primeiro vence e quem perdeu recebe a **prenda final** (nível mais alto ligado). **Nova partida** zera o placar e mantém meta, pulos, níveis e cartas de vocês; quem perdeu começa.
- Qualquer um pode ligar/desligar níveis; muda para os dois.
- **+ Adicionar carta** (abaixo dos níveis): qualquer um cria verdade, desafio ou prenda, com nível e, se quiser, aviso de foto/vídeo/áudio. A carta vai para a tabela `cartas` com o código da sala, aparece na lista **Cartas de vocês** dos dois, entra no sorteio e mostra "carta de {autor}". Qualquer um pode apagar. Limite de 300 por sala; as cartas ficam na sala (para manter, reusem o mesmo código).
- Para voltar a uma sala (recarregou, trocou de aba), entre com o **mesmo nome**.

- **App no celular:** no Chrome do Android, "Instalar app" no início (ou "Adicionar à tela inicial"). O aparelho vibra quando chega a sua vez.
- **Cronômetro:** carta com tempo ("20 segundos") mostra "Iniciar 20s"; as outras, "Cronômetro". A contagem aparece nos dois; qualquer um pausa ou cancela.
- **Nota do adversário:** desafio cumprido recebe ★ a ★★★ do outro; cada estrela vale +1 ponto (pode desligar com o placar zerado).
- **Sala fixa:** "Criar sala fixa" gera um nome com final aleatório (ex.: `rica-e-carol-7k2p`). Guardem o link; a sala aparece em "Salas recentes". O **Histórico** registra cada partida terminada.
- **Reencontro:** data com contagem regressiva e **Cofre** para guardar cartas e combinados ("Guardar para o reencontro" na carta).
- **Desafio do dia** (sala fixa): um desafio por pessoa por dia, igual nos dois aparelhos, com sequência de dias.
- **Trilha da rodada:** cadastrem músicas com o link do Spotify ("+ Adicionar música"); a cada giro sai uma do nível da carta, com "Abrir no Spotify" e "Tocar aqui".

## Como funciona

Cada sala é uma linha em `public.salas` com o estado do jogo em `estado` (jsonb): jogadores, níveis, vez, placar (pontos, verdades, desafios, prendas, liberadas e pulos grátis restantes de cada um), meta, pulos por tipo, vencedor, aviso, último giro e carta atual. As cartas (padrão e de vocês) ficam na tabela `cartas`, que também é sincronizada pelo Realtime. Cada ação grava o estado e os dois aparelhos recebem o `UPDATE` pelo Realtime. As cartas não se repetem até acabar o nível escolhido.

## Observações

- A chave anon fica pública no site; isso é normal no Supabase. As políticas deixam qualquer pessoa com o código ler e jogar numa sala — adequado para um jogo entre vocês dois, não guarde nada sensível ali.
- Limpeza opcional de salas paradas: a última linha comentada do `schema.sql`.
- Se o Realtime não sincronizar, confira em *Database → Publications* se `salas` está em `supabase_realtime`.
- **Cartas padrão:** ficam na tabela `cartas` (com `sala` vazia). Para editar, use o Table Editor do Supabase; para tirar uma do jogo sem apagar, marque `ativa = false`.
