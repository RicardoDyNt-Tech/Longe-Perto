# Plano — Longe & Perto: tempo em chamada

Registra quanto tempo vocês passam em chamada e transforma isso em números, recordes e conquistas.

O WhatsApp é fechado: nem o site nem o app conseguem "ver" uma chamada dele. Por isso a captura combina três jeitos:
1. **Presença na sala** (automático): os dois com a sala aberta ao mesmo tempo.
2. **Botão "Em chamada agora 📞"** (um toque).
3. **"+ Registrar chamada passada"** (para os dias só de WhatsApp).

No APK, entram mais dois jeitos (ver o fim do plano).

**Funciona igual no site e no app**, na mesma sala, ao mesmo tempo.

Pode entrar sobre a versão que estiver na `main`. Partes que dependem de versões ainda não implementadas (conquistas da v5, Casa do Casal, histórico, Configurações) ficam preparadas e são ignoradas se o recurso não existir.

---

## Regras para o Claude Code

Valem as **Regras da v2**:
- mudança mínima;
- não alterar `config.js`;
- não rodar SQL;
- texto do banco e de usuário só via `textContent`;
- valores padrão para salas antigas;
- sem dependências novas.

E mais esta: **toda escrita em `chamadas` passa pelos RPCs** (a tabela não aceita insert/update direto).

---

## Fase 0 — SQL (já pronto)

O `028_chamadas.sql` é fornecido pronto e foi testado num Postgres local: roda duas vezes sem erro. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda no SQL Editor.

- **Tabela `chamadas`:**
  - campos: sala, início, fim, último sinal, tolerância, origem (`presenca`, `botao`, `manual`, `app`, `android`), `fechada_auto`, `humor_final`;
  - `duracao_minutos` é calculada sozinha;
  - **no máximo uma chamada aberta por sala**;
  - está no Realtime.
- **RPCs:**

| RPC | Para quê |
|---|---|
| `chamada_sinal(sala, origem)` | Abre a sessão ou estende a aberta. Os dois celulares podem chamar ao mesmo tempo sem duplicar. Tolerância: presença 5 min, botão 6 h, app 2 min. |
| `chamada_encerrar(sala)` | "Encerrar" agora. |
| `chamada_humor(sala, id, humor)` | "Como foi a call?" (`romantica`, `intensa`, `risadas`, `sono`). |
| `chamada_ajustar(sala, id, minutos)` | Corrigir a duração (ex.: a sessão que fechou sozinha). |
| `chamada_registrar(sala, inicio, minutos)` | Chamada passada: até 60 dias atrás, até 12 h, recusa se sobrepor outra. |
| `chamada_apagar(sala, id)` | Apagar um registro. |
| `chamadas_resumo(sala)` | Estatísticas prontas em JSON: total de minutos e chamadas, recorde, semana, mês, período favorito, humor favorito, dias seguidos, maratona da madrugada e a sessão aberta. |

- **Sessão esquecida:** quem para de mandar sinal tem a sessão fechada no último sinal, com `fechada_auto = true`. Sessões automáticas de menos de 2 min são descartadas (abriu a sala e fechou).

---

## Fase 1 — Captura

### 1. Detecção por presença (zero esforço)
- Usa o **Presence** da sala, que já existe.
- Enquanto **os dois** estiverem online na sala, cada aparelho chama `chamada_sinal(sala, 'presenca')` **a cada 60 s**. Os dois chamarem não tem problema: o banco mantém uma sessão só.
- Quando um sai, os sinais param. Passados 5 min sem sinal (tolerância para o 4G oscilar), a sessão fecha sozinha no último sinal.
- Aba oculta: o navegador pode atrasar o `setInterval`; tudo bem, a tolerância cobre. Ao voltar (`visibilitychange`), manda um sinal na hora.
- **Configuração (dono), se as Configurações existirem:** `chamadas: { presenca: true }`. Desligado, só valem o botão e o registro manual.

### 2. Botão "Em chamada agora 📞"
- **Onde:** um interruptor pequeno no topo da sala, ao lado do botão de modo (se existir).
- **Ligar:** `chamada_sinal(sala, 'botao')`. O cronômetro aparece nos **dois** aparelhos pelo Realtime da tabela: "📞 1h 12min 30s", contado a partir de `inicio` (recalculado de `Date.now()` a cada segundo, sem acumular erro).
- Se a presença já tinha aberto a sessão, o botão **assume a mesma sessão** (não cria outra) e aumenta a tolerância para 6 h.
- Enquanto ligado, qualquer toque no app manda sinal (no máximo um por minuto).
- **"Encerrar":** `chamada_encerrar(sala)` e abre o "Como foi a call?".
- **Esqueceram ligado:** depois de 6 h sem nenhum sinal, fecha sozinha. Na próxima vez que alguém abrir o app aparece: "A chamada de ontem ficou aberta. Quanto durou?", com campo de horas e minutos (`chamada_ajustar`) ou "Está certo".

### 3. "+ Registrar chamada passada"
- Botão discreto no card de chamadas.
- Formulário: **dia** (hoje, ontem, outro), **começou por volta de** (hora) e **duração** (atalhos 30 min, 1 h, 2 h, 3 h ou campo livre). Grava com `chamada_registrar`.
- Hora sempre no fuso −03:00 (como o contador do reencontro).
- Se sobrepor outra: "Já tem uma chamada registrada nesse horário" e mostra qual.
- O histórico permite **ajustar** ou **apagar** qualquer registro, com confirmação.

**Aceite:**
- Os dois com a sala aberta por 10 min geram **uma** sessão de ~10 min.
- Um fecha o app: 5 min depois a sessão está fechada no horário certo.
- O botão mostra o mesmo cronômetro nos dois aparelhos.
- O registro passado sobreposto é recusado.

---

## Fase 2 — "Como foi a call?"

- Ao encerrar pelo botão, ou ao abrir o app depois de uma sessão automática de 15 min ou mais ainda sem humor, aparece por **alguns segundos** um cartão com 4 emojis:
  - 🥰 Romântica
  - 🥵 Intensa
  - 😂 Risadas
  - 😴 Caímos no sono
- Toque grava com `chamada_humor`. Sem toque, some sozinho em 5 s, sem gravar.
- Aparece para quem estiver com o app aberto; se os dois votarem diferente, vale o último.
- O emoji fica ao lado da chamada no histórico.

---

## Fase 3 — O que mostrar

Card **"📞 Nossas chamadas"** na Casa (ou no Início, se a Casa não existir), com o detalhe numa tela própria. Tudo vem do `chamadas_resumo(sala)`, recarregado ao abrir e a cada mudança na tabela.

1. **Contador principal:**
   - "**324 horas conectados**";
   - subtítulo "ou 13 dias e meio sem parar";
   - "**87 chamadas**".
2. **Recordes e médias:**
   - **Chamada mais longa:** "Recorde: 5h 42min · madrugada de sáb, 9 de out".
   - **Esta semana:** "Média de 1h 40min por dia" (`semana_minutos / 7`).
   - **Horário favorito:** madrugada, manhã, tarde ou noite (o período com mais minutos).
   - **Vibe mais comum:** o emoji mais votado.
   - **Dias seguidos com chamada:** "🔥 6 dias seguidos".
3. **Gráfico simples:** barras dos últimos 14 dias (minutos por dia), em CSS puro, sem biblioteca.
4. **Histórico:** lista das chamadas (data, horário, duração, origem com ícone, emoji), com ajustar e apagar.
5. **Equivalência bem-humorada** no rodapé:
   - "Essas 324 horas dariam **54 viagens** entre as nossas cidades";
   - usa o campo novo **"Tempo de viagem entre nós"** (horas e minutos, padrão vazio = esconde a frase), em `estado.viagemMin`. Quem pode mudar: os mesmos do contador do reencontro;
   - frases que se alternam a cada abertura, com o mesmo total:
     - "… viagens entre as nossas cidades";
     - "… filmes de 2 horas";
     - "… vezes a trilogia do Senhor dos Anéis estendida (11h 26min)";
     - "… voltas da Terra pela ISS (92 min)".

**Aceite:**
- Os números batem com a soma das chamadas.
- O recorde mostra a data certa no fuso −03:00.
- Sem "tempo de viagem", a frase da viagem não aparece.

---

## Fase 4 — Marcos e conquistas

Usa a tabela `conquistas` da v5 (definições no código, como as outras). Se não existir, esta fase só mostra os selos no card, sem gravar.

| Código | Selo | Quando |
|---|---|---|
| `call_10h` | 📞 Primeiras 10 horas | 10 h somadas |
| `call_100h` | 🛡️ Resistência à Distância | 100 h somadas |
| `call_500h` | 🏆 Meio milhar | 500 h somadas |
| `call_maratona` | 🌙 Maratona da Madrugada | uma chamada de 3 h ou mais que atravessa a meia-noite ou começa antes das 3h (`maratona_madrugada`) |
| `call_semana` | 📅 Semana Perfeita | 7 dias seguidos com chamada (`sequencia_dias >= 7`) |
| `call_mes` | 💯 Mês Perfeito | 30 dias seguidos |
| `call_recorde` | ⏱️ Novo recorde | sempre que bater o recorde (mostra o aviso, não grava selo repetido) |

- Ao desbloquear: aviso na tela dos dois ("🛡️ Resistência à Distância desbloqueada: 100 horas juntos na tela"), com vibração curta.
- No APK, o mesmo aviso chega por push se o app estiver fechado (canal `carinhos`).

---

## Fase 5 — No APK (quando o plano do APK estiver implementado)

Itens que só funcionam no app Android; o site ignora.

1. **Chamada dentro do app** (Fase 7 do APK): enquanto a chamada WebRTC estiver conectada, manda `chamada_sinal(sala, 'app')` a cada 60 s. Registro exato, sem botão.
2. **Detecção de chamada do WhatsApp (experimental, desligada por padrão):**
   - O Android informa quando o celular está **em modo de comunicação** (`AudioManager.MODE_IN_COMMUNICATION`), que é o que o WhatsApp liga durante qualquer chamada de voz ou vídeo.
   - Ligado nos **dois** celulares: cada um avisa a sala ("estou em chamada") e, se os dois estiverem em chamada ao mesmo tempo, conta como chamada de vocês (`chamada_sinal(sala, 'android')`).
   - Limites, que vão em "📱 Este aparelho":
     - pode contar uma ligação com outra pessoa que coincidir no horário;
     - para funcionar com o app fechado, o Android exige um serviço com notificação fixa ("Longe & Perto contando a chamada"); sem isso, só conta com o app aberto ou recente.
3. **Widget "📞 Horas juntos"** (junto dos widgets do APK): total de horas e dias seguidos.
4. **Retrospectiva:** os números entram no "Wrapped" da v9.

---

## Estado — resumo dos campos novos

```js
viagemMin: null   // tempo de viagem entre vocês, em minutos (frase de equivalência)
```

O resto fica na tabela `chamadas`, fora do `estado`.

---

## Ordem de execução

1. Branch `chamadas` a partir da `main`.
2. **Fase 0:** colocar `028_chamadas.sql` em `supabase/` sem editar. Commit `sql chamadas`. **Parar para o Ricardo rodar.**
3. **Fase 1**, commit `captura de chamadas`.
4. **Fase 2**, commit `como foi a call`.
5. **Fase 3**, commit `estatísticas de chamadas`.
6. **Fase 4**, commit `marcos de chamadas`.
7. Fase 5 fica para o branch do APK.
8. Rodar o checklist, reportar e **não fazer merge na `main`**.

## Checklist de testes

- [ ] Site num celular e app (ou outro navegador) no outro: a presença abre **uma** sessão só.
- [ ] Fechar um lado: a sessão fecha 5 min depois, no último sinal.
- [ ] Botão: cronômetro igual nos dois; "Encerrar" abre o "Como foi a call?".
- [ ] Sessão esquecida: na volta, pergunta quanto durou e ajusta.
- [ ] Registro passado: grava, recusa sobreposição, aparece no histórico; ajustar e apagar funcionam.
- [ ] Card: total, recorde, média, período, dias seguidos e equivalência corretos.
- [ ] Conquistas desbloqueiam uma vez só.
- [ ] Sala antiga sem chamadas: card com "Nenhuma chamada ainda", sem erro.
- [ ] Console do navegador sem erros.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-chamadas.md` na raiz do repositório. Crie a branch `chamadas` a partir da `main` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `028_chamadas.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Toda escrita em `chamadas` passa pelos RPCs do SQL. Aplique só o que existir no código hoje: partes que dependem de versões ainda não implementadas (Casa, conquistas, Configurações) ficam preparadas e são ignoradas se o recurso não existir. A Fase 5 fica para o branch do APK. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). No fim, rode o checklist, me conte o resultado e não faça merge na `main`.
