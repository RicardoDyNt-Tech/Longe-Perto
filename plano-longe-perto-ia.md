# Plano — Longe & Perto: sugestões e cartas criadas por IA

Complemento que entra **depois da v5** (usa os envelopes). Duas partes:

1. **Sugestões aleatórias** nos envelopes, sem IA: um desafio ou uma ideia de mensagem sorteados do banco.
2. **Ideias da IA:** gerar cartas novas (desafios, verdades, prendas, mensagens) com a **Mistral**, pelo "Novo envelope" e pelo "Adicionar carta".

---

## Por que Mistral

- A política do Google proíbe conteúdo sexual explícito nas APIs do Gemini, então o nível Pesado ficaria sempre bloqueado ou suavizado.
- A política de uso da Mistral não proíbe conteúdo adulto de forma geral. No tema sexual, veta só material de abuso infantil e imagens íntimas de pessoas reais sem consentimento. O jogo do casal (dois adultos, só texto) fica dentro disso.
- A política também não garante conteúdo adulto, e o modelo ainda pode suavizar respostas. Por isso o app trata recusa como um caso normal.
- A moderação da Mistral é um serviço separado e opcional. Este plano **não** usa o endpoint de moderação nem o `safe_prompt`. As regras de segurança do jogo ficam na instrução de sistema.

## Como a IA funciona sem expor a chave

O site é estático, então a chave da IA **não pode ficar no navegador**: qualquer um leria no código. O caminho é uma **Edge Function do Supabase**:

1. O app chama `supabase.functions.invoke('gerar-cartas', …)`.
2. A função, no servidor do Supabase, lê a chave da Mistral dos *secrets*, confere a sala e o limite diário, chama a Mistral e devolve as sugestões.
3. A chave nunca chega ao celular.

**Custo:** a Mistral cobra por uso (tokens), e cada geração de 3 cartas curtas custa muito pouco. Confira no console da Mistral se a conta tem camada gratuita ou crédito inicial. O limite diário por sala (padrão de 40 gerações) protege o gasto caso alguém descubra a sala.

**Privacidade:** a função manda para a Mistral só o tipo, o nível, o tema digitado e alguns exemplos de cartas **padrão** do jogo. **Nunca** manda nomes, respostas, cartas de vocês nem textos dos envelopes.

**Antes de implementar:** testar a instrução de sistema (Fase 2) no playground do console da Mistral, nos quatro níveis, para ver se as respostas saem no ponto que vocês querem. Se o Pesado vier fraco, ajustar a instrução antes de passar para o Claude Code.

---

## Fase 0 — SQL (já pronto)

O `011_ia_envelopes.sql` é fornecido pronto. O Claude Code coloca em `supabase/` sem editar, e o Ricardo roda no SQL Editor.

- Novo tipo de carta `ideia_mensagem`, com 23 ideias (Leve 8, Criativo 6, Picante 5, Pesado 4).
- Tabela `ia_uso` (sala, dia, quantidade), com RLS ligado e **nenhuma** policy: o app não lê nem escreve nela, só a Edge Function.
- Função `ia_registrar_uso(sala, dia)`, que soma 1 e devolve o total do dia. Ela é executável só pela service role.

## Fase 1 — Sugestões aleatórias nos envelopes (sem IA)

No `<dialog>` de "Novo envelope":

1. **Botão "🎲 Sugerir"**, ao lado do campo de texto.
   - **Desafio surpresa:** sorteia um `desafio` do nível escolhido no próprio dialog. Se a v5 estiver aplicada, usa o peso do baralho com memória. O texto vai para o campo e pode ser editado antes de salvar.
   - **Mensagem:** sorteia uma `ideia_mensagem` do nível escolhido (o dialog de mensagem ganha um select de nível, só para a sugestão, padrão Leve). A ideia aparece **acima** do campo, como inspiração: "💡 Ideia: Conte a lembrança nossa que você mais repassa na cabeça." O campo continua vazio para a pessoa escrever.
2. **Tocar de novo** sorteia outra, sem repetir as últimas 5.
3. **Nada é salvo** até tocar em "Salvar".

**Aceite:** "Sugerir" preenche o desafio com um texto do nível certo, editável; na mensagem, mostra uma ideia sem preencher o campo.

## Fase 2 — Edge Function `gerar-cartas`

Criar `supabase/functions/gerar-cartas/index.ts` (Deno). **O Ricardo faz o deploy**:
- pelo painel (Edge Functions → Deploy a new function → colar o código);
- ou pela CLI: `supabase functions deploy gerar-cartas`.

### Secrets (definidos pelo Ricardo no painel: Edge Functions → Secrets)

| Nome | Valor |
|---|---|
| `MISTRAL_API_KEY` | Chave criada em console.mistral.ai |
| `MISTRAL_MODEL` | Modelo atual indicado no console (ex.: o "small" ou "medium" mais recente) |
| `ALLOWED_ORIGIN` | `https://ricardodynt-tech.github.io` |
| `IA_LIMITE_DIA` | `40` |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem automaticamente nas Edge Functions.

### Entrada e saída

```json
// entrada
{ "sala": "ricaecarol-7k2p", "tipo": "desafio", "nivel": "picante", "tema": "praia", "quantidade": 3 }
// saída
{ "cartas": [ { "texto": "…", "midia": "foto" }, … ], "usadasHoje": 12, "limite": 40 }
// erros
{ "erro": "limite" }  |  { "erro": "recusado" }  |  { "erro": "sala" }  |  { "erro": "falha" }
```

### O que a função faz, em ordem

1. **CORS:** responde ao `OPTIONS` e só aceita a origem de `ALLOWED_ORIGIN`.
2. **Validação da entrada:**
   - `tipo` ∈ verdade, desafio, prenda, ideia_mensagem;
   - `nivel` ∈ os 4 níveis;
   - `tema` com até 60 caracteres e sem quebras de linha;
   - `quantidade` entre 1 e 5.
3. **Sala:** confere, com a service role, que `sala` existe em `salas`. Se não existir, devolve `{ erro: 'sala' }`.
4. **Limite:** ler `ia_uso.qtd` da sala no dia de hoje (fuso America/Bahia). Se já estiver em `IA_LIMITE_DIA`, devolver `{ erro: 'limite' }`. A soma de uso (`ia_registrar_uso`) só acontece depois de uma resposta válida (item 7).
5. **Exemplos para evitar repetição:** buscar até 15 textos de cartas **padrão** (`sala is null`) do mesmo tipo e nível, para mandar como "não repita estes". Não mandar cartas de vocês.
6. **Chamada à Mistral** em `POST https://api.mistral.ai/v1/chat/completions`, com o header `Authorization: Bearer MISTRAL_API_KEY` e:
   - `model`: `MISTRAL_MODEL`;
   - `messages`: `system` com a instrução abaixo e `user` com tipo, nível, tema (se houver), quantidade e a lista de exemplos;
   - `response_format: { "type": "json_object" }`, pedindo na instrução o formato `{ "cartas": [ { "texto": string, "midia": "foto" | "video" | "audio" | null } ] }`;
   - `temperature` em torno de 0.9 e `max_tokens` em torno de 600;
   - **sem** `safe_prompt` e sem chamar o endpoint de moderação;
   - timeout de 15 segundos.
7. **Tratar a resposta:**
   - Ler `choices[0].message.content` e fazer o parse do JSON.
   - Se o JSON for inválido, vier sem `cartas` ou vier uma recusa (texto sem cartas), fazer **uma** nova tentativa. Se falhar de novo, `{ erro: 'recusado' }`.
   - Erro HTTP da Mistral (429, 5xx) ou timeout vira `{ erro: 'falha' }`. Não contar no limite quando a Mistral falhar: fazer o `ia_registrar_uso` só depois de uma resposta válida, e a checagem do limite antes, com uma leitura simples de `ia_uso`.
   - Cortar cada texto em 280 caracteres, descartar os vazios e os repetidos, e descartar os que forem iguais a algum exemplo enviado.
8. **Resposta** com as cartas e o uso do dia. Não gravar nada em `cartas`: quem grava é o app, quando a pessoa escolhe salvar.

### Instrução de sistema (em PT-BR, dentro da função)

Testar no playground antes. É o único lugar onde ficam as regras de segurança, porque não há moderação externa.

> Você cria cartas para um jogo de verdade ou desafio de um casal adulto que namora a distância. Os dois jogam juntos em chamada de vídeo pelo WhatsApp, cada um na sua casa, e combinaram entre si os limites do jogo.
>
> Regras para toda carta:
> - Escreva em português do Brasil, com frases curtas e diretas, falando com quem vai cumprir ("você"). Quando for sobre a outra pessoa, use "eu/mim" (quem lê a carta).
> - A carta tem de ser possível de cumprir a distância: pela câmera, por mensagem, por áudio, ou por foto ou vídeo enviados pelo WhatsApp.
> - Nada envolvendo menores de idade, terceiros sem consentimento, exposição em público, violência, coerção, algo ilegal ou risco à saúde.
> - Nunca repita nem parafraseie de perto os exemplos fornecidos.
> - Se a carta pedir foto, vídeo ou áudio, preencha `midia` com `foto`, `video` ou `audio`; caso contrário, `null`.
> - Responda **somente** com JSON no formato `{ "cartas": [ { "texto": "…", "midia": null } ] }`, sem nenhum texto fora do JSON.
>
> Níveis:
> - **leve:** carinhoso e divertido, nada sexual.
> - **criativo:** imaginação, desenho, histórias, imitação, movimento.
> - **picante:** sensual e provocante, sem ser explícito.
> - **pesado:** ousado e sexual entre adultos que consentem: nudez, provocação, fantasias, posições, fotos e vídeos íntimos enviados em visualização única. Direto, sem ser gráfico demais.
>
> Tipos:
> - **verdade:** pergunta.
> - **desafio:** ação.
> - **prenda:** ação curta de penalidade.
> - **ideia_mensagem:** uma sugestão do que escrever numa mensagem para a outra pessoa.

A mensagem do usuário na chamada contém: tipo, nível, tema (se houver), quantidade e a lista de exemplos para não repetir.

**Aceite:**
- Uma chamada com `desafio/leve/praia` devolve 3 cartas curtas em PT-BR, cumpríveis a distância.
- A 41ª chamada do dia devolve `limite`.
- Uma sala inexistente devolve `sala`.
- Uma chamada vinda de outra origem é recusada.

## Fase 3 — "✨ Ideias da IA" no app

1. **Onde aparece:** botão "✨ Ideias da IA" no dialog "Novo envelope" (desafio surpresa e mensagem) e no dialog "Adicionar carta" (verdade, desafio, prenda).
2. **Painel:**
   - O nível (já escolhido no dialog) e o campo opcional "Tema", com até 60 caracteres (ex.: "praia", "cozinha", "nosso primeiro encontro").
   - Botão "Gerar", que chama `gerar-cartas` com `quantidade: 3`.
   - Carregando: "Pensando…", com o botão desativado.
3. **Resultado:** 3 cartões com o texto. Tocar em um coloca o texto no campo do dialog, editável, e marca `midia` se vier. Botão "Gerar outras".
4. **Uso do dia:** mostrar discretamente "12 de 40 hoje".
5. **Erros:**
   - `limite`: "A IA já trabalhou bastante hoje. Volte amanhã."
   - `recusado`: "A IA não conseguiu criar essa. Tente outro tema ou escreva a sua."
   - `sala` ou `falha`: "Não deu para gerar agora. Tente de novo."
   - Timeout de 20 segundos, com a mesma mensagem.
6. **Só quando salvar:** a carta escolhida vira uma **carta de vocês** (`cartas` com `sala` e `autor`), ou o texto do envelope, pelo fluxo normal de salvar. Nesta versão não há selo de "feita pela IA": a carta fica com a autoria de quem salvou, sem mudar a tabela.
7. **Só em sala fixa.** Em sala comum, o botão não aparece.

**Aceite:**
- Gerar, tocar numa opção, editar e salvar cria a carta de vocês normalmente.
- O envelope com texto da IA segue as regras normais de envelope.
- O limite do dia aparece e é respeitado.
- Com a função fora do ar, o resto do app funciona normalmente.

---

## Ordem de execução

1. Branch `ia` a partir da `main`, já com a v5.
2. **Fase 0:** colocar `011_ia_envelopes.sql` em `supabase/`. Commit: `sql ideias e ia`. **Parar para o Ricardo rodar.**
3. **Fase 1**, commit `sugestões nos envelopes`.
4. **Fase 2:** criar a função. Commit: `edge function gerar-cartas`. **Parar para o Ricardo criar os secrets e fazer o deploy**, e passar a ele os passos exatos.
5. **Fase 3**, commit `ideias da ia no app`.
6. Rodar o aceite de cada fase, reportar e **não fazer merge na `main`**.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-ia.md` na raiz do repositório. A IA é a Mistral (não o Gemini). Pré-requisito: a v5 já está na `main`. Crie a branch `ia` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `011_ia_envelopes.sql` em `supabase/` sem editar e pare para eu rodar. Na Fase 2, crie a Edge Function e pare para eu configurar os secrets e fazer o deploy, com os passos exatos. Nunca coloque chave de API no código do site nem no repositório. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, sem dependências novas no site). No fim, rode o aceite, me conte o resultado e não faça merge na `main`.
