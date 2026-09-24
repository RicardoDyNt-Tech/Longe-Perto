-- Longe & Perto — tabela de cartas. Rode DEPOIS do schema.sql e ANTES do 003_seed_cartas.sql.
-- Pode rodar de novo sem problema.

create table if not exists public.cartas (
  id        uuid primary key default gen_random_uuid(),
  sala      text references public.salas(codigo) on delete cascade, -- null = carta padrão do jogo
  tipo      text not null check (tipo in ('verdade','desafio','prenda')),
  nivel     text not null check (nivel in ('leve','criativo','picante','pesado')),
  texto     text not null check (char_length(btrim(texto)) between 3 and 280),
  midia     text check (midia in ('foto','video','audio')),
  autor     text check (autor is null or char_length(btrim(autor)) between 1 and 20),
  ativa     boolean not null default true,
  criada_em timestamptz not null default now(),
  constraint carta_da_sala_tem_autor check (sala is null or autor is not null)
);

create index if not exists cartas_sala_idx on public.cartas (sala);
-- evita duplicar as cartas padrão se o seed rodar de novo
create unique index if not exists cartas_padrao_uniq on public.cartas (tipo, nivel, texto) where sala is null;

-- necessário para o Realtime entregar o registro antigo no DELETE
alter table public.cartas replica identity full;

alter table public.cartas enable row level security;

drop policy if exists "ler cartas" on public.cartas;
create policy "ler cartas" on public.cartas
  for select to anon, authenticated using (true);

-- usuário só cria carta da própria sala; as padrão só entram pelo SQL Editor
drop policy if exists "criar carta da sala" on public.cartas;
create policy "criar carta da sala" on public.cartas
  for insert to anon, authenticated
  with check (sala is not null and exists (select 1 from public.salas s where s.codigo = sala));

-- usuário só apaga carta de sala, nunca as padrão
drop policy if exists "apagar carta da sala" on public.cartas;
create policy "apagar carta da sala" on public.cartas
  for delete to anon, authenticated using (sala is not null);

-- Limite de 300 cartas por sala.
create or replace function public.cartas_limite_sala()
returns trigger language plpgsql as $$
begin
  if new.sala is not null
     and (select count(*) from public.cartas where sala = new.sala) >= 300 then
    raise exception 'limite de cartas da sala atingido';
  end if;
  return new;
end $$;

drop trigger if exists cartas_limite_sala on public.cartas;
create trigger cartas_limite_sala before insert on public.cartas
for each row execute function public.cartas_limite_sala();

-- Liga o Realtime para a tabela (cartas novas e apagadas aparecem nos dois celulares).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cartas'
  ) then
    alter publication supabase_realtime add table public.cartas;
  end if;
end $$;
