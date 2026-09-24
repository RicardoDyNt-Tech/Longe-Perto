-- Longe & Perto — cole tudo no SQL Editor do seu projeto Supabase e rode uma vez.

create table if not exists public.salas (
  codigo        text primary key check (codigo ~ '^[A-Z0-9]{5}$'),
  estado        jsonb not null,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create or replace function public.salas_touch()
returns trigger language plpgsql as $$
begin
  new.atualizada_em := now();
  return new;
end $$;

drop trigger if exists salas_touch on public.salas;
create trigger salas_touch before update on public.salas
for each row execute function public.salas_touch();

alter table public.salas enable row level security;

-- Jogo sem login: quem tem o código da sala lê e joga.
drop policy if exists "ler salas" on public.salas;
create policy "ler salas" on public.salas
  for select to anon, authenticated using (true);

drop policy if exists "criar salas" on public.salas;
create policy "criar salas" on public.salas
  for insert to anon, authenticated with check (true);

drop policy if exists "jogar na sala" on public.salas;
create policy "jogar na sala" on public.salas
  for update to anon, authenticated using (true) with check (true);

-- Liga o Realtime para a tabela (é isso que sincroniza os dois celulares).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salas'
  ) then
    alter publication supabase_realtime add table public.salas;
  end if;
end $$;

-- Opcional: apagar salas paradas há mais de 7 dias (rode quando quiser).
-- delete from public.salas where atualizada_em < now() - interval '7 days';
