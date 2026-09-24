# Plano — Longe & Perto v4 (jogo ao vivo)

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`, **depois que a v3 estiver testada e na `main`**. O foco é deixar cada chamada mais variada, com oito novidades:

1. **Eventos especiais:** alguns giros viram uma carta especial em vez de verdade ou desafio.
2. **Cartas de efeito contínuo:** regras que duram algumas rodadas, com contador no topo da tela.
3. **Duelos na câmera:** os dois disputam ao mesmo tempo; quem perde paga prenda.
4. **Modo Sintonia:** um responde sobre si, o outro tenta adivinhar, e as respostas aparecem juntas.
5. **Missão em dupla:** rodada cooperativa em que os dois ganham pontos juntos.
6. **Missão secreta da partida:** cada um recebe um objetivo escondido para cumprir durante a chamada.
7. **Reverso:** uma vez por partida, passar a carta para o outro.
8. **Tela para o WhatsApp em PiP, sons e vibrações.**

---

## Pré-requisitos

- A v3 (`plano-longe-perto-v3.md`) está na `main` e o checklist dela passou. A v4 usa o cronômetro sincronizado, os avisos (`estado.aviso`) e o sorteio de prendas da v2 e da v3.
- Criar a branch `v4` a partir da `main`.
- Continuam valendo todas as **Regras para o Claude Code** da v2:
  - Mudança mínima.
  - Não alterar `config.js`.
  - Não rodar SQL.
  - Texto do banco e de usuário só via `textContent`.
  - Valores padrão para salas antigas.
  - Sem dependências novas.
  - Mídia só pelo WhatsApp.

---

## Fase 0 — SQL (já pronto)

Os dois arquivos são fornecidos prontos pelo Ricardo. O Claude Code só coloca em `supabase/` e **não edita**:

- **`006_v4.sql`:** na tabela `cartas`, acrescenta as colunas `rodadas` (1 a 5, obrigatória para efeitos) e `segundos` (5 a 600, opcional) e amplia o `tipo` para aceitar `efeito`, `duelo`, `sintonia`, `missao_dupla` e `missao_secreta`.
- **`007_seed_v4.sql`:** as 109 cartas especiais:

| Tipo | Leve | Criativo | Picante | Pesado | Total |
|---|---|---|---|---|---|
| efeito | 6 | 6 | 6 | 6 | 24 |
| duelo | 6 | 6 | 4 | 4 | 20 |
| sintonia | 10 | 8 | 6 | 6 | 30 |
| missao_dupla | 5 | 5 | 3 | 2 | 15 |
| missao_secreta | 6 | 6 | 4 | 4 | 20 |

O Ricardo roda os dois antes da Fase 1. Nenhuma tabela nova é necessária: todo o resto vive no `estado` da sala.

**Carregamento:** as cartas especiais vêm junto com as outras no carregamento de `cartas` que já existe. São cerca de 570 cartas no total, dentro do limite de 1.000 por consulta. Se passar de 1.000 no futuro, paginar com `.range()`.

---

## Fase 1 — Eventos especiais (base das Fases 2 a 5)

1. **Configuração da partida "Eventos especiais"**, ao lado da meta e dos pulos, com as opções:

   | Opção | Chance de evento por giro |
   |---|---|
   | Desligado | 0% |
   | Raro | 10% |
   | Normal (padrão) | 20% |
   | Frequente | 35% |

   Fica em `estado.eventos` e só pode mudar com o placar zerado, como a meta. Sala antiga: `normal`.
2. **Sorteio.** No giro, depois de definir a carta normal:
   - Com a chance configurada, a carta é trocada por um evento.
   - O tipo do evento é sorteado com estes pesos: efeito 35%, duelo 30%, sintonia 20%, missão em dupla 15%.
   - O nível do evento é um dos níveis ativos, sorteado.
   - Se não houver carta daquele tipo nos níveis ativos, tentar outro tipo. Se nenhum servir, manter a carta normal.
   - "Escolher verdade" e "Escolher desafio" **nunca** geram evento.
3. **Na tela.** A carta de evento aparece com o selo "⚡ Evento especial" e o nome do tipo. A roleta continua mostrando Verdade/Desafio no ponteiro; o selo deixa claro que a carta foi substituída.
4. **Cronômetro.** Quando a carta tiver `segundos`, o botão "Iniciar Ns" do cronômetro da v3 usa esse valor em vez de detectar pelo texto.
5. **Vez.** Todo evento consome a vez de quem girou. Quando o evento termina, a vez passa normalmente.
6. **Pulos.** Evento não pode ser pulado com os pulos grátis. As saídas de cada evento estão descritas na fase dele.

**Aceite:**
- Com "Frequente", cerca de 1 em cada 3 giros vira evento (conferir em uns 30 giros).
- Com "Desligado", nunca aparece evento.
- "Escolher verdade/desafio" nunca gera evento.

---

## Fase 2 — Cartas de efeito contínuo

1. **Receber.** A carta de efeito aparece para quem girou, com "Dura N rodadas". Botões:
   - "Aceitar": o efeito começa.
   - "Recusar": gera uma prenda do mesmo nível, como um pulo sem pulos livres, com `origem = 'desafio'`, que devolve pulos ao ser cumprida.
2. **Estado.** Os efeitos ativos ficam em `estado.efeitos`:
   ```js
   [{ id, dono: 0, texto, nivel, restantes: 3 }]
   ```
   Cada pessoa pode ter no máximo 2 efeitos ativos. Se já tiver 2, o sorteio de evento pula o tipo efeito.
3. **Contagem.** "Rodada" é uma vez do dono do efeito. Quando a vez volta para o dono, `restantes` desce 1. Ao chegar a 0, o efeito termina:
   - O dono ganha pontos: Leve 1, Criativo 1, Picante 2, Pesado 3.
   - Aviso nos dois aparelhos: "{nome} aguentou o efeito até o fim! +N".
4. **Badge no topo.** Uma faixa fixa no topo da tela lista os efeitos ativos dos dois: nome, texto resumido e "2 rodadas". Tocar abre o texto completo.
5. **Quebrou!** O adversário vê, no badge do efeito do outro, o botão "Quebrou!":
   - O efeito termina sem pontos.
   - Fica registrada uma prenda pendente do nível do efeito em `estado.prendaPendente = { dono, nivel }`.
   - No começo da próxima vez do dono, antes de girar, a prenda aparece e precisa ser resolvida (cumprir ou ser liberado). Ela não devolve pulos, porque não veio de pulo.
   - Aviso: "{adversário} disse que {nome} quebrou o efeito."
6. **Fim de partida.** Efeitos ativos são descartados, sem pontos.

**Aceite:**
- Um efeito de 2 rodadas some depois de 2 vezes do dono e dá os pontos.
- "Quebrou!" gera a prenda no começo da próxima vez do dono.
- O badge aparece igual nos dois aparelhos.

---

## Fase 3 — Duelos na câmera

1. **Quem joga.** A carta de duelo vale para os dois. Qualquer um toca em "Começar duelo".
2. **Contagem.** A tela mostra uma contagem sincronizada **3, 2, 1, VALENDO!**, reaproveitando o mecanismo de `timer.id` da v3. Se a carta tiver `segundos`, o cronômetro começa logo depois do VALENDO.
3. **Resultado.** Cada um escolhe o resultado no próprio aparelho: "Eu ganhei", "{outro} ganhou" ou "Empate". Os votos ficam em `estado.duelo.votos = [null, null]`.
   - Os dois escolheram o mesmo resultado: vale.
   - Escolheram diferente: aviso "Vocês discordaram, escolham de novo", e os votos são zerados.
4. **Pontos.**
   - Vencedor: +2 pontos, e soma em `duelos` no placar.
   - Perdedor: paga uma **prenda imediata** do nível do duelo. Ela aparece na hora, antes de a vez passar, e não devolve pulos.
   - Empate: ninguém ganha, sem prenda.
5. **Vez.** Depois do resultado e da prenda, se houver, a vez passa normalmente a partir de quem girou.

**Aceite:**
- A contagem 3-2-1 aparece junta nos dois.
- Votos diferentes pedem uma nova escolha.
- O perdedor recebe a prenda na hora, e o vencedor ganha 2 pontos.

---

## Fase 4 — Modo Sintonia

1. **Quem responde.** A pergunta é sobre quem girou (o **alvo**), e os dois respondem ao mesmo tempo:
   - O alvo responde a verdade sobre si.
   - O outro tenta adivinhar a resposta do alvo.
2. **Tela.** Cada um vê um campo de texto (até 140 caracteres) com a instrução do seu papel: "Responda sobre você" ou "O que {alvo} vai responder?", e o botão "Enviar".
3. **Estado.** As respostas ficam em `estado.sintonia = { respostas: [null, null], revelado: false }`.
   - Enquanto só uma resposta tiver chegado, a tela mostra "Esperando {nome}…" e **não mostra** a resposta de ninguém.
   - Quando as duas chegam, `revelado = true` e as duas aparecem lado a lado.
   - (O segredo é só na tela. Tecnicamente o estado é legível, e para o casal isso basta.)
4. **Julgar.** Depois de revelar, o **alvo** julga o palpite: "Acertou", "Quase" ou "Errou".
   - Palpite: Acertou +2, Quase +1, Errou 0 para quem adivinhou.
   - O alvo ganha +1 por ter respondido.
   - Acertou soma em `sintonias` no placar dos dois.
5. **Vez.** Depois do julgamento, a vez passa.

**Aceite:**
- Nenhum aparelho mostra resposta antes de os dois enviarem.
- Os pontos seguem o julgamento do alvo.

---

## Fase 5 — Missão em dupla (cooperativa)

1. **Carta.** A missão aparece para os dois, com o selo "🤝 Missão em dupla". Se tiver `segundos`, o botão do cronômetro já vem com esse valor.
2. **Resultado.** Os dois votam em "Conseguimos" ou "Não deu" (em `estado.dupla.votos`). Vale quando os votos batem; se divergirem, votam de novo.
3. **Pontos.**
   - Conseguimos: **+2 para cada um**, e soma em `duplas` no placar dos dois.
   - Não deu: ninguém pontua e não há prenda.
4. **Vez.** A vez passa normalmente.
5. **Empate na meta.** Se, depois de uma missão em dupla, os dois estiverem com pontos iguais e na meta ou acima dela, ninguém vence ainda: o jogo segue até alguém ficar na frente. Aviso: "Empate na meta! Próximo ponto decide."

**Aceite:**
- Os dois ganham 2 pontos com "Conseguimos".
- O empate na meta não encerra a partida.

---

## Fase 6 — Missão secreta da partida

1. **Sorteio.** No começo de cada partida (primeiro giro ou "Nova partida"), cada jogador recebe uma missão secreta. Ela é sorteada entre as cartas `missao_secreta` dos níveis ativos. As duas missões são sempre diferentes.
2. **Estado.** `estado.secretas = [{ id, texto, nivel, status: 'ativa' }, …]`, com `status` `ativa`, `pedida` ou `cumprida`.
3. **Tela.** Um botão discreto "🤫 Minha missão" abre a missão **só no aparelho do dono**. O outro vê apenas "{nome} tem uma missão secreta".
4. **Cumprir.** O dono toca em "Cumpri a missão!" e o `status` vira `pedida`.
   - O adversário recebe um aviso com o texto da missão e os botões "Confirmar" e "Ainda não".
   - Confirmar: `status = 'cumprida'`, o dono ganha pontos (Leve 2, Criativo 2, Picante 3, Pesado 4) e o aviso "{nome} cumpriu a missão secreta: …" aparece nos dois.
   - Ainda não: o `status` volta para `ativa`.
5. **Fim de partida.** Na tela de vitória, as missões não cumpridas são reveladas: "A missão de {nome} era: …". Não dão pontos.
6. Pode ser confirmada a qualquer momento, mesmo fora da vez do dono.

**Aceite:**
- Cada um vê só a própria missão.
- A confirmação do adversário dá os pontos.
- As missões pendentes aparecem no fim da partida.

---

## Fase 7 — Reverso

1. **Disponível** uma vez por partida para cada jogador (`placar[i].reverso: true` no início de cada partida).
2. **Quando usar.** Só quem está na vez, só em carta de **verdade ou desafio** (não em prenda nem em evento) e antes de cumprir ou pular. O botão "🔄 Reverso" aparece ao lado de Cumpri/Pular.
3. **Efeito.** A mesma carta passa para o adversário (`carta.para = outro`, `carta.reversa = true`):
   - O adversário resolve a carta com as regras normais, usando os próprios pulos e as próprias prendas.
   - Os pontos vão para o adversário se ele cumprir.
   - O título da carta vira "🔄 Reverso de {nome}".
   - Não existe contra-reverso: uma carta reversa não pode ser revertida de novo.
4. **Vez.** Depois que o adversário resolve a carta reversa, **a vez é dele** normalmente. Ou seja: o adversário joga duas seguidas; quem usou o reverso não joga essa rodada.
5. **Placar.** Linha "Reverso": "Disponível" ou "Usado".

**Aceite:**
- Usar o reverso transfere a carta e a pontuação.
- O botão some depois do uso e volta na nova partida.
- Não aparece em prenda nem em evento.

---

## Fase 8 — Tela para o PiP, sons e vibrações

### Tela para o WhatsApp em janela flutuante (PiP)

1. **Botões embaixo.** Os botões de ação (Girar, Cumpri, Pular, Reverso, votos) ficam numa barra fixa na parte de baixo da tela, respeitando `env(safe-area-inset-bottom)`.
2. **Carta no centro** da tela, sem conteúdo importante no canto superior.
3. **Ajuste por aparelho** "Câmera do WhatsApp": Direita (padrão), Esquerda ou Nenhuma, salvo em `localStorage`.
   - Direita ou Esquerda: reserva uma área de cerca de 40% da largura por 180 px no canto superior daquele lado. Nada clicável e nenhum texto de carta fica nela.
   - O badge de efeitos e o topo se ajustam para o outro lado.
   - A janela do WhatsApp pode ser arrastada pelo usuário; o ajuste só dá a zona mais provável.

### Sons (Web Audio API, sem arquivos)

4. Todos gerados com osciladores em JavaScript:
   - **Roleta:** tiques curtos que ficam mais espaçados conforme a roleta desacelera.
   - **Cronômetro:** tique-taque nos últimos 5 segundos.
   - **Evento especial:** um acorde curto.
   - **Vitória:** uma fanfarra de 3 notas.
5. Botão "🔊/🔇" no topo, salvo em `localStorage`. O áudio só começa depois do primeiro toque do usuário na página, por causa da política de autoplay.

### Vibrações

6. Padrões distintos com `navigator.vibrate?.()`:

   | Momento | Padrão |
   |---|---|
   | Sua vez (já existe) | 200 |
   | Carta Pesada sorteada | 80, 60, 80, 60, 200 |
   | Evento especial | 100, 50, 100 |
   | Últimos 5 segundos do cronômetro | 50 a cada segundo |
   | Fim do cronômetro (já existe) | 200, 100, 200 |
   | Vitória | 300, 100, 300, 100, 500 |

   Todos respeitam o mesmo botão de silenciar.

**Aceite:**
- Com "Câmera: Direita", nenhum botão fica no canto superior direito.
- Silenciar desliga sons e vibrações.
- A roleta faz tique ao girar.

---

## Placar depois da v4

Linhas novas na tabela de jogo, além das da v2 e da v3:

| | Ricardo | Caroline |
|---|---|---|
| Duelos vencidos | 2 | 1 |
| Sintonias certeiras | 3 | 3 |
| Missões em dupla | 2 | 2 |
| Reverso | Usado | Disponível |

---

## Estado — resumo dos campos novos

```js
eventos: 'normal',          // 'desligado' | 'raro' | 'normal' | 'frequente'
efeitos: [],                // [{ id, dono, texto, nivel, restantes }]
prendaPendente: null,       // { dono, nivel }
duelo: null,                // { cartaId, votos: [null, null] }
sintonia: null,             // { cartaId, alvo, respostas: [null, null], revelado }
dupla: null,                // { cartaId, votos: [null, null] }
secretas: [],               // [{ id, texto, nivel, status }]
// em cada placar[i]: duelos, sintonias, duplas, reverso
// na carta: evento: true, para, reversa
```

**Salas antigas:** tudo ausente vale o padrão acima. `reverso` ausente vale `true`.

**"Nova partida" zera:**
- `efeitos`, `prendaPendente`, `duelo`, `sintonia` e `dupla`;
- as `secretas`, sorteando novas;
- os contadores novos do placar, com `reverso` de volta a `true`.

**"Nova partida" mantém:** `eventos` e o ajuste de câmera, que é local de cada aparelho.

---

## Ordem de execução

1. Branch `v4` a partir da `main`.
2. **Fase 0:** colocar `006_v4.sql` e `007_seed_v4.sql` em `supabase/`. Commit: `sql v4`. **Parar e avisar o Ricardo para rodar os dois, nessa ordem.**
3. **Fase 1**, commit `eventos especiais`.
4. **Fase 2**, commit `efeitos contínuos`.
5. **Fase 3**, commit `duelos na câmera`.
6. **Fase 4**, commit `modo sintonia`.
7. **Fase 5**, commit `missão em dupla`.
8. **Fase 6**, commit `missão secreta`.
9. **Fase 7**, commit `reverso`.
10. **Fase 8**, commit `layout pip, sons e vibrações`.
11. Rodar o checklist, reportar o resultado e **não fazer merge na `main`**.

## Checklist de testes

Usar dois aparelhos: o celular Android com o WhatsApp em chamada (PiP ligado) e o computador.

- [ ] Tudo dos checklists da v2 e da v3 continua passando.
- [ ] Eventos: "Frequente" gera cerca de 1 evento a cada 3 giros; "Desligado" não gera nenhum; "Escolher verdade/desafio" nunca gera.
- [ ] Efeito: aceitar, contar as rodadas no badge dos dois, terminar com pontos; "Quebrou!" gera prenda na próxima vez do dono; recusar gera prenda na hora.
- [ ] Máximo de 2 efeitos ativos por pessoa.
- [ ] Duelo: contagem 3-2-1 junta; votos divergentes pedem nova escolha; vencedor +2; perdedor paga prenda na hora.
- [ ] Sintonia: nada aparece antes de os dois enviarem; os pontos seguem o julgamento do alvo.
- [ ] Missão em dupla: +2 para os dois; empate na meta não encerra a partida.
- [ ] Missão secreta: cada um vê só a sua; a confirmação dá pontos; as pendentes são reveladas no fim.
- [ ] Reverso: transfere a carta e os pontos; uma vez por partida; não aparece em prenda nem em evento.
- [ ] Layout: com "Câmera: Direita", nada clicável no canto superior direito; os botões ficam na barra de baixo.
- [ ] Sons e vibrações nos momentos certos; o botão de silenciar desliga tudo.
- [ ] Sala da v3 abre sem erro e com os padrões novos.
- [ ] Console do navegador sem erros.

## Fora do escopo desta versão

- Entre chamadas e progressão (envelope, aposta, cápsula do tempo, álbum de momentos, conquistas, baralho com memória): ficam para a **v5**.
- Escolha às cegas, sessão com roteiro, cartas com continuação e morte súbita.
- Adicionar cartas especiais pelo "Adicionar carta" do app. Nesta versão, efeitos, duelos, sintonia e missões são só os do seed. Mudanças são feitas pelo Table Editor.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v4.md` na raiz do repositório. Pré-requisito: a v3 já está na `main`. Crie a branch `v4` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `006_v4.sql` e `007_seed_v4.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). No fim, rode o checklist, me conte o que passou e o que não passou, e não faça merge na `main`.
