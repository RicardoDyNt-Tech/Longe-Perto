-- Longe & Perto — tempo em chamada (detecção por presença, botão e registro manual).
-- Pode rodar de novo.
--
-- Uma sala tem no máximo UMA chamada aberta (fim nulo). O app não grava direto:
-- tudo passa pelos RPCs abaixo, que abrem, estendem e fecham a sessão sem duplicar,
-- mesmo com os dois celulares mandando sinal ao mesmo tempo.

create table if not exists public.chamadas (
  id              uuid primary key default gen_random_uuid(),
  sala            text not null references public.salas(codigo) on delete cascade,
  inicio          timestamptz not null default now(),
  fim             timestamptz,
  ultimo_sinal    timestamptz not null default now(),
  tolerancia_min  int  not null default 5 check (tolerancia_min between 1 and 360),
  origem          text not null default 'presenca'
                  check (origem in ('presenca','botao','manual','app','android')),
  fechada_auto    boolean not null default false,   -- fechou sozinha: o app pergunta se quer ajustar
  humor_final     text check (humor_final is null or humor_final in ('romantica','intensa','risadas','sono')),
  duracao_minutos int generated always as (
                    case when fim is null then null
                         else greatest(0, round(extract(epoch from (fim - inicio)) / 60))::int end
                  ) stored,
  criada_em       timestamptz not null default now(),
  constraint fim_depois_inicio check (fim is null or fim >= inicio)
);
create unique index if not exists chamadas_uma_aberta on public.chamadas (sala) where fim is null;
create index if not exists chamadas_sala_idx on public.chamadas (sala, inicio desc);

alter table public.chamadas enable row level security;
drop policy if exists "ler" on public.chamadas;
create policy "ler" on public.chamadas for select to anon, authenticated using (true);
-- Sem policy de insert/update/delete: escrita só pelos RPCs.

-- Realtime (o cronômetro aparece nos dois celulares)
do $$
begin
  alter table public.chamadas replica identity full;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chamadas') then
    alter publication supabase_realtime add table public.chamadas;
  end if;
end $$;

-- Fecha sessões abertas que pararam de receber sinal (fim = último sinal).
-- Sessões automáticas muito curtas (< 2 min) são descartadas.
create or replace function public.chamadas_fechar_vencidas(p_sala text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.chamadas
     set fim = ultimo_sinal, fechada_auto = true
   where sala = p_sala and fim is null
     and ultimo_sinal < now() - make_interval(mins => tolerancia_min);
  get diagnostics n = row_count;
  delete from public.chamadas
   where sala = p_sala and fim is not null and origem in ('presenca','android')
     and fim - inicio < interval '2 minutes';
  return n;
end $$;

-- Sinal de "estamos em chamada": abre a sessão ou estende a que está aberta.
-- presenca/android: tolerância 5 min · app: 2 min · botao: 360 min (6 h)
create or replace function public.chamada_sinal(p_sala text, p_origem text default 'presenca')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tol int;
begin
  if p_origem not in ('presenca','botao','app','android') then raise exception 'origem inválida'; end if;
  if not exists (select 1 from public.salas where codigo = p_sala) then raise exception 'sala não existe'; end if;
  v_tol := case p_origem when 'botao' then 360 when 'app' then 2 else 5 end;

  perform public.chamadas_fechar_vencidas(p_sala);

  update public.chamadas
     set ultimo_sinal = now(),
         -- o botão "Em chamada" manda na sessão: aumenta a tolerância se ela começou pela presença
         tolerancia_min = greatest(tolerancia_min, v_tol)
   where sala = p_sala and fim is null
  returning id into v_id;
  if v_id is not null then return v_id; end if;

  insert into public.chamadas (sala, origem, tolerancia_min)
  values (p_sala, p_origem, v_tol)
  on conflict (sala) where fim is null do nothing
  returning id into v_id;

  if v_id is null then  -- o outro celular abriu no mesmo instante
    update public.chamadas set ultimo_sinal = now()
     where sala = p_sala and fim is null returning id into v_id;
  end if;
  return v_id;
end $$;

-- "Encerrar": fecha a sessão aberta agora.
create or replace function public.chamada_encerrar(p_sala text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.chamadas set fim = now(), ultimo_sinal = now(), fechada_auto = false
   where sala = p_sala and fim is null
  returning id into v_id;
  return v_id;
end $$;

-- "Como foi a call?"
create or replace function public.chamada_humor(p_sala text, p_id uuid, p_humor text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_humor is not null and p_humor not in ('romantica','intensa','risadas','sono') then
    raise exception 'humor inválido';
  end if;
  update public.chamadas set humor_final = p_humor where id = p_id and sala = p_sala;
  return found;
end $$;

-- Ajustar a duração de uma sessão (ex.: a que fechou sozinha)
create or replace function public.chamada_ajustar(p_sala text, p_id uuid, p_minutos int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_minutos not between 1 and 720 then raise exception 'duração inválida (1 a 720 min)'; end if;
  update public.chamadas
     set fim = least(inicio + make_interval(mins => p_minutos), now()), fechada_auto = false
   where id = p_id and sala = p_sala and fim is not null;
  return found;
end $$;

-- "+ Registrar chamada passada": até 60 dias atrás, até 12 h, sem sobrepor outra.
create or replace function public.chamada_registrar(p_sala text, p_inicio timestamptz, p_minutos int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_fim timestamptz; v_id uuid;
begin
  if not exists (select 1 from public.salas where codigo = p_sala) then raise exception 'sala não existe'; end if;
  if p_minutos not between 1 and 720 then raise exception 'duração inválida (1 a 720 min)'; end if;
  v_fim := p_inicio + make_interval(mins => p_minutos);
  if p_inicio < now() - interval '60 days' or v_fim > now() + interval '1 minute' then
    raise exception 'data fora do intervalo (últimos 60 dias, sem passar de agora)';
  end if;
  if exists (select 1 from public.chamadas
              where sala = p_sala
                and tstzrange(inicio, coalesce(fim, now())) && tstzrange(p_inicio, v_fim)) then
    raise exception 'sobreposta: já existe chamada registrada nesse horário';
  end if;
  insert into public.chamadas (sala, inicio, fim, ultimo_sinal, origem, tolerancia_min)
  values (p_sala, p_inicio, v_fim, v_fim, 'manual', 5)
  returning id into v_id;
  return v_id;
end $$;

-- Apagar um registro (qualquer origem; o app confirma antes)
create or replace function public.chamada_apagar(p_sala text, p_id uuid)
returns boolean language sql security definer set search_path = public as $$
  with d as (delete from public.chamadas where id = p_id and sala = p_sala and fim is not null returning 1)
  select exists (select 1 from d);
$$;

-- Estatísticas da sala (horário de Brasília/Bahia)
create or replace function public.chamadas_resumo(p_sala text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform public.chamadas_fechar_vencidas(p_sala);
  with c as (
    select inicio, fim, duracao_minutos as m, humor_final,
           (inicio at time zone 'America/Bahia') as ini_local,
           (fim    at time zone 'America/Bahia') as fim_local
      from public.chamadas where sala = p_sala and fim is not null
  ),
  dias as (select distinct ini_local::date as d from c),
  seq as (  -- dias seguidos com chamada, terminando hoje ou ontem
    select count(*) as n from (
      select d, d - (row_number() over (order by d))::int as grupo from dias
    ) x
    where grupo = (select d - (row_number() over (order by d))::int
                     from dias order by d desc limit 1)
      and (select max(d) from dias) >= (now() at time zone 'America/Bahia')::date - 1
  )
  select jsonb_build_object(
    'total_minutos',   coalesce((select sum(m) from c), 0),
    'total_chamadas',  (select count(*) from c),
    'recorde',         (select jsonb_build_object('inicio', inicio, 'minutos', m) from c order by m desc, inicio limit 1),
    'semana_minutos',  coalesce((select sum(m) from c where inicio >= now() - interval '7 days'), 0),
    'mes_minutos',     coalesce((select sum(m) from c where inicio >= now() - interval '30 days'), 0),
    'periodo_favorito',(select p from (
                          select case when extract(hour from ini_local) < 6  then 'madrugada'
                                      when extract(hour from ini_local) < 12 then 'manha'
                                      when extract(hour from ini_local) < 18 then 'tarde'
                                      else 'noite' end as p, sum(m) as s
                            from c group by 1 order by s desc limit 1) z),
    'humor_favorito',  (select humor_final from c where humor_final is not null
                         group by 1 order by count(*) desc limit 1),
    'sequencia_dias',  coalesce((select n from seq), 0),
    'maratona_madrugada', exists (select 1 from c where m >= 180
                                    and (fim_local::date > ini_local::date or extract(hour from ini_local) < 3)),
    'aberta',          (select jsonb_build_object('id', id, 'inicio', inicio, 'origem', origem)
                          from public.chamadas where sala = p_sala and fim is null)
  ) into r;
  return r;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'chamadas_fechar_vencidas(text)',
    'chamada_sinal(text, text)',
    'chamada_encerrar(text)',
    'chamada_humor(text, uuid, text)',
    'chamada_ajustar(text, uuid, int)',
    'chamada_registrar(text, timestamptz, int)',
    'chamada_apagar(text, uuid)',
    'chamadas_resumo(text)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

select 'ok' as chamadas;
