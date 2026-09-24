# Plano — Longe & Perto v2

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`. São três fases, cada uma com o próprio commit:

1. **Cartas no banco:** todas as verdades, desafios e prendas passam a morar no Supabase, na tabela `cartas`. O `conteudo.js` deixa de existir.
2. **Cartas de vocês:** os dois adicionam verdades, desafios e prendas dentro da sala, gravados na mesma tabela.
3. **Placar de jogo:** pontos por nível, 3 pulos grátis de verdade e 3 de desafio por pessoa, prenda obrigatória a partir do 4º pulo, "Liberar da prenda", meta de pontos e prenda final para quem perde.

O conteúdo novo (160 cartas, cartas de posições e 40 prendas) está nos Anexos A, B e C e vai para o banco pelo SQL de seed.

---

## Contexto do projeto (ler antes de mexer)

- Site estático publicado no GitHub Pages a partir da branch `main`, raiz do repositório. Não há build, bundler nem framework.
- Os arquivos são `index.html`, `style.css`, `app.js`, `conteudo.js`, `config.js` e `supabase/schema.sql`.
- O Supabase é carregado pelo CDN (`@supabase/supabase-js@2.45.4`, build UMD) e acessado com a chave anon que está em `config.js`.
- Cada sala é uma linha em `public.salas`. O jogo inteiro fica em `estado` (jsonb): `jogadores`, `niveis`, `vez`, `pontos`, `giro`, `carta` e `usados`.
- Toda ação grava o `estado` inteiro com `gravar()`. Os dois aparelhos recebem o `UPDATE` pelo Realtime e redesenham com `aplicar()`.
- A roleta sincroniza pelo `giro.id`, e a carta viaja junto com o texto dentro do `estado`.

## Regras para o Claude Code

- **Mudança mínima.** Não reescrever o que já funciona (roleta, entrar/criar sala, vez, sincronização). Acrescentar código, não substituir.
- **Não alterar o `config.js`.**
- **SQL em arquivos novos, idempotentes.** O Ricardo roda esses arquivos manualmente no SQL Editor; o Claude Code não acessa o Supabase. Todo o SQL fica pronto na Fase 1, para ter uma única pausa.
- **Texto digitado por usuário só entra na tela via `textContent`.** Nunca usar `innerHTML` com conteúdo vindo do banco ou de usuário.
- **Compatibilidade com salas antigas.** Campos novos no `estado` precisam de valor padrão quando não existirem.
- **Sem dependências novas.**
- **Mídia não passa pelo app.** Fotos, vídeos, áudios e nudes vão pelo WhatsApp. O app só mostra o texto e, quando a carta tem `midia`, a linha "Mande pelo WhatsApp em visualização única". Não criar upload.
- **Branch `v2`**, com um commit por fase. O merge na `main` só acontece depois do checklist de testes.

---

## Fase 1 — Cartas no banco

### SQL 1: `supabase/002_cartas.sql` (estrutura)

```sql
create table if not exists public.cartas (
  id        uuid primary key default gen_random_uuid(),
  sala      text references public.salas(codigo) on delete cascade, -- null = carta padrão do jogo
  tipo      text not null check (tipo in ('verdade','desafio','prenda')),
  nivel     text not null check (nivel in ('leve','criativo','picante','pesado')),
  texto     text not null check (char_length(btrim(texto)) between 3 and 280),
  midia     text check (midia in ('foto','video','audio')),
  autor     text check (autor is null or char_length(btrim(autor)) between 1 and 20),
  ativa     boolean not null default true,
  criada_em timestamptz not null default now(),
  constraint carta_da_sala_tem_autor check (sala is null or autor is not null)
);

create index if not exists cartas_sala_idx on public.cartas (sala);
-- evita duplicar as cartas padrão se o seed rodar de novo
create unique index if not exists cartas_padrao_uniq on public.cartas (tipo, nivel, texto) where sala is null;

-- necessário para o Realtime entregar DELETE filtrado por sala
alter table public.cartas replica identity full;

alter table public.cartas enable row level security;

drop policy if exists "ler cartas" on public.cartas;
create policy "ler cartas" on public.cartas
  for select to anon, authenticated using (true);

-- usuário só cria carta da própria sala; as padrão só entram pelo SQL Editor
drop policy if exists "criar carta da sala" on public.cartas;
create policy "criar carta da sala" on public.cartas
  for insert to anon, authenticated
  with check (sala is not null and exists (select 1 from public.salas s where s.codigo = sala));

-- usuário só apaga carta de sala, nunca as padrão
drop policy if exists "apagar carta da sala" on public.cartas;
create policy "apagar carta da sala" on public.cartas
  for delete to anon, authenticated using (sala is not null);
```

O mesmo arquivo também precisa de:

- **Limite de 300 cartas por sala.** Um trigger `before insert` que conta as cartas da sala e dá `raise exception 'limite de cartas da sala atingido'` ao passar do limite.
- **Realtime.** Adicionar a tabela à publicação `supabase_realtime`, com o mesmo bloco `do $$ … $$` do `schema.sql`.

### SQL 2: `supabase/003_seed_cartas.sql` (conteúdo)

- Gerado pelo Claude Code a partir das listas atuais do `conteudo.js` mais os Anexos A, B e C deste plano.
- Um `insert into public.cartas (tipo, nivel, texto, midia) values … on conflict do nothing;` por nível e tipo.
- **Escapar aspas simples** do texto (`'` vira `''`).
- As marcações `[foto]`, `[vídeo]` e `[áudio]` no fim dos textos viram o campo `midia` (`foto`, `video`, `audio`) e saem do texto.
- As cartas atuais que já pedem mídia também recebem `midia`. Por exemplo: "Tire uma foto sensual…" (foto), "Mande um áudio de 20 segundos…" (audio), "Mande uma selfie agora…" (foto) e "Mande uma foto ousada…" (foto).
- No fim do arquivo, um `select tipo, nivel, count(*) from public.cartas where sala is null group by 1, 2 order by 1, 2;` para o Ricardo conferir a contagem com a tabela abaixo.

### App

1. **Carregar as cartas ao abrir a sala.** Buscar `cartas` com `.or('sala.is.null,sala.eq.' + codigo)` e `ativa = true`, e guardar no array `cartas`. São cerca de 460 linhas, dentro do limite padrão de 1.000 por consulta.
2. **Sorteio.** `sortear()` passa a usar o array `cartas`, filtrando por `tipo` e pelos níveis ativos. A chave em `usados` passa a ser o `id` da carta.
3. **Carta no `estado`** continua levando `texto`, `nivel` e `tipo`, e ganha `midia`, `autor` e `id`. Assim o outro aparelho mostra a carta mesmo sem ter a lista carregada.
4. **Aviso de mídia.** Quando `midia` existir, mostrar abaixo do texto: "Mande pelo WhatsApp em visualização única."
5. **Falha ao carregar.** Se a busca falhar, mostrar "Não consegui carregar as cartas. Recarregue a página." e desativar o botão de girar.
6. **Tirar o conteúdo do código.** Remover `conteudo.js` e a tag `<script>` dele. O `LEVEL_NAMES` vai para dentro do `app.js`.
7. **Salas antigas.** Chaves antigas em `usados` (texto no lugar de uuid) são simplesmente ignoradas.

### Contagem esperada de cartas padrão

| Nível | Verdades | Desafios | Prendas |
|---|---|---|---|
| Leve | 40 | 70 | 10 |
| Criativo | 26 | 50 | 10 |
| Picante | 35 | 45 | 10 |
| Pesado | 30 | 40 | 10 |

---

## Fase 2 — Cartas de vocês

1. **Tela de adicionar.** Um botão "Adicionar carta" abaixo dos chips de nível abre um `<dialog>` com:
   - Tipo: Verdade, Desafio ou Prenda.
   - Nível: select com os 4 níveis.
   - Texto: textarea com `maxlength=280` e contador.
   - Checkbox "Pede foto, vídeo ou áudio", que grava `midia`. Um select curto aparece quando marcado.
   - Botões "Salvar carta" e "Cancelar".
2. **Salvar.** Faz `insert` em `cartas` com `sala = codigo` e `autor = nome` do jogador. Validação no cliente: no mínimo 3 caracteres depois do trim.
3. **Realtime.** No mesmo canal da sala, acrescentar `postgres_changes` para `INSERT` e `DELETE` em `cartas` com `filter: sala=eq.CODIGO`. Os eventos atualizam o array `cartas`.
4. **Lista "Cartas de vocês (N)".** Fica recolhível (`<details>`) abaixo do placar. Cada item mostra tipo, nível, autor e texto, com o botão "Apagar" e uma confirmação. Qualquer um dos dois pode apagar.
5. **Carta sorteada de vocês.** A linha de nível passa a dizer "Nível X, carta de {autor}, para {nome}".
6. **Erros** no `#erroJogo`: falha de rede e limite de 300 cartas (reconhecer a mensagem do trigger).

---

## Fase 3 — Placar de jogo, pulos e prendas

### Estado

Novo campo `estado.placar`, com um objeto por jogador:

```js
{ pontos: 0, verdades: 0, desafios: 0, prendas: 0, liberadas: 0, pulosV: 0, pulosD: 0 }
```

Mais `estado.meta = 20` e `estado.vencedor = null`. Em sala antiga sem `placar`, criar a partir de `estado.pontos` e zerar o resto.

### Pontuação

| Carta cumprida | Leve | Criativo | Picante | Pesado |
|---|---|---|---|---|
| Verdade | 1 | 1 | 2 | 3 |
| Desafio | 2 | 2 | 3 | 4 |
| Prenda | 0 | 0 | 0 | 0 |

### Regras

1. **Cumpri** soma os pontos da tabela e o contador do tipo, e passa a vez.
2. **Pular (verdade ou desafio).** Cada pessoa tem 3 pulos grátis de verdade e 3 de desafio por partida, contados em `pulosV` e `pulosD`.
   - **Do 1º ao 3º pulo:** soma o contador, descarta a carta, não dá ponto e passa a vez.
   - **Do 4º pulo em diante:** soma o contador e troca a carta por uma **prenda obrigatória** para a mesma pessoa, na mesma vez. O nível da prenda depende da carta pulada:
     - **Desafio pulado:** um nível acima (leve → criativo → picante → pesado; pesado continua pesado).
     - **Verdade pulada:** o mesmo nível da verdade.
     - **Teto:** nunca acima do nível mais alto entre os ativos.
     - **Sem prenda nesse nível:** se não houver prenda disponível no nível calculado, desce um nível até encontrar.
3. **Carta de prenda.** Mostra "Prenda por pular a verdade" ou "Prenda por pular o desafio". Não tem botão Pular, só "Cumpri", que vale 0 ponto, soma `prendas` e passa a vez.

   3b. **Liberar da prenda.** Enquanto houver uma prenda na tela (por pulo ou a prenda final), o adversário vê o botão "Liberar da prenda". Quem está pagando a prenda não vê esse botão.
   - Ao tocar: descarta a prenda, não dá ponto, passa a vez e soma `liberadas` no placar de quem foi liberado. Os contadores de pulo não mudam.
   - Os dois aparelhos mostram por alguns segundos: "{adversário} liberou {nome} da prenda."
   - Na prenda final, liberar leva direto ao estado de "Nova partida".
4. **Botão Pular.** Mostra quantos pulos grátis restam: "Pular (2 grátis)". Com os grátis esgotados, vira "Pular (paga prenda)".
5. **Meta.** Ao atingir `meta` pontos, grava `estado.vencedor`. A tela mostra "{nome} venceu!" e sorteia uma **prenda final** para quem perdeu, do nível mais alto ativo (se não houver prenda nesse nível, desce até encontrar). Aparece o botão "Nova partida".
6. **Nova partida.** Zera o `placar`, o `vencedor` e os `usados`, e mantém os níveis e as cartas de vocês.
7. **Escolher a meta.** Um select com 10, 20 ou 30 pontos, que só pode ser alterado com o placar zerado.

### Tela

O placar atual (nome e pontos) vira uma tabela de jogo com uma coluna por jogador:

| | Ricardo | Caroline |
|---|---|---|
| Pontos | 12 | 9 |
| Verdades | 3 | 4 |
| Desafios | 3 | 2 |
| Prendas | 1 | 0 |
| Liberadas | 0 | 1 |
| Pulos de verdade | 1/3 | 3/3 +1 |
| Pulos de desafio | 2/3 | 1/3 |

Os pulos aparecem como "usados/3" enquanto houver grátis e como "3/3 +N" para os pulos pagos com prenda. Mostrar também uma barra ou texto "Meta: 20 pontos".

### Critérios de aceite

- Os pontos somam conforme a tabela de pontuação, nos dois aparelhos.
- Os 3 primeiros pulos de cada tipo descartam a carta sem ponto e passam a vez.
- Do 4º pulo em diante, a carta vira prenda para a mesma pessoa, na mesma vez, com o nível da regra 2.
- O botão Pular mostra os pulos grátis restantes e depois "paga prenda".
- Com prenda na tela, só o adversário vê "Liberar da prenda"; liberar passa a vez, sem ponto, e soma "Liberadas".
- Ao bater a meta, os dois veem o vencedor e a prenda final.
- "Nova partida" zera o placar e mantém as cartas de vocês.
- Uma sala antiga abre com o placar criado a partir dos pontos que ela já tinha.

---

## Ordem de execução

1. Criar a branch `v2`.
2. **Fase 1:** criar `002_cartas.sql`, `003_seed_cartas.sql` e a mudança no app. Commit: `cartas no banco + seed`.
3. **Parar** e avisar o Ricardo para rodar os dois SQL, nessa ordem, e conferir a contagem.
4. **Fase 2.** Commit: `cartas de vocês por sala`.
5. **Fase 3.** Commit: `placar, pulos, prendas e meta`.
6. Fazer o checklist de testes. Só depois disso, fazer o merge da `v2` na `main`.

## Checklist de testes

Usar dois navegadores: uma janela normal e uma anônima, ou o computador e o celular.

- [ ] A contagem do seed bate com a tabela da Fase 1.
- [ ] Criar sala em A, entrar em B pelo link, girar: mesma carta nos dois.
- [ ] Carta com `midia` mostra o aviso de visualização única.
- [ ] Adicionar carta em B: aparece na lista de A. Ela pode ser sorteada e mostra o autor.
- [ ] Apagar a carta em A: some nos dois. As cartas padrão não têm botão de apagar.
- [ ] Texto com `<script>` numa carta de vocês: exibido como texto.
- [ ] Cumprir verdade e desafio de níveis diferentes: pontos certos.
- [ ] Pular 3 verdades: sem prenda e sem ponto, a vez passa.
- [ ] 4º pulo de verdade: entra uma prenda para a mesma pessoa, sem botão Pular.
- [ ] O mesmo para desafio, com contador separado.
- [ ] O botão Pular mostra os pulos grátis restantes e depois "paga prenda".
- [ ] 4º pulo de desafio Leve com todos os níveis ativos: prenda Criativa.
- [ ] 4º pulo de desafio Pesado: prenda Pesada.
- [ ] 4º pulo de verdade Picante: prenda Picante.
- [ ] Só Leve e Criativo ativos, 4º pulo de desafio Criativo: prenda Criativa (respeita o teto).
- [ ] Com prenda na tela, só o adversário vê "Liberar da prenda".
- [ ] Liberar: a vez passa, sem ponto, "Liberadas" +1 e aviso nos dois aparelhos.
- [ ] Liberar a prenda final leva ao "Nova partida".
- [ ] Bater a meta: vencedor e prenda final nos dois. "Nova partida" zera o placar.
- [ ] Recarregar e entrar com o mesmo nome: placar e cartas continuam lá.
- [ ] Sala criada antes da v2: abre e joga normalmente.
- [ ] Console do navegador sem erros.

## Fora do escopo desta versão

- Contas e login.
- Guardar cartas de vocês entre salas diferentes. Para manter, reusem o mesmo código de sala.
- Upload de fotos e vídeos. A mídia fica no WhatsApp.
- Tela para editar cartas padrão. Mudanças nelas são feitas direto no Table Editor do Supabase (dá para desligar uma carta com `ativa = false`).

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v2.md` na raiz do repositório e aplique as três fases na ordem da seção "Ordem de execução", numa branch `v2`, com um commit por fase. Siga as "Regras para o Claude Code". Ao terminar a Fase 1, pare e me avise para rodar os dois arquivos SQL no Supabase antes de continuar. Não faça merge na `main`.

---

## Anexo A — Cartas novas (160)

Estas cartas foram pensadas para cada um estar na sua casa, com a chamada de vídeo aberta. `[foto]`, `[vídeo]` e `[áudio]` indicam o campo `midia`.

### Leve — verdades (20)

1. Qual foi o seu pior encontro antes de mim?
2. Qual é a coisa mais boba que te deixa feliz?
3. O que você pensou de mim na nossa primeira conversa?
4. Qual hábito meu você pegou sem perceber?
5. Qual foi a última coisa que você pesquisou no Google?
6. Qual presente meu você guarda com mais carinho?
7. Se pudesse mudar uma coisa na nossa rotina a distância, o que seria?
8. Qual foi a última mentirinha que você me contou?
9. Qual é o seu maior medo sobre a distância?
10. Qual série você quer que a gente assista junto?
11. Qual foi o momento em que você mais riu comigo?
12. Quem da sua família mais pergunta de mim?
13. Qual é a sua lembrança favorita da infância?
14. O que você faria com um dia inteiro só para você?
15. Qual foi a última vez que você sentiu orgulho de mim?
16. Qual foto nossa é a sua favorita?
17. O que você mais gosta na sua própria personalidade?
18. Qual comida você não comeria nem por amor?
19. Qual sonho você ainda não me contou?
20. Qual foi a coisa mais corajosa que você já fez?

### Leve — desafios (20)

1. Mostre o que tem na sua geladeira e comente como um crítico gastronômico.
2. Faça 15 segundos de dança robótica.
3. Fale um trava-língua 3 vezes seguidas sem errar.
4. Mostre sua caneca ou copo favorito e conte a história dele.
5. Finja ser atendente de telemarketing tentando me vender você mesmo(a).
6. Mande um áudio de bom dia para eu ouvir amanhã cedo. [áudio]
7. Pule corda imaginária por 20 segundos.
8. Mostre a sua meia mais feia.
9. Imite o som de 3 animais sem pausa.
10. Faça uma pose de super-herói e diga o seu slogan.
11. Faça um coração com as mãos e segure até eu dizer chega.
12. Vista uma camiseta do avesso e fique assim até a próxima rodada.
13. Conte até 10 em outra língua.
14. Tente equilibrar uma colher no nariz.
15. Mande uma selfie imitando a minha cara favorita. [foto]
16. Mostre a vista da sua janela e descreva como um corretor de imóveis.
17. Me faça 3 elogios com voz de robô.
18. Massageie as próprias mãos narrando como se fosse um spa de luxo.
19. Me mostre o seu cantinho favorito da casa.
20. Fale por 30 segundos sobre o seu dia usando só palavras com mais de 3 letras.

### Criativo — verdades (20)

1. Se a gente fosse personagens de um jogo, quais seriam os nossos poderes?
2. Qual seria o nome do nosso livro de memórias?
3. Se o nosso namoro tivesse uma trilha sonora, qual seria a primeira música?
4. Que invenção você criaria para acabar com a distância?
5. Se eu fosse uma comida, qual seria?
6. Como seria o nosso casamento com orçamento infinito?
7. Qual seria o nome do nosso pet imaginário?
8. Se a gente abrisse um negócio juntos, o que seria?
9. Em qual época da história você gostaria de viver comigo?
10. Qual seria a minha profissão num universo paralelo?
11. Se a nossa história virasse novela, quem faria o vilão?
12. Que cor você acha que eu sou, e por quê?
13. Qual final de filme você mudaria para ser sobre nós?
14. Qual lenda ou mito combina com o nosso namoro?
15. Qual seria o feriado nacional do nosso casal?
16. Se a gente entrasse num reality show, qual seria a nossa estratégia?
17. Descreva o nosso futuro numa frase de biscoito da sorte.
18. Se você criasse uma lei para casais a distância, qual seria?
19. Qual objeto da sua casa melhor representa o nosso namoro?
20. Se a gente fosse uma dupla de detetives, qual seria o nosso primeiro caso?

### Criativo — desafios (20)

1. Faça uma escultura com massinha, papel ou comida que me represente.
2. Invente um jingle de 15 segundos para o nosso casal.
3. Conte como a gente se conheceu no estilo conto de fadas.
4. Desenhe o caminho da sua casa até a minha, com monstros no meio.
5. Faça um fantoche de meia e faça ele me pedir em namoro de novo.
6. Faça um poema em que cada verso começa com uma letra do meu nome.
7. Grave um áudio narrando o seu dia como documentário. [áudio]
8. Desenhe o nosso futuro pet e dê um nome para ele.
9. Faça um desfile com o tema que eu escolher.
10. Invente uma poção do amor com o que tiver na cozinha e mostre o preparo.
11. Encene o nosso reencontro usando objetos como personagens.
12. Escreva a manchete de jornal sobre nós daqui a 10 anos.
13. Faça uma paródia de 4 versos de uma música famosa sobre a nossa distância.
14. Desenhe como seria a nossa casa na árvore.
15. Crie uma coreografia só com as mãos.
16. Imite uma cena de filme de ação usando só coisas do quarto.
17. Invente um idioma de 5 palavras só nosso e me ensine.
18. Conte uma história de terror de 1 minuto com final romântico.
19. Faça um cartão de aniversário para mim só com o que estiver na sua mesa.
20. Tire uma foto artística de um objeto qualquer e me mande com um título. [foto]

### Picante — verdades (20)

1. O que você mais gosta de sentir quando a gente se beija?
2. Qual foi a primeira vez que você me achou irresistível?
3. Que tipo de mensagem minha mais te provoca?
4. Qual cheiro meu você mais sente falta?
5. Qual é a parte do seu corpo que você mais gosta?
6. O que você vestiria para me receber no reencontro?
7. Em qual lugar inusitado você já imaginou a gente se beijando?
8. Qual foi o sonho mais quente que você já teve comigo?
9. O que eu faço sem perceber que te deixa com vontade?
10. Você prefere ser provocado(a) devagar ou ir direto ao ponto?
11. Qual música te deixa no clima pensando em mim?
12. Que elogio sobre o seu corpo você mais gosta de ouvir?
13. Qual foto minha mais mexeu com você?
14. O que você nunca teve coragem de me pedir?
15. Qual é a sua lingerie ou cueca favorita?
16. Você já se arrumou só para me provocar numa chamada?
17. Qual roupa você gostaria que eu usasse na nossa próxima chamada?
18. De 0 a 10, quanta saudade física você está sentindo agora?
19. Onde você mais gosta de receber carinho?
20. Qual foi a mensagem mais ousada que você quase me mandou?

### Picante — desafios (20)

1. Mande um áudio de 15 segundos sussurrando o meu nome. [áudio]
2. Mostre na câmera a roupa íntima que você está usando agora.
3. Faça um desfile de lingerie ou cueca na música que eu escolher.
4. Tire uma selfie no espelho só de roupa íntima e mande. [foto]
5. Beije a própria mão bem devagar olhando para a câmera.
6. Conte em voz baixa o que vai fazer comigo no reencontro.
7. Passe a mão devagar pelo pescoço enquanto me olha.
8. Mande uma foto da parte do seu corpo que você acha mais sexy. [foto]
9. Faça uma pose sensual e segure por 10 segundos.
10. Escreva no chat 3 coisas que você quer fazer comigo.
11. Grave um vídeo de 10 segundos mandando um beijo do jeito mais provocante. [vídeo]
12. Deite na cama e me mostre como estaria me esperando.
13. Tire a camiseta e continue assim até o fim da próxima rodada.
14. Morda uma fruta ou um chocolate do jeito mais provocante possível.
15. Me olhe como se me visse do outro lado de uma festa.
16. Leia uma mensagem que eu te escrever com a sua voz mais sedutora.
17. Mande uma foto de costas usando só a peça que eu escolher. [foto]
18. Faça o seu melhor olhar de "vem cá" por 5 segundos.
19. Me dê uma ordem provocante que eu vou ter que cumprir na próxima rodada.
20. Faça um striptease de uma peça só, bem devagar.

### Pesado — verdades (20)

1. Qual é a fantasia que você mais quer realizar comigo?
2. Qual foi a nossa noite mais intensa até hoje?
3. O que você já fez pensando em mim quando estava sozinho(a)?
4. O que você quer experimentar comigo e ainda não pediu?
5. Onde você gostaria que a gente estivesse agora, sem ninguém por perto?
6. Que foto minha você gostaria de receber hoje?
7. Qual é o seu maior "sim" e o seu maior "não" na intimidade?
8. Qual cena de filme ou série te deixou pensando em nós?
9. Você prefere mandar ou receber nudes? Por quê?
10. Qual foi o momento em que você mais me quis e não podia?
11. Qual palavra minha mais te deixa no clima?
12. Qual é a sua fantasia com chamada de vídeo?
13. O que você quer que eu vista quando a gente se reencontrar?
14. Qual parte do meu corpo você mais queria ver agora?
15. Você já me imaginou numa situação ousada em público? Conta.
16. O que você faria comigo com uma hora livre e nenhuma regra?
17. Qual foi a coisa mais ousada que você já fez num relacionamento?
18. Como você gostaria de ser acordado(a) por mim?
19. Qual fantasia você acha que eu tenho e não conto?
20. Que regra você criaria para as nossas chamadas mais quentes?

### Pesado — desafios (20)

1. Mande um nude, com o enquadramento que você escolher. [foto]
2. Grave um vídeo sensual de 15 segundos e mande. [vídeo]
3. Fique sem roupa até o fim da próxima rodada, com a câmera no ângulo que você quiser.
4. Faça um striptease completo, no seu ritmo, na música que eu escolher.
5. Mande um áudio contando em detalhes o que quer que eu faça com você. [áudio]
6. Escolha uma foto ousada da sua galeria e me mande. [foto]
7. Deixe eu dirigir uma sessão de fotos sua por 2 minutos, pela câmera.
8. Tire uma foto sem a parte de cima e mande. [foto]
9. Faça a pose mais ousada que tiver coragem e segure 10 segundos.
10. Grave um áudio de 10 segundos dizendo meu nome com a voz mais quente que conseguir. [áudio]
11. Escreva a mensagem mais ousada que você já escreveu e me mande.
12. Mostre a peça que você tiraria primeiro para mim, e tire.
13. Mande uma foto saindo do banho. [foto]
14. Por 1 minuto, faça só o que eu mandar, com direito a veto.
15. Descreva sua fantasia mais ousada me olhando nos olhos pela câmera.
16. Mande um vídeo de 10 segundos tirando uma peça de roupa. [vídeo]
17. Me mostre com as mãos, pela câmera, onde você gostaria de ser beijado(a).
18. Descreva o nude que você gostaria de receber de mim.
19. Crie um cupom ousado para usar comigo no reencontro e me mostre.
20. Sim ou não rápido: eu faço 5 perguntas ousadas e você responde em até 3 segundos cada.


## Anexo B — Posições (35)

### Picante — verdades (5)

1. Qual é a sua posição favorita comigo?
2. Qual posição você tem curiosidade de experimentar?
3. Qual posição te lembra a nossa melhor noite?
4. Você prefere estar no controle ou deixar eu conduzir?
5. Qual posição você acha que eu mais gosto?

### Picante — desafios (10)

1. Descreva a sua posição favorita sem dizer o nome, até eu adivinhar.
2. Me mostre com as mãos, pela câmera, a posição que você mais quer repetir.
3. Escolha a posição da nossa primeira noite do reencontro e diga por quê.
4. Deite na posição em que gostaria de dormir abraçado(a) comigo e me mostre.
5. Faça um ranking das suas 3 posições favoritas.
6. Procure o nome de uma posição que a gente nunca fez e me conte o que achou.
7. Desenhe com bonecos de palito a posição que você quer tentar.
8. Diga qual posição combina com cada dia da semana.
9. Escolha uma posição para eu "estudar" até o reencontro.
10. Mostre na câmera como você me puxaria para perto.

### Pesado — verdades (5)

1. Qual posição te faz perder o controle?
2. Qual posição você nunca fez e morre de vontade de fazer?
3. Qual posição você mais imagina quando pensa em mim?
4. Qual posição você achava que não ia gostar e acabou gostando?
5. Qual posição você quer que seja a primeira no reencontro?

### Pesado — desafios (15)

1. Monte a sua posição favorita com travesseiros e me mostre na câmera.
2. Mande um áudio contando a posição que você quer comigo e por quê. [áudio]
3. Deite na cama na posição que você mais quer comigo e fique assim 20 segundos.
4. Eu escolho uma posição e você me explica como faria.
5. Monte um cardápio de 5 posições para o reencontro e me mande.
6. Me mostre pela câmera como você estaria na posição que eu escolher (com ou sem roupa, você decide).
7. Mande uma foto sugerindo a posição que você quer. [foto]
8. Escolha a posição e o cômodo da casa para a primeira vez no reencontro.
9. Descreva a posição que te deixa mais sem fôlego.
10. Grave um vídeo de 10 segundos na posição que você quer que eu imagine. [vídeo]
11. Crie um desafio de posições para a gente cumprir no reencontro.
12. Escolha uma posição nova para cada dia do nosso reencontro.
13. Diga qual posição a gente vai "treinar" primeiro e por quê.
14. Em 30 segundos, diga o maior número de posições que conseguir lembrar.
15. Escolha 3 posições e a gente vota na vencedora.

## Anexo C — Prendas (40)

Usadas a partir do 4º pulo de verdade ou de desafio e como prenda final de quem perde a partida.

### Leve (10)

1. Faça 3 elogios sinceros para mim olhando na câmera.
2. Faça 15 polichinelos.
3. Cante um trecho da música que eu escolher.
4. Fique 30 segundos parado(a) como estátua na pose que eu escolher.
5. Mande uma selfie com a cara mais feia que conseguir. [foto]
6. Conte um mico que você pagou esta semana.
7. Faça 10 agachamentos.
8. Me chame pelo apelido mais fofo pelas próximas 3 rodadas.
9. Dance 20 segundos sem música.
10. Imite a minha risada.

### Criativo (10)

1. Desenhe meu retrato em 30 segundos com a mão não dominante.
2. Faça 2 versos rimando com o meu nome.
3. Conte uma história de 30 segundos com a palavra que eu escolher.
4. Imite o personagem que eu escolher até a próxima rodada.
5. Crie um slogan para mim.
6. Faça um comercial de 20 segundos de você mesmo(a).
7. Faça mímica de uma música até eu acertar.
8. Invente um apelido novo para mim e explique.
9. Desenhe como você está se sentindo agora.
10. Narre o que está acontecendo no seu quarto como um jogo de futebol.

### Picante (10)

1. Mande um beijo provocante para a câmera.
2. Diga 3 coisas que você acha sexy em mim.
3. Tire uma peça de roupa (acessório conta).
4. Mande um áudio de 10 segundos com a sua voz mais sedutora. [áudio]
5. Faça uma pose sensual por 10 segundos.
6. Morda o lábio me olhando por 10 segundos.
7. Me conte um pensamento quente que você teve esta semana.
8. Sussurre o que faria se eu estivesse aí.
9. Mande uma foto provocante, no nível que você escolher. [foto]
10. Dance sensual por 15 segundos.

### Pesado (10)

1. Mande um nude. [foto]
2. Tire duas peças de roupa.
3. Fique sem a parte de cima até o fim da próxima rodada.
4. Mande um vídeo sensual de 10 segundos. [vídeo]
5. Conte uma fantasia sua em detalhes.
6. Faça o que eu mandar por 1 minuto, com direito a veto.
7. Mande um áudio ousado de 15 segundos. [áudio]
8. Me mostre pela câmera a posição que eu escolher.
9. Faça um striptease de 30 segundos.
10. Escolha um nude para me mandar depois da chamada. [foto]
