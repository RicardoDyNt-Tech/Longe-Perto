# Plano — Longe & Perto: Modo Presencial

Complemento independente para quando o casal está junto. Um botão **"📍 A distância / 💞 Juntos"** troca o app inteiro de modo:
- outras cartas;
- outros modos de jogo;
- o reencontro virando o momento de cumprir o que foi prometido a distância.

Pode entrar **sobre a versão que estiver na `main`** agora. Recursos de versões que ainda não estão no ar (Configurações, cofre, guia de posições, v4 a v8) são aplicados quando existirem; até lá, a parte correspondente é ignorada.

---

## Regras para o Claude Code

Valem as **Regras da v2**:
- mudança mínima;
- não alterar `config.js`;
- não rodar SQL;
- texto do banco e de usuário só via `textContent`;
- valores padrão para salas antigas;
- sem dependências novas.

Se as Configurações já existirem, tudo que for sorteado ou exibido passa por `permitido()`.

---

## Fase 0 — SQL (já pronto)

O `025_presencial.sql` é fornecido pronto. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda no SQL Editor.

- **Coluna `cartas.modo`:** `distancia` (padrão), `presencial` ou `ambos`.
  - Verdades, sintonias, perguntas do dia, cápsulas e boa noite viram `ambos`, porque funcionam nos dois modos.
  - Desafios, prendas e cartas especiais existentes continuam `distancia`, porque pedem câmera ou WhatsApp.
- **Cartas presenciais novas** (desafios e prendas), em pirâmide:

| Nível | Desafios | Prendas |
|---|---|---|
| Romântico | 30 | 6 |
| Leve | 27 | 5 |
| Criativo | 24 | 5 |
| Picante | 21 | 4 |
| Pesado | 18 | 4 |

- **Tabela `dado_itens`:** as faces do Dado do casal (ação, parte e tempo), por nível, com 46 itens. Só leitura.

---

## Fase 1 — O botão de modo

1. **Botão no topo da sala:** "📍 A distância" ⇄ "💞 Juntos". Grava `estado.modo` (`distancia` ou `presencial`); sala antiga sem o campo vale `distancia`.
   - Muda para os dois aparelhos ao mesmo tempo.
   - Quem pode trocar: os dois. Se as Configurações existirem, segue o `chipsQuemMuda`.
   - Confirmação ao trocar com uma partida em andamento: "Trocar de modo? O placar continua."
2. **Visual:** no modo Juntos, o tema muda para tons quentes (CSS por `data-modo="presencial"` no `<body>`), e aparece o cabeçalho "💞 Juntos de novo · dia X do reencontro".
3. **Sorteio:** filtra `cartas.modo` por `ambos` + o modo atual. Cartas de vocês (criadas pelo app) ganham um select "Para: a distância / juntos / os dois" no "Adicionar carta", com padrão no modo atual.
4. **O que muda no modo Juntos:**

| Recurso | No modo Juntos |
|---|---|
| Cartas com `midia` (WhatsApp) | Nunca saem |
| Aviso "Mande pelo WhatsApp em visualização única" | Some |
| Guia de poses (foto/vídeo) | Some |
| Guia de posições | Continua, com o botão "Fazer agora" no lugar de "Mostrar na câmera" |
| Eventos da v4 (efeito, duelo, sintonia, missões) | Continuam, mas só os de `modo` `ambos` ou `presencial`; os de câmera ficam de fora |
| Pedir dengo, humor, mural, carinhos (v6/v7) | Continuam iguais |
| Trilha da rodada | Continua; o player embutido toca no aparelho de quem girou |

5. **Configurações (dono):** novo item `presencial: { ativo: true }`. Desligado, o botão de modo some e a sala fica sempre a distância. Os níveis máximos da sala valem também no presencial.

**Aceite:**
- Trocar de modo em A muda em B na hora.
- No modo Juntos, nenhuma carta com `midia` sai e as verdades continuam saindo.
- Uma carta criada "para juntos" só sai no modo Juntos.

---

## Fase 2 — Um celular só

Juntos, o casal costuma usar um aparelho só.

1. **Opção "Jogar num celular só"**, aparece só no modo Juntos.
   - Os dois jogadores ficam no mesmo aparelho.
   - O app alterna a vez entre os dois nomes e mostra "Passe o celular para {nome} 💞" entre as rodadas.
2. **Placar e sala:** continuam os mesmos, gravados na sala normalmente (o histórico e as conquistas contam).
3. **Votos e respostas secretas:** duelos, missões em dupla e Sintonia ganham uma tela de "esconde": um responde, a tela fica coberta com "Agora é a vez de {nome}, não espie", e o outro responde. Só então revela.
4. **Missão secreta** fica desligada no modo um-celular, porque não dá para esconder.

**Aceite:**
- Uma partida inteira em um aparelho, alternando nomes, com placar gravado.
- A Sintonia esconde a primeira resposta até a segunda ser enviada.

---

## Fase 3 — Modos exclusivos do presencial

Todos aparecem no modo Juntos, num cartão "Modos de hoje" acima da roleta, e respeitam os níveis ligados.

### 🎲 Dado do casal
- Botão "Rolar o dado". Sorteia, de `dado_itens`, **ação + parte + tempo** dos níveis ativos. Exemplo: "Beije devagar · o pescoço · 40 segundos".
- Animação dos três dados girando. O tempo vira o cronômetro da v3 já preparado ("Iniciar 40s").
- Quem faz alterna a cada rolagem. "Rolar de novo" sem custo; não conta ponto.
- O nível de cada face nunca passa do nível mais alto ligado.

### ⏱️ Massagem cronometrada
- Escolhe o tempo (2, 5 ou 10 min) e a região (ombros, costas, pés, mãos, cabeça).
- No fim, o outro dá uma nota de 1 a 5 ⭐, que vai para o placar como estrelas.
- Troca de lugar automática.

### 🙈 De olhos vendados
- Liga um efeito para a próxima carta: quem cumpre está de olhos vendados (lenço, travesseiro, mão).
- A carta é lida em voz alta pelo outro: o app mostra a carta **só para o outro**, com "Leia para {nome}".
- Vale +1 ponto extra.

### 🔥 Quente ou frio
- Um esconde um objeto (ou um bilhete) pela casa; o app marca o tempo.
- O outro procura com dicas de "quente ou frio". Quem achar mais rápido vence a rodada.
- Placar próprio da noite (melhor de 3), e quem perde paga uma prenda presencial.

**Aceite:**
- O dado nunca sorteia face acima do nível máximo ligado.
- A massagem soma estrelas e troca de lugar.
- Vendado mostra a carta só no aparelho do outro (ou some até passar o celular, no modo um-celular).

---

## Fase 4 — O reencontro cobra o que foi prometido

O modo Juntos puxa tudo o que ficou guardado na distância.

1. **"Hoje é dia de cumprir"** (cartão no Início do modo Juntos), juntando:
   - itens **pendentes do cofre do reencontro** (v3);
   - **cardápio de posições** salvo no guia (posições marcadas "Queremos testar");
   - **desafios surpresa** e cartas "Abra quando… faltar uma semana" ainda fechados;
   - os **desejos do Manual** (campo "Coisas que quero fazer um dia", v7).
2. **Sortear uma promessa:** "🎁 Sortear do cofre" mostra um item pendente para os dois. Botões "Cumprimos ✓" (marca `feito` no cofre e vai para o álbum de momentos com a data) e "Hoje não".
3. **Lista do reencontro:** a lista inteira, com check, para ir riscando nos dias juntos.
4. **Contador do reencontro:** "Dia 2 de 5 juntos". O app pergunta, ao ligar o modo Juntos pela primeira vez, até quando vão ficar (`estado.juntosAte`). No último dia: "Último dia juntos 💞 · já cumpriram 7 de 12 promessas".
5. **Ao voltar para a distância:** resumo "O que fizemos juntos", com as promessas cumpridas e os momentos salvos, e a pergunta "Quando é o próximo reencontro?", que já alimenta a contagem regressiva.

**Aceite:**
- Os itens do cofre aparecem no "Hoje é dia de cumprir" e somem ao marcar "Cumprimos".
- O resumo ao voltar mostra o que foi cumprido.
- A data do próximo reencontro vira a contagem regressiva.

---

## Estado — resumo dos campos novos

```js
modo: 'distancia',        // 'distancia' | 'presencial'
umCelular: false,
juntosDesde: null,        // 'AAAA-MM-DD'
juntosAte: null,          // 'AAAA-MM-DD'
vendado: null,            // { jogador } para a próxima carta
noite: null               // placar de quente ou frio da noite
```

---

## Ordem de execução

1. Branch `presencial` a partir da `main`.
2. **Fase 0:** colocar `025_presencial.sql` em `supabase/`. Commit: `sql modo presencial`. **Parar para o Ricardo rodar.**
3. **Fase 1**, commit `botão de modo`.
4. **Fase 2**, commit `um celular só`.
5. **Fase 3**, commit `modos presenciais`.
6. **Fase 4**, commit `reencontro e promessas`.
7. Rodar o checklist, reportar e **não fazer merge na `main`**.

Se o tempo for curto antes do encontro: **as Fases 0, 1 e 3 já entregam o modo Juntos jogável.** As Fases 2 e 4 podem vir depois.

## Checklist de testes

- [ ] O botão troca o modo nos dois aparelhos; o placar não zera.
- [ ] Juntos: nenhuma carta de WhatsApp; verdades continuam; desafios presenciais saem.
- [ ] Voltar para a distância: as cartas presenciais somem.
- [ ] Um celular só: alterna nomes, esconde respostas secretas, grava placar.
- [ ] Dado: três faces dentro dos níveis ligados; cronômetro preparado.
- [ ] Massagem soma estrelas; vendado mostra a carta só para quem lê.
- [ ] "Hoje é dia de cumprir" lista o cofre; "Cumprimos" marca como feito e salva no álbum.
- [ ] Sala antiga abre no modo a distância, sem erro.
- [ ] Console do navegador sem erros.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-presencial.md` na raiz do repositório. Crie a branch `presencial` a partir da `main` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `025_presencial.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Aplique só o que existir no código hoje: partes que dependem de versões ainda não implementadas (Configurações, cofre, guias, v4 a v8) ficam preparadas e são ignoradas se o recurso não existir. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). Priorize as Fases 0, 1 e 3. No fim, rode o checklist, me conte o resultado e não faça merge na `main`.
