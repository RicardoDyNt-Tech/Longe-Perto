# Plano — Longe & Perto v3

Plano para o Claude Code aplicar no repositório `RicardoDyNt-Tech/Longe-Perto`, depois que a v2 estiver testada e na `main`. São sete novidades, cada uma com o próprio commit:

1. App na tela inicial (PWA), com vibração quando chega a sua vez.
2. Cronômetro sincronizado nos desafios com tempo.
3. Nota do adversário: estrelas que valem pontos extras depois de cada desafio.
4. Sala fixa do casal, com nome próprio e histórico de partidas.
5. Cofre do reencontro, com contagem regressiva.
6. Desafio do dia para cumprir fora da chamada.
7. Trilha da rodada: uma música por giro, com link e player do Spotify.

## Pré-requisitos

- A v2 (`plano-longe-perto-v2.md`) está na `main` e o checklist dela passou.
- Criar a branch `v3` a partir da `main`.
- Continuam valendo todas as Regras para o Claude Code da v2:
  - Mudança mínima.
  - Não alterar `config.js`.
  - Não rodar SQL.
  - Texto do banco e de usuário só via `textContent`.
  - Valores padrão para salas antigas.
  - Sem dependências novas.
  - Mídia só pelo WhatsApp.

## Contexto rápido

- Site estático no GitHub Pages em `https://ricardodynt-tech.github.io/Longe-Perto/`. O caminho base é `/Longe-Perto/`, então use sempre caminhos relativos (`./`).
- O estado do jogo fica em `salas.estado` (jsonb) e sincroniza pelo Realtime com `gravar()` e `aplicar()`.
- As cartas ficam em `public.cartas`.
- A v2 já tem: `placar`, `meta`, `pulosMax`, `vencedor`, `aviso`, prendas, pulos livres e "Liberar da prenda".

---

## Fase 0 — SQL da v3 (uma única pausa)

Criar `supabase/004_v3.sql`, idempotente, com tudo o que a v3 precisa no banco. Depois de criar, parar e avisar o Ricardo para rodar no SQL Editor. As fases seguintes dependem dele.

### Nomes de sala

A constraint atual de `salas.codigo` só aceita 5 letras ou números. Trocar para aceitar também nomes de sala fixa:

```sql
alter table public.salas drop constraint if exists salas_codigo_check;
alter table public.salas add constraint salas_codigo_check
  check (codigo ~ '^([A-Z0-9]{5}|[a-z0-9]+(-[a-z0-9]+)*)$' and char_length(codigo) between 5 and 30);
```

(Confirmar o nome real da constraint com `\d public.salas`. Se for outro, ajustar o `drop`.)

### Tabela `partidas` (histórico)

```sql
create table if not exists public.partidas (
  id            uuid primary key default gen_random_uuid(),
  sala          text not null references public.salas(codigo) on delete cascade,
  jogadores     jsonb not null,  -- ["Ricardo","Caroline"]
  placar        jsonb not null,  -- cópia do estado.placar no fim
  vencedor      int  not null check (vencedor in (0,1)),
  meta          int  not null,
  finalizada_em timestamptz not null default now()
);
create index if not exists partidas_sala_idx on public.partidas (sala, finalizada_em desc);
```

### Tabela `cofre` (reencontro)

```sql
create table if not exists public.cofre (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  carta     text not null check (char_length(btrim(carta)) between 3 and 280),
  nota      text check (nota is null or char_length(nota) <= 500),
  autor     text not null check (char_length(btrim(autor)) between 1 and 20),
  feito     boolean not null default false,
  criada_em timestamptz not null default now()
);
create index if not exists cofre_sala_idx on public.cofre (sala, criada_em);
alter table public.cofre replica identity full;
```

### Tabela `musicas` (trilha da rodada)

```sql
create table if not exists public.musicas (
  id        uuid primary key default gen_random_uuid(),
  sala      text references public.salas(codigo) on delete cascade, -- null = música padrão
  nivel     text not null check (nivel in ('leve','criativo','picante','pesado')),
  titulo    text not null check (char_length(btrim(titulo)) between 1 and 120),
  artista   text not null check (char_length(btrim(artista)) between 1 and 120),
  url       text not null check (url ~ '^https://open\.spotify\.com/(intl-[a-z-]+/)?track/[A-Za-z0-9]+'),
  autor     text,
  ativa     boolean not null default true,
  criada_em timestamptz not null default now(),
  constraint musica_da_sala_tem_autor check (sala is null or autor is not null)
);
create index if not exists musicas_sala_idx on public.musicas (sala);
create unique index if not exists musicas_padrao_uniq on public.musicas (nivel, url) where sala is null;
alter table public.musicas replica identity full;
```

### RLS

Mesmo modelo de `cartas`. Todo mundo lê, e o usuário só mexe em linhas de sala.

- `partidas`: select liberado; insert só se a sala existir; sem update e sem delete.
- `cofre`: select liberado; insert se a sala existir; update e delete liberados (qualquer um dos dois marca como feito ou apaga).
- `musicas`: select liberado; insert só com `sala is not null` e a sala existindo; delete só com `sala is not null`.
- Limite por sala: trigger `before insert` de 300 linhas por sala em `cofre` e em `musicas`, igual ao de `cartas`.

### Realtime

Adicionar `cofre` e `musicas` à publicação `supabase_realtime`, com o bloco `do $$ … $$` do `schema.sql`.

---

## Fase 1 — App na tela inicial (PWA) e vibração

1. `manifest.webmanifest` com:
   - `name: "Longe & Perto"`, `short_name: "Longe&Perto"`.
   - `start_url: "./"`, `scope: "./"`, `display: "standalone"`.
   - `background_color` e `theme_color` iguais ao `--bg` do tema escuro (`#17132A`).
   - Ícones de 192 e 512 px em PNG, mais um `maskable`.
2. Ícones. Criar `icons/icon.svg` (coração 💞 sobre o fundo do tema) e gerar os PNGs com um script local (Python/Pillow ou Node) que não entra no site. Commitar só os PNGs e o SVG.
3. `sw.js` (service worker):
   - Cache dos arquivos do site (`index.html`, `style.css`, `app.js`, `config.js`, `manifest.webmanifest` e ícones), com estratégia stale-while-revalidate.
   - Nunca cachear chamadas ao Supabase nem ao CDN do supabase-js.
   - Versionar o nome do cache (`lp-v3-1`) e apagar caches antigos no `activate`.
4. No `index.html`: link do manifest, `<meta name="theme-color">` e o registro do service worker com caminho relativo.
5. Vibração. Quando a vez muda para mim, `navigator.vibrate?.(200)`. Quando o cronômetro termina (Fase 2), `navigator.vibrate?.([200,100,200])`. Não funciona no iPhone, e tudo bem.
6. Botão "Instalar app". Capturar `beforeinstallprompt` e mostrar o botão no lobby só quando o evento existir.

**Aceite:**

- No Chrome do Android aparece "Instalar app" / "Adicionar à tela inicial", e o app abre em tela cheia.
- Depois de publicar uma versão nova, recarregar pega o código novo (o cache não prende versão antiga).
- Vibra quando chega a sua vez.

---

## Fase 2 — Cronômetro sincronizado

1. Detectar tempo na carta pelo texto, no cliente:
   - `/(\d+)\s*segundos?/` vira segundos.
   - `/(\d+)\s*minutos?/` e "1 minuto" viram minutos × 60.
   - Se houver mais de um número, usar o primeiro.
2. Botão na carta. Se a carta tiver tempo detectado, mostrar "Iniciar 20s". Se não tiver, mostrar "Cronômetro", que abre as opções 15s, 30s, 60s e 2min.
3. Estado: `estado.timer = { id, segundos, inicio }`, com `inicio = Date.now()` de quem iniciou.
   - Qualquer um dos dois pode iniciar, pausar e cancelar.
   - Ao receber um `timer.id` novo, cada aparelho começa a própria contagem a partir do momento em que recebeu. Não comparar relógios; a diferença de rede fica abaixo de 1 segundo.
   - Quem entra no meio de uma contagem usa `inicio` como estimativa.
4. Tela. Número grande regressivo abaixo do texto da carta e uma barra de progresso.
   - Nos últimos 5 segundos, destaque visual.
   - No fim, "Tempo!", vibração e um bipe curto com Web Audio. O bipe só toca se o usuário já tiver tocado na página, por causa da política de autoplay.
5. Limpeza. O timer some quando a carta sai (cumpri, pular ou liberar).

**Aceite:**

- Iniciar em A mostra a contagem em B na hora, com diferença de no máximo 1 segundo.
- Cancelar em B para nos dois.
- Carta "Dance por 15 segundos…" oferece "Iniciar 15s".

---

## Fase 3 — Nota do adversário

1. Novo passo depois de "Cumpri" num desafio. A carta fica na tela no modo `avaliando`, com `estado.avaliacao = { cartaId, de: vez }`.
   - O adversário vê "Como foi?" com três botões: ★, ★★ e ★★★.
   - Quem cumpriu vê "Aguardando a nota de {nome}".
2. Pontos. Cada estrela vale +1 ponto, somado aos pontos da tabela da v2.
   - O placar ganha a linha "Estrelas" com o total recebido.
   - Depois da nota, a vez passa normalmente.
3. Só em desafios. Verdades e prendas não recebem nota.
4. Meta. A checagem de vitória acontece depois da nota, porque as estrelas contam.
5. Aviso nos dois aparelhos: "{nome} ganhou ★★ de {adversário}".
6. Configuração da partida. Um checkbox "Nota do adversário" (ligado por padrão), com a mesma regra da meta: só editável com o placar zerado. Desligado, o "Cumpri" funciona como na v2.

**Aceite:**

- Desafio cumprido em A: B vê as estrelas, e A vê "Aguardando".
- ★★★ soma 3 pontos além dos pontos do desafio.
- A meta é atingida corretamente quando as estrelas completam os pontos.

---

## Fase 4 — Sala fixa do casal e histórico

### Criar

1. No lobby, um terceiro caminho: "Criar sala fixa", com o campo "Nome da sala" (ex.: `ricaecarol`).
2. Sufixo automático. O app normaliza o nome (minúsculas, sem acento, espaço vira hífen) e acrescenta um sufixo aleatório de 4 caracteres: `ricaecarol-7k2p`.
   - Isso é segurança: com a chave anon, qualquer um que souber o nome da sala consegue ler o conteúdo dela. Um nome fácil de adivinhar exporia as cartas de vocês.
   - A tela explica em uma frase: "Guarde o link: o final aleatório protege a sala de vocês."
3. O estado da sala ganha `fixa: true`.

### Entrar

4. Entrar numa sala fixa funciona como hoje: pelo link ou digitando o nome completo com o sufixo.
5. Salas recentes. O app guarda em `localStorage` as salas já abertas neste aparelho e mostra no lobby, com um toque para entrar, sem precisar do link.

### Histórico

6. Registrar partida. Ao definir `vencedor`, inserir em `partidas` com `jogadores`, `placar`, `vencedor` e `meta`.
   - Só quem tem a vez no momento da vitória grava, para não duplicar.
   - Vale para sala fixa e para sala comum.
7. Aba "Histórico" na sala. Mostra vitórias de cada um, total de partidas e as últimas 10 partidas (data, placar e vencedor). Os totais são calculados no cliente a partir de `partidas`.

**Aceite:**

- Criar a sala fixa "Rica e Carol" gera `rica-e-carol-xxxx`.
- Fechar tudo e voltar pela lista de salas recentes: cartas de vocês, histórico e configurações continuam lá.
- Cada partida terminada aparece uma única vez no histórico.

---

## Fase 5 — Cofre do reencontro

1. Data do reencontro. Campo de data em `estado.reencontro` (formato `AAAA-MM-DD`).
   - No topo da sala: "Faltam 23 dias para o reencontro 💞". No dia: "É hoje!". Depois da data, pergunta se querem marcar uma nova.
2. Guardar uma carta. Botão "Guardar para o reencontro" em qualquer carta na tela.
   - Abre um `<dialog>` com a carta e um campo opcional "Resposta / combinado" (até 500 caracteres) para anotar o que foi prometido.
   - Salva em `cofre`.
3. Aba "Cofre" na sala, com a lista em ordem de criação: carta, nota, autor e data.
   - Checkbox "Feito ✓", que grava `feito` e risca o item.
   - Botão "Apagar", com confirmação.
   - Filtro: Todos / Pendentes / Feitos.
4. Realtime em `cofre` com `filter: sala=eq.CODIGO`, para os dois verem na hora.
5. Funciona em qualquer sala, mas faz mais sentido na fixa. Na sala comum, mostrar a dica "Use uma sala fixa para o cofre durar."

**Aceite:**

- Guardar em A aparece no cofre de B.
- Marcar feito em B risca em A.
- A contagem regressiva mostra os dias certos para a data escolhida.

---

## Fase 6 — Desafio do dia

1. Só em sala fixa. No topo da sala aparece o cartão "Desafio do dia de {meu nome}".
2. Sorteio determinístico, sem banco.
   - Semente = `codigo da sala + data de hoje (fuso America/Bahia) + índice do jogador`.
   - Usar um hash simples (ex.: FNV-1a) para escolher um desafio entre as cartas do nível do dia.
   - Os dois aparelhos veem os mesmos desafios do dia sem gravar nada.
   - Cada um tem o seu desafio, e vê também o do outro.
3. Nível do dia. Configuração da sala `estado.nivelDiario`, padrão `leve`, com as opções Leve, Criativo, Picante e Pesado. Editável a qualquer momento.
4. Ações no cartão:
   - "Mandar no WhatsApp": abre `wa.me` com o texto.
   - "Cumpri hoje": grava em `estado.diario[data][eu] = true`.
5. Sequência. Mostrar "🔥 N dias seguidos" para cada um, contando os dias consecutivos até hoje (ou até ontem, se hoje ainda não cumpriu). Guardar só os últimos 60 dias em `estado.diario`.
6. Sem interferir na partida. O desafio do dia não mexe no placar da partida.

**Aceite:**

- Os dois aparelhos mostram os mesmos desafios do dia.
- Amanhã os desafios mudam sozinhos.
- "Cumpri hoje" aumenta a sequência.
- Pular um dia zera a sequência.

---

## Fase 7 — Trilha da rodada (Spotify)

Sem login e sem API do Spotify. Só links e o player embutido.

1. Músicas. Vêm de `public.musicas`: as padrão (`sala null`) mais as da sala. Carregar ao abrir a sala, junto com as cartas.
   - As padrão começam vazias. Não inventar músicas nem IDs de faixa: o Ricardo cadastra as dele pelo app ou pelo Table Editor.
2. Sorteio. A cada giro (e em "Escolher verdade/desafio"), sortear uma música do nível da carta e gravar em `estado.musica = { titulo, artista, url }`.
   - Sem música naquele nível: usar qualquer nível mais baixo.
   - Sem nenhuma música: esconder o cartão.
3. Cartão "Trilha da rodada" abaixo da carta:
   - Título e artista.
   - Botão "Abrir no Spotify" (link com `target="_blank"`).
   - Botão "Tocar aqui", que carrega sob demanda um iframe `https://open.spotify.com/embed/track/{id}` (altura de 80 px). Nunca carregar o iframe automaticamente.
   - Botão "Outra música", que sorteia outra e grava no estado.
4. Adicionar música. Botão "Adicionar música" (na mesma área de "Adicionar carta") com os campos link do Spotify, título, artista e nível.
   - Validar o link com a mesma regex da tabela.
   - Extrair o ID da faixa, ignorando `?si=` e o prefixo `intl-xx/`.
5. Lista "Músicas de vocês" recolhível, com botão de apagar, igual às cartas de vocês.
6. Encaixe com os desafios. Quando o texto da carta tiver "música que eu escolher", o cartão da trilha ganha o título "Sugestão para este desafio".

**Aceite:**

- Adicionar uma música em A, girar em B: a música pode aparecer, com o mesmo título nos dois.
- "Abrir no Spotify" abre o app ou o site no celular.
- "Tocar aqui" mostra o player sem quebrar o layout no celular.

---

## Ordem de execução

1. Branch `v3` a partir da `main`.
2. Fase 0: criar `supabase/004_v3.sql`. Commit: `sql v3`. Parar e avisar o Ricardo para rodar.
3. Fase 1, commit `pwa e vibração`.
4. Fase 2, commit `cronômetro sincronizado`.
5. Fase 3, commit `nota do adversário`.
6. Fase 4, commit `sala fixa e histórico`.
7. Fase 5, commit `cofre do reencontro`.
8. Fase 6, commit `desafio do dia`.
9. Fase 7, commit `trilha da rodada spotify`.
10. Rodar o checklist, reportar o resultado e não fazer merge na `main`.

## Checklist de testes

Usar dois aparelhos: o celular Android e o computador (ou uma janela anônima).

- [ ] Tudo do checklist da v2 continua passando.
- [ ] Instalar como app no Android; abre em tela cheia; vibra na sua vez.
- [ ] Publicar uma mudança pequena: o app instalado pega a versão nova depois de recarregar.
- [ ] Cronômetro: iniciar em A conta em B; cancelar em B para nos dois; no fim, vibra e mostra "Tempo!".
- [ ] Nota: desafio cumprido pede estrelas ao adversário; ★★★ soma 3; a meta conta as estrelas.
- [ ] Sala fixa: nome normalizado com sufixo; aparece em "Salas recentes"; o histórico registra cada partida uma vez.
- [ ] Cofre: guardar, marcar feito e apagar, sincronizado; contagem regressiva certa.
- [ ] Desafio do dia: o mesmo nos dois aparelhos; a sequência sobe com "Cumpri hoje".
- [ ] Trilha: música cadastrada aparece nos dois; link e player funcionam no celular; sem músicas, o cartão não aparece.
- [ ] Salas antigas (v1 e v2) abrem sem erro.
- [ ] Console do navegador sem erros.

## Fora do escopo

- Login e contas.
- Controle do player do Spotify ou sincronizar a música tocando nos dois (exigiria login no Spotify e Premium).
- Notificações push fora do app.
- Senha na sala. Com a chave anon, uma senha só no cliente não protege nada de verdade; a proteção fica no sufixo aleatório. Proteção real exigiria funções RPC no Supabase e fica para uma próxima versão.

## Prompt para colar no Claude Code

> Leia `plano-longe-perto-v3.md` na raiz do repositório. Pré-requisito: a v2 já está na `main`. Crie a branch `v3` e siga a "Ordem de execução", com um commit por fase. Na Fase 0, crie o SQL e pare para eu rodar no Supabase antes de continuar. Siga as regras da v2 (mudança mínima, não alterar `config.js`, não rodar SQL, texto só via `textContent`, padrão para salas antigas, sem dependências novas). Não invente músicas nem IDs do Spotify. No fim, rode o checklist, me conte o que passou e o que não passou, e não faça merge na `main`.
