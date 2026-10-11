-- Longe & Perto — APK: aparelhos para notificação push (FCM).
-- Pode rodar de novo.
--
-- O token FCM de cada aparelho fica em `dispositivos`, que o app NÃO consegue ler
-- (RLS ligado e nenhuma policy). O app só registra/remove pelo RPC abaixo.
-- Quem lê os tokens é a Edge Function `enviar-push`, com a service role.

create table if not exists public.dispositivos (
  id            uuid primary key default gen_random_uuid(),
  sala          text not null references public.salas(codigo) on delete cascade,
  jogador       int  not null check (jogador in (0,1)),
  token         text not null unique check (char_length(token) between 20 and 4096),
  plataforma    text not null default 'android' check (plataforma in ('android')),
  preferencias  jsonb not null default '{}'::jsonb,   -- ex.: {"dengo":true,"carinho":true,"silencio":{"de":"23:00","ate":"07:00"}}
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists dispositivos_sala_idx on public.dispositivos (sala, jogador);
alter table public.dispositivos enable row level security;

-- Registra ou atualiza o aparelho (o mesmo token só pode estar numa sala/jogador)
create or replace function public.registrar_dispositivo(p_sala text, p_jogador int, p_token text, p_preferencias jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  if p_token is null or char_length(p_token) < 20 then raise exception 'token inválido'; end if;
  if not exists (select 1 from public.salas where codigo = p_sala) then return false; end if;
  if (select count(*) from public.dispositivos where sala = p_sala) >= 10
     and not exists (select 1 from public.dispositivos where token = p_token) then
    raise exception 'limite de aparelhos da sala';
  end if;
  insert into public.dispositivos (sala, jogador, token, preferencias)
  values (p_sala, p_jogador, p_token, coalesce(p_preferencias, '{}'::jsonb))
  on conflict (token) do update
    set sala = excluded.sala, jogador = excluded.jogador,
        preferencias = excluded.preferencias, atualizado_em = now();
  return true;
end $$;

-- Remove o aparelho (sair da sala, desligar notificações)
create or replace function public.remover_dispositivo(p_token text)
returns boolean language sql security definer set search_path = public as $$
  with d as (delete from public.dispositivos where token = p_token returning 1)
  select exists (select 1 from d);
$$;

revoke all on function public.registrar_dispositivo(text, int, text, jsonb) from public;
revoke all on function public.remover_dispositivo(text) from public;
grant execute on function public.registrar_dispositivo(text, int, text, jsonb) to anon, authenticated;
grant execute on function public.remover_dispositivo(text) to anon, authenticated;

-- Registro de envios (anti-spam e depuração). Só a Edge Function usa.
create table if not exists public.push_log (
  id        bigserial primary key,
  sala      text not null,
  para      int  not null,
  evento    text not null,
  enviado_em timestamptz not null default now()
);
create index if not exists push_log_idx on public.push_log (sala, para, evento, enviado_em desc);
alter table public.push_log enable row level security;

select 'ok' as dispositivos;
