# Plano — Longe & Perto: Configurações da sala (controladas pelo dono)

Plano para o Claude Code aplicar **depois da versão mais recente que estiver na `main`** (v6, guia de posições, guia de poses e IA, conforme o que já tiver entrado). Onde um recurso ainda não existir no código, a regra dele fica pronta e é aplicada quando o recurso chegar.

**Objetivo:** o **dono da sala** decide o que existe na sala. O que estiver desligado **não aparece**: some botão, chip, aba e filtro, e a carta nunca é sorteada. Por padrão, tudo que é mais ousado vem **desligado** e, quando ligado, começa no **nível mais leve**.

---

## 1. Quem é o dono

- **Sala nova:** quem cria a sala é o dono.
- **Sala antiga** (como a `ricaecarol-icrq`): não tem dono ainda. Enquanto não tiver, a tela de Configurações mostra o botão **"Assumir como dono desta sala"** para quem abrir. O primeiro que tocar vira o dono. **Ricardo deve fazer isso primeiro, no próprio celular.**
- **Um dono por sala.**
- **Só o dono vê as configurações.** Para quem não é dono, a tela de Configurações **não existe**: não há aba, botão, menu nem aviso sobre o que está ligado ou desligado. A pessoa só percebe o efeito (o que aparece ou não no jogo).
- **As únicas portas de entrada para quem não é dono:**
  - enquanto a sala não tiver dono, o cartão "Assumir como dono desta sala" na Casa (seção 5, item 5);
  - depois disso, uma opção discreta no menu da sala, **"👑 Entrar como dono"**, que abre só o campo do código de dono. Ela não mostra nenhuma configuração; com o código certo, o aparelho vira dono e só então a aba aparece.

### Como funciona sem login

1. **Token do dono.** Ao criar ou assumir a sala, o aparelho gera um **token aleatório** de 24 caracteres com `crypto.getRandomValues`, grava em `localStorage` (`lp-dono-{codigo}`) e chama `sala_reivindicar`. O banco guarda só o **hash** do token, numa tabela que o app não consegue ler.
2. **Mudanças só pela função.** A config fica na tabela `salas_config`. Todo mundo lê, mas **ninguém escreve direto**: a única forma de mudar é a função `sala_config_salvar`, que confere o token.
3. **Por isso ela fica fora do `estado`.** Se a config ficasse no `estado` da sala, qualquer jogada sobrescreveria as configurações.
4. **É bem mais forte que um controle só na tela.** Mesmo quem mexer pela API não consegue mudar a config sem o token.

### Código de recuperação

5. **Mostrar uma vez.** Logo depois de criar ou assumir a sala, o app mostra o token como **"Código de dono"**, em blocos de 4 caracteres (`K7QX-M2PA-…`), com o botão "Copiar" e o aviso: "Guarde este código. Sem ele, se você trocar de celular ou limpar o navegador, perde o controle das configurações."
6. **Entrar como dono em outro aparelho:** pela opção **"👑 Entrar como dono"** do menu da sala (fora das Configurações, que não aparecem para quem ainda não é dono). O app confere com `sala_sou_dono` e, se estiver certo, grava o token no `localStorage` do aparelho novo.
7. **Gerar código novo:** "Gerar novo código" chama `sala_dono_trocar`. O código antigo para de funcionar.
8. **Passar a dona para o outro jogador:** fica fora do escopo. Por enquanto, basta mandar o código para a outra pessoa, e ela passa a poder mudar também.

---

## 2. Fase 0 — SQL (já pronto)

O `019_config.sql` é fornecido pronto. O Claude Code coloca em `supabase/` e **não edita**. O Ricardo roda no SQL Editor.

| Objeto | Para que serve |
|---|---|
| `salas_config` | Config da sala (`config` jsonb) e `dono` (0 ou 1). Leitura liberada, escrita só por função. Com Realtime. A leitura precisa ficar liberada porque o app dos dois aplica as regras; "não visualizar" é na interface, e o conteúdo da config não é secreto. |
| `salas_dono` | Hash do token do dono. Sem nenhuma policy: o app não lê. |
| `sala_reivindicar(sala, token, jogador, config)` | Define o dono se a sala ainda não tiver um. Devolve `true` ou `false`. |
| `sala_sou_dono(sala, token)` | Confere o token. |
| `sala_config_salvar(sala, token, config)` | Salva a config inteira. Só o dono. |
| `sala_dono_trocar(sala, token_atual, token_novo)` | Gera um novo código de dono. |
| `sala_dono_indice(sala, token, jogador)` | Muda qual jogador aparece como dono. |

Chamadas pelo app: `supabase.rpc('sala_config_salvar', { p_sala, p_token, p_config })`, e assim por diante.

---

## 3. A configuração e os padrões

Guardada em `salas_config.config`. **Sala sem linha em `salas_config`, ou com campo ausente, usa exatamente estes padrões:**

```js
{
  versao: 1,

  // Níveis que EXISTEM na sala (desligado = não aparece em lugar nenhum)
  niveis: { romantico: true, leve: true, criativo: true, picante: false, pesado: false },
  // Quem pode ligar/desligar os chips de nível durante a partida (dentro dos níveis que existem)
  chipsQuemMuda: 'todos',            // 'todos' | 'dono'

  // Cartas que pedem foto, vídeo ou áudio (campo midia)
  midia: { ativo: false },

  posicoes: { ativo: false, nivelMax: 'picante', climas: ['romantica'], dificuldadeMax: 'facil' },
  poses:    { ativo: false, nivelMax: 'leve', video: false },
  ia:       { ativo: false, nivelMax: 'leve', poses: false },

  eventos:       { ativo: false, nivelMax: 'leve', tipos: { efeito: true, duelo: true, sintonia: true, missao_dupla: true } },
  missaoSecreta: { ativo: false, nivelMax: 'leve' },
  reverso:       { ativo: true },

  trilha:        { ativo: true, nivelMax: 'leve' },
  desafioDoDia:  { ativo: true, nivelMax: 'leve' },
  semana:        { ativo: true, nivelMax: 'leve' },      // apostas e missão de observação (v5)
  envelopes:     { ativo: true, desafioNivelMax: 'leve' },
  cartasDeVoces: { ativo: true, nivelMax: 'leve' },

  conquistasOusadia: { ativo: false }
}
```

### Regras de nível

- **Ordem dos níveis:** `romantico < leve < criativo < picante < pesado`.
- **Nível máximo da sala:** o nível mais alto entre os que estão `true` em `niveis`.
- **Nível efetivo de um modo:** o menor entre o `nivelMax` do modo e o nível máximo da sala. Exemplo: com Pesado desligado na sala, `poses.nivelMax = 'pesado'` vale como Picante.
- **Ao ligar um modo:** quando o dono muda `ativo` de `false` para `true`, o app grava junto o `nivelMax` **mais baixo** que aquele modo aceita:
  - `leve` para poses, IA, eventos, missão secreta, trilha, dia, semana, envelopes e cartas de vocês;
  - `picante` para posições, que só têm Picante e Pesado.

  O dono sobe o nível depois, se quiser.
- **Ao ligar um nível da sala** (por exemplo, Picante): ele passa a existir, mas **nenhum chip de partida é ligado sozinho**.
- **Posições:**
  - `climas` padrão `['romantica']`;
  - `dificuldadeMax` padrão `'facil'`;
  - ao ligar, voltam a esses valores se estiverem vazios.

### Chips da partida

- **Os chips de nível mostram só os níveis que existem na sala.**
- **"Nova partida" e sala nova** começam com **só o chip mais leve disponível ligado**: Leve (ou Romântico, se o Leve estiver desligado).
- Com `chipsQuemMuda = 'dono'`, só o dono liga e desliga os chips. Com `'todos'`, os dois, como hoje.

---

## 4. O que cada configuração esconde

"Desligado" quer dizer: **não aparece** na tela e **nunca é sorteado**. Uma carta que já estiver na tela quando a config mudar fica até ser resolvida.

| Config desligada | O que some |
|---|---|
| Um nível em `niveis` | O chip do nível. As cartas desse nível no sorteio, nas prendas (a prenda cai para o nível permitido mais alto), no desafio surpresa e em "Sugerir". A opção no "Adicionar carta", no "Novo envelope", nos filtros e na IA. A prenda final, que usa o nível mais alto permitido. |
| `midia` | Cartas com `midia` preenchido (de qualquer tipo) nunca saem no sorteio. Some também a opção "Pede foto, vídeo ou áudio" do "Adicionar carta". |
| `posicoes` | O botão "📖 Posições" nas cartas, a aba na Casa e o "Montar cardápio". Com o modo ligado, o guia mostra só as posições dentro de `climas`, `dificuldadeMax` e do nível efetivo. |
| `poses` | O botão "📸 Ideias de pose" e a aba na Casa. Com o modo ligado: poses até o nível efetivo; com `video: false`, só fotos. |
| `ia` | Todos os botões "✨ Ideias da IA": cartas, envelopes e, com `ia.poses`, também poses. O nível pedido à IA nunca passa do nível efetivo da IA. |
| `eventos` | Nenhum evento especial sai no sorteio, e some a configuração de frequência de eventos da partida. Com o modo ligado: só os tipos marcados em `tipos`, até o nível efetivo. |
| `missaoSecreta` | Nenhuma missão secreta é sorteada, e some o botão "🤫 Minha missão". |
| `reverso` | O botão "🔄 Reverso" e a linha no placar. |
| `trilha` | O cartão "Trilha da rodada", o "Nossa playlist" e o "Só as nossas". Com o modo ligado: músicas até o nível efetivo (romântico usa o leve). |
| `desafioDoDia` | O cartão do desafio do dia e a sequência. Com o modo ligado: o seletor de nível do dia só oferece até o nível efetivo. |
| `semana` | Apostas e missão de observação. Com o modo ligado: o nível da semana só até o nível efetivo. |
| `envelopes` | A aba e o botão "Novo envelope". Com o modo ligado: desafio surpresa até `desafioNivelMax`. Mensagens e "Abra quando…" não mudam. |
| `cartasDeVoces` | O "Adicionar carta" e a lista "Cartas de vocês". As cartas de vocês **também param de ser sorteadas** e não são apagadas. Com o modo ligado: o nível no "Adicionar carta" só até o nível efetivo, e as cartas de vocês acima dele não saem. |
| `conquistasOusadia` | A seção Ousadia das conquistas e os títulos dessa seção. Substitui o interruptor da v5, que sai do `estado`. |

**Os recursos românticos da v6 não têm interruptor:** pensei em você, mãos juntas, mapa, linha do tempo, pote, "Abra quando…", pergunta do dia, encerramento da noite. São sempre visíveis, como pedido.

---

## 5. Fase 1 — Dono e config no app

1. **Carregar** `salas_config` ao abrir a sala e mesclar com os **padrões** da seção 3, campo a campo, com um merge profundo em que o padrão preenche o que faltar. Guardar em `config`.
2. **Realtime** em `salas_config` com `filter: sala=eq.CODIGO`, que recarrega `config` e redesenha tudo.
3. **Dono local:** `souDono = await rpc('sala_sou_dono', { p_sala, p_token: localStorage['lp-dono-'+codigo] })`. Guardar em memória e refazer ao abrir a sala.
4. **Criar sala:** logo depois de criar, gerar o token, chamar `sala_reivindicar` com `p_config` = os padrões e `p_jogador = 0`, e mostrar o código de dono (seção 1, item 5).
5. **Sala sem dono:** se `salas_config` não tiver linha, **usar os padrões** e mostrar, na Casa e no menu da sala, um cartão "Esta sala ainda não tem dono" com o botão "Assumir como dono desta sala". O cartão some para os dois assim que alguém assumir.
   - Ao tocar: gerar o token e chamar `sala_reivindicar` com `p_config` = os padrões e `p_jogador = eu`.
   - Se voltar `false`, alguém chegou antes: "Esta sala já tem dono".
6. **Uma função central**, `permitido(recurso, nivel?)`, que responde tudo pela seção 4. Todos os pontos do app passam por ela: renderização, sorteio, filtros, IA. **Não espalhar `if` soltos.**
7. **Sorteio:** o filtro de `config` entra **antes** de todos os outros filtros (níveis ativos, usados, peso do baralho). Com isso, uma carta proibida nunca sai, nem por "Jogar de novo" nem por desafio surpresa.

## 6. Fase 2 — Tela de Configurações

1. **Onde fica:** aba "⚙️ Configurações" na Casa do casal e no menu da sala (também em sala comum). **Só é criada no DOM quando `souDono` for verdadeiro.** Se o aparelho deixar de ser dono (por exemplo, depois de "Gerar novo código" em outro aparelho), a aba some na hora.
2. **Topo:** "Você é o dono desta sala 👑", com os botões "Mostrar código de dono" (pede confirmação), "Gerar novo código" e "Passar o 👑 para {outro}" (chama `sala_dono_indice`; o código continua com quem tem).
3. **Seções**, cada item com um interruptor e, quando ligado, os controles internos:
   - **Níveis da sala:** 5 interruptores (Romântico, Leve, Criativo, Picante, Pesado), com a regra de que pelo menos um fica ligado. Mais o "Quem muda os níveis na partida: Os dois / Só o dono".
   - **Conteúdo:** Cartas com foto, vídeo e áudio. Conquistas de ousadia.
   - **Modos de jogo:** Eventos especiais (nível máximo e tipos). Missão secreta (nível máximo). Reverso.
   - **Guias:** Posições (nível máximo Picante ou Pesado, climas com checkboxes, dificuldade máxima). Poses (nível máximo e "incluir vídeos").
   - **IA:** ativar, nível máximo e "Ideias de pose pela IA".
   - **Entre chamadas:** Trilha, Desafio do dia, Semana, Envelopes e Cartas de vocês, cada um com o seu nível máximo.
4. **Seletores de nível** mostram só os níveis que existem na sala. Se o dono desligar um nível da sala, os `nivelMax` acima dele continuam gravados, mas passam a valer como o nível permitido mais alto (regra do nível efetivo).
5. **Salvar:** cada mudança chama `sala_config_salvar` com a config inteira, com um intervalo de 500 ms para juntar toques seguidos. Mostrar "Salvo ✓" ou o erro.
6. **Sem permissão:** não se aplica. Quem não é dono não tem a tela. Qualquer outro lugar do app que hoje mostra uma configuração (por exemplo, o seletor de frequência de eventos na partida ou o seletor de nível do desafio do dia) também **só aparece para o dono**; o outro vê só o resultado.
7. **Aviso** no topo da seção de níveis quando Picante ou Pesado estiverem desligados: "Níveis mais ousados estão desligados nesta sala". Esse aviso só existe dentro da tela do dono; nada disso aparece para o outro.

## 7. Fase 3 — Aplicar em todo o app

Passar `permitido()` por todos os pontos da seção 4, recurso por recurso, e revisar:

- chips de nível e "Nova partida" (começa só com o chip mais leve disponível);
- sorteio de carta, de evento, de prenda (incluindo prendas fofas e prenda final), de desafio surpresa, de desafio do dia, de apostas e de observação;
- "Sugerir", "Adicionar carta", "Novo envelope" e o painel da IA (níveis oferecidos e nível enviado à função);
- botões e abas de posições, poses, trilha, playlist, missão secreta, reverso e conquistas;
- **Edge Function `gerar-cartas`:** fica como está. O app é que nunca pede um nível acima do permitido.

---

## 8. Sala atual (`ricaecarol-icrq`)

Depois do deploy, a sala **ainda não tem dono** e passa a usar os padrões: **Picante, Pesado, mídia, posições, poses, IA e eventos somem até alguém assumir e ligar.** Para voltar ao jogo de antes:

1. Ricardo abre a sala no celular dele, vai em Configurações e toca em **"Assumir como dono desta sala"**.
2. Guarda o código de dono.
3. Liga o que quiser, começando pelos níveis Picante e Pesado e depois os modos.

---

## Aceite

- Sala nova: só Romântico, Leve e Criativo aparecem, e nenhum botão de posições, poses ou IA.
- Quem não é dono **não vê** a aba de Configurações nem nenhum aviso sobre configuração; vê só "👑 Entrar como dono" no menu.
- Digitar o código certo em "👑 Entrar como dono" faz a aba aparecer; código errado mostra "Código inválido" e nada mais.
- Tentar salvar pelo console do navegador sem o token dá erro, e a config não muda.
- Ligar "Poses" já grava o nível máximo `leve`. Ligar "Posições" grava `picante`, clima `romantica` e dificuldade `facil`.
- Com Pesado desligado, nenhuma carta Pesada sai: nem no sorteio, nem como prenda, nem como desafio surpresa, nem pela IA.
- Com `midia` desligado, nenhuma carta com foto, vídeo ou áudio sai.
- "Nova partida" começa só com o chip mais leve.
- Mudar a config no aparelho do dono atualiza o outro em até 2 segundos.
- O código de dono funciona em outro aparelho, e "Gerar novo código" invalida o antigo.
- Sala sem dono mostra "Assumir como dono", e só o primeiro consegue.
- Console do navegador sem erros.

## Ordem de execução

1. Branch `config` a partir da `main`.
2. **Fase 0:** colocar `019_config.sql` em `supabase/`. Commit: `sql config e dono`. **Parar para o Ricardo rodar.**
3. **Fase 1**, commit `dono e config`.
4. **Fase 2**, commit `tela de configurações`.
5. **Fase 3**, commit `aplicar configurações no app`.
6. Rodar o aceite, reportar e **não fazer merge na `main`**. Lembrar o Ricardo da seção 8 antes do merge.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-config.md` na raiz do repositório. Crie a branch `config` a partir da `main` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, coloque `019_config.sql` em `supabase/` sem editar e pare para eu rodar no Supabase. Centralize todas as regras numa função `permitido()` e aplique em todos os pontos listados na seção 4, inclusive nos recursos que já existem de versões anteriores. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, sem dependências novas). Nunca grave o token do dono em lugar nenhum além do `localStorage` do aparelho. No fim, rode o aceite, me conte o resultado, me lembre da seção 8 e não faça merge na `main`.
