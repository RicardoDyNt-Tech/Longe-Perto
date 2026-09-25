# Plano — Longe & Perto v5 (entre chamadas e progressão)

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`, **depois que a v4 estiver testada e na `main`**. O foco é manter o jogo vivo **fora da chamada** e construir uma história do casal ao longo do tempo:

1. **Casa do casal e presença:** tela inicial da sala fixa, com o aviso "{nome} está aqui agora".
2. **Envelopes:** mensagem fechada ou desafio surpresa que só abre na próxima chamada, com os dois presentes.
3. **Cápsula do tempo:** a mesma pergunta respondida agora e de novo numa data futura, para comparar.
4. **Apostas da semana:** previsões sobre o outro, conferidas no fim da semana.
5. **Missão de observação:** algo para procurar durante a semana e mostrar na próxima chamada.
6. **Álbum de momentos:** as cartas mais marcantes guardadas com uma frase.
7. **Baralho com memória:** favoritar, aposentar e "jogar de novo"; cartas já vistas aparecem menos.
8. **Conquistas do casal:** desbloqueios por variedade e cumplicidade, com uma categoria opcional de ousadia.

---

## Pré-requisitos

- A v4 (`plano-longe-perto-v4.md`) está na `main` e o checklist dela passou.
- Tudo da v5 **só aparece em sala fixa** (v3). Em sala comum, a Casa do casal mostra: "Crie uma sala fixa para guardar envelopes, álbum e conquistas".
- Criar a branch `v5` a partir da `main`.
- Continuam valendo todas as **Regras para o Claude Code** da v2:
  - Mudança mínima.
  - Não alterar `config.js`.
  - Não rodar SQL.
  - Texto do banco e de usuário só via `textContent`.
  - Valores padrão para salas antigas.
  - Sem dependências novas.
  - Mídia só pelo WhatsApp.

**Princípio da v5: sem recompensa por frequência.** Nada dá pontos ou prêmios só por abrir o app todo dia. As novidades valem pela surpresa e pela memória do casal. A única sequência de dias continua sendo a do desafio do dia (v3).

**Segredos.** Envelopes, palpites e respostas de cápsula ficam escondidos **na tela** até a hora certa. Tecnicamente, com a chave anon, os dados podem ser lidos pela rede. Para o casal isso basta, e o app não precisa fingir que é mais seguro que isso.

---

## Fase 0 — SQL (já pronto)

Os dois arquivos são fornecidos prontos pelo Ricardo. O Claude Code só coloca em `supabase/` e **não edita**:

- **`008_v5.sql`:**
  - Amplia o `tipo` de `cartas` com `aposta`, `observacao` e `capsula`.
  - Cria as tabelas `envelopes`, `capsulas`, `apostas`, `observacoes`, `momentos`, `cartas_marcadas`, `cartas_vistas` e `conquistas`.
  - Aplica RLS no mesmo modelo das outras tabelas: todo mundo lê; cria só em sala existente; altera e apaga liberados.
  - Liga o Realtime.
- **`009_seed_v5.sql`:** 69 cartas novas.

| Tipo | Leve | Criativo | Picante | Pesado | Total |
|---|---|---|---|---|---|
| aposta | 14 | 8 | 5 | 3 | 30 |
| observacao | 10 | 8 | 4 | 2 | 24 |
| capsula | 15 | – | – | – | 15 |

Nas apostas, o texto tem o marcador `{nome}`, que o app troca pelo nome da outra pessoa antes de exibir.

O Ricardo roda os dois antes da Fase 1.

**Detalhe técnico:** `conquistas` tem índice único em `(sala, codigo, coalesce(jogador, -1))`. Para registrar uma conquista, fazer `insert` e **ignorar o erro `23505`** (já existia). Não usar `upsert` com `onConflict`, porque o índice é por expressão.

---

## Fase 1 — Casa do casal e presença

1. **Casa do casal.** Ao entrar numa sala fixa, a primeira tela é a Casa do casal, com cartões:
   - **Jogar**, que leva à tela atual da roleta.
   - **Envelopes**, com o contador "2 esperando".
   - **Semana**: apostas e missão de observação.
   - **Cápsulas**, **Álbum**, **Conquistas**.
   - **Cofre** e **Desafio do dia**, que já existem na v3 e passam a morar aqui.
   - Uma barra de abas simples no topo permite voltar para a Casa a qualquer momento.
2. **Presença.** Usar o **Presence** do Supabase Realtime no canal da sala. Cada aparelho envia `{ jogador: eu, online_em }`.
   - No topo da Casa e do jogo: "💚 {nome} está aqui agora" ou "{nome} está fora".
   - A função `ambosPresentes()` é usada pelos envelopes (Fase 2).
3. **Vibração** (respeitando o botão de silenciar da v4) quando a outra pessoa entra na sala.

**Aceite:**
- Abrir a sala em A e B mostra "está aqui agora" nos dois.
- Fechar B muda o aviso em A em até ~30 segundos.
- A Casa aparece só em sala fixa.

---

## Fase 2 — Envelopes (mensagem e desafio surpresa)

1. **Escrever.** Na Casa, "Novo envelope" abre um `<dialog>` com:
   - Tipo: "💌 Mensagem" ou "🎲 Desafio surpresa".
   - Texto: até 500 caracteres.
   - Nível: só para desafio surpresa.
   - Salva em `envelopes` com `de = eu`.
2. **Lista.**
   - Quem escreveu vê os próprios envelopes fechados (com o texto, porque é dele) e pode apagar enquanto estiverem fechados.
   - Quem vai receber vê só "💌 1 envelope de {nome}" ou "🎲 1 desafio surpresa de {nome}", **sem o texto**.
3. **Abrir uma mensagem.**
   - O botão "Abrir juntos" só fica ativo quando `ambosPresentes()`.
   - Quem tocar abre para os dois: grava `aberto_em` e o texto aparece nos dois aparelhos com uma animação de envelope abrindo.
   - Sem os dois presentes, o botão mostra "Espere {nome} entrar para abrir".
4. **Desafio surpresa.** Não é aberto na lista. Ele entra no jogo como **primeira carta** da próxima vez de quem vai receber, numa partida em que os dois estejam presentes, **no lugar do giro**:
   - Título: "🎲 Desafio surpresa de {nome}".
   - Vale como desafio normal do nível escolhido (pontos, pulos e prendas da v2).
   - Grava `aberto_em` ao aparecer.
   - Se houver mais de um, sai um por vez, do mais antigo para o mais novo.
5. **Histórico.** Os envelopes abertos ficam numa lista "Já abertos", com a data.

**Aceite:**
- B não vê o texto do envelope de A antes da abertura.
- "Abrir juntos" só funciona com os dois online.
- O desafio surpresa aparece como primeira carta de B na próxima partida com os dois presentes.

---

## Fase 3 — Cápsula do tempo

1. **Criar.** "Nova cápsula" permite escolher uma pergunta do seed (`tipo = 'capsula'`, uma sorteada, com botão "Outra pergunta") ou escrever uma própria. Depois, escolher a data de abertura, entre 7 dias e 2 anos (atalhos: 1 mês, 3 meses, 6 meses, 1 ano).
2. **Responder agora.** Cada um responde no próprio aparelho, e a resposta vai para `respostas[eu]`.
   - As respostas ficam escondidas dos dois, inclusive de quem escreveu: aparece só "Respondida ✓".
   - Uma cápsula só fica "selada" quando os dois responderem. Antes disso, aparece "Esperando {nome} responder".
3. **Na data.** A cápsula aparece na Casa como "⏳ Cápsula pronta para abrir".
   - Primeiro, cada um responde **de novo** a mesma pergunta (`respostas_depois[eu]`), sem ver nada.
   - Com as duas respostas novas, o app revela uma comparação em quatro quadros: você antes e agora, a outra pessoa antes e agora.
4. **Lista.** Cápsulas seladas (com a contagem "abre em 43 dias") e abertas.

**Aceite:**
- Nenhuma resposta aparece antes da data e das respostas novas dos dois.
- Uma cápsula com data de hoje (usar 7 dias no teste, ou editar `abre_em` no banco) segue o fluxo completo.

---

## Fase 4 — A semana: apostas e missão de observação

**A semana** vai de segunda a domingo, no fuso `America/Bahia`. `semana` é a data da segunda-feira.

### Apostas

1. **Sorteio.** Toda semana, cada um recebe 2 perguntas de aposta sobre a outra pessoa.
   - O sorteio é determinístico: hash de `codigo + semana + jogador`, como o desafio do dia da v3.
   - Os níveis vêm do ajuste da sala "Nível da semana" (Leve por padrão, com as mesmas opções do desafio do dia).
   - O marcador `{nome}` é trocado pelo nome do outro.
2. **Palpite.** Até quarta-feira, cada um escreve o palpite, que vai para `apostas`.
   - O palpite fica escondido do outro até o fim da semana.
   - Depois de quarta, não dá mais para apostar naquela semana.
3. **Conferir.** De sábado em diante, o **alvo** vê as perguntas sobre si, escreve a resposta verdadeira e então vê o palpite e julga: Acertou, Quase ou Errou.
4. **Placar da semana.** "Apostas certeiras" de cada um na semana e no total. Não vale ponto na partida.
5. **Semanas passadas** ficam numa lista, com perguntas, palpites, respostas e resultados.

### Missão de observação

6. Toda semana, cada um recebe uma missão (`tipo = 'observacao'`), sorteada do mesmo jeito das apostas.
   - A missão aparece na Casa: "👀 Sua missão da semana".
   - O outro vê só "{nome} tem uma missão da semana". A missão do outro é revelada quando ele mostrar.
7. **Mostrar.** Na chamada, o dono toca em "Mostrei!" e o outro recebe "{nome} mostrou: '{missão}'. Confirmar?".
   - Confirmar grava em `observacoes`.
   - Uma por pessoa por semana.
   - A mídia, se houver, vai pelo WhatsApp.

**Aceite:**
- Os dois aparelhos sorteiam as mesmas perguntas e missões para a mesma semana.
- Os palpites ficam escondidos até sábado.
- A missão confirmada aparece nas semanas passadas.

---

## Fase 5 — Álbum de momentos

1. **Histórico da partida.** O `estado` passa a guardar `historico`: as últimas 50 cartas resolvidas da partida atual, com `{ texto, tipo, nivel, jogador, resultado }`. É zerado em "Nova partida".
2. **Guardar momento.**
   - Na tela de vitória e numa aba "Rodadas desta partida", cada carta do histórico tem o botão "📸 Guardar no álbum".
   - Abre um campo "Uma frase sobre esse momento" (opcional, até 200 caracteres).
   - Salva em `momentos`.
3. **Álbum.** Na Casa, lista em ordem de data, com a carta, a frase, quem guardou e o dia. Estrela de favorito e botão de apagar com confirmação. Filtro: Todos / Favoritos.
4. **Só texto.** Nada de fotos no álbum; as fotos continuam no WhatsApp.

**Aceite:**
- Guardar um momento na tela de vitória aparece no álbum dos dois.
- Os favoritos filtram corretamente.

---

## Fase 6 — Baralho com memória

1. **Marcas na carta.** Em toda carta mostrada, uma linha discreta de ícones:
   - ⭐ **Favoritar**
   - 🔁 **Jogar de novo**
   - 🚫 **Aposentar**, com confirmação: "Essa carta não vai mais aparecer nesta sala."

   Salvam em `cartas_marcadas`. Tocar de novo remove a marca.
2. **Visualizações.** Cada carta sorteada faz um upsert em `cartas_vistas`: `vezes + 1` e `ultima_vez = now()`.
   - Carregar as visualizações da sala ao abrir, junto com as marcas.
   - Leitura, soma e gravação no cliente estão bem para dois jogadores.
3. **Sorteio com peso** (verdade, desafio, prenda e todos os tipos de evento):
   - Peso base = `1 / (1 + vezes)`, com mínimo de 0,2.
   - Favorita: peso × 3.
   - Aposentada: nunca sai.
   - Jogar de novo: tem prioridade. Na próxima vez que o sorteio cair no mesmo tipo e nos níveis ativos, ela sai, e a marca `repetir` é removida.
   - O `usados` da partida (v2) continua valendo por cima disso.
4. **Aba "Baralho"** na Casa, com as listas Favoritas, Aposentadas (com "Restaurar") e "Mais vistas", mostrando as 20 mais sorteadas.

**Aceite:**
- Aposentar faz a carta sumir do sorteio.
- "Jogar de novo" faz a carta sair na próxima oportunidade.
- Em 30 giros, as cartas nunca vistas aparecem mais que as vistas várias vezes.

---

## Fase 7 — Conquistas do casal

1. **Definições no código.** Criar `conquistas.js` com uma lista de objetos:
   ```js
   { codigo, titulo, descricao, categoria: 'jornada' | 'ousadia', escopo: 'casal' | 'jogador', meta, contar(dados) }
   ```
   `contar` recebe os dados já carregados e devolve o progresso atual.
2. **Dados para contar**, todos da sala:
   - `partidas` (v3), com o `placar` de cada partida, que tem os contadores de v2 a v4;
   - `cartas` com `sala = codigo` (as cartas autorais);
   - `envelopes`, `capsulas`, `apostas`, `observacoes`, `momentos`, `cofre` (v3);
   - `estado.diario` (sequência do desafio do dia).
3. **Contadores por nível.** Para as conquistas de ousadia, o `placar[i]` passa a guardar, a partir da v5, `porNivel: { leve: { v, d }, criativo: …, picante: …, pesado: … }`, incrementado ao cumprir verdade (`v`) ou desafio (`d`). Partidas antigas contam como zero.
4. **Verificar** ao fim de cada partida e depois de cada ação das Fases 2 a 5.
   - Uma conquista nova grava em `conquistas` (ignorando o `23505`) e mostra nos dois aparelhos o aviso "🏆 {título}".
   - Só **quem fez a ação** grava, para não duplicar.
5. **Tela de conquistas** na Casa:
   - Grade com desbloqueadas e bloqueadas, e barra de progresso (`3/5`).
   - Duas seções: **Jornada** e **Ousadia**.
   - A seção Ousadia tem o interruptor "Mostrar conquistas de ousadia", ligado por padrão e salvo no `estado` da sala.
6. **Títulos.** Cada jogador pode escolher um título entre as suas conquistas de escopo `jogador` desbloqueadas. Ele aparece embaixo do nome no placar. Fica em `estado.titulos = [codigo | null, codigo | null]`.

### Lista inicial

**Jornada (casal)**

| Código | Título | Condição |
|---|---|---|
| `primeira_partida` | Primeira de muitas | 1 partida terminada |
| `dez_partidas` | Casal de carteirinha | 10 partidas |
| `cinquenta_partidas` | Temporada completa | 50 partidas |
| `sintonia_5` | Na mesma frequência | 5 sintonias certeiras (somando os dois) |
| `sintonia_20` | Telepatia | 20 sintonias certeiras |
| `dupla_1` | Time | 1 missão em dupla concluída |
| `dupla_10` | Dupla imbatível | 10 missões em dupla |
| `autorais_10` | Autores | 10 cartas criadas por vocês |
| `autorais_50` | Baralho próprio | 50 cartas criadas por vocês |
| `envelope_1` | Correio do amor | 1 envelope aberto |
| `envelope_10` | Carteiros | 10 envelopes abertos |
| `capsula_1` | Viajantes do tempo | 1 cápsula aberta |
| `apostas_10` | Conheço você | 10 apostas certeiras (somando os dois) |
| `observacao_4` | Olhos atentos | 4 missões de observação confirmadas |
| `album_10` | Álbum de família | 10 momentos no álbum |
| `cofre_1` | Promessa cumprida | 1 item do cofre marcado como feito |
| `eventos_todos` | Experimentamos de tudo | Pelo menos 1 de cada: efeito, duelo, sintonia e missão em dupla |

**Jornada (jogador)**

| Código | Título | Condição |
|---|---|---|
| `vitoria_1` | Primeira vitória | 1 vitória |
| `vitoria_10` | Campeão(ã) | 10 vitórias |
| `sequencia_7` | Constância | 7 dias seguidos no desafio do dia |
| `sequencia_30` | Inabalável | 30 dias seguidos no desafio do dia |
| `sem_pulo` | Sem desculpas | Terminar uma partida sem usar nenhum pulo |
| `duelista_10` | Duelista | 10 duelos vencidos |

**Ousadia (jogador)**

| Código | Título | Condição |
|---|---|---|
| `prendas_10` | Paga tudo | 10 prendas cumpridas |
| `sem_filtro` | Sem filtro | 30 verdades Picante ou Pesado cumpridas |
| `corajoso_20` | Corajoso(a) | 20 desafios Pesados cumpridos |
| `indomavel` | Indomável | 5 efeitos Pesados até o fim |
| `secreta_pesada` | Agente secreto(a) | 1 missão secreta Pesada cumprida |

**Aceite:**
- A primeira partida terminada desbloqueia `primeira_partida` nos dois, com o aviso.
- O progresso aparece nas bloqueadas.
- Desligar "Ousadia" esconde a seção.
- O título escolhido aparece embaixo do nome no placar.

---

## Estado — resumo dos campos novos

```js
historico: [],        // últimas 50 cartas resolvidas da partida
nivelSemana: 'leve',  // nível das apostas e missões de observação
mostrarOusadia: true,
titulos: [null, null]
// em cada placar[i]: porNivel: { leve: { v: 0, d: 0 }, criativo: …, picante: …, pesado: … }
```

**Salas antigas:** tudo ausente vale o padrão acima.

"Nova partida" zera `historico` e `porNivel`, mas os números já ficaram guardados em `partidas` e continuam contando para as conquistas.

---

## Ordem de execução

1. Branch `v5` a partir da `main`.
2. **Fase 0:** colocar `008_v5.sql` e `009_seed_v5.sql` em `supabase/`. Commit: `sql v5`. **Parar e avisar o Ricardo para rodar os dois, nessa ordem.**
3. **Fase 1**, commit `casa do casal e presença`.
4. **Fase 2**, commit `envelopes`.
5. **Fase 3**, commit `cápsula do tempo`.
6. **Fase 4**, commit `apostas e missão da semana`.
7. **Fase 5**, commit `álbum de momentos`.
8. **Fase 6**, commit `baralho com memória`.
9. **Fase 7**, commit `conquistas`.
10. Rodar o checklist, reportar o resultado e **não fazer merge na `main`**.

## Checklist de testes

Usar dois aparelhos, na mesma sala fixa.

- [ ] Tudo dos checklists da v2 à v4 continua passando.
- [ ] Casa do casal só em sala fixa; a presença mostra quem está online.
- [ ] Envelope: B não vê o texto antes; "Abrir juntos" só com os dois online; o desafio surpresa sai como primeira carta de B.
- [ ] Cápsula: respostas escondidas; na data, pede a resposta nova; a comparação em 4 quadros aparece.
- [ ] Apostas: as mesmas perguntas nos dois; palpite fechado depois de quarta; julgamento no sábado.
- [ ] Missão de observação: "Mostrei!" e confirmação gravam; uma por semana.
- [ ] Álbum: guardar da tela de vitória; favoritar; apagar.
- [ ] Baralho: aposentar remove do sorteio; "Jogar de novo" traz a carta; restaurar funciona.
- [ ] Conquistas: primeira partida desbloqueia; aviso nos dois; sem duplicar; interruptor de ousadia; título no placar.
- [ ] Sala comum mostra o convite para criar sala fixa em vez da Casa.
- [ ] Console do navegador sem erros.

## Fora do escopo desta versão

- Notificações push fora do app (avisar que chegou um envelope). O aviso é só quando o app está aberto.
- Escolha às cegas, sessão com roteiro, cartas com continuação e morte súbita.
- Exportar o álbum ou as cápsulas.
- Criar perguntas de aposta ou missões de observação pelo app. Nesta versão, só pelo seed e pelo Table Editor.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v5.md` na raiz do repositório. Pré-requisito: a v4 já está na `main`. Crie a branch `v5` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `008_v5.sql` e `009_seed_v5.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). No fim, rode o checklist, me conte o que passou e o que não passou, e não faça merge na `main`.
