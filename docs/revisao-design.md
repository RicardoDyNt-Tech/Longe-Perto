# Revisão de design — Longe & Perto

## Contexto

O Longe & Perto é um verdade ou desafio com roleta para um casal jogar a distância, no Android (APK com Capacitor) e no navegador do celular. O app cresceu em nove versões e ganhou muitos recursos, mas a camada visual foi feita aos poucos, sem um sistema por baixo. Esta revisão diagnostica o design atual, propõe uma direção visual e ordena as mudanças por impacto. **Não muda nada** da sincronização da sala pelo Supabase nem da Edge Function `gerar-cartas`.

Base da revisão: leitura de `style.css` (1051 linhas), `index.html` e das partes de interface do `app.js`. Usei três referências:
- **redesign-existing-projects:** auditoria por área.
- **design-taste-frontend:** o `lint.mjs` rodou e deu 190 FAIL e 5 WARN.
- **web-design-guidelines:** as regras da Vercel.

O `inspect.mjs` (que tira screenshots) ainda não rodou, porque grava arquivos no projeto. Ele entra na verificação.

### Ajustes aprovados (15/10/2026)
- O trabalho acontece na branch `redesign`, criada a partir da `main`.
- **Antes da Fase 2:** verificar se algum código depende da posição dos elementos que vão para o diálogo (`closest`, `parentElement`, seletores por hierarquia) e reportar antes de mover.
- **Vibração por fatia:** só no último segundo da desaceleração da roleta.
- **A Fase 6 (diálogos, carregamento e erro) fica por último,** depois da Fase 7. Antes de começar, listar os 31 pontos de `confirm`/`alert`/`prompt`.
- **Screenshots:** feitas com um script que monta os estados da tela só via DOM, sem criar salas no Supabase.

> As regras "da casa" do taste-skill (sem emoji, sem sombra, sem gradiente) foram feitas para sites de marketing. Num jogo afetivo, apliquei o espírito delas, não a letra. Os pontos onde me afastei estão marcados.

---

## 1. Diagnóstico

### 1.1 Hierarquia (o problema mais grave)
- **A roleta fica abaixo da dobra.** Na tela Jogo, antes da roda aparecem, nesta ordem (`index.html:54-124`):
  - o h1 "Longe & Perto";
  - a barra da sala;
  - a linha de modo, celular único e chamada;
  - a linha de ajustes: som, posições, encerrar a noite, dono e seletor de câmera;
  - o bloco do reencontro, com contador, formulário e botão "Juntos";
  - o convite, a presença, o aviso de sala sem dono e os erros.

  Num celular de 360×740, a roda só aparece depois de rolar a tela. O momento principal do jogo disputa espaço com configurações.
- **O h1 do app se repete dentro da sala** e gasta cerca de 60px que não informam nada.
- **A carta, que é o clímax, é pequena.** O texto tem 1.25rem dentro de uma caixa branca com borda colorida (`style.css:82-89`). Ela tem o mesmo peso visual de qualquer outro bloco.
- **Abaixo da carta vem uma pilha de cinco `<details>` iguais:** histórico, cofre, músicas, rodadas e cartas. Mais o placar. Fica tudo com cara de formulário.
- **A barra fixa de ações acumula até 11 botões possíveis** (`index.html:1084-1127`). Ela tem `max-height:52vh`, então pode cobrir metade da tela.

### 1.2 Tipografia
- A Bricolage Grotesque é uma boa escolha, tem personalidade e combina com o tom do jogo. **Fica.**
- **São 79 usos de `font-weight:700`, mas só os pesos 400, 600 e 800 são carregados** (`index.html:14`). O navegador cai para 600 ou 800, e a hierarquia que se pretendia fica imprevisível.
- **Há cerca de 20 tamanhos de fonte diferentes**, de .65rem a 2.4rem, com passos de .02rem. Não existe escala.
- **Os rótulos da roleta têm 11 unidades** num viewBox de 200 (`app.js:105-119`). Na roda de 340px isso dá cerca de 19px, mas em telas pequenas encolhe.
- **Texto pequeno demais:**
  - `.ch-col span` com .65rem;
  - `.selo-novo` com .65rem;
  - `.nav-in` com .74rem;
  - `.carinho-botoes` com .72rem.

  Abaixo de 12px é ilegível no celular.
- **Restam tags em maiúsculas com espaçamento** (`.selo`, `.trilha-titulo`) e monospace no código do dono (`style.css:553-554`).

### 1.3 Cores
- **O sistema de tokens é bom.** Tem modo escuro e o modo presencial troca a paleta inteira (`style.css:1-13, 799-805`). É a base certa.
- **Há cores fora dos tokens, sem papel definido:**
  - `#e0457b`: 8 usos (pote, mapa, mãos, marco);
  - `#1FAF55`, `#2e9d5b` e `#1DB954`: três verdes diferentes;
  - `#e9b949` e `#e0a800`;
  - os fundos `#FFF8E7`, `#fffaf0`, `#0b1026` e `#0d0b14`.

  São quatro acentos competindo: violeta, rosa-vermelho, amarelo e esse rosa extra.
- **Contraste reprovado (WCAG AA):**
  - **O anel de foco amarelo `--lamp` (#FFC23D) sobre o fundo claro #FBF3F6 dá cerca de 1.6:1.** No tema claro o foco fica quase invisível.
  - O `.selo` em `--lamp` sobre branco dá cerca de 1.6:1.
  - O verde de status `.presenca.on`, `.manual-salvo` e `.humor-salvo` (#1FAF55) sobre o fundo claro dá cerca de 2.7:1.
- **O `theme-color` é fixo**, então a barra do Android não acompanha o modo presencial nem as telas cheias (noite, companhia).

### 1.4 Espaçamento e forma
- **O espaçamento é ad hoc:** 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24px, sem escala.
- **São nove raios de borda diferentes:** 6, 8, 10, 12, 14, 16, 18, 20 e 99.
- **Quase todo bloco é uma "caixa com borda de 1.5px"** (`.casa-bloco`, `.perfil-bloco`, `.hist-*`, `.extras`, `.trilha`…). Isso nivela tudo e não comunica nada. É caixa dentro de caixa.
- **Bug: `.contador` está definido duas vezes** (`style.css:318` e `:851`). Os contadores de caracteres dos diálogos (`index.html:1368, 1499, 1728`) herdam o flex centralizado do contador do reencontro.

### 1.5 Roleta
- **Funciona bem:**
  - é um SVG com tokens;
  - o easing de 3.2s é convincente;
  - tem um tique sonoro por fatia (`tiquesDaRoleta`, `app.js:6595`);
  - respeita `prefers-reduced-motion`.
- **O que falta:**
  - **Personalidade.** São oito fatias alternando duas cores chapadas, com a ponteira em triângulo CSS e um emoji 💞 no centro. É uma roda genérica.
  - **Antecipação e chegada.** A roda não "puxa" antes de girar, a ponteira não balança quando passa pelos pinos e a fatia sorteada não é destacada quando para.
  - **Transição para a carta.** A carta surge do nada e o `scrollIntoView` faz a página pular (`app.js:6638-6647`). A roda e a carta parecem duas coisas separadas.
  - **Tique no toque.** No Android só há vibração em eventos e cartas pesadas. Um pulso curto (cerca de 8ms) por fatia, junto com o som, daria peso físico ao giro.
  - **Espera do outro lado.** Quando é a vez do parceiro, quem espera vê só a roda parada e um texto. Falta um estado "Fulano está girando…" que mostre que a sala está viva.

### 1.6 Feedback de interação
- **Só o `.primary` tem estado pressionado** (`style.css:44`). `.secondary`, chips, abas, nav, `.casa-card`, `.votos` e `.estrelas` não respondem ao toque.
- **Não há `-webkit-tap-highlight-color` definido.** O Android pinta o retângulo azul ou cinza padrão.
- **Não há `transition` nos botões.** Os estados trocam no seco.
- **Alvos de toque menores que 44–48px:**
  - `.linkbtn` (padding 4px 0, cerca de 30px), que é o "Sair da sala" e o "Encerrar a noite";
  - `.direct` ("Escolher verdade/desafio", padding 6px);
  - `.marcas` (⭐🔁🚫, cerca de 28px);
  - `.estrela`;
  - `.cor-op` (34px) e `.mural-cor` (30px);
  - `.nav-recolher` (34px);
  - `.som`.
- **Os diálogos nativos quebram o clima:** 29 `confirm()`, 1 `alert()` e 1 `prompt()` (`app.js:144, 658, 3009, 3327, 5648, 8334…`). No Android Chrome eles aparecem como "este site diz…", com o visual do sistema.

### 1.7 Acessibilidade
- **Já está bom:**
  - `<dialog>` nativo (24);
  - `role="alert"` nos erros;
  - `aria-pressed` e `aria-current` na nav;
  - `:focus-visible`;
  - `lang="pt-BR"`;
  - nenhum `style=` inline;
  - `prefers-reduced-motion` em quase todas as animações.
- **O que falha:**
  - O foco fica invisível no tema claro (1.3).
  - **Emojis como ícone, 176 no HTML.** O TalkBack lê "pino redondo, A distância", "casa, Início". Eles não têm `aria-hidden` e o desenho muda conforme o fabricante (Samsung ou Google).
  - **24 regiões `aria-live`.** A `.stage` inteira é `aria-live="polite"` e a carta também, então a mesma rodada é anunciada mais de uma vez.
  - Faltam animações com fallback de reduced motion: `.maos-coracao.juntos`, `.mapa-linha`, `.noite-estrelas`, `.juntos-anim`, `.carinho-anim` e `.motivo-papel`.
  - Há `transition:all` (`style.css:477`) e `ease-in` em saídas (`:430`, `:865`).
  - O zoom está desligado no APK (`nativo.js`, commit 9250b39). Por isso texto abaixo de 14px vira um problema real.

### 1.8 Estados de carregamento e erro
- **Carregamento:**
  - só textos soltos: "Carregando…" (5 lugares) e "Pensando…" no `gerar-cartas` (`app.js:8671`);
  - nenhum skeleton nem `aria-busy`;
  - os 20s de timeout da IA passam com uma linha de texto parada.
- **Erros:**
  - aparecem como texto vermelho num `<p class="erro">`, o que é bom porque fica inline e com `role=alert`;
  - não oferecem ação ("Tentar de novo");
  - usam o mesmo estilo para erro de rede e de validação.
- **Estados vazios:** existem em texto ("Nada guardado ainda…"), mas sem nenhum desenho. São os momentos em que um app de casal mais pode encantar.
- **Conexão:** não há um indicador claro de "conexão caiu, reconectando…". A presença (`#presenca`) só diz se o outro está on.

---

## 2. Direção visual proposta: "Dois lados da mesma mesa"

**A ideia, a partir do próprio jogo:** os dois celulares são dois lados de uma mesa de jogo. A roleta é o objeto que os dois compartilham e a carta é o que um entrega ao outro. Na frase do taste-skill: *neste app, **a carta que um passa ao outro** vira **o objeto físico central**: grande, colorida, com frente e verso*. A distância aparece pelo que acontece entre os dois: a roda que o outro gira, a carta que chega, o "Fulano está girando…".

- **Tom:** afetivo e brincalhão, como um jogo de tabuleiro de casal, não um app de produtividade. É noite, sofá e luz baixa.

### Paleta
Mantém a estrutura de tokens e corta para estes papéis:

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| `--bg` fundo | rosa-papel #FBF3F6 (atual) | ameixa-noite #17132A (atual) | fundo |
| `--surface` | um degrau de tom, sem borda | #221C3B | blocos |
| `--ink` | #2A1F3D | #F3EEFF | texto em tinta cheia |
| `--verdade` | violeta (atual) | (atual) | **naipe** da carta e fatia |
| `--desafio` | coral-vermelho (atual) | (atual) | **naipe** da carta e fatia |
| `--acao` (ex-`--lamp`) | amarelo-vela #FFC23D | #FFD166 | **só** no botão principal e na ponteira |
| `--amor` (novo) | #E0457B | — | absorve os 8 `#e0457b` soltos: carinhos, mãos, pote |
| `--ok` (novo) | verde com ≥4.5:1 | — | substitui os três verdes |
| `--foco` (novo) | tinta #2A1F3D com halo | amarelo | anel de foco com contraste |

Verdade e desafio deixam de ser "acentos" e passam a ser **naipes**, como copas e espadas. O amarelo vira a cor única de ação.

### Tipografia
- **Uma família só, a Bricolage.**
- **Carregar o eixo variável** (`wght@400..800`), para que o peso 700 exista de verdade.
- **Seis tamanhos:**

  | Uso | Tamanho |
  |---|---|
  | Display (texto da carta e resultado) | `clamp(1.6rem, 6vw, 2.1rem)` |
  | Título | 1.35rem |
  | Destaque | 1.1rem |
  | Corpo | 1rem (17px) |
  | Apoio | .875rem |
  | Mínimo | .8rem, nada abaixo de 13px |

- **Display com tracking de -0.02em, opsz alto e `text-wrap:balance`.**

### Forma
- **Espaçamento:** escala 4 / 8 / 12 / 16 / 24 / 32 / 48.
- **Raios:** três apenas: 10 (controles), 20 (blocos), 999 (pílulas e chips).
- **Blocos:** separados por degrau de tom, não por borda. Sombra só no que flutua: barra fixa, diálogos e a carta durante o "voo".

### Os dois momentos-assinatura
1. **A roleta:**
   - aro com pinos;
   - ponteira em SVG que balança a cada pino;
   - hub com a marca do app no lugar do emoji;
   - rótulos maiores;
   - "puxada" de 120ms antes do giro;
   - a fatia sorteada acende quando a roda para;
   - vibração curta por fatia no Android.
2. **A carta:**
   - é uma carta de verdade, com o campo inteiro na cor do naipe e o texto em display;
   - sai da roda, sobe e vira (flip em Y, 450ms, só com transform e opacity), sem `scrollIntoView` brusco;
   - com reduced motion, só aparece com fade.

### Iconografia
- **Controles e navegação:** um sprite SVG inline de traço único, no estilo Phosphor, para nav, som, sair, câmera, etc.
- **Emoji continua no conteúdo expressivo** (carinhos, humor, reações, conquistas), onde ele é a linguagem do casal. *(Desvio consciente da regra "sem emoji" do taste-skill.)*

---

## 3. Plano de mudanças, em ordem de impacto

Todas as mudanças são em `style.css` e `index.html`. As poucas que tocam o `app.js` mexem só em apresentação. Não tocam em nada de Supabase, canais, `gerar-cartas` nem regras do jogo.

### Fase 1 — Fundação (baixo risco, alto alcance)
1. **Tokens.** Criar a escala de espaço, raio e tipo como custom properties em `:root`. Colocar `--acao`, `--amor`, `--ok` e `--foco` e trocar as cores hardcoded por tokens (`#e0457b`, os três verdes, `#e9b949` e `#e0a800`). Aplicar também em `body[data-modo="presencial"]` e no modo escuro.
2. **Fonte variável.** Trocar o link em `index.html:14` para `wght@400..800`.
3. **Contraste:**
   - novo anel de foco (`--foco`);
   - `.selo` com tinta;
   - verde de status acessível.
4. **Correções pontuais:**
   - separar `.contador` (caracteres) de `.contador-reencontro`;
   - trocar `transition:all` por propriedades nomeadas;
   - trocar `ease-in` por ease-out;
   - adicionar reduced motion nas seis animações que faltam.
5. **Tamanho mínimo de texto:** nada abaixo de .8rem (13px).

### Fase 2 — Hierarquia da tela Jogo (maior ganho de experiência)
Pré-requisito: reportar dependências de posição no DOM (`closest`, `parentElement`, seletores por hierarquia) dos elementos que vão para o diálogo.
6. **Tirar o h1 de dentro da sala.** Ele fica só no lobby.
7. **Cabeçalho compacto de uma linha:** sala, presença do parceiro e um botão "⋯" (ícone SVG). O botão abre um `<dialog>` em forma de folha de baixo, com:
   - som;
   - câmera do WhatsApp;
   - modo;
   - "jogar num celular só";
   - chamada;
   - posições;
   - encerrar a noite;
   - entrar como dono;
   - sair da sala.

   Os elementos e os IDs continuam os mesmos, só mudam de lugar. Os listeners do `app.js` continuam funcionando.
8. **Reencontro na tela Jogo:** fica só o `contador-mini` de uma linha. O bloco completo já vive no Início.
9. **Meta:** a roda inteira visível sem rolar a tela em 360×740.
10. **Barra de ações:**
    - Cumpri e Pular fortes, lado a lado;
    - ações secundárias da carta (reverso, deixar para o reencontro, silêncio) numa linha de pílulas menores;
    - limite de 40vh.

### Fase 3 — Roleta e carta (o coração afetivo)
11. **Roleta.** Ajustar o SVG em `desenharRoleta()` (`app.js:105`), só a parte de desenho:
    - aro;
    - pinos;
    - rótulos maiores;
    - hub com a marca.

    A ponteira passa a ser SVG, com uma classe de "balanço" acionada no mesmo ponto em que `tiquesDaRoleta` toca o som. Vibração de 8ms por fatia **só no último segundo da desaceleração**, respeitando o botão de som.
12. **Chegada da roda:** uma classe `.vencedora` na fatia sorteada, com pulso de brilho de 400ms. A antecipação é uma rotação de -6° com duração de 120ms antes do giro, só em CSS.
13. **Carta:**
    - o campo inteiro na cor do naipe;
    - `.kind` como rótulo da carta;
    - `.text` em tamanho display.

    Variações:
    - prenda e evento com borda dourada;
    - reversa com textura de verso;
    - secreta mantém o blur.

    A entrada é um flip com transform e opacity. O `scrollIntoView` passa a ser suave, posicionando a carta acima da barra fixa.
14. **Estado de espera:** quando é a vez do outro, mostrar "Carol está girando…" com a roda num leve "respiro". O texto vem do estado que já existe e não exige nova sincronização.

### Fase 4 — Feedback de toque e alvos
15. **Estados globais:**
    - `-webkit-tap-highlight-color:transparent`;
    - `:active` com scale(.97) ou translateY(1px) em todos os botões, chips, cards e nav;
    - `transition` de 150–200ms em `transform`, `background-color` e `border-color`.
16. **Alvos de no mínimo 44px** (com área de toque estendida via padding ou `::after` quando o visual precisa ser pequeno): `.linkbtn`, `.direct`, `.marcas`, `.estrela`, `.cor-op`, `.mural-cor`, `.nav-recolher` e `.som`.

### Fase 5 — Ícones e leitura de tela
17. **Sprite SVG** com cerca de 15 ícones (`<symbol>` no topo do `index.html`) para nav, cabeçalho, som e marcas. O emoji continua no conteúdo, envolvido em `<span aria-hidden="true">` quando for decorativo.
18. **Regiões `aria-live`:**
    - tirar o `aria-live` da `.stage`;
    - deixar um único anúncio por rodada ("Verdade para Rica: …").

### Fase 6 — Diálogos, carregamento e erro (executada por último, depois da Fase 7)
Antes de começar, listar os 31 pontos de `confirm`/`alert`/`prompt` para aprovação.
19. **Substituir `confirm()`, `alert()` e `prompt()`** por um helper `perguntar({titulo, texto, ok, cancelar})` que devolve uma Promise, sobre um `<dialog>` estilizado.
    - **Risco médio:** são 31 pontos de chamada síncronos (`if(!confirm()) return`). Cada handler precisa virar `async`.
    - **Como fazer:** um por um e em commits separados, testando cada fluxo.
20. **Carregamento e erro:**
    - skeleton da carta (o formato da carta com shimmer suave) enquanto a IA pensa;
    - mensagens que progridem: "Pensando…", depois de 8s "Quase lá…";
    - `aria-busy`.
    - Os erros de rede ganham um botão "Tentar de novo", que só chama de novo a mesma função que já existe.
21. **Indicador de conexão:** um ponto ao lado da presença ("Reconectando…"), lendo o estado que a reconexão automática do commit eaeae9d já mantém.
22. **Estados vazios:** um ícone grande e uma frase calorosa no cofre, nas músicas, nas cartas de vocês e no histórico.

### Fase 7 — Acabamento
23. **Blocos sem borda:** trocar a borda de 1.5px dos `.casa-bloco`, `.perfil-bloco` e `.extras` por degrau de tom.
24. **`theme-color` dinâmico** no modo presencial e nas telas cheias (noite e companhia), com uma linha no ponto em que o modo já é trocado.
25. **Desvios conscientes do lint:** o céu estrelado da noite e a luz da companhia mantêm o gradiente, porque são cenas e não ornamentos. Eles levam um comentário `taste-skill-ignore`.

---

## Arquivos

- `style.css`: quase tudo.
- `index.html`:
  - link da fonte;
  - sprite;
  - reorganização do cabeçalho do Jogo, sem renomear IDs;
  - `aria-hidden` nos emojis.
- `app.js`, só apresentação:
  - `desenharRoleta` (105-119);
  - `tiquesDaRoleta` (6595), para o balanço e a vibração;
  - `revelarCarta` (6638);
  - os 31 `confirm`/`alert`/`prompt`;
  - os textos "Carregando…" e "Pensando…".
- **Novo arquivo** `docs/revisao-design.md`: este documento.

**Não serão tocados:**
- `config.js`;
- `supabase/`;
- as funções de canal/realtime;
- `gerarIdeias` (só o texto de status em volta);
- as regras de pontuação.

## Verificação
1. **Antes de começar e depois de cada fase:**
   - subir um servidor local;
   - rodar `inspect.mjs` em 390px;
   - fazer screenshots em 360×740, claro e escuro, distância e presencial;
   - comparar com as capturas de antes;
   - rodar `lint.mjs` para ver os FAIL caírem.
2. **Dois navegadores na mesma sala:** criar, entrar, girar, cumprir, pular, carta da IA e fim de partida. Confirmar que a sincronização não mudou.
3. **Android:** testar no Chrome real e no APK.
   - Alvos de toque.
   - Vibração por fatia.
   - Barra de status.
   - Roda visível sem rolar.
4. **TalkBack:** uma rodada completa ouvindo, sem emojis lidos em controles e com um único anúncio por carta.
5. **Reduced motion ativado** no sistema: tudo aparece, nada viaja.
6. **Revisar o diff** e confirmar que nenhuma linha tocou Supabase nem `gerar-cartas`.

## Entrega
Ao aprovar, o primeiro passo é salvar este documento em `docs/revisao-design.md`, que é o único arquivo criado nesse momento. Depois aplico as fases uma a uma, com um commit por fase, e mostro as screenshots de antes e depois a cada fase.

---

## Execução (15/10/2026)

As Fases 2 a 7 foram aplicadas em seguida e a Fase 6 ficou por último, a pedido. Tudo está na branch `redesign`.

### Checagem de dependências antes da Fase 2
Os elementos que foram para a folha "Opções da sala" (`#dlgSala`) mantêm os mesmos IDs. Encontrei três dependências de posição, e as três continuam atendidas:
- `app.js` `desenharEntradaConfig()` faz `document.querySelector(".ajustes")` e `menu.insertBefore(bm, $("som").nextSibling)`. Por isso `#som` continua filho direto de `.ajustes`, e o botão "Configurações" entra logo depois dele, dentro da folha.
- `app.js` `desenharAjustes()` faz `$("camera").closest("label")`. O `<select>` continua dentro do seu `<label>`.
- `style.css`: as margens da câmera do WhatsApp (`body.cam-direita .topbar/.ajustes`) foram reapontadas para o topo novo (`.sala-topo`, `.juntos-cab` e o resumo de "Níveis e regras").

Nenhum código usa `parentElement` nem seletores por hierarquia nesses elementos. `#presenca`, `#chamadaRelogio` e `#contadorMini` mudaram de lugar, mas o app só chega neles por ID.

### Os 31 diálogos nativos (Fase 6)
Todos agora usam `perguntar()` ou `avisar()`, com um `<dialog id="dlgPergunta">`. O botão de confirmar leva o verbo da pergunta e fica vermelho quando a ação apaga algo.

- **Trocar modo:** `trocarModo`.
- **Cardápio secreto:** `enviarCardapio`.
- **Apagar algo:**
  - chamada: `apagarChamada`;
  - cofre: `apagarCofre`;
  - música: `apagarMusica`;
  - envelope: `apagarEnvelope`;
  - momento do álbum: `apagarMomento`;
  - marco: `apagarMarco`;
  - motivo do pote: `apagarMotivo`;
  - carta "abra quando": `apagarAbra`;
  - carta de vocês: `apagarCarta`;
  - desenho do mural: `apagarMural`, mais o `alert` de falha, que virou `avisar()`.
- **Mural:** `limparMural`.
- **Dengo:** `cancelarDengo` (botões "Cancelar pedido" e "Manter") e `restaurarPedidos`.
- **Posições:** `referenciaPosicao`. Era o único `prompt`; agora é um campo de link dentro do diálogo.
- **Baralho:** `marcarCarta`, ao aposentar.
- **Abra quando:** `abrirAbra` ("Abrir agora").
- **Noite:** `encerrarNoite`.
- **Dono:** `gerarNovoCodigo` e "Mostrar código de dono".
- **Cartas em etapas:** `pararSequencia`.
- **Roteiro:** `sairRoteiro`.
- **Campanha:**
  - `jogarNoite`;
  - `recomecarCampanha`;
  - `sairCampanha`;
  - `quebreiRegra` ("Quebrei").
- **Enredo:** `sairEnredo`.
- **Cláusulas:** `vetarClausula`.
- **Morte súbita:** `desistirMorteSubita`.

São 29 `confirm`, 1 `alert` e 1 `prompt`. O `pedidoInstalar.prompt()` é a API de instalar o app e continua como estava. Todos os 31 ficam dentro de handlers de clique. Onze funções passaram a ser `async`; as outras já eram.

### Desvios conscientes do lint do taste-skill
- **Emoji:** continua no conteúdo e no texto dos botões, como linguagem do casal. Foi marcado com `aria-hidden`, então o leitor de tela lê só o texto. A navegação, as opções da sala, o som e as marcas da carta passaram a usar ícones SVG.
- **Sombras:** ficam no botão principal (o "degrau") e nos elementos que flutuam (barra fixa, diálogos, convite do mural).
- **Gradientes:** ficam nas cenas da noite e da companhia e no papel quadriculado do mural.
- **Monospace:** fica no código de dono, que é um código de verdade e se lê caractere a caractere.
