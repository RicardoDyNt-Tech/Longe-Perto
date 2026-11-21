-- Longe & Perto — Hub de Jogos: fundação (partidas e segredos de rodada).
-- Migração idempotente: pode ser executada novamente sem duplicar dados.

------------------------------------------------------------------------------
-- 1) Tabela de partidas (estado compartilhado em tempo real)
------------------------------------------------------------------------------
create table if not exists public.jogos_partidas (
  id            uuid primary key default gen_random_uuid(),
  sala_codigo   text not null references public.salas(codigo) on delete cascade,
  jogo_id       text not null,
  status        text not null default 'ativa' check (status in ('ativa', 'encerrada')),
  rodada        integer not null default 1,
  placar        jsonb not null default '{}'::jsonb,
  estado        jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  constraint jogos_partidas_sala_jogo_uk unique (sala_codigo, jogo_id)
);

create index if not exists jogos_partidas_sala_idx
  on public.jogos_partidas (sala_codigo, jogo_id);

alter table public.jogos_partidas enable row level security;

drop policy if exists "jogos_partidas_ler" on public.jogos_partidas;
create policy "jogos_partidas_ler"
  on public.jogos_partidas for select to anon, authenticated
  using (true);

drop policy if exists "jogos_partidas_criar" on public.jogos_partidas;
create policy "jogos_partidas_criar"
  on public.jogos_partidas for insert to anon, authenticated
  with check (exists (select 1 from public.salas s where s.codigo = jogos_partidas.sala_codigo));

drop policy if exists "jogos_partidas_alterar" on public.jogos_partidas;
create policy "jogos_partidas_alterar"
  on public.jogos_partidas for update to anon, authenticated
  using (true) with check (true);

drop policy if exists "jogos_partidas_apagar" on public.jogos_partidas;
create policy "jogos_partidas_apagar"
  on public.jogos_partidas for delete to anon, authenticated
  using (true);

do $$
begin
  alter publication supabase_realtime add table public.jogos_partidas;
exception
  when duplicate_object then null;
end $$;

------------------------------------------------------------------------------
-- 2) Tabela de segredos de rodada (sem policy pública: acesso só via RPC)
------------------------------------------------------------------------------
create table if not exists public.jogos_segredos (
  id         uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.jogos_partidas(id) on delete cascade,
  sala_codigo text not null,
  rodada     integer not null,
  jogador    text not null,
  chave      text not null default 'principal',
  valor      jsonb not null,
  revelado   boolean not null default false,
  criado_em  timestamptz not null default now(),
  constraint jogos_segredos_unico_uk unique (partida_id, rodada, jogador, chave)
);

create index if not exists jogos_segredos_partida_rodada_idx
  on public.jogos_segredos (partida_id, rodada);

alter table public.jogos_segredos enable row level security;
-- Nenhuma policy para anon/authenticated: leitura e escrita somente pelas RPCs abaixo.

------------------------------------------------------------------------------
-- 3) RPCs security definer para segredos
------------------------------------------------------------------------------
create or replace function public.jogo_enviar_segredo(
  p_sala_codigo text,
  p_partida_id  uuid,
  p_rodada      integer,
  p_jogador     text,
  p_chave       text,
  p_valor       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text := coalesce(nullif(btrim(p_chave), ''), 'principal');
begin
  if not exists (
    select 1
    from public.jogos_partidas p
    where p.id = p_partida_id
      and p.sala_codigo = p_sala_codigo
  ) then
    raise exception 'Partida não encontrada para esta sala.';
  end if;

  insert into public.jogos_segredos (
    partida_id, sala_codigo, rodada, jogador, chave, valor, revelado
  ) values (
    p_partida_id, p_sala_codigo, p_rodada, p_jogador, v_chave, coalesce(p_valor, 'null'::jsonb), false
  )
  on conflict (partida_id, rodada, jogador, chave)
  do update set
    valor = excluded.valor,
    revelado = false,
    criado_em = now();
end;
$$;

create or replace function public.jogo_ler_meu_segredo(
  p_sala_codigo text,
  p_partida_id  uuid,
  p_rodada      integer,
  p_jogador     text,
  p_chave       text default 'principal'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text := coalesce(nullif(btrim(p_chave), ''), 'principal');
  v_valor jsonb;
begin
  if not exists (
    select 1
    from public.jogos_partidas p
    where p.id = p_partida_id
      and p.sala_codigo = p_sala_codigo
  ) then
    raise exception 'Partida não encontrada para esta sala.';
  end if;

  select s.valor
  into v_valor
  from public.jogos_segredos s
  where s.partida_id = p_partida_id
    and s.rodada = p_rodada
    and s.jogador = p_jogador
    and s.chave = v_chave;

  return v_valor;
end;
$$;

create or replace function public.jogo_status_segredos(
  p_sala_codigo text,
  p_partida_id  uuid,
  p_rodada      integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  if not exists (
    select 1
    from public.jogos_partidas p
    where p.id = p_partida_id
      and p.sala_codigo = p_sala_codigo
  ) then
    raise exception 'Partida não encontrada para esta sala.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jogador', s.jogador,
        'chave', s.chave,
        'enviado', true,
        'revelado', s.revelado
      )
      order by s.criado_em
    ),
    '[]'::jsonb
  )
  into v_res
  from public.jogos_segredos s
  where s.partida_id = p_partida_id
    and s.rodada = p_rodada;

  return v_res;
end;
$$;

create or replace function public.jogo_revelar_rodada(
  p_sala_codigo text,
  p_partida_id  uuid,
  p_rodada      integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  if not exists (
    select 1
    from public.jogos_partidas p
    where p.id = p_partida_id
      and p.sala_codigo = p_sala_codigo
  ) then
    raise exception 'Partida não encontrada para esta sala.';
  end if;

  update public.jogos_segredos
  set revelado = true
  where partida_id = p_partida_id
    and rodada = p_rodada;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jogador', s.jogador,
        'chave', s.chave,
        'valor', s.valor
      )
      order by s.criado_em
    ),
    '[]'::jsonb
  )
  into v_res
  from public.jogos_segredos s
  where s.partida_id = p_partida_id
    and s.rodada = p_rodada;

  return v_res;
end;
$$;

grant execute on function public.jogo_enviar_segredo(text, uuid, integer, text, text, jsonb) to anon, authenticated;
grant execute on function public.jogo_ler_meu_segredo(text, uuid, integer, text, text) to anon, authenticated;
grant execute on function public.jogo_status_segredos(text, uuid, integer) to anon, authenticated;
grant execute on function public.jogo_revelar_rodada(text, uuid, integer) to anon, authenticated;
