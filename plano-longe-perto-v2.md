# Plano — Longe & Perto v2

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`. Esta versão substitui as anteriores e já inclui todas as decisões tomadas até aqui.

São três fases, cada uma com o próprio commit:

1. **Cartas no banco:** verdades, desafios e prendas moram no Supabase, na tabela `cartas`. O `conteudo.js` deixa de existir.
2. **Cartas de vocês:** os dois adicionam verdades, desafios e prendas dentro da sala, na mesma tabela.
3. **Placar de jogo:** pontos por nível, pulos grátis configuráveis, prenda obrigatória quando os pulos acabam (com nível conforme a carta pulada), recuperação de pulos ao cumprir prenda, botão de liberar da prenda, meta de pontos e prenda final.

---

## Status atual (conferir antes de começar)

- O Ricardo **já rodou** no Supabase o `supabase/002_cartas.sql` (tabela `cartas`, RLS, trigger de limite, Realtime) e o `supabase/003_seed_cartas.sql`.
- As cartas padrão estão no banco: Leve 40/70/10, Criativo 26/50/10, Picante 35/45/10 e Pesado 30/40/10 (verdades/desafios/prendas).
- Também foram aplicados **direto no banco** três ajustes que **ainda precisam ir para o arquivo `003_seed_cartas.sql`** (primeira tarefa da Fase 1).
- Parte do código das Fases 1 e 2 pode já existir no repositório. Antes de escrever, leia o código atual e aplique **só o que falta** para cumprir cada fase. Não refaça o que já está pronto e funcionando.

---

## Contexto do projeto

- Site estático publicado no GitHub Pages a partir da branch `main`, raiz do repositório. Não há build, bundler nem framework.
- Os arquivos principais são `index.html`, `style.css`, `app.js`, `config.js` e a pasta `supabase/`.
- O Supabase é carregado pelo CDN (`@supabase/supabase-js@2.45.4`, build UMD) e acessado com a chave anon que está em `config.js`.
- Cada sala é uma linha em `public.salas`. O jogo inteiro fica em `estado` (jsonb).
- Toda ação grava o `estado` inteiro com `gravar()`. Os dois aparelhos recebem o `UPDATE` pelo Realtime e redesenham com `aplicar()`.
- A roleta sincroniza pelo `giro.id`, e a carta viaja junto com o texto dentro do `estado`.
- As cartas ficam em `public.cartas`:
  - `sala null` = carta padrão; `sala` preenchida = carta de vocês.
  - Colunas: `tipo` (verdade, desafio ou prenda), `nivel` (leve, criativo, picante ou pesado), `texto`, `midia` (foto, video, audio ou null), `autor`, `ativa` e `criada_em`.
  - RLS: qualquer um lê; usuário só cria e apaga cartas de sala; as padrão só mudam pelo SQL Editor.

## Regras para o Claude Code

- **Mudança mínima.** Não reescrever o que já funciona (roleta, entrar/criar sala, vez, sincronização). Acrescentar código, não substituir.
- **Não alterar o `config.js`.**
- **Não rodar SQL.** O Claude Code não acessa o Supabase. Se precisar de SQL novo, criar um arquivo novo e idempotente em `supabase/` e avisar o Ricardo. Para este plano, **não deve ser necessário SQL novo**: tudo da Fase 3 vive no `estado` da sala.
- **Texto do banco ou de usuário só entra na tela via `textContent`.** Nunca usar `innerHTML` com esse conteúdo.
- **Compatibilidade com salas antigas.** Todo campo novo no `estado` precisa de valor padrão quando não existir.
- **Sem dependências novas.**
- **Mídia não passa pelo app.** Fotos, vídeos, áudios e nudes vão pelo WhatsApp. O app só mostra o texto e, quando a carta tem `midia`, a linha "Mande pelo WhatsApp em visualização única". Não criar upload.
- **Branch `v2`**, com um commit por fase. O merge na `main` só acontece depois do checklist de testes.

---

## Fase 1 — Cartas no banco

### 1.1 Sincronizar o seed com o banco

Atualizar o `supabase/003_seed_cartas.sql` com os ajustes que já foram aplicados no banco. Isso evita duplicar cartas se o seed rodar de novo.

| Tipo / nível | Texto antigo | Texto novo | `midia` |
|---|---|---|---|
| desafio / picante | Tire uma foto sensual (você decide o nível) e mande em visualização única. | Tire uma foto sensual (você decide o nível) e me mande. | foto |
| desafio / pesado | Mande uma foto ousada (o limite é seu), em visualização única. | Mande uma foto ousada (o limite é seu). | foto |
| desafio / leve | Recrie a nossa primeira foto juntos, só que sozinho(a). | (sem mudança) | `null` (era `foto`) |

### 1.2 App

1. **Carregar as cartas ao abrir a sala.** Buscar `cartas` com `.or('sala.is.null,sala.eq.' + codigo)` e `ativa = true`, e guardar no array `cartas`. São cerca de 460 linhas, dentro do limite padrão de 1.000 por consulta.
2. **Sorteio.** `sortear()` usa o array `cartas`, filtrando por `tipo` e pelos níveis ativos. A chave em `usados` é o `id` da carta.
3. **Sorteio de prenda.** Criar `sortearPrenda(nivel)`, que busca `tipo = 'prenda'` no nível pedido e, se não houver, desce um nível até encontrar.
4. **Carta no `estado`.** Guarda `id`, `tipo`, `nivel`, `texto`, `midia` e `autor`, para o outro aparelho mostrar a carta mesmo sem ter a lista carregada.
5. **Aviso de mídia.** Quando `midia` existir, mostrar abaixo do texto: "Mande pelo WhatsApp em visualização única."
6. **Falha ao carregar.** Mostrar "Não consegui carregar as cartas. Recarregue a página." e desativar o botão de girar.
7. **Tirar o conteúdo do código.** Remover `conteudo.js` e a tag `<script>` dele. O `LEVEL_NAMES` vai para dentro do `app.js`.
8. **Salas antigas.** Chaves antigas em `usados` (texto no lugar de uuid) são simplesmente ignoradas.

### Critérios de aceite

- A roleta sorteia cartas vindas do banco nos dois aparelhos.
- Carta com `midia` mostra o aviso de visualização única.
- Sem internet ao abrir a sala, aparece a mensagem de erro e o botão de girar fica desativado.

---

## Fase 2 — Cartas de vocês

1. **Tela de adicionar.** Um botão "Adicionar carta" abaixo dos chips de nível abre um `<dialog>` com:
   - Tipo: Verdade, Desafio ou Prenda.
   - Nível: select com os 4 níveis.
   - Texto: textarea com `maxlength=280` e contador.
   - Checkbox "Pede foto, vídeo ou áudio", que mostra um select para escolher qual e grava em `midia`.
   - Botões "Salvar carta" e "Cancelar".
2. **Salvar.** Faz `insert` em `cartas` com `sala = codigo` e `autor = nome` do jogador. Validação no cliente: no mínimo 3 caracteres depois do trim.
3. **Realtime.** No mesmo canal da sala, acrescentar `postgres_changes` para `INSERT` e `DELETE` em `cartas` com `filter: sala=eq.CODIGO`. Os eventos atualizam o array `cartas`.
4. **Lista "Cartas de vocês (N)".** Fica recolhível (`<details>`) abaixo do placar. Cada item mostra tipo, nível, autor e texto, com o botão "Apagar" e uma confirmação. Qualquer um dos dois pode apagar. As cartas padrão não aparecem nessa lista.
5. **Carta sorteada de vocês.** A linha de nível passa a dizer "Nível X, carta de {autor}, para {nome}".
6. **Erros** no `#erroJogo`: falha de rede e limite de 300 cartas por sala (reconhecer a mensagem do trigger).

### Critérios de aceite

- Carta criada no aparelho A aparece na lista do B em até 2 segundos.
- Carta de vocês pode ser sorteada, e as duas telas mostram o autor.
- Carta apagada some da lista e do sorteio nos dois.
- Texto com `<script>` aparece como texto.

---

## Fase 3 — Placar de jogo

### 3.1 Estado

Campos novos no `estado`:

```js
placar: [
  { pontos: 0, verdades: 0, desafios: 0, prendas: 0, liberadas: 0, livresV: 3, livresD: 3 },
  { pontos: 0, verdades: 0, desafios: 0, prendas: 0, liberadas: 0, livresV: 3, livresD: 3 }
],
meta: 20,        // 10, 20 ou 30
pulosMax: 3,     // 0, 1, 2, 3, 5 ou 10
vencedor: null,  // 0, 1 ou null
aviso: null      // { id, texto } — mensagem curta mostrada nos dois aparelhos
```

A carta atual ganha dois campos quando for prenda:
- `motivo`: `'pulo'` ou `'final'`.
- `origem`: `'verdade'` ou `'desafio'`, só quando `motivo = 'pulo'`.

**Salas antigas:**
- Sem `placar`: criar a partir de `estado.pontos`, com o resto zerado.
- Sem `pulosMax`: usar 3. Sem `meta`: usar 20.
- `livresV` e `livresD` ausentes: usar `pulosMax`.
- Se existirem `pulosV`/`pulosD` de uma versão intermediária: converter para `livres = max(0, pulosMax - pulos)`.

### 3.2 Pontuação

| Carta cumprida | Leve | Criativo | Picante | Pesado |
|---|---|---|---|---|
| Verdade | 1 | 1 | 2 | 3 |
| Desafio | 2 | 2 | 3 | 4 |
| Prenda | 0 | 0 | 0 | 0 |

### 3.3 Regras

1. **Cumprir verdade ou desafio.** Soma os pontos da tabela e o contador do tipo (`verdades` ou `desafios`), e passa a vez.

2. **Pular verdade ou desafio.** Cada pessoa tem `pulosMax` pulos grátis de verdade e `pulosMax` de desafio por partida, guardados em `livresV` e `livresD`.
   - **Com pulos livres** (contador do tipo maior que 0): tira 1 do contador, descarta a carta, não dá ponto e passa a vez.
   - **Com o contador em 0:** troca a carta por uma **prenda obrigatória** para a mesma pessoa, na mesma vez, com `motivo = 'pulo'` e `origem` igual ao tipo pulado. A vez não passa.

3. **Nível da prenda por pulo.**
   - **Desafio pulado:** um nível acima do desafio (leve → criativo → picante → pesado; pesado continua pesado).
   - **Verdade pulada:** o mesmo nível da verdade.
   - **Teto:** nunca acima do nível mais alto entre os ativos.
   - **Sem prenda no nível calculado:** desce um nível até encontrar (`sortearPrenda`).

4. **Carta de prenda.**
   - Título: "Prenda por pular a verdade", "Prenda por pular o desafio" ou "Prenda final".
   - Quem está pagando vê só o botão **Cumpri**, sem Pular.
   - O adversário vê só o botão **Liberar da prenda**.

5. **Cumprir prenda.** Vale 0 ponto, soma `prendas` e passa a vez. Quando `motivo = 'pulo'`, devolve pulos ao contador da `origem`:

   | Nível da prenda | Pulos devolvidos |
   |---|---|
   | Leve | 1 |
   | Criativo | 1 |
   | Picante | 2 |
   | Pesado | 3 |

   - O contador nunca passa de `pulosMax`. Com `pulosMax = 0`, nada é devolvido.
   - Aviso nos dois aparelhos: "{nome} recuperou N pulo(s) de verdade" (ou "de desafio"). Se nada foi devolvido, não mostra aviso.

6. **Liberar da prenda.** Visível só para o adversário, em qualquer prenda (por pulo ou final).
   - Descarta a prenda, sem ponto, sem devolver pulos, e soma `liberadas` no placar de quem foi liberado.
   - Na prenda por pulo, a vez passa. Na prenda final, leva ao estado de "Nova partida".
   - Aviso nos dois aparelhos: "{adversário} liberou {nome} da prenda."

7. **Meta e fim de partida.** Quando alguém atinge `meta` pontos, grava `vencedor`.
   - A tela mostra "{nome} venceu!".
   - Sorteia uma **prenda final** para quem perdeu, com `motivo = 'final'`, do nível mais alto entre os ativos. Ela não devolve pulos.
   - Depois de cumprida ou liberada, aparece o botão **Nova partida**.
   - Enquanto houver `vencedor`, a roleta fica travada.

8. **Nova partida.** Zera `placar` (com `livresV` e `livresD` em `pulosMax`), `vencedor`, `carta` e `usados`. Mantém `meta`, `pulosMax`, os níveis e as cartas de vocês. A vez começa com quem perdeu.

9. **Configurações da partida.** Dois selects, lado a lado, acima da roleta:
   - **Meta:** 10, 20 ou 30 pontos.
   - **Pulos por tipo:** 0, 1, 2, 3, 5 ou 10. Com 0, todo pulo gera prenda.
   - Só podem ser alterados com o placar zerado: antes da primeira jogada ou logo depois de "Nova partida". Fora disso, ficam desativados nos dois aparelhos.

10. **Avisos.** `estado.aviso` guarda `{ id, texto }`. Cada aparelho mostra o texto por uns 4 segundos quando o `id` muda, perto da carta, usando `textContent`.

### 3.4 Tela

**Botão Pular** mostra os pulos livres do tipo da carta: "Pular (2 grátis)". Com o contador em 0, vira "Pular (paga prenda)".

**Placar** vira uma tabela de jogo, com uma coluna por jogador e a coluna de quem é a vez destacada:

| | Ricardo | Caroline |
|---|---|---|
| Pontos | 12 | 9 |
| Verdades | 3 | 4 |
| Desafios | 3 | 2 |
| Prendas | 1 | 0 |
| Liberadas | 0 | 1 |
| Pulos grátis de verdade | 2/3 | 3/3 |
| Pulos grátis de desafio | 0/3 | 1/3 |

Acima da tabela: "Meta: 20 pontos".

### Critérios de aceite

- Os pontos somam conforme a tabela, nos dois aparelhos.
- Os pulos grátis descem até 0, e o próximo pulo gera prenda para a mesma pessoa.
- O nível da prenda segue a regra (desafio sobe um nível, verdade mantém, respeitando o teto).
- Cumprir prenda devolve os pulos certos, sem passar de `pulosMax`.
- Só o adversário vê "Liberar da prenda", e liberar não devolve pulos.
- Bater a meta mostra o vencedor e a prenda final, e depois "Nova partida".
- As configurações só mudam com o placar zerado.
- Sala antiga abre com o placar criado a partir dos pontos que já tinha.

---

## Ordem de execução

1. Criar a branch `v2` (ou continuar nela, se já existir).
2. **Fase 1:** conferir o que já existe, atualizar o seed (1.1) e completar o app (1.2). Commit: `cartas no banco`.
3. **Fase 2:** conferir o que já existe e completar. Commit: `cartas de vocês por sala`.
4. **Fase 3:** commit `placar, pulos, prendas e meta`.
5. Rodar o checklist abaixo e me avisar do resultado. **Não fazer merge na `main`.**

## Checklist de testes

Usar dois navegadores: uma janela normal e uma anônima, ou o computador e o celular.

**Base**
- [ ] Criar sala em A, entrar em B pelo link, girar: mesma carta e mesma roleta nos dois.
- [ ] Carta com `midia` mostra o aviso de visualização única.
- [ ] Recarregar e entrar com o mesmo nome: placar e cartas continuam.
- [ ] Sala criada antes da v2: abre e joga normalmente.
- [ ] Console do navegador sem erros.

**Cartas de vocês**
- [ ] Adicionar em B: aparece em A e pode ser sorteada, com o autor.
- [ ] Apagar em A: some nos dois. Cartas padrão não aparecem para apagar.
- [ ] Texto com `<script>` exibido como texto.

**Pontos e pulos**
- [ ] Cumprir verdade e desafio de níveis diferentes: pontos certos.
- [ ] Com "Pulos por tipo" em 3: 3 pulos de desafio grátis; o 4º gera prenda.
- [ ] 4º pulo de desafio Leve com todos os níveis ativos: prenda Criativa.
- [ ] 4º pulo de desafio Pesado: prenda Pesada.
- [ ] 4º pulo de verdade Picante: prenda Picante.
- [ ] Só Leve e Criativo ativos, pulo de desafio Criativo sem pulos livres: prenda Criativa.
- [ ] Cumprir prenda Picante vinda de desafio com 0/3: volta para 2/3, com aviso.
- [ ] Cumprir prenda Pesada: volta no máximo até 3/3.
- [ ] Com "Pulos por tipo" em 0: todo pulo gera prenda, e cumprir não devolve nada.
- [ ] O botão Pular mostra os pulos grátis restantes e depois "paga prenda".

**Prendas e fim de partida**
- [ ] Com prenda na tela, só o adversário vê "Liberar da prenda"; quem paga vê só "Cumpri".
- [ ] Liberar: a vez passa, sem ponto, sem devolver pulos, "Liberadas" +1, aviso nos dois.
- [ ] Bater a meta: vencedor e prenda final nos dois; a roleta trava.
- [ ] Liberar ou cumprir a prenda final leva a "Nova partida".
- [ ] "Nova partida": placar zerado, pulos em `pulosMax`, meta e pulos mantidos, a vez é de quem perdeu.
- [ ] Meta e "Pulos por tipo" só editáveis com o placar zerado.

## Fora do escopo desta versão

- Contas e login.
- Guardar cartas de vocês entre salas diferentes. Para manter, reusem o mesmo código de sala.
- Upload de fotos e vídeos. A mídia fica no WhatsApp.
- Tela para editar cartas padrão. Mudanças nelas são feitas no Table Editor do Supabase (dá para desligar uma carta com `ativa = false`).

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v2.md` na raiz do repositório. Ele substitui qualquer versão anterior. Comece pela seção "Status atual": leia o código que já existe e aplique só o que falta em cada fase, na ordem da seção "Ordem de execução", numa branch `v2`, com um commit por fase. Siga as "Regras para o Claude Code" e não rode SQL. No fim, rode o checklist de testes, me conte o que passou e o que não passou, e não faça merge na `main`.
