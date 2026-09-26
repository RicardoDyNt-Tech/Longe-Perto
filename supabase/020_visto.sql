-- Longe & Perto — "visto por último".
-- Cada aparelho grava a hora em que esteve com o app aberto; o outro vê quando saiu.
-- Uma linha por jogador em cada sala. Pode rodar de novo.

create table if not exists public.vistos (
  sala     text not null references public.salas(codigo) on delete cascade,
  jogador  int  not null check (jogador in (0,1)),
  visto_em timestamptz not null default now(),
  primary key (sala, jogador)
);

-- RLS: mesmo modelo das outras tabelas (sem login; quem tem o código da sala joga)
alter table public.vistos enable row level security;
drop policy if exists "ler" on public.vistos;
create policy "ler" on public.vistos for select to anon, authenticated using (true);
drop policy if exists "criar" on public.vistos;
create policy "criar" on public.vistos for insert to anon, authenticated
  with check (exists (select 1 from public.salas s where s.codigo = sala));
drop policy if exists "alterar" on public.vistos;
create policy "alterar" on public.vistos for update to anon, authenticated using (true) with check (true);

-- Realtime
do $$
begin
  alter table public.vistos replica identity full;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vistos') then
    alter publication supabase_realtime add table public.vistos;
  end if;
end $$;

-- Conferência
select tablename from pg_tables where schemaname = 'public' and tablename = 'vistos';
