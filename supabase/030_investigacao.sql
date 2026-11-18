-- Longe & Perto — Investigação: jogo de mistério cooperativo para dois (motor + casos).
-- Pode rodar de novo (nada duplica; partidas em andamento são preservadas).
--
-- Como os segredos ficam protegidos:
--   · `casos_segredo` (documentos, senhas e solução) tem RLS ligado e NENHUMA policy: o app não lê.
--   · O app só fala com os RPCs `inv_*`, que entregam a cada jogador o que ele pode ver naquele momento.
--   · A solução só sai pelo `inv_relatorio`, depois de o caso ser concluído.
--   · O conteúdo do caso de verdade vai codificado (base64) para ninguém levar spoiler ao rodar este arquivo.

------------------------------------------------------------------------------
-- 1) Tabelas
------------------------------------------------------------------------------
create table if not exists public.casos (
  id           text primary key check (id ~ '^[a-z0-9-]{3,40}$'),
  titulo       text not null check (char_length(btrim(titulo)) between 3 and 60),
  emoji        text not null default '🕵️',   -- legado: o app usa `icone`
  icone        text not null default 'search',   -- nome do ícone (ver plano de identidade)
  tema         text not null check (tema in ('policial','misterio','sombrio','fantasia')),
  formato      text not null check (formato in ('curto','medio','longo')),
  minutos      int  not null check (minutos between 5 and 600),
  dificuldade  int  not null check (dificuldade between 1 and 3),
  sinopse      text not null check (char_length(btrim(sinopse)) between 10 and 400),
  serie        text,                 -- casos em capítulos: mesmo nome de série
  capitulo     int,
  versao       int  not null default 1,
  n_suspeitos  int  not null default 0,
  n_docs       int  not null default 0,
  teste        boolean not null default false,   -- caso de desenvolvimento: o app só lista com ?teste=1
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);
alter table public.casos add column if not exists icone text not null default 'search';
alter table public.casos enable row level security;
drop policy if exists "ler" on public.casos;
create policy "ler" on public.casos for select to anon, authenticated using (true);

create table if not exists public.casos_segredo (
  caso  text primary key references public.casos(id) on delete cascade,
  dados jsonb not null
);
alter table public.casos_segredo enable row level security;   -- sem policy: só os RPCs leem

create table if not exists public.investigacoes (
  id               uuid primary key default gen_random_uuid(),
  sala             text not null references public.salas(codigo) on delete cascade,
  caso             text not null references public.casos(id),
  versao           int  not null,
  estado           text not null default 'envelope'
                   check (estado in ('envelope','investigando','acusacao','concluido','revelado')),
  um_celular       boolean not null default false,
  pacote_a         int  not null check (pacote_a in (0,1)),          -- qual jogador recebeu o envelope A
  abriu            boolean[] not null default '{false,false}',
  travas_abertas   text[] not null default '{}',
  travas_erros     jsonb not null default '{}'::jsonb,                -- {trava: {"n": 3, "ate": "..."}}
  lidos            jsonb not null default '{"0":[],"1":[]}'::jsonb,
  marcacoes        jsonb not null default '{}'::jsonb,                -- {suspeito: 'suspeito'|'alibi'|'descartado'}
  mostrados        text[] not null default '{}',                      -- provas exclusivas mostradas ao parceiro
  mostrou          int[] not null default '{0,0}',                    -- quantas cada jogador já mostrou
  dicas            int  not null default 0,
  tentativas       int  not null default 0,                           -- acusações erradas
  ultima_tentativa timestamptz,
  proposta         jsonb,                                             -- {"por": 0, "respostas": {...}}
  feedback         text,
  desistiu         boolean[] not null default '{false,false}',
  estrelas         int check (estrelas is null or estrelas between 0 and 3),
  iniciada_em      timestamptz not null default now(),
  atualizada_em    timestamptz not null default now(),
  concluida_em     timestamptz,
  unique (sala, caso)
);
create index if not exists investigacoes_sala_idx on public.investigacoes (sala, atualizada_em desc);
alter table public.investigacoes enable row level security;
drop policy if exists "ler" on public.investigacoes;
create policy "ler" on public.investigacoes for select to anon, authenticated using (true);
-- Sem policy de escrita: tudo passa pelos RPCs.

create table if not exists public.investigacoes_notas (
  id            uuid primary key default gen_random_uuid(),
  investigacao  uuid not null references public.investigacoes(id) on delete cascade,
  sala          text not null references public.salas(codigo) on delete cascade,
  autor         int  not null check (autor in (0,1)),
  texto         text not null check (char_length(btrim(texto)) between 1 and 500),
  suspeito      text,                                   -- nota presa a um suspeito (opcional)
  hora          text check (hora is null or hora ~ '^[0-2][0-9]:[0-5][0-9]$'),   -- nota na linha do tempo (opcional)
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists investigacoes_notas_idx on public.investigacoes_notas (investigacao, criada_em);
-- "Fato" (confirmado por documento) ou "dúvida" (suspeita a conferir)
alter table public.investigacoes_notas add column if not exists marca text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'investigacoes_notas_marca_ck') then
    alter table public.investigacoes_notas add constraint investigacoes_notas_marca_ck check (marca is null or marca in ('fato', 'duvida'));
  end if;
end $$;

do $$
declare t text;
begin
  t := 'investigacoes_notas';
  execute format('alter table public.%I enable row level security', t);
  execute format('drop policy if exists "ler" on public.%I', t);
  execute format('create policy "ler" on public.%I for select to anon, authenticated using (true)', t);
  execute format('drop policy if exists "criar" on public.%I', t);
  execute format('create policy "criar" on public.%I for insert to anon, authenticated with check (exists (select 1 from public.investigacoes i where i.id = investigacoes_notas.investigacao and i.sala = investigacoes_notas.sala))', t);
  execute format('drop policy if exists "alterar" on public.%I', t);
  execute format('create policy "alterar" on public.%I for update to anon, authenticated using (true) with check (true)', t);
  execute format('drop policy if exists "apagar" on public.%I', t);
  execute format('create policy "apagar" on public.%I for delete to anon, authenticated using (true)', t);
  foreach t in array array['investigacoes','investigacoes_notas']
  loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

------------------------------------------------------------------------------
-- 2) Funções internas (o app NÃO pode chamar)
------------------------------------------------------------------------------
-- Compara senhas sem ligar para maiúsculas, acentos, espaços e pontuação
create or replace function public._inv_norm(t text)
returns text language sql immutable as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
           '[^a-z0-9]', '', 'g');
$$;

-- Confere se o JSON de um caso está completo e coerente. Devolve a lista de problemas (vazia = ok).
create or replace function public.caso_validar(d jsonb)
returns text[] language plpgsql immutable as $$
declare e text[] := '{}'; x jsonb; ids text[]; travas text[]; sus text[]; n int;
begin
  if jsonb_typeof(d->'suspeitos') <> 'array' or jsonb_array_length(d->'suspeitos') < 2 then e := e || 'faltam suspeitos (mínimo 2)'; end if;
  if jsonb_typeof(d->'docs') <> 'array' or jsonb_array_length(d->'docs') < 3 then e := e || 'faltam documentos (mínimo 3)'; end if;
  if jsonb_typeof(d->'perguntas') <> 'array' or jsonb_array_length(d->'perguntas') < 1 then e := e || 'faltam perguntas'; end if;
  if d->'solucao'->>'resumo' is null then e := e || 'falta solucao.resumo'; end if;
  if array_length(e, 1) > 0 then return e; end if;

  select array_agg(s->>'id') into sus from jsonb_array_elements(d->'suspeitos') s;
  if (select count(distinct v) from unnest(sus) v) <> array_length(sus, 1) or array_position(sus, null) is not null then
    e := e || 'suspeitos com id repetido ou vazio'; end if;

  select coalesce(array_agg(t->>'id'), '{}') into travas from jsonb_array_elements(coalesce(d->'travas', '[]'::jsonb)) t;
  for x in select * from jsonb_array_elements(coalesce(d->'travas', '[]'::jsonb)) loop
    if public._inv_norm(x->>'resposta') = '' then e := e || format('trava %s sem resposta', x->>'id'); end if;
    if x->>'titulo' is null then e := e || format('trava %s sem título', x->>'id'); end if;
    if coalesce(x->>'formato', '') not in ('codigo', 'palavra', 'escolha') then e := e || format('trava %s: formato deve ser codigo, palavra ou escolha', x->>'id'); end if;
    if x->>'formato' = 'escolha' and (jsonb_typeof(x->'opcoes') is distinct from 'array' or jsonb_array_length(x->'opcoes') < 2
       or (select count(*) from jsonb_array_elements(x->'opcoes') o where o->>'id' = x->>'resposta') <> 1) then
      e := e || format('trava %s: escolha precisa de 2+ opções e a resposta entre elas', x->>'id'); end if;
    if not exists (select 1 from jsonb_array_elements(d->'docs') k where k->>'trava' = x->>'id') then
      e := e || format('trava %s não abre nenhum documento', x->>'id'); end if;
  end loop;

  select array_agg(k->>'id') into ids from jsonb_array_elements(d->'docs') k;
  if (select count(distinct v) from unnest(ids) v) <> array_length(ids, 1) or array_position(ids, null) is not null then
    e := e || 'documentos com id repetido ou vazio'; end if;
  for x in select * from jsonb_array_elements(d->'docs') loop
    if coalesce(x->>'para', '') not in ('ambos', 'a', 'b') then e := e || format('doc %s: para deve ser ambos, a ou b', x->>'id'); end if;
    if x->>'titulo' is null or x->>'tipo' is null then e := e || format('doc %s sem título ou tipo', x->>'id'); end if;
    if x->>'texto' is null and jsonb_typeof(x->'mensagens') is distinct from 'array' then e := e || format('doc %s sem texto nem mensagens', x->>'id'); end if;
    if x->>'trava' is not null and not (x->>'trava' = any(travas)) then e := e || format('doc %s aponta para trava inexistente', x->>'id'); end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(d->'docs') k where k->>'tipo' = 'briefing' and k->>'para' = 'ambos' and k->>'trava' is null) then
    e := e || 'falta o briefing (doc tipo briefing, para ambos, sem trava)'; end if;
  select count(*) into n from jsonb_array_elements(d->'docs') k where k->>'para' = 'a' and k->>'trava' is null;
  if n = 0 then e := e || 'o envelope A está vazio'; end if;
  select count(*) into n from jsonb_array_elements(d->'docs') k where k->>'para' = 'b' and k->>'trava' is null;
  if n = 0 then e := e || 'o envelope B está vazio'; end if;

  for x in select * from jsonb_array_elements(d->'perguntas') loop
    if x->>'id' is null or x->>'texto' is null or x->>'rotulo' is null then e := e || 'pergunta sem id, texto ou rotulo'; end if;
    if jsonb_typeof(x->'opcoes') <> 'array' or jsonb_array_length(x->'opcoes') < 2 then e := e || format('pergunta %s com menos de 2 opções', x->>'id');
    elsif (select count(*) from jsonb_array_elements(x->'opcoes') o where o->>'id' = x->>'certa') <> 1 then
      e := e || format('pergunta %s: a resposta certa não está entre as opções', x->>'id'); end if;
  end loop;
  return e;
end $$;

-- Instala ou atualiza um caso (rodar no SQL Editor; o app não tem acesso)
create or replace function public.caso_instalar(p_id text, p_titulo text, p_emoji text, p_tema text, p_formato text,
  p_minutos int, p_dificuldade int, p_sinopse text, p_versao int, p_teste boolean, p_dados jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare erros text[];
begin
  erros := public.caso_validar(p_dados);
  if array_length(erros, 1) > 0 then
    raise exception 'Caso % com problemas: %', p_id, array_to_string(erros, ' | ');
  end if;
  insert into public.casos (id, titulo, emoji, tema, formato, minutos, dificuldade, sinopse, versao, teste, n_suspeitos, n_docs)
  values (p_id, p_titulo, p_emoji, p_tema, p_formato, p_minutos, p_dificuldade, p_sinopse, p_versao, p_teste,
          jsonb_array_length(p_dados->'suspeitos'), jsonb_array_length(p_dados->'docs'))
  on conflict (id) do update set titulo = excluded.titulo, emoji = excluded.emoji, tema = excluded.tema,
    formato = excluded.formato, minutos = excluded.minutos, dificuldade = excluded.dificuldade,
    sinopse = excluded.sinopse, versao = excluded.versao, teste = excluded.teste,
    n_suspeitos = excluded.n_suspeitos, n_docs = excluded.n_docs;
  insert into public.casos_segredo (caso, dados) values (p_id, p_dados)
  on conflict (caso) do update set dados = excluded.dados;
  return p_id || ' v' || p_versao || ' instalado';
end $$;

-- Carrega a partida conferindo a sala (e trava a linha para evitar corrida entre os dois celulares)
create or replace function public._inv_pegar(p_sala text, p_inv uuid)
returns public.investigacoes language plpgsql security definer set search_path = public as $$
declare r public.investigacoes;
begin
  select * into r from public.investigacoes where id = p_inv and sala = p_sala for update;
  if not found then raise exception 'investigação não encontrada nesta sala'; end if;
  return r;
end $$;

-- Corrige a acusação que está em `proposta`
create or replace function public._inv_avaliar(p_inv uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; d jsonb; q jsonb; total int := 0; certas int := 0;
        ok_rot text[] := '{}'; err_rot text[] := '{}'; fb text; est int;
begin
  select * into r from public.investigacoes where id = p_inv for update;
  select dados into d from public.casos_segredo where caso = r.caso;
  for q in select * from jsonb_array_elements(d->'perguntas') loop
    total := total + 1;
    if r.proposta->'respostas'->>(q->>'id') = q->>'certa' then
      certas := certas + 1; ok_rot := ok_rot || (q->>'rotulo');
    else err_rot := err_rot || (q->>'rotulo'); end if;
  end loop;

  if certas = total then
    est := case when r.tentativas = 0 and r.dicas = 0 then 3
                when r.tentativas <= 1 and r.dicas <= 1 then 2 else 1 end;
    update public.investigacoes
       set estado = 'concluido', estrelas = est, concluida_em = now(), atualizada_em = now(),
           feedback = 'Caso encerrado.', proposta = null
     where id = p_inv;
    return jsonb_build_object('resolvido', true, 'estrelas', est);
  end if;

  -- 1ª acusação errada: só a contagem. Da 2ª em diante: diz o que está certo, nunca a resposta.
  if r.tentativas = 0 then
    fb := format('Respostas certas: %s de %s. O relatório ainda não fecha: continuem investigando.', certas, total);
  elsif certas = 0 then
    fb := 'Nenhuma das respostas está certa. Voltem aos álibis e aos horários.';
  else
    fb := format('Vocês acertaram %s, mas ainda não %s.',
                 array_to_string(ok_rot, ' e '), array_to_string(err_rot, ' nem '));
  end if;
  update public.investigacoes
     set estado = 'investigando', tentativas = tentativas + 1, ultima_tentativa = now(),
         feedback = fb, proposta = null, atualizada_em = now()
   where id = p_inv;
  return jsonb_build_object('resolvido', false, 'certas', certas, 'total', total, 'feedback', fb);
end $$;

------------------------------------------------------------------------------
-- 3) RPCs do app
------------------------------------------------------------------------------
-- Começa (ou retoma) a investigação de um caso na sala. Sorteia quem fica com cada envelope.
create or replace function public.inv_iniciar(p_sala text, p_caso text, p_um_celular boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_versao int;
begin
  if not exists (select 1 from public.salas where codigo = p_sala) then raise exception 'sala não existe'; end if;
  select versao into v_versao from public.casos where id = p_caso and ativo;
  if not found then raise exception 'caso não existe'; end if;
  insert into public.investigacoes (sala, caso, versao, um_celular, pacote_a)
  values (p_sala, p_caso, v_versao, coalesce(p_um_celular, false), floor(random() * 2)::int)
  on conflict (sala, caso) do nothing
  returning id into v_id;
  if v_id is null then select id into v_id from public.investigacoes where sala = p_sala and caso = p_caso; end if;
  return v_id;
end $$;

-- "Abrir o envelope". Quando os dois abrem (ou no modo um celular), começa a investigação.
create or replace function public.inv_abrir(p_sala text, p_inv uuid, p_jogador int)
returns text language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; v_abriu boolean[];
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  r := public._inv_pegar(p_sala, p_inv);
  v_abriu := r.abriu; v_abriu[p_jogador + 1] := true;
  update public.investigacoes
     set abriu = v_abriu,
         estado = case when estado = 'envelope' and (um_celular or (v_abriu[1] and v_abriu[2])) then 'investigando' else estado end,
         atualizada_em = now()
   where id = p_inv
  returning estado into r.estado;
  return r.estado;
end $$;

-- O dossiê do jogador: só o que ELE pode ver agora.
create or replace function public.inv_dossie(p_sala text, p_inv uuid, p_jogador int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; d jsonb; meu text; lim jsonb;
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  select * into r from public.investigacoes where id = p_inv and sala = p_sala;
  if not found then raise exception 'investigação não encontrada nesta sala'; end if;
  select dados into d from public.casos_segredo where caso = r.caso;
  meu := case when r.pacote_a = p_jogador then 'a' else 'b' end;
  lim := coalesce(d->'limites', '{}'::jsonb);

  return jsonb_build_object(
    'meu_envelope', case when r.um_celular then 'ambos' else meu end,
    'suspeitos', d->'suspeitos',
    'docs', coalesce((
      select jsonb_agg((k.doc - 'trava') || jsonb_build_object(
               'exclusivo', (k.doc->>'para') <> 'ambos' and not r.um_celular,
               'mostrado',  (k.doc->>'id') = any(r.mostrados),
               'de_trava',  k.doc->>'trava') order by k.ord)
        from jsonb_array_elements(d->'docs') with ordinality k(doc, ord)
       where (k.doc->>'trava' is null or k.doc->>'trava' = any(r.travas_abertas))
         and (r.um_celular or k.doc->>'para' in ('ambos', meu) or k.doc->>'id' = any(r.mostrados))
    ), '[]'::jsonb),
    -- o que o parceiro tem e eu não: só título e tipo, para eu saber o que perguntar
    'do_parceiro', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.doc->>'id', 'titulo', k.doc->>'titulo', 'tipo', k.doc->>'tipo') order by k.ord)
        from jsonb_array_elements(d->'docs') with ordinality k(doc, ord)
       where not r.um_celular
         and (k.doc->>'trava' is null or k.doc->>'trava' = any(r.travas_abertas))
         and k.doc->>'para' not in ('ambos', meu) and not (k.doc->>'id' = any(r.mostrados))
    ), '[]'::jsonb),
    'travas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t->>'id', 'titulo', t->>'titulo', 'descricao', t->>'descricao', 'formato', t->>'formato',
               'opcoes', t->'opcoes',
               'aberta', (t->>'id') = any(r.travas_abertas),
               'bloqueada_ate', r.travas_erros->(t->>'id')->>'ate'))
        from jsonb_array_elements(coalesce(d->'travas', '[]'::jsonb)) t
    ), '[]'::jsonb),
    'perguntas', (
      select jsonb_agg(q - 'certa') from jsonb_array_elements(d->'perguntas') q),
    'dicas', coalesce((
      select jsonb_agg(x.dica order by x.ord)
        from jsonb_array_elements(coalesce(d->'dicas', '[]'::jsonb)) with ordinality x(dica, ord)
       where x.ord <= r.dicas), '[]'::jsonb),
    'dicas_total', jsonb_array_length(coalesce(d->'dicas', '[]'::jsonb)),
    'limites', jsonb_build_object(
      'mostrar', coalesce((lim->>'mostrar')::int, 3),
      'mostrei', r.mostrou[p_jogador + 1],
      'espera_min', coalesce((lim->>'espera_min')::int, 5))
  );
end $$;

-- Marca um documento como lido (para o "Carol leu 5 de 9")
create or replace function public.inv_ler(p_sala text, p_inv uuid, p_jogador int, p_doc text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; k text;
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  r := public._inv_pegar(p_sala, p_inv);
  k := p_jogador::text;
  if r.lidos->k @> to_jsonb(p_doc) then return false; end if;
  if jsonb_array_length(r.lidos->k) >= 300 then return false; end if;
  update public.investigacoes
     set lidos = jsonb_set(lidos, array[k], (lidos->k) || to_jsonb(p_doc)), atualizada_em = now()
   where id = p_inv;
  return true;
end $$;

-- Tenta abrir uma prova trancada. Senha: 5 erros seguidos travam por 1 minuto.
-- Objetivo de múltipla escolha (formato escolha): cada erro trava por 2 minutos.
create or replace function public.inv_destravar(p_sala text, p_inv uuid, p_jogador int, p_trava text, p_tentativa text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; d jsonb; t jsonb; er jsonb; n int; ate timestamptz;
begin
  r := public._inv_pegar(p_sala, p_inv);
  if r.estado not in ('investigando', 'acusacao') then raise exception 'a investigação não está aberta'; end if;
  if p_trava = any(r.travas_abertas) then return jsonb_build_object('ok', true); end if;
  select dados into d from public.casos_segredo where caso = r.caso;
  select x into t from jsonb_array_elements(coalesce(d->'travas', '[]'::jsonb)) x where x->>'id' = p_trava;
  if t is null then raise exception 'trava não existe'; end if;

  er := coalesce(r.travas_erros->p_trava, '{"n":0}'::jsonb);
  ate := (er->>'ate')::timestamptz;
  if ate is not null and ate > now() then
    return jsonb_build_object('ok', false, 'bloqueada_ate', ate);
  end if;

  if public._inv_norm(p_tentativa) = public._inv_norm(t->>'resposta') then
    update public.investigacoes
       set travas_abertas = travas_abertas || p_trava, travas_erros = travas_erros - p_trava, atualizada_em = now()
     where id = p_inv;
    return jsonb_build_object('ok', true);
  end if;

  n := coalesce((er->>'n')::int, 0) + 1;
  if t->>'formato' = 'escolha' then      -- objetivo de múltipla escolha: cada erro custa 2 minutos
    n := 5; er := jsonb_build_object('n', 0, 'ate', now() + interval '2 minutes');
  elsif n >= 5 then
    er := jsonb_build_object('n', 0, 'ate', now() + interval '1 minute');
  else
    er := jsonb_build_object('n', n);
  end if;
  update public.investigacoes set travas_erros = jsonb_set(travas_erros, array[p_trava], er), atualizada_em = now()
   where id = p_inv;
  return jsonb_build_object('ok', false, 'restam', greatest(5 - n, 0), 'bloqueada_ate', er->>'ate');
end $$;

-- "Mostrar ao parceiro": libera uma prova exclusiva minha para o outro ver. Limitado por caso.
create or replace function public.inv_mostrar(p_sala text, p_inv uuid, p_jogador int, p_doc text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; d jsonb; k jsonb; meu text; lim int; v int[];
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  r := public._inv_pegar(p_sala, p_inv);
  if r.estado not in ('investigando', 'acusacao') then raise exception 'a investigação não está aberta'; end if;
  if p_doc = any(r.mostrados) then return jsonb_build_object('ok', true); end if;
  select dados into d from public.casos_segredo where caso = r.caso;
  meu := case when r.pacote_a = p_jogador then 'a' else 'b' end;
  select x into k from jsonb_array_elements(d->'docs') x where x->>'id' = p_doc;
  if k is null or k->>'para' <> meu or (k->>'trava' is not null and not (k->>'trava' = any(r.travas_abertas))) then
    raise exception 'essa prova não é sua para mostrar';
  end if;
  lim := coalesce((d->'limites'->>'mostrar')::int, 3);
  if r.mostrou[p_jogador + 1] >= lim then
    return jsonb_build_object('ok', false, 'motivo', 'limite');
  end if;
  v := r.mostrou; v[p_jogador + 1] := v[p_jogador + 1] + 1;
  update public.investigacoes set mostrados = mostrados || p_doc, mostrou = v, atualizada_em = now() where id = p_inv;
  return jsonb_build_object('ok', true, 'restam', lim - v[p_jogador + 1]);
end $$;

-- Quadro: marca um suspeito
create or replace function public.inv_marcar(p_sala text, p_inv uuid, p_suspeito text, p_estado text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.investigacoes;
begin
  if p_estado not in ('neutro', 'suspeito', 'alibi', 'descartado') then raise exception 'estado inválido'; end if;
  r := public._inv_pegar(p_sala, p_inv);
  if not exists (select 1 from public.casos_segredo c, jsonb_array_elements(c.dados->'suspeitos') s
                  where c.caso = r.caso and s->>'id' = p_suspeito) then raise exception 'suspeito não existe'; end if;
  update public.investigacoes
     set marcacoes = case when p_estado = 'neutro' then marcacoes - p_suspeito
                          else jsonb_set(marcacoes, array[p_suspeito], to_jsonb(p_estado)) end,
         atualizada_em = now()
   where id = p_inv;
  return true;
end $$;

-- Pede a próxima dica (cada dica pesa nas estrelas)
create or replace function public.inv_dica(p_sala text, p_inv uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; d jsonb; total int;
begin
  r := public._inv_pegar(p_sala, p_inv);
  if r.estado <> 'investigando' then raise exception 'a investigação não está aberta'; end if;
  select dados into d from public.casos_segredo where caso = r.caso;
  total := jsonb_array_length(coalesce(d->'dicas', '[]'::jsonb));
  if r.dicas >= total then return jsonb_build_object('ok', false, 'motivo', 'acabaram'); end if;
  update public.investigacoes set dicas = dicas + 1, atualizada_em = now() where id = p_inv;
  return jsonb_build_object('ok', true, 'dica', d->'dicas'->r.dicas, 'restam', total - r.dicas - 1);
end $$;

-- Acusação final: um propõe as respostas...
create or replace function public.inv_propor(p_sala text, p_inv uuid, p_jogador int, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; d jsonb; q jsonb; espera int; livre timestamptz;
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  r := public._inv_pegar(p_sala, p_inv);
  if r.estado <> 'investigando' then raise exception 'não dá para acusar agora'; end if;
  select dados into d from public.casos_segredo where caso = r.caso;
  espera := coalesce((d->'limites'->>'espera_min')::int, 5);
  livre := r.ultima_tentativa + make_interval(mins => espera);
  if livre is not null and livre > now() then
    return jsonb_build_object('ok', false, 'motivo', 'espera', 'livre_em', livre);
  end if;
  for q in select * from jsonb_array_elements(d->'perguntas') loop
    if not exists (select 1 from jsonb_array_elements(q->'opcoes') o where o->>'id' = p_respostas->>(q->>'id')) then
      raise exception 'falta responder: %', q->>'rotulo';
    end if;
  end loop;
  update public.investigacoes
     set proposta = jsonb_build_object('por', p_jogador, 'respostas', p_respostas),
         estado = 'acusacao', atualizada_em = now()
   where id = p_inv;
  if r.um_celular then
    return jsonb_build_object('ok', true) || public._inv_avaliar(p_inv);
  end if;
  return jsonb_build_object('ok', true, 'aguardando', 1 - p_jogador);
end $$;

-- ...e o outro assina (ou devolve para continuar investigando). Só com os dois de acordo o caso é corrigido.
create or replace function public.inv_confirmar(p_sala text, p_inv uuid, p_jogador int, p_aceita boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes;
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  r := public._inv_pegar(p_sala, p_inv);
  if r.estado <> 'acusacao' or r.proposta is null then raise exception 'não há acusação para assinar'; end if;
  if (r.proposta->>'por')::int = p_jogador then raise exception 'quem assina é o parceiro'; end if;
  if not coalesce(p_aceita, false) then
    update public.investigacoes
       set estado = 'investigando', proposta = null, atualizada_em = now(),
           feedback = 'A acusação foi devolvida para vocês conversarem mais.'
     where id = p_inv;
    return jsonb_build_object('ok', true, 'devolvida', true);
  end if;
  return jsonb_build_object('ok', true) || public._inv_avaliar(p_inv);
end $$;

-- Quem propôs pode retirar a acusação antes de o parceiro assinar
create or replace function public.inv_retirar(p_sala text, p_inv uuid, p_jogador int)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.investigacoes;
begin
  r := public._inv_pegar(p_sala, p_inv);
  if r.estado <> 'acusacao' or (r.proposta->>'por')::int <> p_jogador then return false; end if;
  update public.investigacoes set estado = 'investigando', proposta = null, atualizada_em = now() where id = p_inv;
  return true;
end $$;

-- "Revelar a solução": só depois de pelo menos uma acusação errada e com os DOIS pedindo. Fica sem estrelas.
create or replace function public.inv_desistir(p_sala text, p_inv uuid, p_jogador int, p_quer boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; v boolean[];
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  r := public._inv_pegar(p_sala, p_inv);
  if r.estado <> 'investigando' then raise exception 'não dá para revelar agora'; end if;
  if r.tentativas < 1 then return jsonb_build_object('ok', false, 'motivo', 'tentem acusar ao menos uma vez'); end if;
  v := r.desistiu; v[p_jogador + 1] := coalesce(p_quer, true);
  if r.um_celular and v[p_jogador + 1] then v := '{true,true}'; end if;
  update public.investigacoes
     set desistiu = v,
         estado = case when v[1] and v[2] then 'revelado' else estado end,
         estrelas = case when v[1] and v[2] then 0 else estrelas end,
         concluida_em = case when v[1] and v[2] then now() else concluida_em end,
         atualizada_em = now()
   where id = p_inv;
  return jsonb_build_object('ok', true, 'revelado', v[1] and v[2]);
end $$;

-- Relatório de conclusão: a verdade, só depois do fim
create or replace function public.inv_relatorio(p_sala text, p_inv uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.investigacoes; d jsonb;
begin
  select * into r from public.investigacoes where id = p_inv and sala = p_sala;
  if not found then raise exception 'investigação não encontrada nesta sala'; end if;
  if r.estado not in ('concluido', 'revelado') then raise exception 'o caso ainda não foi encerrado'; end if;
  select dados into d from public.casos_segredo where caso = r.caso;
  return jsonb_build_object(
    'solucao', d->'solucao',
    'perguntas', d->'perguntas',
    'docs', d->'docs',           -- no fim, os dois podem ler tudo
    'estrelas', r.estrelas, 'tentativas', r.tentativas, 'dicas', r.dicas,
    'iniciada_em', r.iniciada_em, 'concluida_em', r.concluida_em);
end $$;

-- Recomeçar do zero (apaga a partida e as anotações; o app confirma antes)
create or replace function public.inv_reiniciar(p_sala text, p_inv uuid)
returns boolean language sql security definer set search_path = public as $$
  with d as (delete from public.investigacoes where id = p_inv and sala = p_sala returning 1)
  select exists (select 1 from d);
$$;

------------------------------------------------------------------------------
-- 4) Permissões: o app chama só os inv_*; o resto fica fechado
------------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    '_inv_norm(text)', 'caso_validar(jsonb)', '_inv_pegar(text, uuid)', '_inv_avaliar(uuid)',
    'caso_instalar(text, text, text, text, text, int, int, text, int, boolean, jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'inv_iniciar(text, text, boolean)', 'inv_abrir(text, uuid, int)', 'inv_dossie(text, uuid, int)',
    'inv_ler(text, uuid, int, text)', 'inv_destravar(text, uuid, int, text, text)',
    'inv_mostrar(text, uuid, int, text)', 'inv_marcar(text, uuid, text, text)', 'inv_dica(text, uuid)',
    'inv_propor(text, uuid, int, jsonb)', 'inv_confirmar(text, uuid, int, boolean)',
    'inv_retirar(text, uuid, int)', 'inv_desistir(text, uuid, int, boolean)',
    'inv_relatorio(text, uuid)', 'inv_reiniciar(text, uuid)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

------------------------------------------------------------------------------
-- 5) Caso de TESTE (sem graça de propósito; serve para o desenvolvimento). Solução: a / m1 / p1.
--    Senha do cofre: 1234. Objetivo 1: quintal. O app só lista casos de teste com ?teste=1 na URL.
------------------------------------------------------------------------------
select public.caso_instalar('teste-biscoito', 'TESTE · O biscoito sumiu', '🧪', 'policial', 'curto', 5, 1,
  'Caso de teste para o desenvolvimento. Não tem graça nenhuma e a solução está no SQL.', 1, true,
$caso${
  "limites": {"mostrar": 2, "espera_min": 0},
  "suspeitos": [
    {"id": "a", "nome": "Suspeito A", "idade": 30, "emoji": "🅰️", "aparencia": "Usa camisa azul.", "vinculo": "Dono da cozinha", "motivo": "Adora biscoito.", "alibi": "Diz que estava na sala."},
    {"id": "b", "nome": "Suspeito B", "idade": 40, "emoji": "🅱️", "aparencia": "Usa camisa verde.", "vinculo": "Vizinho", "motivo": "Estava com fome.", "alibi": "Diz que estava no quintal."}
  ],
  "docs": [
    {"id": "briefing", "tipo": "briefing", "para": "ambos", "titulo": "Relatório inicial", "texto": "O último biscoito sumiu do pote às 15:00.\nDescubram quem comeu, por quê e qual prova derruba o álibi."},
    {"id": "a1", "tipo": "depoimento", "para": "a", "titulo": "Depoimento do Suspeito A", "texto": "\"Às 15:00 eu estava na sala vendo TV.\""},
    {"id": "a2", "tipo": "chat", "para": "a", "titulo": "Conversa de A com a mãe", "mensagens": [
      {"de": "Mãe", "hora": "14:50", "texto": "Qual é a senha do cofre?"},
      {"de": "A", "hora": "14:51", "texto": "Um, dois, três, quatro."}]},
    {"id": "b1", "tipo": "laudo", "para": "b", "titulo": "Laudo da TV", "texto": "A TV da sala ficou desligada das 14:00 às 16:00."},
    {"id": "b2", "tipo": "registro", "para": "b", "titulo": "Registro do quintal", "texto": "A câmera do quintal mostra o Suspeito B regando as plantas das 14:30 às 15:30."},
    {"id": "t1", "tipo": "foto", "para": "ambos", "trava": "cofre", "titulo": "Conteúdo do cofre", "texto": "Dentro do cofre: farelos de biscoito e a camisa azul."},
    {"id": "e2", "tipo": "audio", "para": "ambos", "trava": "etapa2", "titulo": "Etapa 2: recado na secretária", "texto": "RECADO DE VOZ\n\"Oi, aqui é a vizinha. Vi o A na cozinha às três.\""}
  ],
  "travas": [
    {"id": "cofre", "titulo": "Cofre da cozinha", "descricao": "Cadeado de 4 dígitos.", "formato": "codigo", "resposta": "1234"},
    {"id": "etapa2", "titulo": "Objetivo 1", "descricao": "Onde o Suspeito B estava às 15:00? Acertem para receber novas provas.", "formato": "escolha", "resposta": "quintal",
     "opcoes": [{"id": "sala", "texto": "Na sala"}, {"id": "quintal", "texto": "No quintal"}, {"id": "cozinha", "texto": "Na cozinha"}]}
  ],
  "perguntas": [
    {"id": "quem", "rotulo": "o culpado", "texto": "Quem comeu o biscoito?", "certa": "a",
     "opcoes": [{"id": "a", "texto": "Suspeito A"}, {"id": "b", "texto": "Suspeito B"}]},
    {"id": "motivo", "rotulo": "o motivo", "texto": "Por quê?", "certa": "m1",
     "opcoes": [{"id": "m1", "texto": "Porque adora biscoito"}, {"id": "m2", "texto": "Por vingança"}]},
    {"id": "prova", "rotulo": "a prova que derruba o álibi", "texto": "Qual prova derruba o álibi?", "certa": "p1",
     "opcoes": [{"id": "p1", "texto": "Laudo da TV"}, {"id": "p2", "texto": "Registro do quintal"}]}
  ],
  "dicas": ["Dica 1 de teste: olhem a TV.", "Dica 2 de teste: foi o A."],
  "solucao": {
    "resumo": "O Suspeito A comeu o biscoito. A TV estava desligada, então ele não estava vendo TV.",
    "linha_do_tempo": [{"hora": "15:00", "texto": "A come o biscoito e guarda a camisa no cofre."}],
    "falsas_pistas": ["O Suspeito B estava mesmo no quintal."]
  }
}$caso$::jsonb);

------------------------------------------------------------------------------
-- 6) Caso de verdade (codificado para não dar spoiler)
------------------------------------------------------------------------------
select public.caso_instalar('violao-do-cais', 'O violão do cais', '🎸', 'policial', 'medio', 40, 2,
  'Um violão histórico some do memorial durante um apagão de cinco minutos, no meio de um sarau. Cinco pessoas tinham motivo. Uma delas mentiu sobre onde estava.', 1, false,
  convert_from(decode($b64$
eyJsaW1pdGVzIjogeyJtb3N0cmFyIjogMywgImVzcGVyYV9taW4iOiA1fSwgInN1c3BlaXRvcyI6IFt7ImlkIjogImhlbGVuYSIs
ICJub21lIjogIkhlbGVuYSBCcmFuZMOjbyIsICJpZGFkZSI6IDUyLCAicmV0cmF0byI6ICJjYXNvcy92aW9sYW8tZG8tY2Fpcy9o
ZWxlbmEiLCAiYXBhcmVuY2lhIjogIkNhYmVsbyBncmlzYWxobyBwcmVzbywgw7NjdWxvcyBkZSBhcm8gdmVybWVsaG8sIGZhbGEg
cGF1c2FkYS4iLCAidmluY3VsbyI6ICJEaXJldG9yYSBkbyBNZW1vcmlhbCBow6Egc2VpcyBhbm9zLiIsICJtb3Rpdm8iOiAiTyBt
ZW1vcmlhbCBlc3TDoSBlbmRpdmlkYWRvIGUgbyB2aW9sw6NvIHRlbSBzZWd1cm8uIiwgImFsaWJpIjogIkRpeiBxdWUgZXN0YXZh
IG5vIHBhbGNvLCBmYWxhbmRvIGFvIHDDumJsaWNvLiJ9LCB7ImlkIjogImNhaW8iLCAibm9tZSI6ICJDYWlvIE1vbnRlbmVncm8i
LCAiaWRhZGUiOiAzNCwgInJldHJhdG8iOiAiY2Fzb3MvdmlvbGFvLWRvLWNhaXMvY2FpbyIsICJhcGFyZW5jaWEiOiAiTcOjb3Mg
Y2FsZWphZGFzLCBhdmVudGFsIGRlIGNvdXJvLCBzZW1wcmUgY29tIHVtIGzDoXBpcyBhdHLDoXMgZGEgb3JlbGhhLiIsICJ2aW5j
dWxvIjogIkx1dGhpZXIgY29udHJhdGFkbyBwYXJhIHJlc3RhdXJhciBvIHZpb2zDo28uIiwgIm1vdGl2byI6ICJEZXZlIGRpbmhl
aXJvIGUgY29uaGVjZSBvIHZhbG9yIGRhIHBlw6dhIGNvbW8gbmluZ3XDqW0uIiwgImFsaWJpIjogIkRpeiBxdWUgc2FpdSBkbyBw
csOpZGlvIGFudGVzIGRlIGEgbHV6IGNhaXIuIn0sIHsiaWQiOiAibWFybGVuZSIsICJub21lIjogIk1hcmxlbmUgQ2FuZGVpYSIs
ICJpZGFkZSI6IDYxLCAicmV0cmF0byI6ICJjYXNvcy92aW9sYW8tZG8tY2Fpcy9tYXJsZW5lIiwgImFwYXJlbmNpYSI6ICJWZXN0
aWRvIGVzdGFtcGFkbywgY29sYXIgZGUgY29udGFzLCB2b3ogcXVlIGVuY2hlIGEgc2FsYS4iLCAidmluY3VsbyI6ICJTb2JyaW5o
YSBkZSBUacOjbyBDYW5kZWlhLiBDb250ZXN0YSBuYSBKdXN0acOnYSBhIGRvYcOnw6NvIGRvIHZpb2zDo28uIiwgIm1vdGl2byI6
ICJDb25zaWRlcmEgbyB2aW9sw6NvIHVtIGJlbSBkYSBmYW3DrWxpYS4iLCAiYWxpYmkiOiAiRGl6IHF1ZSBlc3RhdmEgYW8gdGVs
ZWZvbmUsIGZvcmEgZG8gc2Fsw6NvLiJ9LCB7ImlkIjogIm90YXZpbyIsICJub21lIjogIk90w6F2aW8gUmVpcyIsICJpZGFkZSI6
IDQ1LCAicmV0cmF0byI6ICJjYXNvcy92aW9sYW8tZG8tY2Fpcy9vdGF2aW8iLCAiYXBhcmVuY2lhIjogIkJsYXplciBjbGFybywg
cmVsw7NnaW8gZ3JhbmRlLCBhcGVydG8gZGUgbcOjbyBkZW1vcmFkby4iLCAidmluY3VsbyI6ICJFbXByZXPDoXJpbyBkbyByYW1v
IG7DoXV0aWNvLCBjb2xlY2lvbmFkb3IgZSBwYXRyb2NpbmFkb3IgZG8gc2FyYXUuIiwgIm1vdGl2byI6ICJRdWlzIGNvbXByYXIg
byB2aW9sw6NvIG5vIGFubyBwYXNzYWRvIGUgb3V2aXUgdW0gbsOjby4iLCAiYWxpYmkiOiAiRGl6IHF1ZSBlc3RhdmEgbm8gdMOp
cnJlbyBkdXJhbnRlIG8gYXBhZ8Ojby4ifSwgeyJpZCI6ICJiaWEiLCAibm9tZSI6ICJCZWF0cml6IFwiQmlhXCIgTm9ndWVpcmEi
LCAiaWRhZGUiOiAyOSwgInJldHJhdG8iOiAiY2Fzb3MvdmlvbGFvLWRvLWNhaXMvYmlhIiwgImFwYXJlbmNpYSI6ICJDcmFjaMOh
IG5vIHBlc2Nvw6dvLCB0w6puaXMsIHVtIG1vbGhvIGRlIGNoYXZlcyBxdWUgbsOjbyBsYXJnYS4iLCAidmluY3VsbyI6ICJHdWlh
IGRvIG1lbW9yaWFsLCByZXNwb25zw6F2ZWwgcGVsYXMgc2FsYXMgZG8gYW5kYXIgZGUgY2ltYS4iLCAibW90aXZvIjogIkdhbmhh
IHBvdWNvIGUgY29uaGVjZSBhIHJvdGluYSBlIGFzIGNoYXZlcyBkYSBjYXNhLiIsICJhbGliaSI6ICJEaXogcXVlIGVzdGF2YSBu
YSByZWNlcMOnw6NvLiJ9XSwgImRvY3MiOiBbeyJpZCI6ICJicmllZmluZyIsICJ0aXBvIjogImJyaWVmaW5nIiwgInBhcmEiOiAi
YW1ib3MiLCAidGl0dWxvIjogIkJvbGV0aW0gZGUgb2NvcnLDqm5jaWEgbsK6IDA0MTIvMjAyNiIsICJ0ZXh0byI6ICJQT0zDjUNJ
QSBDSVZJTCDCtyAywqogREVMRUdBQ0lBIERFIFNBTlRBIFJJVEEgRE8gUEFSQUdVQcOHVVxuRnVydG8gcXVhbGlmaWNhZG9cblxu
TG9jYWw6IE1lbW9yaWFsIFRpw6NvIENhbmRlaWEsIFJ1YSBkbyBDYWlzLCAxOC5cbkRhdGE6IHPDoWJhZG8sIDE0LzAzLzIwMjYu
XG5PYmpldG86IHZpb2zDo28gZGUgMTk2MSBxdWUgcGVydGVuY2V1IGFvIGNvbXBvc2l0b3IgVGnDo28gQ2FuZGVpYSwgY29tIG8g
ZXN0b2pvIG9yaWdpbmFsLiBBdmFsaWFkbyBlbnRyZSBSJCAxODAgbWlsIGUgUiQgMjAwIG1pbC5cblxuTyBtZW1vcmlhbCByZWFi
cmlhIGFvIHDDumJsaWNvIGNvbSB1bSBzYXJhdSBwYXJhIGNlcmNhIGRlIDQwIGNvbnZpZGFkb3MuIE8gdmlvbMOjbyBmaWNhdmEg
bm8gZXhwb3NpdG9yIGRhIFNhbGEgMiwgbm8gYW5kYXIgZGUgY2ltYSwgZmVjaGFkbyBwb3IgdW0gY2FkZWFkbyBkZSBzZWdyZWRv
LlxuXG7DgHMgMjA6NDcgZmFsdG91IGx1eiBubyBwcsOpZGlvIHBvciBjZXJjYSBkZSBjaW5jbyBtaW51dG9zLiDDgHMgMjE6NDAs
IG5hIHJvbmRhLCBvIHZpZ2lhIGVuY29udHJvdSBvIGV4cG9zaXRvciB2YXppbyBlIGZlY2hhZG8uIE7Do28gaMOhIHNpbmFsIGRl
IGFycm9tYmFtZW50by5cblxuQ2luY28gcGVzc29hcyB0aW5oYW0gbW90aXZvIG91IGFjZXNzbyBlIGVzdGF2YW0gbm8gcHLDqWRp
byBuYXF1ZWxhIG5vaXRlLiBUb2RhcyBuZWdhbS5cblxuTUlTU8ODTzogZGVzY29icmlyIHF1ZW0gbGV2b3UgbyB2aW9sw6NvLCBw
b3IgcXXDqiwgZSBxdWFsIHByb3ZhIGRlcnJ1YmEgbyDDoWxpYmkgZGVzc2EgcGVzc29hLlxuXG5Wb2PDqnMgcmVjZWJlcmFtIGVu
dmVsb3BlcyBkaWZlcmVudGVzLiBOaW5ndcOpbSByZXNvbHZlIHNvemluaG86IGNvbnRlbSB1bSBhbyBvdXRybyBvIHF1ZSBsZXJh
bS4ifSwgeyJpZCI6ICJwbGFudGEiLCAidGlwbyI6ICJwbGFudGEiLCAicGFyYSI6ICJhbWJvcyIsICJ0aXR1bG8iOiAiUGxhbnRh
IGRvIG1lbW9yaWFsIiwgInRleHRvIjogIlTDiVJSRU9cbsK3IEVudHJhZGEgcGVsYSBSdWEgZG8gQ2FpcyBlIHJlY2Vww6fDo29c
bsK3IFNhbMOjbyBkbyBzYXJhdSwgY29tIG8gcGFsY28gZSBvIGJhclxuwrcgVmFyYW5kYSBsYXRlcmFsXG7CtyBCYW5oZWlybyBk
byB0w6lycmVvXG7CtyBDb3BhIGF0csOhcyBkbyBiYXIsIGNvbSBhIHBvcnRhIGRlIHNlcnZpw6dvIHF1ZSBkw6EgcGFyYSBhIHZp
ZWxhIGRvcyBmdW5kb3NcblxuQU5EQVIgREUgQ0lNQVxuwrcgU2FsYSAxIChmb3RvZ3JhZmlhcylcbsK3IFNhbGEgMiAobyB2aW9s
w6NvKVxuwrcgQ29ycmVkb3IsIGNvbSBvIHF1YWRybyBkZSBsdXpcbsK3IEJhbmhlaXJvIGRlIGNpbWFcblxuTElHQcOHw5VFU1xu
wrcgRXNjYWRhIHByaW5jaXBhbDogc2Fsw6NvIOKGlCBjb3JyZWRvciBkZSBjaW1hXG7CtyBFc2NhZGEgZGUgc2VydmnDp286IGNv
cGEg4oaUIGNvcnJlZG9yIGRlIGNpbWFcblxuQ8OCTUVSQVNcblVtYSBuYSBlbnRyYWRhIGUgdW1hIG5hIFNhbGEgMi4gTsOjbyBo
w6EgY8OibWVyYSBuYSBjb3BhLCBuYSBlc2NhZGEgZGUgc2VydmnDp28gbmVtIG5hIHZpZWxhLiJ9LCB7ImlkIjogImRlcC1oZWxl
bmEiLCAidGlwbyI6ICJkZXBvaW1lbnRvIiwgInBhcmEiOiAiYSIsICJ0aXR1bG8iOiAiRGVwb2ltZW50byBkZSBIZWxlbmEgQnJh
bmTDo28iLCAidGV4dG8iOiAiVEVSTU8gREUgREVQT0lNRU5UTyDCtyBIZWxlbmEgQnJhbmTDo28sIDUyLCBkaXJldG9yYVxuXG5c
IkNvbWVjZWkgYSBmYWxhciBubyBwYWxjbyDDoHMgMjA6NDAuIFF1YW5kbyBhIGx1eiBjYWl1IGV1IGNvbnRpbnVlaSBubyBtaWNy
b2ZvbmUsIHBlZGluZG8gY2FsbWEsIGF0w6kgZWxhIHZvbHRhci4gTyBzYWzDo28gaW50ZWlybyBtZSB2aXUuXG5cblNvYnJlIG8g
c2VndXJvOiBzaW0sIHBlZGkgcGFyYSBhdW1lbnRhciBvIHZhbG9yIG5vIGNvbWXDp28gZG8gbcOqcy4gTyB2aW9sw6NvIGZvaSBy
ZWF2YWxpYWRvIGRlcG9pcyBkbyByZXN0YXVybyBlIGEgYXDDs2xpY2UgYW50aWdhIGVzdGF2YSBkZWZhc2FkYS4gTsOjbyB2ZWpv
IGNyaW1lIG5pc3NvLlxuXG5PIHNlZ3JlZG8gZG8gY2FkZWFkbyBkbyBleHBvc2l0b3IgcXVlbSBzYWJlIHNvdSBldSwgbyBDYWlv
LCBxdWUgZmV6IG8gcmVzdGF1cm8sIGUgYSBCaWEsIHF1ZSBjdWlkYSBkYXMgc2FsYXMgZGUgY2ltYS4gTWFpcyBuaW5ndcOpbS5c
IiJ9LCB7ImlkIjogImRlcC1jYWlvIiwgInRpcG8iOiAiZGVwb2ltZW50byIsICJwYXJhIjogImEiLCAidGl0dWxvIjogIkRlcG9p
bWVudG8gZGUgQ2FpbyBNb250ZW5lZ3JvIiwgInRleHRvIjogIlRFUk1PIERFIERFUE9JTUVOVE8gwrcgQ2FpbyBNb250ZW5lZ3Jv
LCAzNCwgbHV0aGllclxuXG5cIlVtYSBjb3JkYSBkbyB2aW9sw6NvIGRhIGJhbmRhIGVzdG91cm91IG5vIG1laW8gZG8gc2FyYXUu
IFNhw60gZGUgbW90byBwYXJhIGJ1c2NhciB1bSBqb2dvIG5vdm8gbmEgbWluaGEgb2ZpY2luYSwgZG8gb3V0cm8gbGFkbyBkYSBw
b250ZS4gQXByb3ZlaXRlaSBlIGFiYXN0ZWNpIG5vIGNhbWluaG8uIFF1YW5kbyB2b2x0ZWksIGEgbHV6IGrDoSB0aW5oYSB2b2x0
YWRvIGZhemlhIHRlbXBvLlxuXG5Ew612aWRhPyBUZW5obywgcXVlbSBuw6NvIHRlbS4gSXNzbyBuw6NvIG1lIGZheiBsYWRyw6Nv
LiBQYXNzZWkgcXVhdHJvIG1lc2VzIHJlc3RhdXJhbmRvIGFxdWVsZSB2aW9sw6NvLlwiXG5cbkFORVhPOiBjdXBvbSBkbyBQb3N0
byBQYXJhZ3Vhw6d1LCBCQS00MjAsIGttIDYuIDE0LzAzLzIwMjYsIDIwOjQ5LiBHYXNvbGluYSwgUiQgMzAsMDAuIn0sIHsiaWQi
OiAiZGVwLW1hcmxlbmUiLCAidGlwbyI6ICJkZXBvaW1lbnRvIiwgInBhcmEiOiAiYSIsICJ0aXR1bG8iOiAiRGVwb2ltZW50byBk
ZSBNYXJsZW5lIENhbmRlaWEiLCAidGV4dG8iOiAiVEVSTU8gREUgREVQT0lNRU5UTyDCtyBNYXJsZW5lIENhbmRlaWEsIDYxLCBh
cG9zZW50YWRhXG5cblwiRXUgZXN0YXZhIG5hIHZhcmFuZGEsIG5vIHRlbGVmb25lIGNvbSBvIG1ldSBhZHZvZ2FkbywgZGVzZGUg
YW50ZXMgZGUgYSBsdXogY2Fpci4gTmVtIHNhw60gZG8gbHVnYXIsIGZpcXVlaSBsw6Egbm8gZXNjdXJvIGZhbGFuZG8uXG5cbk7D
o28gZXNjb25kbyBkZSBuaW5ndcOpbTogYXF1ZWxlIHZpb2zDo28gw6kgZGEgZmFtw61saWEuIE1ldSB0aW8gbnVuY2EgYXNzaW5v
dSBkb2HDp8OjbyBuZW5odW1hLiBNYXMgZXUgdm91IHJlYXZlciBuYSBKdXN0acOnYSwgbsOjbyBubyBicmHDp28uXCIifSwgeyJp
ZCI6ICJkZXAtb3RhdmlvIiwgInRpcG8iOiAiZGVwb2ltZW50byIsICJwYXJhIjogImEiLCAidGl0dWxvIjogIkRlcG9pbWVudG8g
ZGUgT3TDoXZpbyBSZWlzIiwgInRleHRvIjogIlRFUk1PIERFIERFUE9JTUVOVE8gwrcgT3TDoXZpbyBSZWlzLCA0NSwgZW1wcmVz
w6FyaW9cblxuXCJTb3UgcGF0cm9jaW5hZG9yIGRhIG5vaXRlLiBPZmVyZWNpIGNvbXByYXIgbyB2aW9sw6NvIG5vIGFubyBwYXNz
YWRvLCBhIGRpcmV0b3JhIHJlY3Vzb3UsIGUgZmljb3UgcG9yIGlzc28uXG5cblF1YW5kbyBhIGx1eiBjYWl1IGV1IGVzdGF2YSBu
byBiYW5oZWlybyBkbyB0w6lycmVvLiBGaXF1ZWkgbMOhIGRlbnRybyBlc3BlcmFuZG8sIG7Do28gaWEgc2FpciB0YXRlYW5kbyBu
byBlc2N1cm8uIEFzc2ltIHF1ZSBhIGx1eiB2b2x0b3UgZnVpIHBhcmEgbyBiYXIsIHRvbWVpIGEgc2FpZGVpcmEgZSBmdWkgZW1i
b3JhIHBlbGEgcG9ydGEgZGEgZnJlbnRlLCBkZSBtw6NvcyB2YXppYXMuIEEgY8OibWVyYSBkYSBlbnRyYWRhIGRldmUgbW9zdHJh
ci5cIiJ9LCB7ImlkIjogImRlcC1iaWEiLCAidGlwbyI6ICJkZXBvaW1lbnRvIiwgInBhcmEiOiAiYSIsICJ0aXR1bG8iOiAiRGVw
b2ltZW50byBkZSBCaWEgTm9ndWVpcmEiLCAidGV4dG8iOiAiVEVSTU8gREUgREVQT0lNRU5UTyDCtyBCZWF0cml6IE5vZ3VlaXJh
LCAyOSwgZ3VpYVxuXG5cIkV1IGZpY28gbmFzIHNhbGFzIGRlIGNpbWEsIG1hcyBuYSBob3JhIGRhIGZhbGEgZGEgSGVsZW5hIHRv
ZG8gbXVuZG8gZGVzY2UsIGVudMOjbyBldSBlc3RhdmEgbmEgcmVjZXDDp8Ojby4gUXVhbmRvIGFwYWdvdSwgcGVndWVpIGFzIHZl
bGFzIGRhIGdhdmV0YSBlIHNhw60gZGlzdHJpYnVpbmRvLlxuXG5TZSBhbGd1w6ltIGRlIGZvcmEgasOhIG1lIHZpdSBhYnJpciBv
IGV4cG9zaXRvcj8gTsOjby4gTnVuY2EgcmVjZWJpIG5hZGEgZGUgbmluZ3XDqW0gcGFyYSBpc3NvLlwiXG5cbihBIGRlcG9lbnRl
IGRlbW9uc3Ryb3UgbmVydm9zaXNtbyBhbyByZXNwb25kZXIgw6Agw7psdGltYSBwZXJndW50YS4pIn0sIHsiaWQiOiAiZGVwLW5l
bHNvbiIsICJ0aXBvIjogImRlcG9pbWVudG8iLCAicGFyYSI6ICJhIiwgInRpdHVsbyI6ICJEZXBvaW1lbnRvIGRvIHZpZ2lhIE5l
bHNvbiIsICJ0ZXh0byI6ICJURVJNTyBERSBERVBPSU1FTlRPIMK3IE5lbHNvbiBBcmHDumpvLCA1OCwgdmlnaWFcblxuXCJRdWFu
ZG8gYXBhZ291IGV1IGVzdGF2YSBuYSBwb3J0YSBkYSBmcmVudGUuIEEgQmlhIGFwYXJlY2V1IGRvIG1ldSBsYWRvIGNvbSBhcyB2
ZWxhcyBxdWFzZSBuYSBtZXNtYSBob3JhLiBTdWJpIHBlbGEgZXNjYWRhIHByaW5jaXBhbCBjb20gYSBsYW50ZXJuYS4gTyBkaXNq
dW50b3IgZ2VyYWwgZXN0YXZhIGRlc2xpZ2FkbywgbmEgcG9zacOnw6NvIGRlIGJhaXhvLiBSZWxpZ3VlaSDDoHMgMjA6NTIuIE7D
o28gY3J1emVpIGNvbSBuaW5ndcOpbSBuYSBlc2NhZGEgbmVtIG5vIGNvcnJlZG9yLlxuXG5Ow6NvIGVudHJlaSBuYSBTYWxhIDIg
bmFxdWVsYSBob3JhOiBhIHBvcnRhIGVzdGF2YSBlbmNvc3RhZGEgZSBldSB0aW5oYSBxdWUgdm9sdGFyIHBhcmEgYSBlbnRyYWRh
LiBTw7MgdmkgbyBleHBvc2l0b3IgdmF6aW8gbmEgcm9uZGEgZGFzIDIxOjQwLlxuXG5QZWxhIHBvcnRhIGRhIGZyZW50ZSBuaW5n
dcOpbSBzYWl1IGNhcnJlZ2FuZG8gdm9sdW1lLiBJc3NvIGV1IGdhcmFudG8uXCIifSwgeyJpZCI6ICJjaGF0LW1hcmxlbmUiLCAi
dGlwbyI6ICJjaGF0IiwgInBhcmEiOiAiYSIsICJ0aXR1bG8iOiAiTWVuc2FnZW5zOiBNYXJsZW5lIGUgbyBpcm3Do28gKDEzLzAz
KSIsICJtZW5zYWdlbnMiOiBbeyJkZSI6ICJNYXJsZW5lIiwgImhvcmEiOiAiMjI6MTAiLCAidGV4dG8iOiAiQW1hbmjDoyB2b3Ug
bm8gdGFsIHNhcmF1LiJ9LCB7ImRlIjogIlplY2EiLCAiaG9yYSI6ICIyMjoxMiIsICJ0ZXh0byI6ICJQcmEgcXXDqj8gU8OzIHZh
aSBwYXNzYXIgcmFpdmEuIn0sIHsiZGUiOiAiTWFybGVuZSIsICJob3JhIjogIjIyOjEzIiwgInRleHRvIjogIlByYSBvbGhhciBu
YSBjYXJhIGRlbGVzLiBBcXVlbGUgdmlvbMOjbyB2b2x0YSBwcmEgZmFtw61saWEsIG5lbSBxdWUgZXUgbWVzbWEgdGVuaGEgcXVl
IHRpcmFyIGRlIGzDoS4ifSwgeyJkZSI6ICJaZWNhIiwgImhvcmEiOiAiMjI6MTUiLCAidGV4dG8iOiAiTGVuYSwgbsOjbyBmYXog
YmVzdGVpcmEuIn0sIHsiZGUiOiAiTWFybGVuZSIsICJob3JhIjogIjIyOjE2IiwgInRleHRvIjogIkJlc3RlaXJhIMOpIGRlaXhh
ciBjb21vIGVzdMOhLiJ9XX0sIHsiaWQiOiAiY2hhdC1jYWlvIiwgInRpcG8iOiAiY2hhdCIsICJwYXJhIjogImEiLCAidGl0dWxv
IjogIk1lbnNhZ2VuczogQ2FpbyBlIFwiQmlyb1wiICgxMy8wMykiLCAibWVuc2FnZW5zIjogW3siZGUiOiAiQmlybyIsICJob3Jh
IjogIjE4OjAyIiwgInRleHRvIjogIk1vbnRlbmVncm8sIHZlbmNldSBvbnRlbS4ifSwgeyJkZSI6ICJDYWlvIiwgImhvcmEiOiAi
MTg6MjAiLCAidGV4dG8iOiAiU2VndXJhIGF0w6kgc2VndW5kYS4gU2VndW5kYSBlbnRyYSB1bSBkaW5oZWlybyBncmFuZGUgZSBl
dSBxdWl0byB0dWRvLiJ9LCB7ImRlIjogIkJpcm8iLCAiaG9yYSI6ICIxODoyMSIsICJ0ZXh0byI6ICJHcmFuZGUgcXVhbnRvPyJ9
LCB7ImRlIjogIkNhaW8iLCAiaG9yYSI6ICIxODoyNSIsICJ0ZXh0byI6ICJPIHN1ZmljaWVudGUuIERlcG9pcyBkZSBzw6FiYWRv
IHTDoSByZXNvbHZpZG8uIn0sIHsiZGUiOiAiQmlybyIsICJob3JhIjogIjE4OjI2IiwgInRleHRvIjogIlNlZ3VuZGEuIE5lbSB1
bSBkaWEgYSBtYWlzLiJ9XX0sIHsiaWQiOiAiY2hhdC1iaWEiLCAidGlwbyI6ICJjaGF0IiwgInBhcmEiOiAiYSIsICJ0aXR1bG8i
OiAiTWVuc2FnZW5zOiBCaWEgZSBEdWRhICgxMi8wMykiLCAibWVuc2FnZW5zIjogW3siZGUiOiAiQmlhIiwgImhvcmEiOiAiMTk6
NDAiLCAidGV4dG8iOiAiRml6IHVtYSB2aXNpdGEgZmVjaGFkYSBob2plIHByYSB1bSByaWNhw6dvLiBQYWdvdSBwb3IgZm9yYS4i
fSwgeyJkZSI6ICJEdWRhIiwgImhvcmEiOiAiMTk6NDEiLCAidGV4dG8iOiAiQSBIZWxlbmEgc2FiZT8ifSwgeyJkZSI6ICJCaWEi
LCAiaG9yYSI6ICIxOTo0MSIsICJ0ZXh0byI6ICJTZSBzb3ViZXIgZXUgdMO0IG5hIHJ1YS4ifSwgeyJkZSI6ICJEdWRhIiwgImhv
cmEiOiAiMTk6NDMiLCAidGV4dG8iOiAiRSBlbGUgcXVlcmlhIG8gcXXDqj8ifSwgeyJkZSI6ICJCaWEiLCAiaG9yYSI6ICIxOTo0
NSIsICJ0ZXh0byI6ICJWZXIgbyB2aW9sw6NvIGRlIHBlcnRvLiBBYnJpIG8gZXhwb3NpdG9yIGUgZWxlIGZpY291IGRvIG1ldSBs
YWRvIG8gdGVtcG8gdG9kbywgbmVtIHBpc2NhdmEuIn0sIHsiZGUiOiAiQmlhIiwgImhvcmEiOiAiMTk6NDYiLCAidGV4dG8iOiAi
QXBhZ2EgZXNzYSBjb252ZXJzYS4ifV19LCB7ImlkIjogInByb2dyYW1hIiwgInRpcG8iOiAiZm9saGV0byIsICJwYXJhIjogImEi
LCAidGl0dWxvIjogIlByb2dyYW1hIGRvIHNhcmF1IiwgInRleHRvIjogIlNBUkFVIERFIFJFQUJFUlRVUkEgwrcgMTQvMDNcblxu
MjA6MDAgIEFiZXJ0dXJhOiBcIkJlaXJhIGRlIENhaXNcIiwgY29tIG8gUmVnaW9uYWwgZG8gQ2Fpc1xuMjA6MTUgIFJvZGEgZGUg
c2FtYmFzIGRlIFRpw6NvIENhbmRlaWFcbjIwOjQwICBGYWxhIGRhIGRpcmV0b3JhIEhlbGVuYSBCcmFuZMOjb1xuMjE6MDAgIEVu
Y2VycmFtZW50bzogXCJMdWEgZGUgTWFyw6lcIlxuXG5CYXIgZGEgY2FzYTogY2FpcGlyaW5oYSwgY2VydmVqYSBlIMOhZ3VhLlxu
U29tIGUgZ3JhdmHDp8OjbzogVGljby4ifSwgeyJpZCI6ICJjaGF0LW90YXZpbyIsICJ0aXBvIjogImNoYXQiLCAicGFyYSI6ICJh
IiwgInRpdHVsbyI6ICJNZW5zYWdlbnM6IE90w6F2aW8gZSBWZXJhLCBhIGVzcG9zYSAoMTAvMDMpIiwgIm1lbnNhZ2VucyI6IFt7
ImRlIjogIlZlcmEiLCAiaG9yYSI6ICIwOToxMiIsICJ0ZXh0byI6ICJOw6NvIGNvbnNpZ28gZW50cmFyIG5vIHRhYmxldC4gUXVh
bCDDqSBhIHNlbmhhPyJ9LCB7ImRlIjogIk90w6F2aW8iLCAiaG9yYSI6ICIwOToxNSIsICJ0ZXh0byI6ICJBIGRlIHNlbXByZS4i
fSwgeyJkZSI6ICJWZXJhIiwgImhvcmEiOiAiMDk6MTYiLCAidGV4dG8iOiAiUXVlIGRlIHNlbXByZT8ifSwgeyJkZSI6ICJPdMOh
dmlvIiwgImhvcmEiOiAiMDk6MTgiLCAidGV4dG8iOiAiTyBhbm8gZG8gcHJpbWVpcm8gZGlzY28gZG8gVGnDo28uIFVzbyBlbSB0
dWRvLCB2b2PDqiBzYWJlLiJ9LCB7ImRlIjogIlZlcmEiLCAiaG9yYSI6ICIwOToxOSIsICJ0ZXh0byI6ICJFdSBudW5jYSBzZWkg
cXVlIGFubyDDqSBlc3NlLiBWb2PDqiBlIGVzc2Egb2JzZXNzw6NvLiJ9XX0sIHsiaWQiOiAibGF1ZG8iLCAidGlwbyI6ICJsYXVk
byIsICJwYXJhIjogImIiLCAidGl0dWxvIjogIkxhdWRvIHByZWxpbWluYXIgZGEgcGVyw61jaWEiLCAidGV4dG8iOiAiSU5TVElU
VVRPIERFIENSSU1JTkFMw41TVElDQSDCtyBMQVVETyBQUkVMSU1JTkFSXG5cbjEuIEV4cG9zaXRvciBkYSBTYWxhIDI6IGNhZGVh
ZG8gZGUgc2VncmVkbyBkZSA0IGTDrWdpdG9zLCBpbnRhY3RvIGUgZmVjaGFkby4gRm9pIGFiZXJ0byBjb20gYSBjb21iaW5hw6fD
o28gY29ycmV0YS5cblxuMi4gRXN0b2pvIGRvIHZpb2zDo28sIHF1ZSBmaWNhdmEgbm8gYXJtw6FyaW8gZW1iYWl4byBkbyBleHBv
c2l0b3I6IHRhbWLDqW0gYXVzZW50ZS5cblxuMy4gTmEgdGFtcGEgZGUgdmlkcm8sIHJlc8OtZHVvIHBlZ2Fqb3NvIGNvbSBhw6fD
umNhciBlIHN1bW8gZGUgbGltw6NvLiBTZW0gaW1wcmVzc8O1ZXMgZGlnaXRhaXMgYXByb3ZlaXTDoXZlaXMuXG5cbjQuIEPDom1l
cmEgZGEgU2FsYSAyOiDDoHMgMjA6NDYgbyB2aW9sw6NvIGFwYXJlY2Ugbm8gZXhwb3NpdG9yLiBPIHNpc3RlbWEgZGVzbGlnb3Ug
bmEgcXVlZGEgZGUgZW5lcmdpYSBlIHPDsyB2b2x0b3UgYSBncmF2YXIgw6BzIDIwOjU4LCBjb20gbyBleHBvc2l0b3IgasOhIHZh
emlvLlxuXG41LiBRdWFkcm8gZGUgbHV6IGRvIGNvcnJlZG9yIGRlIGNpbWE6IGRpc2p1bnRvciBnZXJhbCBkZXNhcm1hZG8gbWFu
dWFsbWVudGUuIE7Do28gaG91dmUgc29icmVjYXJnYS5cblxuNi4gQ8OibWVyYSBkYSBlbnRyYWRhOiBuaW5ndcOpbSBzYWl1IGNv
bSB2b2x1bWUgY29tcGF0w612ZWwgY29tIHVtIHZpb2zDo28uXG5cbkNPTkNMVVPDg08gUEFSQ0lBTDogYSBzdWJ0cmHDp8OjbyBv
Y29ycmV1IGVudHJlIDIwOjQ2IGUgMjA6NTgsIHBvciBhbGd1w6ltIHF1ZSBjb25oZWNpYSBhIGNvbWJpbmHDp8OjbywgZSBvIG9i
amV0byBuw6NvIHNhaXUgcGVsYSBwb3J0YSBkYSBmcmVudGUuIn0sIHsiaWQiOiAiZXN0YWNpb25hbWVudG8iLCAidGlwbyI6ICJy
ZWdpc3RybyIsICJwYXJhIjogImIiLCAidGl0dWxvIjogIkNvbnRyb2xlIGRvIGVzdGFjaW9uYW1lbnRvIiwgInRleHRvIjogIkNP
TlRST0xFIERPIEVTVEFDSU9OQU1FTlRPIMK3IDE0LzAzXG5cbjE5OjIwICBlbnRyYWRhIMK3IG1vdG8gKEMuIE1vbnRlbmVncm8p
IMK3IHDDoXRpb1xuMTk6MzUgIGVudHJhZGEgwrcgc2Vkw6MgcHJldG8gKEguIEJyYW5kw6NvKSDCtyBww6F0aW9cbjE5OjUwICBl
bnRyYWRhIMK3IFNVViBwcmF0YSAoTy4gUmVpcykgwrcgYSBwZWRpZG8gZG8gZG9ubywgZGVpeGFkbyBuYSB2aWVsYSBkb3MgZnVu
ZG9zLCBmb3JhIGRvIHDDoXRpb1xuMjA6MzIgIHNhw61kYSDCtyBtb3RvIChDLiBNb250ZW5lZ3JvKVxuMjE6MDUgIHNhw61kYSDC
tyBTVVYgcHJhdGEgKE8uIFJlaXMpXG4yMToxMiAgZW50cmFkYSDCtyBtb3RvIChDLiBNb250ZW5lZ3JvKVxuXG5PYnMuOiBNLiBD
YW5kZWlhIGUgQi4gTm9ndWVpcmEgY2hlZ2FyYW0gYSBww6kuIn0sIHsiaWQiOiAidGVsZWZvbmUiLCAidGlwbyI6ICJyZWdpc3Ry
byIsICJwYXJhIjogImIiLCAidGl0dWxvIjogIkV4dHJhdG8gZGUgY2hhbWFkYXMgZGUgTWFybGVuZSIsICJ0ZXh0byI6ICJPUEVS
QURPUkEgwrcgRVhUUkFUTyBERSBDSEFNQURBU1xuTGluaGEgZGUgTWFybGVuZSBDYW5kZWlhIMK3IDE0LzAzXG5cbjE4OjAyICBy
ZWNlYmlkYSDCtyBKb3PDqSBDYW5kZWlhIMK3IDMgbWluXG4yMDo0NCAgZWZldHVhZGEgwrcgRHIuIEF1csOpbGlvIFBhY2hlY28g
KGFkdm9nYWRvKSDCtyAxMiBtaW5cbjIxOjMwICBlZmV0dWFkYSDCtyBKb3PDqSBDYW5kZWlhIMK3IDYgbWluIn0sIHsiaWQiOiAi
YWxhcm1lIiwgInRpcG8iOiAicmVnaXN0cm8iLCAicGFyYSI6ICJiIiwgInRpdHVsbyI6ICJSZWdpc3RybyBkYSBjZW50cmFsIGRl
IGFsYXJtZSIsICJ0ZXh0byI6ICJDRU5UUkFMIERFIEFMQVJNRSDCtyBzZW5zb3JlcyBhIGJhdGVyaWEgwrcgMTQvMDNcblxuUG9y
dGEgZGEgZnJlbnRlOiBhYmVydGEgZHVyYW50ZSB0b2RvIG8gZXZlbnRvIChtb2RvIGZlc3RhKS5cblxuUG9ydGEgZGUgc2VydmnD
p28gKGNvcGEg4oaSIHZpZWxhKTpcbjIwOjUxOjEwICBBQkVSVEFcbjIwOjUzOjQwICBGRUNIQURBXG5cbk5lbmh1bWEgb3V0cmEg
YWJlcnR1cmEgZGEgcG9ydGEgZGUgc2VydmnDp28gZW50cmUgMTk6MDAgZSAyMzowMC4ifSwgeyJpZCI6ICJhdmlzbyIsICJ0aXBv
IjogImF2aXNvIiwgInBhcmEiOiAiYiIsICJ0aXR1bG8iOiAiQXZpc28gaW50ZXJubyBuwrogMDcgZG8gbWVtb3JpYWwiLCAidGV4
dG8iOiAiTUVNT1JJQUwgVEnDg08gQ0FOREVJQSDCtyBBVklTTyBJTlRFUk5PIE7CuiAwNyDCtyAxMi8wM1xuXG5PIGJhbmhlaXJv
IGRvIHTDqXJyZW8gZXN0w6EgaW50ZXJkaXRhZG8gcGFyYSB0cm9jYSBkbyBlbmNhbmFtZW50bywgZGUgMTIvMDMgYSAxOC8wMy4g
QSBwb3J0YSBmaWNhIHRyYW5jYWRhIGNvbSBjYWRlYWRvIGUgYSBjaGF2ZSBlc3TDoSBjb20gYSBlbXByZWl0ZWlyYS5cblxuRHVy
YW50ZSBvIHNhcmF1IGRlIHPDoWJhZG8sIG9yaWVudGFyIG9zIGNvbnZpZGFkb3MgYSB1c2FyIG8gYmFuaGVpcm8gZG8gYW5kYXIg
ZGUgY2ltYS4ifSwgeyJpZCI6ICJjb21hbmRhcyIsICJ0aXBvIjogInJlY2libyIsICJwYXJhIjogImEiLCAidGl0dWxvIjogIkNv
bWFuZGFzIGRvIGJhciIsICJ0ZXh0byI6ICJCQVIgREEgQ0FTQSDCtyBDT01BTkRBUyDCtyAxNC8wM1xuXG4yMDowNSAgSC4gQnJh
bmTDo28gwrcgw6FndWFcbjIwOjEyICBNLiBDYW5kZWlhIMK3IGNhaXBpcmluaGFcbjIwOjIwICBPLiBSZWlzIMK3IGNhaXBpcmlu
aGFcbjIwOjI1ICBDLiBNb250ZW5lZ3JvIMK3IGNlcnZlamFcbjIwOjQxICBPLiBSZWlzIMK3IGNhaXBpcmluaGFcbihzZW0gdmVu
ZGFzIGVudHJlIDIwOjQyIGUgMjA6NTkpXG4yMTowMSAgTy4gUmVpcyDCtyBjYWlwaXJpbmhhXG5cbk9icy4gZG8gZ2Fyw6dvbTog
XCJOYSBkYXMgMjA6NDEgbyBjbGllbnRlIHNhaXUgY29tIG8gY29wbyBuYSBtw6NvLCBkaXplbmRvIHF1ZSBqw6Egdm9sdGF2YS5c
IiJ9LCB7ImlkIjogInNlZ3VybyIsICJ0aXBvIjogImVtYWlsIiwgInBhcmEiOiAiYiIsICJ0aXR1bG8iOiAiRS1tYWlsIGRhIHNl
Z3VyYWRvcmEgcGFyYSBIZWxlbmEiLCAidGV4dG8iOiAiRGU6IEF0bMOibnRpY2EgU2VndXJvc1xuUGFyYTogSGVsZW5hIEJyYW5k
w6NvXG5EYXRhOiAwMi8wMy8yMDI2XG5Bc3N1bnRvOiBFbmRvc3NvIGRhIGFww7NsaWNlIDg4LjIxNFxuXG5QcmV6YWRhIEhlbGVu
YSxcblxuQ29uZm9ybWUgcGVkaWRvIGRhIGRpcmXDp8OjbywgbyB2YWxvciBzZWd1cmFkbyBkbyBpdGVtIFwidmlvbMOjbyBUacOj
byBDYW5kZWlhLCAxOTYxXCIgcGFzc2EgZGUgUiQgMTIwLjAwMCBwYXJhIFIkIDIwMC4wMDAgYSBwYXJ0aXIgZGUgaG9qZS4gRW0g
Y2FzbyBkZSBmdXJ0bywgYSBpbmRlbml6YcOnw6NvIMOpIHBhZ2EgYW8gTWVtb3JpYWwgZW0gYXTDqSAzMCBkaWFzLlxuXG5MZW1i
cmFtb3MgcXVlIG8gbWVtb3JpYWwgdGVtIGR1YXMgcGFyY2VsYXMgZW0gYXRyYXNvLiJ9LCB7ImlkIjogImV4dHJhdG8tYmlhIiwg
InRpcG8iOiAiZXh0cmF0byIsICJwYXJhIjogImIiLCAidGl0dWxvIjogIkV4dHJhdG8gYmFuY8OhcmlvIGRlIEJpYSIsICJ0ZXh0
byI6ICJCQU5DTyDCtyBFWFRSQVRPIERFIE1BUsOHT1xuQmVhdHJpeiBOb2d1ZWlyYVxuXG4wNS8wMyAgU2Fsw6FyaW8gwrcgTWVt
b3JpYWwgVC4gQ2FuZGVpYSAgICAgKyAxLjYyMCwwMFxuMTIvMDMgIFBpeCByZWNlYmlkbyDCtyBPVEFWSU8gQSBSRUlTICAgICAg
ICArICAgNTAwLDAwXG4xMy8wMyAgUGl4IGVudmlhZG8gwrcgYWx1Z3VlbCAgICAgICAgICAgICAgICDiiJIgICA3MDAsMDAifSwg
eyJpZCI6ICJmaW5hbmNlaXJvIiwgInRpcG8iOiAicmVnaXN0cm8iLCAicGFyYSI6ICJiIiwgInRpdHVsbyI6ICJGaW5hbmNlaXJv
IGRvIG1lbW9yaWFsIiwgInRleHRvIjogIk1FTU9SSUFMIMK3IEZJTkFOQ0VJUk8gwrcgTUFSw4dPXG5cbjI3LzAyICBMYXVkbyBk
ZSBhdmFsaWHDp8OjbyBww7NzLXJlc3RhdXJvIChwZXJpdG8gZXh0ZXJubyk6IHZpb2zDo28gYXZhbGlhZG8gZW50cmUgUiQgMTgw
IG1pbCBlIFIkIDIwMCBtaWwuXG5cbjE2LzAzIChzZWd1bmRhKSAgQSBwYWdhcjogQy4gTW9udGVuZWdybywgcmVzdGF1cm8gZG8g
dmlvbMOjbywgcGFyY2VsYSBmaW5hbCBkZSBSJCA2LjUwMCwwMC5cblxuMjAvMDMgIEEgcGFnYXI6IEF0bMOibnRpY2EgU2VndXJv
cywgcGFyY2VsYXMgZW0gYXRyYXNvLiJ9LCB7ImlkIjogImZvbGhldG8iLCAidGlwbyI6ICJmb2xoZXRvIiwgInBhcmEiOiAiYiIs
ICJ0aXR1bG8iOiAiRm9saGV0byBkbyBtZW1vcmlhbCIsICJ0ZXh0byI6ICJNRU1PUklBTCBUScODTyBDQU5ERUlBXG5cblRpw6Nv
IENhbmRlaWEgKDE5MzHigJMxOTk0KSwgZmlsaG8gZGUgU2FudGEgUml0YSBkbyBQYXJhZ3Vhw6d1LCBjb21ww7RzIG1haXMgZGUg
ZHV6ZW50b3Mgc2FtYmFzLiBDb21wcm91IHNldSB2aW9sw6NvIGVtIDE5NjEsIGNvbSBvIHByaW1laXJvIGNhY2jDqi4gR3Jhdm91
IG8gcHJpbWVpcm8gZGlzY28sIFwiTHVhIGRlIE1hcsOpXCIsIGVtIDE5NjgsIGUgbnVuY2EgbWFpcyB0b2NvdSBlbSBvdXRybyBp
bnN0cnVtZW50by5cblxuQSBjYXNhIG9uZGUgdml2ZXUgdmlyb3UgbWVtb3JpYWwgZW0gMjAwOS4ifSwgeyJpZCI6ICJiaWxoZXRl
IiwgInRpcG8iOiAiYmlsaGV0ZSIsICJwYXJhIjogImIiLCAidGl0dWxvIjogIkJpbGhldGUgZG8gdMOpY25pY28gZGUgc29tIiwg
InRleHRvIjogIkJJTEhFVEUgQ09MQURPIE5PIE5PVEVCT09LIERPIFNPTVxuXG5cIkRlbGVnYWRvLCBhIGdyYXZhw6fDo28gZGEg
bm9pdGUgZXN0w6EgaW50ZWlyYSBubyBhcnF1aXZvIFNBUkFVLldBVi4gR3JhdmVpIG5hIGJhdGVyaWEsIG7Do28gcGFyb3Ugbm8g
YXBhZ8Ojby4gRXN0w6EgY29tIHNlbmhhIHBvcnF1ZSBvIG5vdGVib29rIMOpIGRvIGVzdMO6ZGlvLlxuXG5BIHNlbmhhIMOpIG8g
bm9tZSBkYSBtw7pzaWNhIHF1ZSBhYnJpdSBhIG5vaXRlLCB0dWRvIGp1bnRvIGUgc2VtIGFjZW50by5cblxuVGljb1wiIn0sIHsi
aWQiOiAiZ3JhdmFjYW8iLCAidGlwbyI6ICJhdWRpbyIsICJwYXJhIjogImFtYm9zIiwgInRyYXZhIjogImdyYXZhY2FvIiwgInRp
dHVsbyI6ICJUcmFuc2NyacOnw6NvIGRhIGdyYXZhw6fDo28gZG8gc2FyYXUiLCAidGV4dG8iOiAiVFJBTlNDUknDh8ODTyDCtyBT
QVJBVS5XQVZcbihtaWNyb2ZvbmUgZG8gcGFsY28gZSBzb20gYW1iaWVudGUpXG5cbjIwOjQwICBIZWxlbmEsIGFvIG1pY3JvZm9u
ZTogXCJCb2Egbm9pdGUgYSB0b2Rvcy4gRXN0YSBjYXNhIHF1YXNlIGZlY2hvdSBhcyBwb3J0YXMuLi5cIlxuMjA6NDIgIEdhcsOn
b20sIGFvIGZ1bmRvOiBcIlNldSBPdMOhdmlvLCBzdWEgY2FpcGlyaW5oYS5cIiBWb3ogbWFzY3VsaW5hOiBcIkxldm8gY29taWdv
LCBqw6Egdm9sdG8uXCJcbjIwOjQ3ICBRdWVkYSBkZSBlbmVyZ2lhLiBCdXJidXJpbmhvLlxuMjA6NDcgIEhlbGVuYTogXCJDYWxt
YSwgZ2VudGUsIGZpcXVlbSBvbmRlIGVzdMOjby4gRGV2ZSBzZXIgbyBkaXNqdW50b3IuXCJcbjIwOjQ5ICBCaWEsIHBlcnRvIGRh
IHJlY2Vww6fDo286IFwiVGVuaG8gdmVsYSBhcXVpISBRdWVtIHF1ZXIgdmVsYT9cIlxuMjA6NTAgIFZveiBmZW1pbmluYSwgdmlu
ZGEgZGEgdmFyYW5kYTogXCJEb3V0b3IgQXVyw6lsaW8sIGV1IG7Do28gdm91IGVzcGVyYXIganVpeiBuZW5odW0uLi5cIlxuMjA6
NTEgIEhlbGVuYTogXCJFbnF1YW50byBhIGx1eiBuw6NvIHZvbHRhLCBldSBjb250byB1bWEgaGlzdMOzcmlhIGRvIFRpw6NvLlwi
XG4yMDo1MiAgQSBsdXogdm9sdGEuIFBhbG1hcy5cbjIwOjUzICBIZWxlbmE6IFwiT2JyaWdhZGEgYW8gc2V1IE5lbHNvbi4gQ29u
dGludWFuZG8uLi5cIlxuMjE6MDAgIE8gUmVnaW9uYWwgZG8gQ2FpcyBjb21lw6dhIFwiTHVhIGRlIE1hcsOpXCIuIn0sIHsiaWQi
OiAiY2VsdWxhciIsICJ0aXBvIjogImNoYXQiLCAicGFyYSI6ICJhbWJvcyIsICJ0cmF2YSI6ICJjZWx1bGFyIiwgInRpdHVsbyI6
ICJDZWx1bGFyIGRlIE90w6F2aW86IGNvbnZlcnNhcyByZWN1cGVyYWRhcyIsICJ0ZXh0byI6ICJBdmlzbyBkbyBiYW5jbywgMTEv
MDM6IFwiUmVpcyBOw6F1dGljYSBMdGRhLjogbGltaXRlIGV4Y2VkaWRvLiBSZWd1bGFyaXplIG8gc2FsZG8gZGV2ZWRvciBkZSBS
JCAzMTIuNDgwLDAwIHBhcmEgZXZpdGFyIHByb3Rlc3RvLlwiIiwgIm1lbnNhZ2VucyI6IFt7ImRlIjogIkxhY2VyZGEgQW50aWd1
aWRhZGVzIiwgImhvcmEiOiAiMDkvMDMiLCAidGV4dG8iOiAiTWV1IGNsaWVudGUgY29uZmlybWEgb3MgNDAwLiBNYXMgcXVlciBh
IHBlw6dhIGNvbSBvIGVzdG9qbyBvcmlnaW5hbC4ifSwgeyJkZSI6ICJPdMOhdmlvIiwgImhvcmEiOiAiMDkvMDMiLCAidGV4dG8i
OiAiVmFpIGNvbSBlc3Rvam8uIFNhaSBubyBzw6FiYWRvLCBkdXJhbnRlIGEgZmVzdGEuIn0sIHsiZGUiOiAiT3TDoXZpbyIsICJo
b3JhIjogIjE0LzAzIDIxOjIwIiwgInRleHRvIjogIkVzdMOhIGNvbWlnby4gRW50cmVnbyB0ZXLDp2EgZW0gU2FsdmFkb3IuIn0s
IHsiZGUiOiAiTGFjZXJkYSBBbnRpZ3VpZGFkZXMiLCAiaG9yYSI6ICIxNC8wMyAyMToyMiIsICJ0ZXh0byI6ICJFbSBlc3DDqWNp
ZSwgY29tbyBjb21iaW5hZG8uIn1dfV0sICJ0cmF2YXMiOiBbeyJpZCI6ICJncmF2YWNhbyIsICJ0aXR1bG8iOiAiR3JhdmHDp8Oj
byBkbyBzYXJhdSAoU0FSQVUuV0FWKSIsICJkZXNjcmljYW8iOiAiQXJxdWl2byBkZSDDoXVkaW8gcHJvdGVnaWRvIHBvciBzZW5o
YS4iLCAiZm9ybWF0byI6ICJwYWxhdnJhIiwgInJlc3Bvc3RhIjogImJlaXJhZGVjYWlzIn0sIHsiaWQiOiAiY2VsdWxhciIsICJ0
aXR1bG8iOiAiQ2VsdWxhciBhcHJlZW5kaWRvIGRlIE90w6F2aW8gUmVpcyIsICJkZXNjcmljYW8iOiAiQmxvcXVlYWRvIHBvciB1
bSBjw7NkaWdvIGRlIDQgZMOtZ2l0b3MuIE8gZG9ubyBkaXogcXVlIGVzcXVlY2V1LiIsICJmb3JtYXRvIjogImNvZGlnbyIsICJy
ZXNwb3N0YSI6ICIxOTY4In1dLCAicGVyZ3VudGFzIjogW3siaWQiOiAicXVlbSIsICJyb3R1bG8iOiAibyBjdWxwYWRvIiwgInRl
eHRvIjogIlF1ZW0gbGV2b3UgbyB2aW9sw6NvPyIsICJjZXJ0YSI6ICJvdGF2aW8iLCAib3Bjb2VzIjogW3siaWQiOiAiaGVsZW5h
IiwgInRleHRvIjogIkhlbGVuYSBCcmFuZMOjbyJ9LCB7ImlkIjogImNhaW8iLCAidGV4dG8iOiAiQ2FpbyBNb250ZW5lZ3JvIn0s
IHsiaWQiOiAibWFybGVuZSIsICJ0ZXh0byI6ICJNYXJsZW5lIENhbmRlaWEifSwgeyJpZCI6ICJvdGF2aW8iLCAidGV4dG8iOiAi
T3TDoXZpbyBSZWlzIn0sIHsiaWQiOiAiYmlhIiwgInRleHRvIjogIkJpYSBOb2d1ZWlyYSJ9XX0sIHsiaWQiOiAibW90aXZvIiwg
InJvdHVsbyI6ICJvIG1vdGl2byIsICJ0ZXh0byI6ICJRdWFsIGZvaSBvIG1vdGl2byByZWFsPyIsICJjZXJ0YSI6ICJyZXZlbmRh
IiwgIm9wY29lcyI6IFt7ImlkIjogInNlZ3VybyIsICJ0ZXh0byI6ICJSZWNlYmVyIGEgaW5kZW5pemHDp8OjbyBkbyBzZWd1cm8i
fSwgeyJpZCI6ICJmYW1pbGlhIiwgInRleHRvIjogIkRldm9sdmVyIG8gdmlvbMOjbyDDoCBmYW3DrWxpYSBDYW5kZWlhIn0sIHsi
aWQiOiAiYWdpb3RhIiwgInRleHRvIjogIlF1aXRhciB1bWEgZMOtdmlkYSBjb20gdW0gYWdpb3RhIn0sIHsiaWQiOiAiY29sZWNh
byIsICJ0ZXh0byI6ICJGaWNhciBjb20gYSBwZcOnYSBwYXJhIGEgcHLDs3ByaWEgY29sZcOnw6NvIn0sIHsiaWQiOiAicmV2ZW5k
YSIsICJ0ZXh0byI6ICJSZXZlbmRlciBhIHBlw6dhIGEgdW0gY29tcHJhZG9yIHBhcmEgY29icmlyIGFzIGTDrXZpZGFzIGRhIGVt
cHJlc2EifV19LCB7ImlkIjogInByb3ZhIiwgInJvdHVsbyI6ICJhIHByb3ZhIHF1ZSBkZXJydWJhIG8gw6FsaWJpIiwgInRleHRv
IjogIlF1YWwgcHJvdmEgZGVycnViYSBvIMOhbGliaSBkbyBjdWxwYWRvPyIsICJjZXJ0YSI6ICJhdmlzbyIsICJvcGNvZXMiOiBb
eyJpZCI6ICJ0ZWxlZm9uZSIsICJ0ZXh0byI6ICJPIGV4dHJhdG8gZGUgY2hhbWFkYXMgZGUgTWFybGVuZSJ9LCB7ImlkIjogImVz
dGFjaW9uYW1lbnRvIiwgInRleHRvIjogIk8gY29udHJvbGUgZG8gZXN0YWNpb25hbWVudG8ifSwgeyJpZCI6ICJhdmlzbyIsICJ0
ZXh0byI6ICJPIGF2aXNvIGludGVybm8gbsK6IDA3IGRvIG1lbW9yaWFsIn0sIHsiaWQiOiAic2VndXJvIiwgInRleHRvIjogIk8g
ZS1tYWlsIGRhIHNlZ3VyYWRvcmEifSwgeyJpZCI6ICJjb21hbmRhcyIsICJ0ZXh0byI6ICJBcyBjb21hbmRhcyBkbyBiYXIifV19
XSwgImRpY2FzIjogWyJDb21wYXJlbSBvIGx1Z2FyIG9uZGUgY2FkYSBzdXNwZWl0byBkaXogcXVlIGVzdGF2YSBkdXJhbnRlIG8g
YXBhZ8OjbyBjb20gb3MgcmVnaXN0cm9zIGRvIHByw6lkaW8uIFVtIGRlc3NlcyBsdWdhcmVzIG7Do28gcG9kaWEgc2VyIHVzYWRv
IG5hcXVlbGEgbm9pdGUuIiwgIkjDoSBkb2lzIGFycXVpdm9zIHRyYW5jYWRvcy4gUGFyYSBjYWRhIHVtLCB1bSBkZSB2b2PDqnMg
dGVtIGEgcGVyZ3VudGEgZSBvIG91dHJvIHRlbSBhIHJlc3Bvc3RhLiIsICJTw7MgdHLDqnMgcGVzc29hcyBkZXZlcmlhbSBzYWJl
ciBhIGNvbWJpbmHDp8OjbyBkbyBleHBvc2l0b3IuIEFsZ3XDqW0gZGUgZm9yYSBhcHJlbmRldSBvbGhhbmRvLiBTaWdhbSBvIFBp
eCBkZSBxdWludGEtZmVpcmEuIl0sICJzb2x1Y2FvIjogeyJyZXN1bW8iOiAiT3TDoXZpbyBSZWlzIGxldm91IG8gdmlvbMOjby4g
QSBlbXByZXNhIGRlbGUgZXN0YXZhIHF1ZWJyYWRhIGUgZWxlIGrDoSB0aW5oYSBmZWNoYWRvIGEgdmVuZGEgZGEgcGXDp2EsIGNv
bSBvIGVzdG9qbywgcGFyYSB1bSBhbnRpcXXDoXJpbyBkZSBTYWx2YWRvci4gTyDDoWxpYmkgY2FpIGNvbSBvIGF2aXNvIGludGVy
bm8gbsK6IDA3OiBvIGJhbmhlaXJvIGRvIHTDqXJyZW8sIG9uZGUgZWxlIGp1cmEgcXVlIGZpY291IGR1cmFudGUgbyBhcGFnw6Nv
LCBlc3RhdmEgaW50ZXJkaXRhZG8gZSB0cmFuY2FkbyBkZXNkZSBxdWludGEtZmVpcmEuIiwgImxpbmhhX2RvX3RlbXBvIjogW3si
aG9yYSI6ICIxMi8wMyIsICJ0ZXh0byI6ICJPdMOhdmlvIHBhZ2EgUiQgNTAwIGEgQmlhIHBvciB1bWEgdmlzaXRhIGZlY2hhZGEg
ZSBvYnNlcnZhIGEgY29tYmluYcOnw6NvIGVucXVhbnRvIGVsYSBhYnJlIG8gZXhwb3NpdG9yLiJ9LCB7ImhvcmEiOiAiMTk6NTAi
LCAidGV4dG8iOiAiT3TDoXZpbyBjaGVnYSBlIHBlZGUgcGFyYSBkZWl4YXIgbyBTVVYgbmEgdmllbGEgZG9zIGZ1bmRvcywgYW8g
bGFkbyBkYSBwb3J0YSBkZSBzZXJ2acOnby4ifSwgeyJob3JhIjogIjIwOjQyIiwgInRleHRvIjogIlBlZ2EgYSBjYWlwaXJpbmhh
IG5vIGJhciwgZGl6IHF1ZSBqw6Egdm9sdGEgZSBzb2JlIHBlbGEgZXNjYWRhIHByaW5jaXBhbCBjb20gbyBjb3BvLiJ9LCB7Imhv
cmEiOiAiMjA6NDYiLCAidGV4dG8iOiAiQSBjw6JtZXJhIGRhIFNhbGEgMiBhaW5kYSBtb3N0cmEgbyB2aW9sw6NvLiJ9LCB7Imhv
cmEiOiAiMjA6NDciLCAidGV4dG8iOiAiT3TDoXZpbyBkZXNhcm1hIG8gZGlzanVudG9yIG5vIGNvcnJlZG9yIGRlIGNpbWEsIGFi
cmUgbyBleHBvc2l0b3IgY29tIGEgY29tYmluYcOnw6NvIGUgcGVnYSBvIHZpb2zDo28gZSBvIGVzdG9qby4gTyBjb3BvIGRlaXhh
IGHDp8O6Y2FyIGUgbGltw6NvIG5vIHZpZHJvLiJ9LCB7ImhvcmEiOiAiMjA6NTEiLCAidGV4dG8iOiAiRGVzY2UgcGVsYSBlc2Nh
ZGEgZGUgc2VydmnDp28sIHNhaSBwZWxhIGNvcGEgZSBndWFyZGEgbyB2aW9sw6NvIG5vIFNVVi4gQSBwb3J0YSBkZSBzZXJ2acOn
byByZWdpc3RyYSBhIGFiZXJ0dXJhLiJ9LCB7ImhvcmEiOiAiMjA6NTIiLCAidGV4dG8iOiAiTmVsc29uIHJlbGlnYSBhIGx1eiBl
IG7Do28gZW5jb250cmEgbmluZ3XDqW0gbm8gY29ycmVkb3IuIn0sIHsiaG9yYSI6ICIyMDo1MyIsICJ0ZXh0byI6ICJPdMOhdmlv
IHZvbHRhIHBlbGEgcG9ydGEgZGUgc2VydmnDp28uIn0sIHsiaG9yYSI6ICIyMTowMSIsICJ0ZXh0byI6ICJQZWRlIGEgc2FpZGVp
cmEgbm8gYmFyLiJ9LCB7ImhvcmEiOiAiMjE6MDUiLCAidGV4dG8iOiAiU2FpIHBlbGEgZnJlbnRlIGRlIG3Do29zIHZhemlhcyBl
IHZhaSBlbWJvcmEgbm8gU1VWLCBjb20gbyB2aW9sw6NvIG5vIHBvcnRhLW1hbGFzLiJ9LCB7ImhvcmEiOiAiMjE6MjAiLCAidGV4dG8i
OiAiQXZpc2EgbyBhbnRpcXXDoXJpbzogXCJFc3TDoSBjb21pZ28uXCIifV0sICJmYWxzYXNfcGlzdGFzIjogWyJIZWxlbmEg
YXVtZW50b3UgbyBzZWd1cm8gcG9ycXVlIG8gdmlvbMOjbyBmb2kgcmVhdmFsaWFkbyBkZXBvaXMgZG8gcmVzdGF1cm8uIEVsYSBu
w6NvIHNhaXUgZG8gbWljcm9mb25lLCBjb21vIG1vc3RyYSBhIGdyYXZhw6fDo28uIiwgIk8gXCJkaW5oZWlybyBncmFuZGVcIiBk
ZSBDYWlvIGVyYSBhIHBhcmNlbGEgZmluYWwgZG8gcmVzdGF1cm8sIHBhZ2EgbmEgc2VndW5kYS1mZWlyYS4gRWxlIGVzdGF2YSBk
byBvdXRybyBsYWRvIGRhIHBvbnRlLCBjb21vIG1vc3RyYW0gbyBlc3RhY2lvbmFtZW50byBlIG8gY3Vwb20gZG8gcG9zdG8uIiwg
Ik1hcmxlbmUgcXVlcmlhIG8gdmlvbMOjbyBkZSB2b2x0YSwgbWFzIHBlbGEgSnVzdGnDp2EuIEVsYSBwYXNzb3UgbyBhcGFnw6Nv
IGludGVpcm8gYW8gdGVsZWZvbmUgbmEgdmFyYW5kYS4iLCAiQmlhIG1lbnRpdSBwb3JxdWUgdGluaGEgdmVyZ29uaGEgZGEgdmlz
aXRhIHBhZ2EgcG9yIGZvcmEuIFNlbSBxdWVyZXIsIGZvaSBlbGEgcXVlbSBtb3N0cm91IGEgY29tYmluYcOnw6NvIGEgT3TDoXZp
by4gRXN0YXZhIG5hIHJlY2Vww6fDo28gZGlzdHJpYnVpbmRvIHZlbGFzLiJdfX0=
$b64$, 'base64'), 'UTF8')::jsonb);

-- Conferência (não mostra nada do conteúdo)
update public.casos set icone = 'guitar' where id = 'violao-do-cais';
update public.casos set icone = 'flask-conical' where id = 'teste-biscoito';
select id, titulo, formato, minutos, n_suspeitos, n_docs, versao, teste from public.casos order by teste, id;
