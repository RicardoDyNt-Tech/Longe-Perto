-- Longe & Perto v5 — entre chamadas e progressão.
-- Rode ANTES do 009_seed_v5.sql. Pode rodar de novo.

-- 1) Novos tipos de carta: aposta, observacao, capsula
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cartas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.cartas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.cartas
  add constraint cartas_tipo_check check (tipo in (
    'verdade','desafio','prenda','efeito','duelo','sintonia','missao_dupla','missao_secreta',
    'aposta','observacao','capsula')),
  add constraint cartas_efeito_tem_rodadas check (tipo <> 'efeito' or rodadas is not null);

-- 2) Envelopes: mensagem fechada ou desafio surpresa para a próxima chamada
create table if not exists public.envelopes (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  tipo      text not null check (tipo in ('mensagem','desafio')),
  de        int  not null check (de in (0,1)),
  texto     text not null check (char_length(btrim(texto)) between 3 and 500),
  nivel     text check (nivel is null or nivel in ('leve','criativo','picante','pesado')),
  aberto_em timestamptz,
  criada_em timestamptz not null default now(),
  constraint envelope_desafio_tem_nivel check (tipo <> 'desafio' or nivel is not null)
);
create index if not exists envelopes_sala_idx on public.envelopes (sala, criada_em);

-- 3) Cápsulas do tempo: mesma pergunta respondida agora e de novo numa data futura
create table if not exists public.capsulas (
  id               uuid primary key default gen_random_uuid(),
  sala             text not null references public.salas(codigo) on delete cascade,
  pergunta         text not null check (char_length(btrim(pergunta)) between 3 and 280),
  abre_em          date not null,
  respostas        jsonb not null default '[null,null]'::jsonb,
  respostas_depois jsonb not null default '[null,null]'::jsonb,
  criada_em        timestamptz not null default now()
);
create index if not exists capsulas_sala_idx on public.capsulas (sala, abre_em);

-- 4) Apostas da semana
create table if not exists public.apostas (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  semana    date not null,                       -- segunda-feira da semana
  autor     int  not null check (autor in (0,1)), -- quem aposta
  pergunta  text not null,
  palpite   text not null check (char_length(btrim(palpite)) between 1 and 200),
  resposta  text check (resposta is null or char_length(resposta) <= 200),
  resultado text check (resultado is null or resultado in ('acertou','quase','errou')),
  criada_em timestamptz not null default now(),
  unique (sala, semana, autor, pergunta)
);

-- 5) Missões de observação cumpridas
create table if not exists public.observacoes (
  id            uuid primary key default gen_random_uuid(),
  sala          text not null references public.salas(codigo) on delete cascade,
  semana        date not null,
  jogador       int  not null check (jogador in (0,1)),
  missao        text not null,
  confirmada_em timestamptz not null default now(),
  unique (sala, semana, jogador)
);

-- 6) Álbum de momentos (só texto)
create table if not exists public.momentos (
  id          uuid primary key default gen_random_uuid(),
  sala        text not null references public.salas(codigo) on delete cascade,
  carta_texto text not null check (char_length(btrim(carta_texto)) between 3 and 500),
  carta_tipo  text,
  frase       text check (frase is null or char_length(frase) <= 200),
  autor       text not null,
  favorito    boolean not null default false,
  criada_em   timestamptz not null default now()
);
create index if not exists momentos_sala_idx on public.momentos (sala, criada_em desc);

-- 7) Baralho com memória
create table if not exists public.cartas_marcadas (
  sala      text not null references public.salas(codigo) on delete cascade,
  carta_id  uuid not null references public.cartas(id) on delete cascade,
  marca     text not null check (marca in ('favorita','aposentada','repetir')),
  criada_em timestamptz not null default now(),
  primary key (sala, carta_id, marca)
);

create table if not exists public.cartas_vistas (
  sala       text not null references public.salas(codigo) on delete cascade,
  carta_id   uuid not null references public.cartas(id) on delete cascade,
  vezes      int  not null default 1 check (vezes >= 0),
  ultima_vez timestamptz not null default now(),
  primary key (sala, carta_id)
);

-- 8) Conquistas desbloqueadas (as definições ficam no código do app)
create table if not exists public.conquistas (
  id              uuid primary key default gen_random_uuid(),
  sala            text not null references public.salas(codigo) on delete cascade,
  codigo          text not null check (codigo ~ '^[a-z0-9_]{2,40}$'),
  jogador         int  check (jogador is null or jogador in (0,1)), -- null = conquista do casal
  desbloqueada_em timestamptz not null default now()
);
create unique index if not exists conquistas_uniq on public.conquistas (sala, codigo, coalesce(jogador, -1));

-- 9) RLS: mesmo modelo das outras tabelas (sem login; quem tem o código da sala joga)
do $$
declare t text;
begin
  foreach t in array array['envelopes','capsulas','apostas','observacoes','momentos','cartas_marcadas','cartas_vistas','conquistas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "ler" on public.%I', t);
    execute format('create policy "ler" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "criar" on public.%I', t);
    execute format('create policy "criar" on public.%I for insert to anon, authenticated with check (exists (select 1 from public.salas s where s.codigo = sala))', t);
    execute format('drop policy if exists "alterar" on public.%I', t);
    execute format('create policy "alterar" on public.%I for update to anon, authenticated using (true) with check (true)', t);
    execute format('drop policy if exists "apagar" on public.%I', t);
    execute format('create policy "apagar" on public.%I for delete to anon, authenticated using (true)', t);
  end loop;
end $$;

-- 10) Realtime
do $$
declare t text;
begin
  foreach t in array array['envelopes','capsulas','apostas','observacoes','momentos','conquistas']
  loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Conferência
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('envelopes','capsulas','apostas','observacoes','momentos','cartas_marcadas','cartas_vistas','conquistas')
order by 1;
