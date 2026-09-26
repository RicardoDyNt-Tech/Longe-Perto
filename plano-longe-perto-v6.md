# Plano — Longe & Perto v6 (romântico e fofo)

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`, **depois que a v5 estiver testada e na `main`**. O foco é deixar o app mais carinhoso, dentro e fora das partidas. São doze novidades, em sete fases:

| Fase | O que entra |
|---|---|
| 1 | Nível **Romântico** e **prendas fofas** |
| 2 | **"Vocês estão juntos agora"**, **"Pensei em você"** e **Mãos juntas** |
| 3 | **Mapa da saudade** e **linha do tempo do casal** |
| 4 | **Pote de motivos** e cartas **"Abra quando…"** |
| 5 | **Pergunta do dia a dois** |
| 6 | **Encerramento da noite** e **Boa noite** |
| 7 | **Nossa playlist** |

---

## Pré-requisitos

- A v5 (`plano-longe-perto-v5.md`) está na `main` e o checklist dela passou. A v6 usa a Casa do casal, a presença, o álbum de momentos, a sala fixa e a trilha da rodada (v3).
- Tudo que fica fora da partida (Fases 2 a 5 e 7) aparece **só em sala fixa**, como na v5. A Fase 1 e a Fase 6 funcionam em qualquer sala. O "Encerramento da noite" só salva no álbum quando a sala é fixa.
- Criar a branch `v6` a partir da `main`.
- Continuam valendo todas as **Regras para o Claude Code** da v2:
  - Mudança mínima.
  - Não alterar `config.js`.
  - Não rodar SQL.
  - Texto do banco e de usuário só via `textContent`.
  - Valores padrão para salas antigas.
  - Sem dependências novas.
  - Mídia só pelo WhatsApp.
- Continua valendo o **princípio da v5**: nada dá prêmio só por abrir o app todo dia.

---

## Fase 0 — SQL (já pronto)

Os dois arquivos são fornecidos prontos. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda os dois, nessa ordem.

- **`017_v6.sql`:**
  - Amplia `cartas`: nível `romantico` e tipos `pergunta_dia` e `boa_noite`.
  - Libera o nível `romantico` no desafio surpresa dos `envelopes`.
  - Cria as tabelas `carinhos`, `marcos`, `motivos`, `abra_quando`, `respostas_dia` e `musicas_nossas`, com RLS no mesmo modelo da v5 e Realtime ligado.
- **`018_seed_v6.sql`:** 135 cartas novas.

| Tipo | Nível | Quantidade |
|---|---|---|
| verdade | romantico | 30 |
| desafio | romantico | 30 |
| prenda | romantico | 15 |
| pergunta_dia | leve | 40 |
| boa_noite | romantico | 20 |

**Carregamento:** as cartas passam de mil com a v6. Se o app ainda carrega `cartas` numa consulta só, trocar por paginação com `.range()` em blocos de 1.000.

---

## Fase 1 — Nível Romântico e prendas fofas

### Nível Romântico

1. **Chip novo** "💗 Romântico", o primeiro da lista, antes do Leve. Liga e desliga como os outros.
2. **Pontuação** igual à do Leve: verdade 1, desafio 2, prenda 0.
3. **Prendas por pulo:**
   - Pulou verdade ou desafio romântico sem pulos livres: a prenda é **romântica**. Não sobe de nível.
   - A regra "desafio sobe um nível" da v2 continua valendo para os outros níveis. A ordem de subida continua `leve → criativo → picante → pesado`; o romântico fica fora dela.
4. **Eventos especiais (v4):** não existem cartas de efeito, duelo, sintonia ou missão no nível romântico. O sorteio de evento ignora esse nível. Se só o romântico estiver ligado, nunca sai evento.
5. **Trilha da rodada (v3):** cartas românticas sorteiam músicas do nível `leve`.
6. **Guias de posições e de poses:** o romântico conta como Leve. O guia de posições não aparece; o de poses mostra só as Leves.
7. **Rótulo** `LEVEL_NAMES.romantico = "Romântico"`.

### Prendas fofas

8. **Configuração da partida** "Prendas fofas", um checkbox desligado por padrão. Segue a mesma regra da meta: só pode mudar com o placar zerado.
9. **Com o checkbox ligado,** toda prenda da partida é sorteada entre as prendas `romantico`, qualquer que seja o nível que a geraria: pulo, duelo, "Quebrou!" do efeito e prenda final. A devolução de pulos ao cumprir a prenda segue a tabela da v2, usando o nível que a prenda **teria**.

**Aceite:**
- Com só o Romântico ligado, as cartas saem desse nível e nunca sai evento.
- Pular carta romântica sem pulos livres dá prenda romântica.
- Com "Prendas fofas" ligado, a prenda de um desafio Pesado pulado é fofa e devolve os pulos de uma prenda Pesada.

---

## Fase 2 — Juntos agora, "Pensei em você" e Mãos juntas

### "Vocês estão juntos agora 💞"

1. Quando a presença (v5) passa de "só eu" para "os dois", tocar nos dois aparelhos uma animação curta: dois corações vindo de lados opostos que se encontram no meio (CSS, cerca de 1,5 s). Com a vibração `[80, 60, 80]` e o som da v4, se não estiver silenciado.
2. **No máximo uma vez a cada 10 minutos**, para não repetir quando alguém entra e sai.

### "Pensei em você"

3. Na Casa, uma fileira de quatro botões grandes: 💭 **Pensei em você**, 😘 **Beijo**, 🤗 **Abraço** e 🥺 **Saudade**. Tocar grava em `carinhos` com `de = eu` e o `tipo`.
4. **Quem recebe, com o app aberto:** o emoji aparece grande, flutuando e sumindo (cerca de 2 s), com o texto "{nome} pensou em você" (ou "mandou um beijo", "mandou um abraço", "está com saudade"). Vibra `[100, 50, 100]`.
5. **Quem recebe, ao abrir o app depois:** um resumo na Casa com os carinhos que ainda não viu, como "Enquanto você estava fora: 💭 × 3, 😘 × 1". O "visto" fica em `localStorage`, com o último `criada_em` exibido.
6. **Contador do dia:** "Hoje: 💭 5 · 😘 2" de cada um.
7. **Pausa entre toques:** 2 segundos entre um carinho e outro do mesmo aparelho, para evitar toques repetidos sem querer.

### Mãos juntas

8. Na Casa, um coração grande com o texto "Segure junto". **Sem banco**: usar **broadcast** do Realtime no canal da sala.
   - `pointerdown` envia `{ evento: 'mao', jogador: eu, segurando: true }`.
   - `pointerup`, `pointercancel` ou sair da tela envia `segurando: false`.
9. **Estados:**
   - Só eu segurando: o coração brilha fraco, com "Esperando {nome}…".
   - Os dois segurando: o coração pulsa no ritmo de um batimento (cerca de 70 por minuto), nas duas telas, com uma vibração curta a cada batida no Android, e um cronômetro "juntos há 0:12".
10. **Ao soltar:** mostrar "Vocês ficaram 0:42 de mãos dadas". Somar em `estado.maosTotal` (em segundos). Só quem soltou primeiro grava, para não somar duas vezes.
11. **Na Casa:** "Tempo total de mãos dadas: 1 h 12 min".

**Aceite:**
- Abrir a sala nos dois aparelhos mostra a animação uma vez.
- "Pensei em você" aparece no outro aparelho em até 2 s.
- Quem estava fora vê o resumo ao voltar.
- O coração só pulsa com os dois segurando, e o tempo soma no total.

---

## Fase 3 — Mapa da saudade e linha do tempo

### Mapa da saudade

1. **Configuração** "Nossas cidades", na Casa: um campo de cidade para cada um.
   - Ao buscar, usar a API pública do **Nominatim** (OpenStreetMap): `https://nominatim.openstreetmap.org/search?format=json&limit=5&q={cidade}`.
   - Mostrar as opções e gravar a escolhida em `estado.cidades[i] = { nome, lat, lng }`.
   - Buscar só ao tocar em "Buscar", nunca a cada tecla.
   - Mostrar o crédito "© OpenStreetMap".
   - Se a busca falhar, permitir digitar só o nome e, se quiser, a distância em km à mão (`estado.distanciaManual`).
2. **Distância:** calculada pela fórmula de Haversine, arredondada para km.
3. **Desenho sem mapa de verdade:** um SVG estilizado com dois pontos (os nomes das cidades embaixo), uma linha pontilhada animada entre eles e um coração no meio. Texto: "**X km de saudade**".
4. **Reencontro:** embaixo, a contagem da v3 ("Faltam 12 dias"). No dia do reencontro, os dois pontos se juntam na animação e o texto vira "Hoje é 0 km 💞".

### Linha do tempo do casal

5. **Aba "Nossa história"** na Casa: lista vertical de `marcos`, do mais antigo para o mais novo, com data, emoji, título e descrição.
6. **Adicionar marco:** título, data, descrição opcional (até 300 caracteres) e emoji, com sugestões: 💘 primeiro encontro, 💋 primeiro beijo, 💍 pedido, ✈️ viagem, 🎂 aniversário, 🏠 visita. Com editar e apagar, com confirmação.
7. **Marco principal:** o checkbox "Este é o início do namoro" marca `principal = true`. Só pode haver um por sala: ao marcar outro, desmarcar o anterior.
8. **No topo da Casa:** "Juntos há **X dias**" (e "X anos e Y meses", quando passar de um ano), contando a partir do marco principal.
9. **Datas especiais,** no fuso America/Bahia:
   - No **mesversário** (mesmo dia do mês do marco principal): cartão "Feliz mesversário! 🎉 X meses juntos".
   - No **aniversário de namoro:** "Feliz X anos de namoro! 💞".
   - No **aniversário de qualquer outro marco:** "Há 1 ano: {título}".
   - Esses cartões aparecem só no próprio dia.

**Aceite:**
- As duas cidades geram uma distância plausível.
- Sem internet para a busca, a distância manual funciona.
- O marco principal gera o "juntos há X dias".
- Mudar a data do marco para o mesmo dia do mês de hoje mostra o cartão de mesversário.

---

## Fase 4 — Pote de motivos e "Abra quando…"

### Pote de motivos

1. **Aba "Pote de motivos"** na Casa, com um desenho de pote (SVG) que enche conforme a quantidade de motivos que **o outro** escreveu para você.
2. **Escrever:** campo "Um motivo pelo qual eu te amo" (até 280 caracteres). Grava em `motivos` com `de = eu`. Quem escreveu vê a lista dos próprios motivos e pode apagar.
3. **Sortear:** "Tirar um motivo do pote" sorteia um motivo **escrito pelo outro**.
   - Tem prioridade um que nunca foi sorteado (`vezes = 0`); depois disso, o menos sorteado.
   - Soma `vezes`, grava `sorteado_em` e mostra o motivo num papel desdobrando, com "— {nome}".
4. **O outro fica sabendo:** o autor recebe o aviso "{nome} tirou um motivo seu do pote 🥰", sem mostrar qual.
5. **Contadores:** "No pote: 23 motivos · 5 ainda não lidos".

### Cartas "Abra quando…"

6. **Escrever:** "Nova carta Abra quando…", com a ocasião escolhida entre as sugestões ou digitada:
   - "você estiver triste"
   - "sentir saudade"
   - "não conseguir dormir"
   - "o dia for difícil"
   - "estiver feliz"
   - "precisar rir"
   - "brigarmos"
   - "faltar uma semana para o reencontro"

   O texto vai até 1.000 caracteres. Grava em `abra_quando` com `de = eu`.
7. **Quem recebe** vê as cartas fechadas, como envelopes com a ocasião escrita ("Abra quando… sentir saudade"), e **abre quando quiser, sozinho(a)**. Não precisa dos dois online, ao contrário dos envelopes da v5.
   - Antes de abrir, uma confirmação: "É mesmo a hora?".
   - Ao abrir, grava `aberto_em` e mostra a carta.
8. **Quem escreveu** vê as próprias cartas, com o status "fechada" ou "aberta em 12/10, 23:40", e pode editar ou apagar enquanto estiverem fechadas.
9. **Aviso para o autor:** "{nome} abriu a carta 'Abra quando… sentir saudade' 💌".
10. **Cartas abertas** continuam legíveis para os dois numa lista "Já abertas".

**Aceite:**
- O motivo sorteado é sempre do outro, priorizando os não lidos, e o autor recebe o aviso.
- A carta "Abra quando…" abre com só uma pessoa online e avisa o autor.
- O autor não consegue editar uma carta já aberta.

---

## Fase 5 — Pergunta do dia a dois

1. **Sorteio determinístico:** uma pergunta por dia, igual para os dois.
   - Semente = `codigo da sala + data de hoje (America/Bahia)`, com o mesmo hash do desafio do dia (v3).
   - Escolhe entre as cartas `tipo = 'pergunta_dia'`, evitando as 30 perguntas dos dias anteriores. Olhar em `respostas_dia` e, se estiver vazio, só sortear.
2. **Na Casa:** cartão "💬 Pergunta de hoje", com um campo de resposta (até 500 caracteres) e "Responder". Grava em `respostas_dia` com o texto da pergunta.
3. **Resposta escondida:** a resposta do outro fica oculta até **você** responder. Depois dos dois responderem, as duas aparecem lado a lado e ficam editáveis até o fim do dia.
4. **Avisos:**
   - Quem ainda não respondeu vê "{nome} já respondeu! Responda para ver 👀".
   - Quando os dois terminam, aviso nos dois: "As respostas de hoje estão abertas".
5. **Diário do casal:** aba "Diário" com os dias anteriores, do mais novo para o mais antigo: data, pergunta e as duas respostas (ou "sem resposta"). Com paginação de 30 em 30.
6. **Sem sequência e sem pontos:** é só para conversar.

**Aceite:**
- Os dois aparelhos mostram a mesma pergunta no mesmo dia.
- A resposta do outro só aparece depois de responder.
- O diário lista os dias anteriores.

---

## Fase 6 — Encerramento da noite e Boa noite

1. **Botão "🌙 Encerrar a noite"** na tela do jogo (menu da sala) e também na tela de vitória.
2. **Ao tocar:** abre para **os dois** (estado `estado.encerrando = { por: eu, frases: [null, null] }`) a tela "Como foi a nossa noite?", com um campo de uma frase (até 200 caracteres) e "Pular".
   - A frase do outro fica escondida até os dois enviarem ou pularem.
   - Depois, as duas aparecem juntas.
   - Em sala fixa, cada frase enviada vira um momento do álbum (v5): `carta_texto` = "Nossa noite em {data}", `carta_tipo` = `encerramento`, `frase` = a frase e `autor` = quem escreveu.
3. **Tela de Boa noite:**
   - Fundo escuro com estrelas animadas (CSS).
   - Uma frase sorteada de `tipo = 'boa_noite'`, a mesma nos dois aparelhos: o sorteio é gravado em `estado.encerrando.frase`.
   - A contagem "Faltam X dias para o reencontro".
   - O tempo de mãos dadas da noite, se tiver.
   - Botão "Boa noite 💤", que fecha a tela e limpa `estado.encerrando`.
4. **Partida em andamento:** encerrar a noite **não** zera o placar. A partida continua na próxima vez que abrirem.

**Aceite:**
- As frases aparecem juntas nos dois depois de os dois enviarem ou pularem.
- Na sala fixa, elas vão para o álbum.
- A frase de boa noite é a mesma nos dois aparelhos.

---

## Fase 7 — Nossa playlist

1. **Marcar música:** no cartão "Trilha da rodada" (v3), o botão "🤍 Nossa". Marcar grava em `musicas_nossas` e o botão vira "❤️ Nossa". Tocar de novo desmarca.
2. **Aba "Nossa playlist"** na Casa: lista das músicas marcadas, com título, artista, quem marcou, "Abrir no Spotify" e "Tocar aqui" (o embed sob demanda, igual à v3). Ordem: das mais recentes para as mais antigas.
3. **Configuração da partida** "Trilha: só as nossas", desligada por padrão. Com ela ligada, o sorteio da trilha usa só as músicas de `musicas_nossas`, ignorando o nível. Com menos de 5 músicas marcadas, ignorar a opção e mostrar o aviso "Marquem pelo menos 5 músicas".
4. **Botão "Tocar a nossa playlist no Spotify":** fica fora do escopo, porque criaria uma playlist na conta do Spotify e exigiria login. Na tela, mostrar a dica: "Abra cada música no Spotify e adicione a uma playlist de vocês."

**Aceite:**
- Marcar uma música em A aparece na playlist de B.
- "Só as nossas" sorteia só as marcadas, com pelo menos 5.

---

## Estado — resumo dos campos novos

```js
prendasFofas: false,
playlistSoNossas: false,
maosTotal: 0,               // segundos
cidades: [null, null],      // [{ nome, lat, lng }]
distanciaManual: null,      // km, se a busca falhar
encerrando: null            // { por, frases: [null, null], frase }
```

**Salas antigas:** tudo ausente vale o padrão acima.

**"Nova partida":** mantém tudo isso, menos `encerrando`, que volta a `null`.

---

## Ordem de execução

1. Branch `v6` a partir da `main`.
2. **Fase 0:** colocar `017_v6.sql` e `018_seed_v6.sql` em `supabase/`. Commit: `sql v6`. **Parar e avisar o Ricardo para rodar os dois, nessa ordem.**
3. **Fase 1**, commit `nível romântico e prendas fofas`.
4. **Fase 2**, commit `juntos agora, pensei em você e mãos juntas`.
5. **Fase 3**, commit `mapa da saudade e linha do tempo`.
6. **Fase 4**, commit `pote de motivos e abra quando`.
7. **Fase 5**, commit `pergunta do dia`.
8. **Fase 6**, commit `encerramento da noite e boa noite`.
9. **Fase 7**, commit `nossa playlist`.
10. Rodar o checklist, reportar o resultado e **não fazer merge na `main`**.

## Checklist de testes

Usar dois aparelhos, na mesma sala fixa.

- [ ] Tudo dos checklists da v2 à v5 continua passando.
- [ ] **Romântico:** chip próprio; só ele ligado não gera evento; prenda romântica ao pular; música do nível leve.
- [ ] **Prendas fofas:** toda prenda sai romântica e devolve os pulos pelo nível original.
- [ ] **Juntos agora:** a animação toca uma vez ao se encontrarem e não repete em 10 minutos.
- [ ] **Pensei em você:** chega em até 2 s; o resumo aparece para quem estava fora; o contador do dia bate.
- [ ] **Mãos juntas:** o coração só pulsa com os dois segurando; o tempo soma uma vez só.
- [ ] **Mapa:** distância entre as cidades; distância manual sem internet; "0 km" no dia do reencontro.
- [ ] **Linha do tempo:** "juntos há X dias"; mesversário no dia certo; um principal por sala.
- [ ] **Pote:** sorteia só motivos do outro, primeiro os não lidos; o autor recebe o aviso.
- [ ] **Abra quando:** abre sozinho(a); avisa o autor; carta aberta não pode ser editada.
- [ ] **Pergunta do dia:** a mesma nos dois; a resposta do outro escondida até responder; o diário lista os dias.
- [ ] **Encerrar a noite:** frases juntas; vão para o álbum; a mesma frase de boa noite nos dois; o placar não zera.
- [ ] **Nossa playlist:** marcar sincroniza; "só as nossas" com pelo menos 5 músicas.
- [ ] Sala comum: a Casa continua mostrando o convite para sala fixa; Romântico e Encerrar a noite funcionam.
- [ ] Console do navegador sem erros.

## Fora do escopo

- Notificações push. Os carinhos, avisos e cartas só aparecem com o app aberto (o PWA da v3 não tem push).
- Criar playlist no Spotify, fotos no mapa ou na linha do tempo, e mapa com imagens de satélite.
- Mudar o nível Romântico de lugar na ordem de subida das prendas.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v6.md` na raiz do repositório. Pré-requisito: a v5 já está na `main`. Crie a branch `v6` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `017_v6.sql` e `018_seed_v6.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). No fim, rode o checklist, me conte o que passou e o que não passou, e não faça merge na `main`.
