-- Longe & Perto v8 — escolha às cegas, roteiros, cartas com continuação e morte súbita.
-- Rode ANTES do 023_seed_v8.sql. Pode rodar de novo.

-- 1) Cartas com continuação: tipo 'sequencia' e coluna etapas
alter table public.cartas add column if not exists etapas jsonb;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cartas'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%tipo%' or pg_get_constraintdef(oid) ilike '%etapas%')
  loop
    execute format('alter table public.cartas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.cartas
  add constraint cartas_tipo_check check (tipo in (
    'verdade','desafio','prenda','efeito','duelo','sintonia','missao_dupla','missao_secreta',
    'aposta','observacao','capsula','ideia_mensagem','pergunta_dia','boa_noite','sequencia')),
  add constraint cartas_efeito_tem_rodadas check (tipo <> 'efeito' or rodadas is not null),
  add constraint cartas_sequencia_tem_etapas check (
    tipo <> 'sequencia'
    or (etapas is not null and jsonb_typeof(etapas) = 'array' and jsonb_array_length(etapas) between 2 and 3));

-- 2) Roteiros de sessão (conteúdo fixo, só leitura)
create table if not exists public.roteiros (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique check (char_length(btrim(nome)) between 2 and 40),
  emoji     text not null check (char_length(emoji) between 1 and 8),
  descricao text not null check (char_length(btrim(descricao)) between 5 and 200),
  nivel_max text not null check (nivel_max in ('romantico','leve','criativo','picante','pesado')),
  etapas    jsonb not null check (jsonb_typeof(etapas) = 'array' and jsonb_array_length(etapas) between 2 and 6),
  ordem     int  not null default 0,
  ativo     boolean not null default true
);

alter table public.roteiros enable row level security;
drop policy if exists "ler" on public.roteiros;
create policy "ler" on public.roteiros for select to anon, authenticated using (true);

select 'ok' as estrutura_v8;
