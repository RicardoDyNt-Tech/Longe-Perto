-- Longe & Perto — configurações da sala controladas pelo dono.
-- Pode rodar de novo.
--
-- Como a proteção funciona (sem login):
--   * Ao criar a sala (ou reivindicar uma sala antiga), o aparelho do dono gera um token aleatório
--     e guarda no localStorage. O banco guarda só o hash (sha256) desse token, numa tabela que o app não lê.
--   * A config fica em salas_config: todo mundo lê, mas ninguém escreve direto.
--     A única forma de mudar é a função sala_config_salvar, que confere o token.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.salas_config (
  sala          text primary key references public.salas(codigo) on delete cascade,
  config        jsonb not null default '{}'::jsonb,
  dono          int check (dono is null or dono in (0,1)),
  atualizada_em timestamptz not null default now()
);

create table if not exists public.salas_dono (
  sala       text primary key references public.salas(codigo) on delete cascade,
  token_hash text not null,
  criada_em  timestamptz not null default now()
);

alter table public.salas_config enable row level security;
alter table public.salas_dono   enable row level security;

drop policy if exists "ler" on public.salas_config;
create policy "ler" on public.salas_config for select to anon, authenticated using (true);
-- salas_config: sem policy de insert/update/delete para anon.
-- salas_dono: nenhuma policy (nem leitura). Só as funções abaixo acessam.

create or replace function public.lp_hash(p_token text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Reivindica o dono de uma sala que ainda não tem dono. Devolve true se deu certo.
create or replace function public.sala_reivindicar(p_sala text, p_token text, p_jogador int, p_config jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if p_token is null or char_length(p_token) < 20 then
    raise exception 'token curto';
  end if;
  if p_jogador is null or p_jogador not in (0,1) then
    raise exception 'jogador inválido';
  end if;
  if not exists (select 1 from public.salas where codigo = p_sala) then
    return false;
  end if;

  insert into public.salas_dono (sala, token_hash) values (p_sala, public.lp_hash(p_token))
  on conflict (sala) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    return false;  -- já tem dono
  end if;

  insert into public.salas_config (sala, config, dono)
  values (p_sala, coalesce(p_config, '{}'::jsonb), p_jogador)
  on conflict (sala) do update
    set dono = excluded.dono,
        config = case when public.salas_config.config = '{}'::jsonb then excluded.config else public.salas_config.config end,
        atualizada_em = now();
  return true;
end $$;

-- Confere se o token é do dono.
create or replace function public.sala_sou_dono(p_sala text, p_token text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.salas_dono d
                 where d.sala = p_sala and d.token_hash = public.lp_hash(coalesce(p_token, '')));
$$;

-- Salva a config inteira. Só o dono.
create or replace function public.sala_config_salvar(p_sala text, p_token text, p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.sala_sou_dono(p_sala, p_token) then
    raise exception 'apenas o dono pode alterar as configurações';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' or char_length(p_config::text) > 20000 then
    raise exception 'configuração inválida';
  end if;
  update public.salas_config set config = p_config, atualizada_em = now() where sala = p_sala;
  return p_config;
end $$;

-- Troca o código do dono (gerar um novo código de recuperação). Só o dono.
create or replace function public.sala_dono_trocar(p_sala text, p_token_atual text, p_token_novo text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.sala_sou_dono(p_sala, p_token_atual) then
    raise exception 'apenas o dono pode trocar o código';
  end if;
  if p_token_novo is null or char_length(p_token_novo) < 20 then
    raise exception 'token curto';
  end if;
  update public.salas_dono set token_hash = public.lp_hash(p_token_novo) where sala = p_sala;
  return true;
end $$;

-- Passa o dono para o outro jogador (só o índice exibido; o código continua sendo o do aparelho que o tiver).
create or replace function public.sala_dono_indice(p_sala text, p_token text, p_jogador int)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.sala_sou_dono(p_sala, p_token) then
    raise exception 'apenas o dono pode alterar';
  end if;
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  update public.salas_config set dono = p_jogador, atualizada_em = now() where sala = p_sala;
  return true;
end $$;

revoke all on function public.lp_hash(text) from public, anon, authenticated;
revoke all on function public.sala_reivindicar(text, text, int, jsonb) from public;
revoke all on function public.sala_sou_dono(text, text) from public;
revoke all on function public.sala_config_salvar(text, text, jsonb) from public;
revoke all on function public.sala_dono_trocar(text, text, text) from public;
revoke all on function public.sala_dono_indice(text, text, int) from public;
grant execute on function public.sala_reivindicar(text, text, int, jsonb) to anon, authenticated;
grant execute on function public.sala_sou_dono(text, text) to anon, authenticated;
grant execute on function public.sala_config_salvar(text, text, jsonb) to anon, authenticated;
grant execute on function public.sala_dono_trocar(text, text, text) to anon, authenticated;
grant execute on function public.sala_dono_indice(text, text, int) to anon, authenticated;

-- Realtime da config
do $$
begin
  alter table public.salas_config replica identity full;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'salas_config') then
    alter publication supabase_realtime add table public.salas_config;
  end if;
end $$;

-- Conferência
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('sala_reivindicar','sala_sou_dono','sala_config_salvar','sala_dono_trocar','sala_dono_indice')
order by 1;
