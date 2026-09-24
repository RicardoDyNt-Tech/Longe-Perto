-- Longe & Perto v3 — rode DEPOIS do 002_cartas.sql e do 003_seed_cartas.sql.
-- Pode rodar de novo sem problema.

-- ---------------------------------------------------------------------------
-- Nomes de sala: além do código de 5 letras/números, aceita sala fixa
-- (minúsculas, números e hífens, ex.: rica-e-carol-7k2p), de 5 a 30 caracteres.
-- Remove a constraint antiga de codigo pelo conteúdo, qualquer que seja o nome.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.salas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%codigo%'
  loop
    execute format('alter table public.salas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.salas add constraint salas_codigo_check
  check (codigo ~ '^([A-Z0-9]{5}|[a-z0-9]+(-[a-z0-9]+)*)$' and char_length(codigo) between 5 and 30);

-- ---------------------------------------------------------------------------
-- Histórico de partidas
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

-- ---------------------------------------------------------------------------
-- Cofre do reencontro
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

-- ---------------------------------------------------------------------------
-- Trilha da rodada (links do Spotify)
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

-- ---------------------------------------------------------------------------
-- RLS: todo mundo lê; o usuário só mexe em linhas de sala.
alter table public.partidas enable row level security;
alter table public.cofre    enable row level security;
alter table public.musicas  enable row level security;

-- partidas: ler e registrar; sem update e sem delete
drop policy if exists "ler partidas" on public.partidas;
create policy "ler partidas" on public.partidas
  for select to anon, authenticated using (true);
drop policy if exists "registrar partida" on public.partidas;
create policy "registrar partida" on public.partidas
  for insert to anon, authenticated
  with check (exists (select 1 from public.salas s where s.codigo = sala));

-- cofre: ler, guardar, marcar feito e apagar
drop policy if exists "ler cofre" on public.cofre;
create policy "ler cofre" on public.cofre
  for select to anon, authenticated using (true);
drop policy if exists "guardar no cofre" on public.cofre;
create policy "guardar no cofre" on public.cofre
  for insert to anon, authenticated
  with check (exists (select 1 from public.salas s where s.codigo = sala));
drop policy if exists "marcar cofre" on public.cofre;
create policy "marcar cofre" on public.cofre
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "apagar do cofre" on public.cofre;
create policy "apagar do cofre" on public.cofre
  for delete to anon, authenticated using (true);

-- musicas: ler; criar e apagar só as da sala (as padrão só pelo SQL Editor / Table Editor)
drop policy if exists "ler musicas" on public.musicas;
create policy "ler musicas" on public.musicas
  for select to anon, authenticated using (true);
drop policy if exists "criar musica da sala" on public.musicas;
create policy "criar musica da sala" on public.musicas
  for insert to anon, authenticated
  with check (sala is not null and exists (select 1 from public.salas s where s.codigo = sala));
drop policy if exists "apagar musica da sala" on public.musicas;
create policy "apagar musica da sala" on public.musicas
  for delete to anon, authenticated using (sala is not null);

-- ---------------------------------------------------------------------------
-- Limite de 300 linhas por sala em cofre e musicas (igual ao de cartas).
create or replace function public.limite_300_por_sala()
returns trigger language plpgsql as $$
declare n int;
begin
  if new.sala is not null then
    execute format('select count(*) from %I.%I where sala = $1', tg_table_schema, tg_table_name)
      into n using new.sala;
    if n >= 300 then
      raise exception 'limite de % da sala atingido', tg_table_name;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cofre_limite_sala on public.cofre;
create trigger cofre_limite_sala before insert on public.cofre
for each row execute function public.limite_300_por_sala();

drop trigger if exists musicas_limite_sala on public.musicas;
create trigger musicas_limite_sala before insert on public.musicas
for each row execute function public.limite_300_por_sala();

-- ---------------------------------------------------------------------------
-- Realtime para cofre e musicas
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cofre'
  ) then
    alter publication supabase_realtime add table public.cofre;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'musicas'
  ) then
    alter publication supabase_realtime add table public.musicas;
  end if;
end $$;

-- Confira: deve listar partidas, cofre e musicas, e salas/cartas/cofre/musicas no Realtime.
select tablename from pg_tables where schemaname = 'public' and tablename in ('partidas','cofre','musicas') order by 1;
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
