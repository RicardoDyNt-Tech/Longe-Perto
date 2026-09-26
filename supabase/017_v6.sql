-- Longe & Perto v6 — romântico e fofo.
-- Rode ANTES do 018_seed_v6.sql. Pode rodar de novo.

-- 1) Cartas: novo nível 'romantico' e novos tipos 'pergunta_dia' e 'boa_noite'
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cartas'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%tipo%' or pg_get_constraintdef(oid) ilike '%nivel%')
  loop
    execute format('alter table public.cartas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.cartas
  add constraint cartas_tipo_check check (tipo in (
    'verdade','desafio','prenda','efeito','duelo','sintonia','missao_dupla','missao_secreta',
    'aposta','observacao','capsula','ideia_mensagem','pergunta_dia','boa_noite')),
  add constraint cartas_nivel_check check (nivel in ('romantico','leve','criativo','picante','pesado')),
  add constraint cartas_efeito_tem_rodadas check (tipo <> 'efeito' or rodadas is not null);

-- Envelopes (v5) também aceitam desafio surpresa romântico
do $$
declare r record;
begin
  if to_regclass('public.envelopes') is not null then
    for r in
      select conname from pg_constraint
      where conrelid = 'public.envelopes'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%nivel%' and pg_get_constraintdef(oid) not ilike '%tipo%'
    loop
      execute format('alter table public.envelopes drop constraint %I', r.conname);
    end loop;
    alter table public.envelopes add constraint envelopes_nivel_check
      check (nivel is null or nivel in ('romantico','leve','criativo','picante','pesado'));
  end if;
end $$;

-- 2) "Pensei em você" e outros carinhos
create table if not exists public.carinhos (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  de        int  not null check (de in (0,1)),
  tipo      text not null check (tipo in ('pensei','beijo','abraco','saudade')),
  criada_em timestamptz not null default now()
);
create index if not exists carinhos_sala_idx on public.carinhos (sala, criada_em desc);

-- 3) Linha do tempo do casal
create table if not exists public.marcos (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  titulo    text not null check (char_length(btrim(titulo)) between 1 and 80),
  data      date not null,
  descricao text check (descricao is null or char_length(descricao) <= 300),
  emoji     text check (emoji is null or char_length(emoji) <= 8),
  principal boolean not null default false,  -- início do namoro: base do "juntos há X dias"
  autor     text not null,
  criada_em timestamptz not null default now()
);
create index if not exists marcos_sala_idx on public.marcos (sala, data);
create unique index if not exists marcos_um_principal on public.marcos (sala) where principal;

-- 4) Pote de motivos
create table if not exists public.motivos (
  id          uuid primary key default gen_random_uuid(),
  sala        text not null references public.salas(codigo) on delete cascade,
  de          int  not null check (de in (0,1)),
  texto       text not null check (char_length(btrim(texto)) between 3 and 280),
  vezes       int  not null default 0 check (vezes >= 0),
  sorteado_em timestamptz,
  criada_em   timestamptz not null default now()
);
create index if not exists motivos_sala_idx on public.motivos (sala, de);

-- 5) Cartas "Abra quando…"
create table if not exists public.abra_quando (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  de        int  not null check (de in (0,1)),
  ocasiao   text not null check (char_length(btrim(ocasiao)) between 2 and 60),
  texto     text not null check (char_length(btrim(texto)) between 3 and 1000),
  aberto_em timestamptz,
  criada_em timestamptz not null default now()
);
create index if not exists abra_quando_sala_idx on public.abra_quando (sala, criada_em);

-- 6) Pergunta do dia
create table if not exists public.respostas_dia (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  dia       date not null,
  jogador   int  not null check (jogador in (0,1)),
  pergunta  text not null,
  resposta  text not null check (char_length(btrim(resposta)) between 1 and 500),
  criada_em timestamptz not null default now(),
  unique (sala, dia, jogador)
);

-- 7) Nossa playlist
create table if not exists public.musicas_nossas (
  sala        text not null references public.salas(codigo) on delete cascade,
  musica_id   uuid not null references public.musicas(id) on delete cascade,
  marcado_por text not null,
  criada_em   timestamptz not null default now(),
  primary key (sala, musica_id)
);

-- 8) RLS: mesmo modelo das outras tabelas
do $$
declare t text;
begin
  foreach t in array array['carinhos','marcos','motivos','abra_quando','respostas_dia','musicas_nossas']
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

-- 9) Realtime
do $$
declare t text;
begin
  foreach t in array array['carinhos','marcos','motivos','abra_quando','respostas_dia','musicas_nossas']
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
  and table_name in ('carinhos','marcos','motivos','abra_quando','respostas_dia','musicas_nossas')
order by 1;
