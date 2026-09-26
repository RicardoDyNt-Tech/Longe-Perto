# Plano — Longe & Perto v8 (novas formas de jogar)

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`, **depois que a v7 estiver testada e na `main`**. As quatro ideias que ficaram "para depois" na v4 e na v5, todas mexendo no núcleo da partida:

1. **Escolha às cegas:** antes de revelar a carta, escolher entre dois caminhos com tema e pontuação.
2. **Sessão com roteiro:** uma partida com começo, meio e fim, escolhida pelo clima da noite.
3. **Cartas com continuação:** cartas em 2 ou 3 etapas, alternando quem faz.
4. **Morte súbita:** opção da partida para quando o placar empata perto da meta.

O **APK Android** fica num plano separado, e não entra aqui.

---

## Pré-requisitos

- A v7 e as **Configurações** (`plano-longe-perto-config.md`) estão na `main`, com os checklists passando.
- **Tudo passa por `permitido()`.** As quatro novidades respeitam os níveis da sala, o nível máximo de cada modo e o `midia`. Nada da v8 pode fazer sair uma carta que a configuração proíbe.
- Criar a branch `v8` a partir da `main`.
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

Os dois arquivos são fornecidos prontos. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda os dois, nessa ordem.

- **`022_v8.sql`:**
  - Em `cartas`: nova coluna `etapas` (jsonb) e novo tipo `sequencia`, que exige de 2 a 3 etapas.
  - Nova tabela `roteiros`, só leitura pelo app.
- **`023_seed_v8.sql`:** 20 cartas com continuação (4 Românticas, 4 Leves, 4 Criativas, 4 Picantes, 4 Pesadas) e 6 roteiros.

**Formato de uma etapa:** `{ "quem": "vez" | "outro" | "dois", "texto": "…" }`.
- `vez`: quem está na vez faz.
- `outro`: o adversário faz.
- `dois`: os dois fazem juntos.

**Formato de uma etapa de roteiro:**
```json
{ "nome": "Aquecimento", "rodadas": 2, "niveis": ["leve"], "tipos": ["verdade"] }
```
- `tipos` aceita `verdade`, `desafio`, `duelo`, `sintonia`, `missao_dupla`, `efeito`, `sequencia`.
- Tipos especiais de fechamento, com `rodadas: 0`: `encerrar` (abre o "Encerrar a noite" da v6) e `cofre` (abre o "Guardar para o reencontro" da v3).

**Os 6 roteiros:**

| Roteiro | Nível máximo | Etapas |
|---|---|---|
| 😂 Só risadas | Criativo | Aquecimento → Improvisos → Duelo → Juntos no final |
| 💗 Noite romântica | Romântico | Conversa → Carinhos → A dois → Boa noite |
| 🔥 Esquenta | Picante | Leve → Criativo → Picante → Duelo final |
| 🌶️ Noite quente | Pesado | Provocação → Sem filtro → Até o fim |
| 🎨 Criatividade total | Criativo | Aquecendo a imaginação → Mão na massa → Obra a dois → Missão final |
| ✈️ Antes do reencontro | Picante | Saudade → Planos → Contagem regressiva → Para o cofre |

---

## Fase 1 — Cartas com continuação

1. **Sorteio.** A `sequencia` entra como **mais um tipo de evento especial** (v4), com peso de 15%. Os pesos dos outros ficam proporcionais (efeito 30%, duelo 25%, sintonia 17%, missão em dupla 13%).
   - Respeita `config.eventos` e ganha a chave `sequencia` em `config.eventos.tipos` (padrão `true`).
   - Também pode sair por um roteiro (Fase 3).
   - "Escolher verdade/desafio" nunca gera sequência.
2. **Na tela:** título da carta com o selo "🔗 Em etapas" e as etapas em lista.
   - A etapa atual fica destacada; as seguintes ficam **escondidas** ("Etapa 2 · ???"), para manter a surpresa.
   - Cada etapa mostra quem faz: "Sua vez", "Vez de {nome}" ou "Os dois juntos".
3. **Avançar.** Em `estado.sequencia = { cartaId, etapa: 0 }`. Quem faz a etapa atual toca em **"Feito ✓"** e a próxima etapa é revelada nos dois aparelhos.
   - Etapa `dois`: os dois precisam tocar em "Feito ✓" (votos em `estado.sequencia.feitos`).
4. **Pontos**, ao terminar todas as etapas: **+1 para cada um** por etapa que fez, e **+1 de bônus para os dois**.
   - A vez passa normalmente, a partir de quem girou.
5. **Desistir.** Botão "Parar aqui", para qualquer um dos dois, com confirmação.
   - Quem parou paga uma **prenda** do nível da carta (respeita as prendas fofas da v6), sem devolver pulos.
   - Os pontos das etapas já feitas ficam.
6. **Mídia.** Se alguma etapa pedir envio de foto, vídeo ou áudio ("mande", "envie", "grave"), a carta só sai com `config.midia.ativo`. As 20 do seed não pedem envio.

**Aceite:**
- As etapas aparecem uma a uma, iguais nos dois aparelhos.
- Etapa `dois` só avança com os dois tocando.
- Os pontos somam no fim, e "Parar aqui" gera a prenda.
- Com `eventos` desligado nas Configurações, nenhuma sequência sai por evento.

---

## Fase 2 — Escolha às cegas

1. **Configuração da partida** "Escolha às cegas", desligada por padrão, ao lado da meta e dos pulos. Só muda com o placar zerado. Aparece só para quem pode mudar as configurações da partida (regra das Configurações).
2. **Com ela ligada,** o giro sorteia **duas cartas** do tipo da roleta (verdade ou desafio), em vez de uma, e mostra dois cartões virados:
   - **Tema**, deduzido pelo nível e pelo texto: 💗 Carinho, 😂 Diversão, 🎨 Criatividade, 🗣️ Conversa, 📸 Câmera, 🔥 Provocação.
   - **Formato:** "ao vivo", "falando" ou "enviar pelo WhatsApp" (quando `midia` preenchido).
   - **Pontos** que vale, pela tabela da v2.
   - **Nunca o texto.**
3. **Diferença entre as duas.** As duas cartas precisam ser diferentes em pelo menos um: nível ou tema. Se não der em 5 tentativas, mostrar a carta única, sem escolha.
4. **Escolher.** Quem está na vez toca num cartão, que vira e revela o texto. A outra carta **volta para o baralho** (não entra em `usados`).
5. **Sem voltar atrás.** Depois de escolher, as regras de pulo e prenda seguem normais.
6. **Eventos e sequências** não entram na escolha às cegas: se o giro virar evento, ele sai direto.
7. **Mesma tela nos dois.** As duas opções ficam em `estado.cegas = [ { id, nivel, tema, formato, pontos }, … ]`; o adversário vê os mesmos cartões e a escolha acontecendo.

### Temas (deduzidos no app)

| Tema | Regra, na ordem |
|---|---|
| 📸 Câmera | `midia` preenchido, ou texto com "câmera", "mostre", "foto", "vídeo" |
| 🔥 Provocação | nível Picante ou Pesado |
| 🎨 Criatividade | nível Criativo, ou texto com "desenhe", "invente", "imite", "crie" |
| 💗 Carinho | nível Romântico |
| 🗣️ Conversa | tipo verdade |
| 😂 Diversão | o resto |

**Aceite:**
- Com a opção ligada, o giro mostra dois cartões com tema, formato e pontos, sem texto.
- A carta não escolhida pode sair de novo mais tarde.
- Os dois aparelhos veem as mesmas opções.

---

## Fase 3 — Sessão com roteiro

1. **Onde começa.** Na aba Jogo, com a partida zerada, o botão **"🎬 Jogar com roteiro"** abre a lista de roteiros.
   - Mostra só os roteiros cujo `nivel_max` cabe nos **níveis da sala** e em que todos os `tipos` estão **permitidos**. Exemplo: sem eventos ligados, some o "Só risadas", que usa duelo e missão em dupla.
   - Cada roteiro mostra emoji, nome, descrição e as etapas.
2. **Quem escolhe.** Só quem pode mudar os chips de nível (`chipsQuemMuda` das Configurações). O outro vê "{nome} está escolhendo o roteiro".
3. **Durante o roteiro,** em `estado.roteiro = { id, etapa: 0, rodadaNaEtapa: 0 }`:
   - Uma faixa no topo do jogo: "🎬 Esquenta · Etapa 2 de 4: Criativo · rodada 1 de 2".
   - **Os chips de nível ficam travados:** a etapa define os níveis e os tipos.
   - O giro sorteia só entre os `tipos` e `niveis` da etapa. `verdade` e `desafio` usam a roleta normal; os outros tipos saem direto, como evento.
   - Uma "rodada" é uma vez de cada jogador. Ao completar as rodadas da etapa, passa para a próxima com uma transição curta: "Etapa 3: Picante 🔥".
4. **Nível acima do permitido.** Se uma etapa pedir um nível desligado na sala, usar o nível permitido mais alto abaixo dele.
5. **Etapas de fechamento** (`rodadas: 0`):
   - `encerrar`: abre o "Encerrar a noite" (v6).
   - `cofre`: abre o "Guardar para o reencontro" (v3) com a última carta jogada.
6. **Fim do roteiro.** Tela "Roteiro concluído 🎬", com o placar. A partida continua normal a partir dali (chips destravados), a menos que alguém já tenha batido a meta.
7. **Sair do roteiro.** "Sair do roteiro" no menu, para quem pode mudar os chips, com confirmação. O placar continua.
8. **Pontos e regras** (pulos, prendas, estrelas, reverso) seguem iguais às da partida normal.

**Aceite:**
- A lista mostra só os roteiros permitidos pela sala.
- As etapas avançam sozinhas, com a faixa e os chips travados.
- "Noite romântica" termina abrindo o "Encerrar a noite".
- Com Pesado desligado, "Noite quente" não aparece.

---

## Fase 4 — Morte súbita

1. **Configuração da partida** "Morte súbita", desligada por padrão, ao lado da meta. Só muda com o placar zerado.
2. **Quando começa:** depois de uma jogada, se os pontos estiverem **empatados** e os dois estiverem a **3 pontos ou menos da meta** (ex.: 18 × 18 com meta 20), entra a morte súbita.
   - Aviso nos dois, com vibração: "⚡ Morte súbita! Próxima carta decide".
3. **Durante a morte súbita,** em `estado.morteSubita = true`:
   - **Sem pulos:** o botão Pular some. Quem não quiser cumprir usa "Desistir", e o outro vence.
   - **O nível sobe um degrau** em relação ao nível mais alto ligado nos chips, **sem passar do nível máximo da sala** (Configurações). Exemplo: chips em Leve e sala até Criativo → a carta sai Criativa.
   - **Pontos dobrados** na carta.
   - Sem eventos especiais, sem escolha às cegas e sem reverso.
4. **Como termina:** cada um joga **uma** carta. Se só um cumprir, esse vence. Se os dois cumprirem, quem fez mais pontos vence; em novo empate, repete com mais uma carta para cada um.
5. **Fim.** O vencedor segue o fluxo normal de vitória (prenda final, "Nova partida").
6. **Com roteiro:** se a morte súbita começar durante um roteiro, o roteiro pausa; ele termina junto com a partida.

**Aceite:**
- Com a opção ligada e 18 × 18 na meta 20, entra a morte súbita.
- Não aparece Pular; a carta vale o dobro.
- O nível nunca passa do máximo da sala.
- Com a opção desligada, o empate segue a regra atual (v4).

---

## Estado — resumo dos campos novos

```js
escolhaCegas: false,
morteSubita: false,       // configuração da partida
emMorteSubita: false,     // se está acontecendo agora
cegas: null,              // [{ id, nivel, tema, formato, pontos }, …]
sequencia: null,          // { cartaId, etapa, feitos: [false, false] }
roteiro: null             // { id, etapa, rodadaNaEtapa }
```

**Salas antigas:** tudo ausente vale o padrão acima.

**"Nova partida":** mantém `escolhaCegas` e `morteSubita`, e zera `emMorteSubita`, `cegas`, `sequencia` e `roteiro`.

**Configurações (dono):** acrescentar `sequencia: true` em `config.eventos.tipos`. Nada mais muda no `019_config.sql`; o campo novo vive no JSON de configuração.

---

## Ordem de execução

1. Branch `v8` a partir da `main`.
2. **Fase 0:** colocar `022_v8.sql` e `023_seed_v8.sql` em `supabase/`. Commit: `sql v8`. **Parar e avisar o Ricardo para rodar os dois, nessa ordem.**
3. **Fase 1**, commit `cartas com continuação`.
4. **Fase 2**, commit `escolha às cegas`.
5. **Fase 3**, commit `sessão com roteiro`.
6. **Fase 4**, commit `morte súbita`.
7. Rodar o checklist, reportar o resultado e **não fazer merge na `main`**.

## Checklist de testes

Usar dois aparelhos, na mesma sala fixa.

- [ ] Tudo dos checklists anteriores continua passando, inclusive as Configurações.
- [ ] **Sequência:** etapas uma a uma nos dois; etapa `dois` exige os dois; pontos no fim; "Parar aqui" gera prenda.
- [ ] **Às cegas:** dois cartões com tema, formato e pontos, sem texto; a carta não escolhida volta ao baralho.
- [ ] **Roteiro:** só os permitidos aparecem; faixa e chips travados; etapas avançam; fechamento abre a tela certa.
- [ ] **Morte súbita:** começa no empate perto da meta; sem Pular; pontos dobrados; nível limitado pela sala.
- [ ] **Configurações:** com Picante e Pesado desligados, nenhuma das quatro novidades faz sair carta desses níveis.
- [ ] Sala da v7 abre sem erro e com os padrões novos.
- [ ] Console do navegador sem erros.

## Fora do escopo

- Criar roteiros ou sequências pelo app (só pelo seed e pelo Table Editor).
- Gerar sequências pela IA.
- O APK Android, que tem plano próprio.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v8.md` na raiz do repositório. Pré-requisito: a v7 e as Configurações já estão na `main`. Crie a branch `v8` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `022_v8.sql` e `023_seed_v8.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Passe tudo o que for sorteado ou exibido pela função `permitido()` das Configurações. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). No fim, rode o checklist, me conte o que passou e o que não passou, e não faça merge na `main`.
