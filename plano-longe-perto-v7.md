# Plano — Longe & Perto v7 (cuidar a distância)

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`, **depois que a v6 e as configurações estiverem testadas e na `main`**. Inspirado em apps de casal do tipo "pedir dengo", adaptado para quem está longe. São seis novidades:

1. **Nova navegação:** barra fixa embaixo (Início · Jogo · Histórico · Perfil) e cabeçalho "Olá, {nome}" com os dois avatares.
2. **Pedir dengo:** pedidos rápidos e editáveis; o outro responde "Tô indo" ou "Agora não consigo".
3. **Humor do dia:** carinhas de 1 a 5, com sugestões de cuidado para o outro e ligação com o jogo.
4. **Mural de desenho:** desenhar com o dedo para o outro, inclusive ao vivo, os dois juntos.
5. **Manual de mim:** a ficha de cada um, com o que acalma, comida de conforto, o que não fazer.
6. **Histórico:** linha do tempo de dengos, humores e desenhos, com o gráfico do humor da semana.

---

## Pré-requisitos

- A v6 (`plano-longe-perto-v6.md`) e as configurações (`plano-longe-perto-config.md`) estão na `main`, com os checklists passando.
- Tudo da v7 aparece **só em sala fixa**. Em sala comum, a barra de baixo mostra só **Jogo**.
- **Sem interruptor nas Configurações:** assim como os recursos românticos da v6, os da v7 ficam sempre visíveis.
- Criar a branch `v7` a partir da `main`.
- Continuam valendo todas as **Regras para o Claude Code** da v2:
  - Mudança mínima.
  - Não alterar `config.js`.
  - Não rodar SQL.
  - Texto do banco e de usuário só via `textContent`.
  - Valores padrão para salas antigas.
  - Sem dependências novas.
  - Mídia só pelo WhatsApp.
- **Sem notificação push.** O app só mostra o que chegou quando está aberto. Por isso, os pedidos têm o botão **"Avisar no WhatsApp"**, que abre `wa.me` com um texto pronto.

---

## Fase 0 — SQL (já pronto)

Os dois arquivos são fornecidos prontos. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda os dois, nessa ordem.

**`020_v7.sql`** cria as tabelas, com RLS no mesmo modelo da v5 e Realtime ligado:

| Tabela | Para que serve |
|---|---|
| `pedidos_modelos` | Pedidos rápidos. `sala null` = padrão, só leitura; `sala + jogador` = a lista editada de cada pessoa. |
| `dengos` | Cada pedido de dengo enviado: itens, mensagem, status e resposta. |
| `humores` | Humor do dia de cada um (1 a 5, com nota opcional). Um por pessoa por dia. |
| `sugestoes_cuidado` | Sugestões por faixa de humor. Só leitura. |
| `murais` | Desenhos guardados como traços (JSON, até ~300 KB), não como imagem. |
| `manuais` | O "Manual de mim" de cada pessoa (JSON de campos). |

**`021_seed_v7.sql`** traz 12 pedidos padrão e 16 sugestões de cuidado.

Os 12 pedidos padrão são:
- 📞 Me liga agora
- 🎙️ Me manda um áudio
- 😴 Fica na chamada até eu dormir
- 💌 Me manda uma mensagem fofa
- 📸 Me manda uma foto sua
- 🍔 Me pede um lanche
- 🎬 Vê um filme comigo
- 🫶 Só preciso de colo
- 🎵 Me manda uma música
- 😂 Me faz rir
- 🗣️ Preciso desabafar
- 🧘 Preciso ficar sozinho(a)

Cada padrão tem uma `chave` (`ligar`, `audio`, `dormir`, `mensagem`, `foto`, `lanche`, `filme`, `colo`, `musica`, `rir`, `desabafar`, `sozinho`), usada nos comportamentos especiais abaixo.

---

## Fase 1 — Nova navegação

1. **Barra fixa embaixo**, com quatro abas:
   - 🏠 **Início:** a Casa do casal reorganizada.
   - 🎲 **Jogo:** a tela da roleta, que já existe.
   - 🕘 **Histórico:** Fase 6.
   - 👤 **Perfil:** Fase 5, mais "Configurações" para o dono.

   Com `env(safe-area-inset-bottom)`, e a aba ativa destacada.
2. **Barra do jogo:** na tela do jogo, a barra de ações da v4 (Girar, Cumpri, Pular…) fica **acima** da barra de navegação, sem sobrepor. Durante uma carta na tela, a barra de navegação pode ser recolhida com um toque, para dar espaço.
3. **Cabeçalho do Início:** "Olá, {meu nome}", com os dois avatares à direita e um ❤️ entre eles. O avatar é o emoji escolhido no Manual (Fase 5); sem emoji, mostrar as iniciais num círculo colorido. **Não usar fotos.**
4. **Ordem do Início:**
   - a. **Pedido de dengo pendente para mim**, se houver (Fase 2), sempre no topo;
   - b. **Botão "PEDIR DENGO 💗"** e a grade de pedidos rápidos (Fase 2);
   - c. **Humor:** "Como você se sente hoje?" e "Humor do(a) {outro} hoje" (Fase 3);
   - d. **Mural:** o último desenho recebido (Fase 4);
   - e. **Pensei em você e Mãos juntas** (v6);
   - f. **Contagem do reencontro, mapa da saudade e "juntos há X dias"** (v3 e v6);
   - g. **Pergunta do dia** (v6);
   - h. **Grade "Mais"**, com as outras áreas: Envelopes, Cápsulas, Semana, Álbum, Cofre, Pote de motivos, Abra quando…, Nossa história, Diário, Conquistas, Nossa playlist, Baralho, Posições e Poses (estes dois só se permitidos nas Configurações).
5. **Nenhuma função some.** Tudo o que existia na Casa continua acessível, só muda de lugar.

**Aceite:**
- As 4 abas funcionam no celular sem cobrir botões.
- A barra do jogo não fica escondida.
- Todas as áreas antigas continuam acessíveis pela grade "Mais".

---

## Fase 2 — Pedir dengo

### Pedidos rápidos

1. **Lista de cada pessoa:** se a pessoa tiver linhas próprias em `pedidos_modelos` (`sala = codigo`, `jogador = eu`), usar essas; senão, usar os **padrões**.
2. **Grade de cartões:** emoji, título e o detalhe sugerido, com seleção múltipla de 1 a 6 itens.
3. **Editar:**
   - Na primeira edição, copiar os padrões para linhas próprias da pessoa.
   - Depois: renomear, trocar o emoji, mudar o detalhe sugerido, reordenar (setas ↑↓), desativar e criar pedidos novos.
   - Botão "Restaurar padrões", que apaga as linhas próprias.

### Enviar

4. **O botão "PEDIR DENGO 💗"** abre o resumo dos itens escolhidos.
   - Cada item pode ganhar um **detalhe** (até 80 caracteres), já preenchido com o `detalhe` do modelo. Exemplo: "O que eu quero: açaí com granola".
   - Campo opcional "Quer dizer mais alguma coisa?" (até 200 caracteres).
   - Salva em `dengos` com `status = 'pendente'`.
   - **Sem nenhum item marcado:** o botão envia um pedido só com 💗 "Dengo", genérico.
5. **Depois de enviar:**
   - Tela "Pedido enviado 💗, esperando {nome}…".
   - Botão **"Avisar no WhatsApp"** (`wa.me/?text=` com "Te pedi dengo no Longe & Perto 💗").
   - Botão "Cancelar pedido", que muda o status para `cancelado`.
6. **Um pendente por vez:** só pode haver um pedido pendente por pessoa. Enquanto houver, o botão vira "Ver meu pedido".

### Receber e responder

7. **Cartão no topo do Início** de quem recebe: "**{nome} pediu dengo!**", com os itens (emoji, título e detalhe), a mensagem e há quanto tempo foi pedido. Vibra `[100, 50, 100, 50, 200]`, respeitando o silenciar da v4.
8. **Respostas:**
   - **"TÔ INDO 💨"** (`status = 'indo'`), com um campo opcional de resposta ("Te ligo em 5 min").
   - **"Agora não consigo"** (`status = 'nao_consigo'`), com as frases rápidas "Tô no trabalho, te ligo às 18h", "Tô sem sinal agora" e "Já já eu volto, te amo", além de texto livre.
9. **Quem pediu** vê a resposta na hora, com animação ("{nome} está indo! 💨") ou com a mensagem de "não consigo". Um toque em "Ok" fecha.

### Comportamentos especiais (pela `chave` do padrão)

10. **`sozinho`:** "Preciso ficar sozinho(a)" é **exclusivo**: marcar esse item desmarca os outros.
    - Quem recebe vê: "{nome} precisa de um tempo sozinho(a). Não precisa fazer nada agora 🤍".
    - A única resposta é **"Tô aqui quando precisar 🤍"**.
    - Esse pedido não conta como "não atendido" em lugar nenhum.
11. **`lanche`:** para quem recebe, se o outro tiver preenchido o **pedido de delivery favorito** no Manual (Fase 5), aparece embaixo: "💡 {nome} costuma pedir: …".
12. **`ligar` e `dormir`:** um botão extra "Abrir o WhatsApp" (`wa.me/` sem número, só para abrir o app).
13. **`musica`:** se a Nossa playlist (v6) existir e tiver músicas, o botão "Mandar uma da nossa playlist" sorteia uma e abre no Spotify.

**Aceite:**
- O pedido chega no outro aparelho em até 2 s, com itens e detalhes.
- As respostas voltam em tempo real.
- "Preciso ficar sozinho(a)" desmarca os outros e só permite "Tô aqui".
- Editar a lista não afeta a do outro.
- Só um pendente por pessoa.

---

## Fase 3 — Humor do dia

1. **No Início:** "Como você se sente hoje?", com 5 carinhas (😣 1, 😢 2, 😐 3, 🙂 4, 😄 5). Tocar faz um upsert em `humores` para hoje (fuso America/Bahia) e pode ser mudado ao longo do dia. Nota opcional "Quer contar por quê?" (até 140 caracteres).
2. **Humor do outro:** cartão "**Humor do(a) {nome} hoje**", com a carinha dele(a) destacada e as outras apagadas, igual ao print. Com a nota, se tiver. Sem humor registrado: "{nome} ainda não disse como está hoje".
3. **Sugestões de cuidado** abaixo do humor do outro: até 4 itens de `sugestoes_cuidado` em que `humor_min ≤ valor ≤ humor_max`, na ordem de `ordem`. Cada `acao` vira um atalho:

   | `acao` | Atalho |
   |---|---|
   | `mural` | Abre o mural (Fase 4) |
   | `mensagem`, `audio`, `ligar` | Abre o WhatsApp (`wa.me/`) |
   | `abra_quando` | Abre "Nova carta Abra quando…" (v6) |
   | `pensei` | Envia "Pensei em você" (v6) na hora |
   | `dengo_lanche` | Mostra o delivery favorito do outro, do Manual |
   | `manual` | Abre o Manual do outro na parte "O que me acalma" |
   | `partida` | Vai para a aba Jogo |
   | `musica` | Sorteia uma da Nossa playlist (v6) |
   | `desculpas` | Abre o WhatsApp |
   | `reencontro` | Abre o Cofre do reencontro (v3) |
   | `nenhuma` | Só o texto |

4. **Dica do Manual:** com humor 1 ou 2, mostrar também, se preenchidos, "💡 O que acalma {nome}: …" e "🚫 Evite: …", do Manual do outro.
5. **Ligação com o jogo:** ao abrir a aba Jogo com a partida zerada, se o humor de hoje de **qualquer um dos dois** for 1 ou 2, mostrar uma faixa discreta: "Dia difícil? Que tal Romântico e prendas fofas hoje?" com o botão "Usar".
   - O botão liga só o chip Romântico e o "Prendas fofas", **respeitando as Configurações**: só se o Romântico existir e só se esta pessoa puder mexer nos chips (`chipsQuemMuda`).
   - É só sugestão; nunca muda nada sozinho.
6. **Sem cobrança:** não mostrar sequência nem lembrete de registrar o humor.

**Aceite:**
- Registrar o humor em A aparece em B em até 2 s.
- As sugestões mudam conforme o valor.
- A faixa do jogo aparece só com humor 1 ou 2 e respeita as permissões.

---

## Fase 4 — Mural de desenho

### Desenhar

1. **Tela do mural:** canvas em tela cheia no celular (`<canvas>` com `devicePixelRatio`), com:
   - 6 cores (vermelho, rosa, laranja, azul, verde, preto);
   - 3 espessuras;
   - borracha, desfazer (até 30 passos) e limpar (com confirmação);
   - fundos "papel", "quadriculado", "escuro" e "rosa".
2. **Formato dos traços**, independente do tamanho da tela:
   ```js
   [{ cor: '#E0405F', esp: 2, pts: [[x, y], …] }]
   ```
   `x` e `y` são inteiros de 0 a 1000, em proporção da largura e da altura do canvas. Simplificar cada traço (remover pontos a menos de 2 unidades do anterior) para caber no limite de ~300 KB. Se passar, avisar "Desenho muito grande, apague alguns traços".
3. **Enviar:** o botão "Enviar para {nome} 💌", com legenda opcional (até 80 caracteres), salva em `murais` com `para = outro`.

### Ao vivo

4. **Com os dois online** (presença da v5), a tela do mural mostra o botão **"Desenhar juntos"**.
   - Os dois entram no mesmo canvas, e cada traço é enviado por **broadcast** do Realtime enquanto é desenhado (lotes a cada ~50 ms). O traço aparece na tela do outro quase na hora.
   - Cada pessoa tem uma cor de cursor diferente.
   - "Guardar" salva o desenho uma vez só, com `para = null` (feito juntos) e a legenda. Só quem tocou em "Guardar" grava.

### Receber e galeria

5. **No Início:** o cartão "**Mural** — {nome} deixou algo para você ❤️", com o último desenho recebido ainda não visto, redesenhado a partir dos traços. Tocar abre em tela cheia e grava `visto_em`. Sem desenho novo, mostra o último recebido, sem o selo.
6. **Galeria:** grade com todos os desenhos (recebidos, enviados e feitos juntos), filtro e botão de apagar com confirmação.
7. **Integração com o jogo:** nas cartas criativas com "desenhe" no texto, o botão "✏️ Desenhar no mural" abre o mural já no modo "Desenhar juntos" (se os dois estiverem online) ou no modo normal.

**Aceite:**
- O desenho enviado em A aparece no Início de B.
- "Desenhar juntos" mostra os traços de um na tela do outro com atraso abaixo de 1 s.
- Os desenhos ficam iguais em telas de tamanhos diferentes.
- O limite de tamanho é respeitado.

---

## Fase 5 — Manual de mim (Perfil)

1. **Aba Perfil:**
   - Meu avatar: emoji, com uma grade de ~40 opções, e cor de fundo.
   - Meu nome, só para exibir.
   - **Meu Manual**, editável.
   - **Manual do(a) {outro}**, só leitura.
   - "Configurações", só para o dono.
2. **Campos do Manual** (em `manuais.campos`, todos opcionais):

   | Campo | Tipo |
   |---|---|
   | `avatar`, `avatarCor` | Emoji e cor |
   | `acalma` | O que me acalma (até 300) |
   | `naoFazer` | O que **não** fazer quando estou mal (até 300) |
   | `linguagemAmor` | Uma das 5: palavras, tempo de qualidade, presentes, atos de serviço, toque |
   | `comidaConforto` | Comida de conforto (até 120) |
   | `doce` | Doce favorito (até 80) |
   | `delivery` | Pedido de delivery favorito, com restaurante e o que pedir (até 200) |
   | `musicaConforto` | Música que me acalma (texto ou link do Spotify) |
   | `bebida` | Bebida favorita (até 80) |
   | `tamanhos` | Camiseta, calça, calçado e anel (texto curto cada) |
   | `flores` | Flor favorita (até 60) |
   | `datas` | Datas importantes para mim (até 300) |
   | `apelidos` | Apelidos de que gosto (até 120) |
   | `sonhos` | Coisas que quero fazer um dia (até 300) |

3. **Salvar:** upsert em `manuais` (`sala`, `jogador = eu`). Salvar a cada campo, com intervalo de 800 ms e o aviso "Salvo ✓".
4. **Onde o Manual aparece:**
   - Dicas no humor 1 ou 2 (Fase 3).
   - Pedido de lanche (Fase 2).
   - Atalho `manual` das sugestões.
   - Avatares no cabeçalho e no placar.
5. **Privacidade:** o Manual fica visível para os dois e, como todo o resto, pode ser lido por quem tiver o código da sala. Mostrar essa dica no topo do Manual e não incluir campos de saúde.

**Aceite:**
- Preencher em A aparece no Manual do outro em B.
- O avatar aparece no cabeçalho e no placar.
- As dicas aparecem nos lugares certos.

---

## Fase 6 — Histórico

1. **Aba Histórico:** linha do tempo, da mais nova para a mais antiga, juntando:
   - dengos, com os itens, quem pediu, a resposta e o tempo até a resposta;
   - humores dos dois;
   - desenhos do mural, em miniatura;
   - partidas terminadas (v3).

   Agrupados por dia ("Hoje", "Ontem", "Seg, 22 set"). Paginação de 30 dias.
2. **Filtros:** Tudo, Dengos, Humor, Mural e Partidas.
3. **Resumo do mês**, no topo:
   - "Dengos pedidos: 9 · atendidos com 'Tô indo': 7";
   - "Desenhos trocados: 5";
   - "Partidas: 3".

   Sem ranking nem comparação entre os dois. "Preciso ficar sozinho(a)" não entra na conta de atendidos.
4. **Humor da semana:** um SVG com os últimos 7 dias, uma linha para cada pessoa, cada uma com a cor do avatar, e os dias sem registro em branco.

**Aceite:**
- A linha do tempo mistura os quatro tipos na ordem certa.
- O gráfico da semana mostra os dois.
- O resumo do mês bate com os dados.

---

## Ordem de execução

1. Branch `v7` a partir da `main`.
2. **Fase 0:** colocar `020_v7.sql` e `021_seed_v7.sql` em `supabase/`. Commit: `sql v7`. **Parar e avisar o Ricardo para rodar os dois, nessa ordem.**
3. **Fase 1**, commit `nova navegação`.
4. **Fase 5**, commit `manual de mim e perfil`. Vem antes, porque as outras fases usam o Manual e os avatares.
5. **Fase 2**, commit `pedir dengo`.
6. **Fase 3**, commit `humor do dia`.
7. **Fase 4**, commit `mural de desenho`.
8. **Fase 6**, commit `histórico`.
9. Rodar o checklist, reportar o resultado e **não fazer merge na `main`**.

## Checklist de testes

Usar dois aparelhos, na mesma sala fixa.

- [ ] Tudo dos checklists anteriores continua passando, inclusive as Configurações (quem não é dono não vê Configurações no Perfil).
- [ ] **Navegação:** 4 abas; a barra do jogo visível; tudo acessível pelo "Mais".
- [ ] **Dengo:** enviar, receber, "Tô indo" e "Agora não consigo" em tempo real; "Preciso ficar sozinho(a)" exclusivo; um pendente por vez; "Avisar no WhatsApp"; edição da lista separada por pessoa.
- [ ] **Humor:** registra e sincroniza; sugestões pela faixa; dicas do Manual no humor baixo; faixa no jogo respeitando as permissões.
- [ ] **Mural:** enviar e receber; "Desenhar juntos" ao vivo; mesmo desenho em telas diferentes; limite de tamanho.
- [ ] **Manual:** salva e sincroniza; avatares no cabeçalho e no placar.
- [ ] **Histórico:** linha do tempo, filtros, resumo do mês e humor da semana.
- [ ] Sala comum: só a aba Jogo na barra.
- [ ] Console do navegador sem erros.

## Fora do escopo

- Notificações push (o aviso fora do app é o botão do WhatsApp).
- Fotos de perfil ou no mural.
- Pedir delivery de verdade por dentro do app.
- Registrar quanto tempo o outro levou para responder como cobrança ou ranking.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v7.md` na raiz do repositório. Pré-requisito: a v6 e as configurações já estão na `main`. Crie a branch `v7` e siga a "Ordem de execução", com um commit por fase (a Fase 5 vem antes da 2). Na Fase 0, coloque `020_v7.sql` e `021_seed_v7.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas) e passe tudo que depende de configuração pela função `permitido()`. No fim, rode o checklist, me conte o que passou e o que não passou, e não faça merge na `main`.
