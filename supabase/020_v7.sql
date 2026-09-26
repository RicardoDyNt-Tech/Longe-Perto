-- Longe & Perto v7 — cuidar a distância: pedir dengo, humor do dia, mural e manual de mim.
-- Rode ANTES do 021_seed_v7.sql. Pode rodar de novo.

-- 1) Modelos de pedido (padrão: sala null; da pessoa: sala + jogador)
create table if not exists public.pedidos_modelos (
  id        uuid primary key default gen_random_uuid(),
  sala      text references public.salas(codigo) on delete cascade,
  jogador   int  check (jogador is null or jogador in (0,1)),
  chave     text check (chave is null or chave ~ '^[a-z_]{2,30}$'),   -- identifica os padrões com comportamento especial
  emoji     text not null check (char_length(emoji) between 1 and 8),
  titulo    text not null check (char_length(btrim(titulo)) between 2 and 40),
  detalhe   text check (detalhe is null or char_length(detalhe) <= 120),  -- texto sugerido para o campo de detalhe
  ordem     int  not null default 0,
  ativo     boolean not null default true,
  criada_em timestamptz not null default now(),
  constraint modelo_da_sala_tem_jogador check ((sala is null and jogador is null) or (sala is not null and jogador is not null))
);
create index if not exists pedidos_modelos_sala_idx on public.pedidos_modelos (sala, jogador, ordem);
create unique index if not exists pedidos_modelos_padrao_uniq on public.pedidos_modelos (titulo) where sala is null;

-- 2) Pedidos de dengo
create table if not exists public.dengos (
  id            uuid primary key default gen_random_uuid(),
  sala          text not null references public.salas(codigo) on delete cascade,
  de            int  not null check (de in (0,1)),
  itens         jsonb not null check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) between 1 and 6),
  mensagem      text check (mensagem is null or char_length(mensagem) <= 200),
  status        text not null default 'pendente' check (status in ('pendente','indo','nao_consigo','cancelado')),
  resposta      text check (resposta is null or char_length(resposta) <= 200),
  respondido_em timestamptz,
  criada_em     timestamptz not null default now()
);
create index if not exists dengos_sala_idx on public.dengos (sala, criada_em desc);

-- 3) Humor do dia (um por pessoa por dia; pode mudar ao longo do dia)
create table if not exists public.humores (
  sala          text not null references public.salas(codigo) on delete cascade,
  dia           date not null,
  jogador       int  not null check (jogador in (0,1)),
  valor         int  not null check (valor between 1 and 5),
  nota          text check (nota is null or char_length(nota) <= 140),
  atualizado_em timestamptz not null default now(),
  primary key (sala, dia, jogador)
);

-- 4) Sugestões de cuidado por humor (conteúdo fixo, só leitura)
create table if not exists public.sugestoes_cuidado (
  id         uuid primary key default gen_random_uuid(),
  humor_min  int  not null check (humor_min between 1 and 5),
  humor_max  int  not null check (humor_max between 1 and 5),
  texto      text not null unique check (char_length(btrim(texto)) between 3 and 120),
  acao       text not null check (acao in ('mural','mensagem','audio','ligar','abra_quando','pensei','dengo_lanche','manual','partida','musica','desculpas','reencontro','nenhuma')),
  ordem      int  not null default 0,
  constraint faixa_valida check (humor_min <= humor_max)
);

-- 5) Mural de desenho (traços em JSON, sem imagem)
create table if not exists public.murais (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  de        int  not null check (de in (0,1)),
  para      int  check (para is null or para in (0,1)),            -- null = desenho feito juntos
  tracos    jsonb not null check (jsonb_typeof(tracos) = 'array' and octet_length(tracos::text) < 300000),
  fundo     text not null default 'papel' check (fundo in ('papel','quadriculado','escuro','rosa')),
  legenda   text check (legenda is null or char_length(legenda) <= 80),
  visto_em  timestamptz,
  criada_em timestamptz not null default now()
);
create index if not exists murais_sala_idx on public.murais (sala, criada_em desc);

-- 6) Manual de mim (perfil de cada um)
create table if not exists public.manuais (
  sala          text not null references public.salas(codigo) on delete cascade,
  jogador       int  not null check (jogador in (0,1)),
  campos        jsonb not null default '{}'::jsonb check (jsonb_typeof(campos) = 'object' and octet_length(campos::text) < 20000),
  atualizado_em timestamptz not null default now(),
  primary key (sala, jogador)
);

-- 7) RLS
alter table public.sugestoes_cuidado enable row level security;
drop policy if exists "ler" on public.sugestoes_cuidado;
create policy "ler" on public.sugestoes_cuidado for select to anon, authenticated using (true);

alter table public.pedidos_modelos enable row level security;
drop policy if exists "ler" on public.pedidos_modelos;
create policy "ler" on public.pedidos_modelos for select to anon, authenticated using (true);
drop policy if exists "criar" on public.pedidos_modelos;
create policy "criar" on public.pedidos_modelos for insert to anon, authenticated
  with check (sala is not null and exists (select 1 from public.salas s where s.codigo = sala));
drop policy if exists "alterar" on public.pedidos_modelos;
create policy "alterar" on public.pedidos_modelos for update to anon, authenticated
  using (sala is not null) with check (sala is not null);
drop policy if exists "apagar" on public.pedidos_modelos;
create policy "apagar" on public.pedidos_modelos for delete to anon, authenticated using (sala is not null);

do $$
declare t text;
begin
  foreach t in array array['dengos','humores','murais','manuais']
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

-- 8) Realtime
do $$
declare t text;
begin
  foreach t in array array['pedidos_modelos','dengos','humores','murais','manuais']
  loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('pedidos_modelos','dengos','humores','sugestoes_cuidado','murais','manuais')
order by 1;
