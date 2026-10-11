-- Longe & Perto v9 — reencontro, campanha de 3 noites, cláusulas, enredos, recados e cuidado.
-- Pode rodar de novo (nada duplica). Rode depois do 022_v8.sql/023_seed_v8.sql (usa `roteiros`).

------------------------------------------------------------------------------
-- 1) Cofre: vira "fatura" (promessas, vales e prendas para pagar ao vivo)
------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.cofre') is null then
    raise notice 'Tabela cofre não existe (v3 não rodou): pulando a parte da fatura.';
    return;
  end if;
  alter table public.cofre add column if not exists tipo       text not null default 'promessa';
  alter table public.cofre add column if not exists credor     int;   -- quem tem o direito de cobrar (0/1); null = os dois
  alter table public.cofre add column if not exists minutos    int;   -- duração do vale/prenda, se houver
  alter table public.cofre add column if not exists quitado_em timestamptz;
  if not exists (select 1 from pg_constraint where conname = 'cofre_tipo_ck') then
    alter table public.cofre add constraint cofre_tipo_ck check (tipo in ('promessa','vale','prenda'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cofre_credor_ck') then
    alter table public.cofre add constraint cofre_credor_ck check (credor is null or credor in (0,1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cofre_minutos_ck') then
    alter table public.cofre add constraint cofre_minutos_ck check (minutos is null or minutos between 1 and 240);
  end if;
end $$;

-- Modelos de vale (prêmio de quem vence a partida). Só leitura.
create table if not exists public.vales_modelos (
  id      uuid primary key default gen_random_uuid(),
  texto   text not null unique check (char_length(btrim(texto)) between 3 and 120),
  minutos int  check (minutos is null or minutos between 1 and 240),
  nivel   text not null check (nivel in ('romantico','leve','criativo','picante','pesado')),
  emoji   text not null default '🎟️'
);
alter table public.vales_modelos enable row level security;
drop policy if exists "ler" on public.vales_modelos;
create policy "ler" on public.vales_modelos for select to anon, authenticated using (true);

insert into public.vales_modelos (texto, minutos, nivel, emoji) values
  ('Vale massagem nas costas', 15, 'romantico', '💆'),
  ('Vale cafuné até dormir', 20, 'romantico', '😴'),
  ('Vale café da manhã na cama', null, 'romantico', '☕'),
  ('Vale escolher o filme sem discussão', null, 'leve', '🎬'),
  ('Vale escolher o drink (e o outro prepara)', null, 'leve', '🍹'),
  ('Vale escolher o restaurante', null, 'leve', '🍽️'),
  ('Vale passeio onde eu quiser', null, 'leve', '🗺️'),
  ('Vale um dia sem lavar louça', null, 'leve', '🧽'),
  ('Vale playlist: só toca o que eu escolher', 60, 'criativo', '🎶'),
  ('Vale sessão de fotos do casal do meu jeito', 20, 'criativo', '📸'),
  ('Vale massagem com óleo', 20, 'picante', '🫧'),
  ('Vale banho a dois', 20, 'picante', '🚿'),
  ('Vale beijos onde eu apontar', 5, 'picante', '💋'),
  ('Vale escolher a roupa (ou a falta dela) da noite', null, 'picante', '👗'),
  ('Vale um "sim" para uma posição do cardápio', null, 'pesado', '📖'),
  ('Vale 10 minutos no comando', 10, 'pesado', '👑'),
  ('Vale realizar um desejo do cardápio secreto', null, 'pesado', '🔥')
on conflict (texto) do nothing;

------------------------------------------------------------------------------
-- 2) Cardápio secreto de desejos (blind match): só o que os dois querem aparece
------------------------------------------------------------------------------
create table if not exists public.desejos_itens (
  id        uuid primary key default gen_random_uuid(),
  sala      text references public.salas(codigo) on delete cascade,  -- null = item padrão
  categoria text not null check (categoria in ('sair','casa','romantico','picante','pesado')),
  nivel     text not null check (nivel in ('romantico','leve','criativo','picante','pesado')),
  texto     text not null check (char_length(btrim(texto)) between 3 and 140),
  emoji     text not null default '✨',
  criado_em timestamptz not null default now()
);
create unique index if not exists desejos_itens_padrao_uniq on public.desejos_itens (texto) where sala is null;
create index if not exists desejos_itens_sala_idx on public.desejos_itens (sala);
alter table public.desejos_itens enable row level security;
drop policy if exists "ler" on public.desejos_itens;
create policy "ler" on public.desejos_itens for select to anon, authenticated using (true);

-- Votos e envios: SEM policy nenhuma. Ninguém lê pela API; só os RPCs.
create table if not exists public.desejos_votos (
  sala    text not null references public.salas(codigo) on delete cascade,
  rodada  text not null check (char_length(rodada) between 1 and 40),   -- ex.: data do reencontro '2026-11-14'
  jogador int  not null check (jogador in (0,1)),
  item    uuid not null references public.desejos_itens(id) on delete cascade,
  quer    boolean not null,
  primary key (sala, rodada, jogador, item)
);
create table if not exists public.desejos_envios (
  sala       text not null references public.salas(codigo) on delete cascade,
  rodada     text not null,
  jogador    int  not null check (jogador in (0,1)),
  enviado_em timestamptz not null default now(),
  primary key (sala, rodada, jogador)
);
alter table public.desejos_votos  enable row level security;
alter table public.desejos_envios enable row level security;

-- Cria um item próprio da sala (os dois votam nele normalmente)
create or replace function public.desejos_item_criar(p_sala text, p_categoria text, p_nivel text, p_texto text, p_emoji text default '✨')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.salas where codigo = p_sala) then raise exception 'sala não existe'; end if;
  if (select count(*) from public.desejos_itens where sala = p_sala) >= 100 then raise exception 'limite de itens da sala'; end if;
  insert into public.desejos_itens (sala, categoria, nivel, texto, emoji)
  values (p_sala, p_categoria, p_nivel, btrim(p_texto), coalesce(nullif(btrim(p_emoji), ''), '✨'))
  returning id into v_id;
  return v_id;
end $$;

-- Envia o cardápio de um jogador de uma vez: p_votos = [{"item":"uuid","quer":true}, ...]
-- Depois de enviado, não muda mais (para ninguém ajustar o voto depois de ver o resultado).
create or replace function public.desejos_enviar(p_sala text, p_rodada text, p_jogador int, p_votos jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_jogador not in (0,1) then raise exception 'jogador inválido'; end if;
  if not exists (select 1 from public.salas where codigo = p_sala) then raise exception 'sala não existe'; end if;
  if jsonb_typeof(p_votos) <> 'array' or jsonb_array_length(p_votos) > 200 then raise exception 'votos inválidos'; end if;
  if exists (select 1 from public.desejos_envios where sala = p_sala and rodada = p_rodada and jogador = p_jogador) then
    raise exception 'já enviado';
  end if;
  insert into public.desejos_votos (sala, rodada, jogador, item, quer)
  select p_sala, p_rodada, p_jogador, (v->>'item')::uuid, coalesce((v->>'quer')::boolean, false)
    from jsonb_array_elements(p_votos) v
    join public.desejos_itens i on i.id = (v->>'item')::uuid and (i.sala is null or i.sala = p_sala)
  on conflict do nothing;
  insert into public.desejos_envios (sala, rodada, jogador) values (p_sala, p_rodada, p_jogador);
  return true;
end $$;

-- Quem já enviou (sem revelar votos)
create or replace function public.desejos_status(p_sala text, p_rodada text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'enviaram', coalesce((select jsonb_agg(jogador order by jogador) from public.desejos_envios
                           where sala = p_sala and rodada = p_rodada), '[]'::jsonb));
$$;

-- Revela só os itens que os DOIS marcaram, e só depois que os dois enviaram
create or replace function public.desejos_revelar(p_sala text, p_rodada text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.desejos_envios where sala = p_sala and rodada = p_rodada) < 2 then
    return jsonb_build_object('pronto', false);
  end if;
  return jsonb_build_object('pronto', true, 'itens', coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'texto', i.texto, 'emoji', i.emoji,
                                        'categoria', i.categoria, 'nivel', i.nivel) order by i.categoria, i.texto)
      from public.desejos_itens i
     where (select count(*) from public.desejos_votos v
             where v.sala = p_sala and v.rodada = p_rodada and v.item = i.id and v.quer) = 2
  ), '[]'::jsonb));
end $$;

insert into public.desejos_itens (categoria, nivel, texto, emoji) values
  ('sair', 'leve', 'Jantar num restaurante que nenhum dos dois conhece', '🍽️'),
  ('sair', 'leve', 'Ver o pôr do sol num lugar alto', '🌅'),
  ('sair', 'leve', 'Cinema com pipoca grande', '🍿'),
  ('sair', 'leve', 'Feira ou mercado de rua de manhã', '🧺'),
  ('sair', 'leve', 'Praia ou cachoeira o dia inteiro', '🏖️'),
  ('sair', 'leve', 'Sorveteria e passeio sem rumo', '🍦'),
  ('sair', 'criativo', 'Tirar fotos juntos num lugar bonito da cidade', '📸'),
  ('sair', 'leve', 'Bar com música ao vivo', '🎸'),
  ('casa', 'leve', 'Cozinhar juntos uma receita nova', '🍝'),
  ('casa', 'leve', 'Maratona de série debaixo da coberta', '📺'),
  ('casa', 'romantico', 'Café da manhã demorado, sem celular', '☕'),
  ('casa', 'criativo', 'Noite de jogos de tabuleiro ou cartas', '🎲'),
  ('casa', 'leve', 'Dia inteiro de pijama', '🛋️'),
  ('casa', 'romantico', 'Assistir ao filme que um dos dois ama e o outro nunca viu', '🎬'),
  ('casa', 'criativo', 'Cantar no karaokê da sala', '🎤'),
  ('romantico', 'romantico', 'Dormir abraçados a noite toda', '🫂'),
  ('romantico', 'romantico', 'Dançar coladinhos na sala', '💃'),
  ('romantico', 'romantico', 'Banho demorado juntos', '🛁'),
  ('romantico', 'romantico', 'Jantar à luz de velas em casa', '🕯️'),
  ('romantico', 'romantico', 'Escrever uma carta um para o outro e ler em voz alta', '💌'),
  ('romantico', 'romantico', 'Massagem demorada, um de cada vez', '💆'),
  ('romantico', 'romantico', 'Ficar uma hora só conversando, olhos nos olhos', '👀'),
  ('picante', 'picante', 'Lingerie ou cueca escolhida pelo outro', '👙'),
  ('picante', 'picante', 'Massagem com óleo pelo corpo todo', '🫧'),
  ('picante', 'picante', 'Strip-tease com música escolhida', '🎶'),
  ('picante', 'picante', 'Um de olhos vendados a noite toda', '🙈'),
  ('picante', 'picante', 'Fazer amor fora do quarto', '🚪'),
  ('picante', 'picante', 'Cumprir ao vivo um desafio que ficou só na câmera', '📲'),
  ('picante', 'picante', 'Acordar o outro com beijos pelo corpo', '🌄'),
  ('picante', 'picante', 'Jogo de gelo e calor (cubo de gelo e respiração quente)', '🧊'),
  ('pesado', 'pesado', 'Testar uma posição nova do guia', '📖'),
  ('pesado', 'pesado', 'Mãos amarradas com uma gravata ou lenço', '🎀'),
  ('pesado', 'pesado', 'Um no comando total por uma hora', '👑'),
  ('pesado', 'pesado', 'Roleplay de estranhos que se conhecem num bar', '🍸'),
  ('pesado', 'pesado', 'Usar um brinquedo novo juntos', '🎁'),
  ('pesado', 'pesado', 'Na frente do espelho', '🪞'),
  ('pesado', 'pesado', 'Uma rapidinha num momento inesperado do dia', '⏱️'),
  ('pesado', 'pesado', 'Realizar a fantasia que um contou na distância', '🔥')
on conflict do nothing;

------------------------------------------------------------------------------
-- 3) Campanha de 3 noites (usa 3 roteiros novos da tabela `roteiros`)
------------------------------------------------------------------------------
insert into public.roteiros (nome, emoji, descricao, nivel_max, etapas, ordem, ativo) values
  ('Ato 1 · Conexão', '🌙', 'Noite 1 da campanha: histórias não contadas, medos e planos. Baixar a guarda.', 'leve',
   '[{"nome": "Histórias antigas", "rodadas": 3, "niveis": ["romantico"], "tipos": ["verdade"]}, {"nome": "Sem armadura", "rodadas": 3, "niveis": ["leve"], "tipos": ["verdade"]}, {"nome": "Carinho na tela", "rodadas": 2, "niveis": ["romantico", "leve"], "tipos": ["desafio"]}, {"nome": "Para amanhã", "rodadas": 0, "niveis": ["leve"], "tipos": ["encerrar"]}]'::jsonb, 20, false),
  ('Ato 2 · Tensão', '⚡', 'Noite 2 da campanha: provocar muito e não terminar nada. A tensão fica guardada para amanhã.', 'picante',
   '[{"nome": "Aquecer", "rodadas": 2, "niveis": ["criativo"], "tipos": ["desafio"]}, {"nome": "Provocar", "rodadas": 4, "niveis": ["picante"], "tipos": ["verdade", "desafio"]}, {"nome": "Duelo", "rodadas": 1, "niveis": ["picante"], "tipos": ["duelo"]}, {"nome": "Proibido terminar", "rodadas": 0, "niveis": ["picante"], "tipos": ["encerrar"]}]'::jsonb, 21, false),
  ('Ato 3 · Clímax', '🔥', 'Noite 3 da campanha: tudo liberado, e quem juntou bônus nas noites anteriores dita o ritmo.', 'pesado',
   '[{"nome": "Cobrança", "rodadas": 2, "niveis": ["picante"], "tipos": ["desafio"]}, {"nome": "Sem filtro", "rodadas": 4, "niveis": ["pesado"], "tipos": ["verdade", "desafio"]}, {"nome": "Duelo final", "rodadas": 1, "niveis": ["pesado"], "tipos": ["duelo"]}, {"nome": "Até o fim", "rodadas": 1, "niveis": ["pesado"], "tipos": ["sequencia"]}]'::jsonb, 22, false)
on conflict (nome) do nothing;
-- ativo = false: estes três não aparecem soltos na lista de roteiros, só dentro da campanha.

create table if not exists public.campanhas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique check (char_length(btrim(nome)) between 2 and 40),
  emoji     text not null,
  descricao text not null check (char_length(btrim(descricao)) between 5 and 300),
  nivel_max text not null check (nivel_max in ('romantico','leve','criativo','picante','pesado')),
  noites    jsonb not null check (jsonb_typeof(noites) = 'array' and jsonb_array_length(noites) between 2 and 5),
  ordem     int not null default 0,
  ativo     boolean not null default true
);
alter table public.campanhas enable row level security;
drop policy if exists "ler" on public.campanhas;
create policy "ler" on public.campanhas for select to anon, authenticated using (true);

insert into public.campanhas (nome, emoji, descricao, nivel_max, noites, ordem) values
  ('Minissérie em 3 atos', '🎬', 'Três noites seguidas que contam uma história: conexão, tensão e clímax. Os pontos das duas primeiras viram bônus na terceira.', 'pesado',
   '[{"titulo": "Conexão & verdades ocultas", "roteiro": "Ato 1 · Conexão", "regra": "Hoje é só conversa e carinho. Nada de pressa."},
     {"titulo": "Tensão & proibição", "roteiro": "Ato 2 · Tensão", "regra": "Pode provocar o quanto quiser, mas ninguém termina nada hoje. Quem quebrar a regra perde os bônus."},
     {"titulo": "Clímax & quebra de regras", "roteiro": "Ato 3 · Clímax", "regra": "Tudo liberado. Quem tem mais bônus escolhe o ritmo."}]'::jsonb, 1),
  ('Contagem para o reencontro', '✈️', 'As três últimas noites antes de se verem: saudade, planos e provocação que fica para o encontro.', 'picante',
   '[{"titulo": "Saudade", "roteiro": "Noite romântica", "regra": "Uma lembrança boa para cada rodada."},
     {"titulo": "Planos", "roteiro": "Antes do reencontro", "regra": "Tudo que for prometido vai para o cofre."},
     {"titulo": "Véspera", "roteiro": "Ato 2 · Tensão", "regra": "Provocar sem terminar: o resto é ao vivo."}]'::jsonb, 2)
on conflict (nome) do nothing;

------------------------------------------------------------------------------
-- 4) Efeito borboleta: cláusulas para o dia seguinte
------------------------------------------------------------------------------
create table if not exists public.clausulas (
  id    uuid primary key default gen_random_uuid(),
  nivel text not null check (nivel in ('romantico','leve','criativo','picante','pesado')),
  texto text not null unique check (char_length(btrim(texto)) between 10 and 240),
  ativa boolean not null default true
);
alter table public.clausulas enable row level security;
drop policy if exists "ler" on public.clausulas;
create policy "ler" on public.clausulas for select to anon, authenticated using (true);

create table if not exists public.clausulas_sala (
  id          uuid primary key default gen_random_uuid(),
  sala        text not null references public.salas(codigo) on delete cascade,
  para        int  not null check (para in (0,1)),      -- quem precisa cumprir
  texto       text not null check (char_length(btrim(texto)) between 10 and 240),
  nivel       text not null check (nivel in ('romantico','leve','criativo','picante','pesado')),
  vale_para   date not null,                             -- o dia seguinte (fuso −03:00)
  cumprida_em timestamptz,
  criada_em   timestamptz not null default now()
);
create index if not exists clausulas_sala_idx on public.clausulas_sala (sala, vale_para desc);

insert into public.clausulas (nivel, texto) values
  ('romantico', 'Amanhã, a primeira mensagem do dia de quem perdeu é uma declaração de pelo menos 5 linhas.'),
  ('romantico', 'Amanhã, quem perdeu manda uma foto de algo que lembrou o outro durante o dia.'),
  ('romantico', 'Amanhã, quem perdeu liga só para dizer boa noite, sem pressa de desligar.'),
  ('romantico', 'Amanhã, quem perdeu escolhe a música do dia e manda com uma explicação do porquê.'),
  ('romantico', 'Amanhã, quem perdeu escreve um "Abra quando…" novo no app.'),
  ('leve', 'Amanhã, quem perdeu manda um áudio cantando um trecho de música (pode ser desafinado).'),
  ('leve', 'Amanhã, quem perdeu usa o apelido que o outro escolher em todas as mensagens.'),
  ('leve', 'Amanhã, quem perdeu manda uma selfie fazendo a careta que o outro pedir.'),
  ('leve', 'Amanhã, quem perdeu responde todas as mensagens com um emoji a mais do que o normal.'),
  ('leve', 'Amanhã, quem perdeu conta três coisas boas que aconteceram no dia, antes de reclamar de qualquer coisa.'),
  ('criativo', 'Amanhã, quem perdeu manda um desenho feito à mão de nós dois.'),
  ('criativo', 'Amanhã, quem perdeu escreve um poema de quatro versos sobre o outro.'),
  ('criativo', 'Amanhã, quem perdeu grava um áudio narrando o próprio almoço como se fosse documentário.'),
  ('criativo', 'Amanhã, quem perdeu manda uma playlist com 5 músicas que contam a nossa história.'),
  ('criativo', 'Amanhã, quem perdeu inventa e manda uma "notícia de jornal" sobre o nosso reencontro.'),
  ('picante', 'Amanhã, quem perdeu manda uma mensagem provocante no meio do expediente do outro.'),
  ('picante', 'Amanhã, quem perdeu manda uma foto em visualização única com a roupa que o outro escolher.'),
  ('picante', 'Amanhã, quem perdeu descreve por mensagem o que faria se o outro chegasse de surpresa.'),
  ('picante', 'Amanhã, quem perdeu manda um áudio sussurrando o que mais sente falta no corpo do outro.'),
  ('picante', 'Amanhã, quem ganhou escolhe a peça íntima que quem perdeu vai usar o dia inteiro.'),
  ('pesado', 'Amanhã, o bom dia de quem perdeu é um áudio de 60 segundos contando uma fantasia que quer realizar.'),
  ('pesado', 'Amanhã, quem perdeu manda um vídeo em visualização única fazendo o que o outro pedir na hora.'),
  ('pesado', 'Amanhã, quem perdeu fica à disposição para uma chamada de 10 minutos no horário que o outro escolher, sem negar nada.'),
  ('pesado', 'Amanhã, quem perdeu escreve com detalhes como vai ser a primeira noite do reencontro.'),
  ('pesado', 'Amanhã, quem ganhou escolhe uma regra que quem perdeu cumpre o dia inteiro (com direito a veto).')
on conflict (texto) do nothing;

------------------------------------------------------------------------------
-- 5) Enredos com escolhas (roleplay em árvore). Só leitura.
--    nos: [{"id","quem":"vez|outro|ambos","tipo":"narracao|verdade|desafio","texto","opcoes":[{"rotulo","vai"}],"fim":bool}]
------------------------------------------------------------------------------
create table if not exists public.enredos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique check (char_length(btrim(nome)) between 2 and 50),
  emoji     text not null,
  descricao text not null check (char_length(btrim(descricao)) between 5 and 240),
  nivel_max text not null check (nivel_max in ('romantico','leve','criativo','picante','pesado')),
  modo      text not null default 'ambos' check (modo in ('distancia','presencial','ambos')),
  papeis    jsonb not null check (jsonb_typeof(papeis) = 'array' and jsonb_array_length(papeis) = 2),
  nos       jsonb not null check (jsonb_typeof(nos) = 'array' and jsonb_array_length(nos) between 3 and 30),
  ordem     int not null default 0,
  ativo     boolean not null default true
);
alter table public.enredos enable row level security;
drop policy if exists "ler" on public.enredos;
create policy "ler" on public.enredos for select to anon, authenticated using (true);

insert into public.enredos (nome, emoji, descricao, nivel_max, modo, papeis, nos, ordem) values
('Primeiro encontro de novo', '💐', 'Vocês fingem que nunca se viram e vivem o primeiro encontro outra vez.', 'romantico', 'ambos',
 '["Quem chegou primeiro", "Quem chegou atrasado"]',
 '[{"id": "a", "quem": "ambos", "tipo": "narracao", "texto": "Um café cheio. Uma mesa vaga, duas cadeiras, e vocês dois sem se conhecer. Quem chegou atrasado pede licença para sentar.", "opcoes": [{"rotulo": "Puxar conversa", "vai": "b"}, {"rotulo": "Fingir que lê o cardápio", "vai": "c"}]},
   {"id": "b", "quem": "vez", "tipo": "verdade", "texto": "Apresente-se como se fosse a primeira vez: nome, o que faz e uma coisa que ninguém sabe sobre você.", "opcoes": [{"rotulo": "Continuar", "vai": "d"}]},
   {"id": "c", "quem": "outro", "tipo": "desafio", "texto": "Chame a atenção do outro sem falar nada, só com o olhar e um sorriso, por 20 segundos.", "opcoes": [{"rotulo": "Funcionou", "vai": "d"}]},
   {"id": "d", "quem": "outro", "tipo": "verdade", "texto": "Qual foi a primeira coisa que você reparou em mim (de verdade, no nosso primeiro encontro)?", "opcoes": [{"rotulo": "Pedir o número", "vai": "e"}, {"rotulo": "Convidar para andar", "vai": "f"}]},
   {"id": "e", "quem": "vez", "tipo": "desafio", "texto": "Peça o número do outro com a cantada mais cafona que conseguir.", "opcoes": [{"rotulo": "Continuar", "vai": "g"}]},
   {"id": "f", "quem": "vez", "tipo": "verdade", "texto": "Se a gente estivesse andando agora, para onde você me levaria e por quê?", "opcoes": [{"rotulo": "Continuar", "vai": "g"}]},
   {"id": "g", "quem": "ambos", "tipo": "desafio", "texto": "Despedida do primeiro encontro: cada um diz o que sentiu ao ir embora naquele dia de verdade. Termina com um beijo (na tela ou ao vivo).", "fim": true}]', 1),
('Estranhos no bar do hotel', '🍸', 'Dois estranhos hospedados no mesmo hotel, uma noite, um bar quase vazio.', 'picante', 'ambos',
 '["Quem está no balcão", "Quem acabou de chegar"]',
 '[{"id": "a", "quem": "ambos", "tipo": "narracao", "texto": "Bar do hotel, quase meia-noite. Quem acabou de chegar senta a dois bancos de distância e pede a mesma bebida.", "opcoes": [{"rotulo": "Oferecer uma bebida", "vai": "b"}, {"rotulo": "Esperar o outro falar", "vai": "c"}]},
   {"id": "b", "quem": "outro", "tipo": "desafio", "texto": "Ofereça a bebida com uma frase que nunca usaria na vida real, no tom mais sedutor possível.", "opcoes": [{"rotulo": "Aceitar", "vai": "d"}, {"rotulo": "Fazer charme", "vai": "e"}]},
   {"id": "c", "quem": "vez", "tipo": "verdade", "texto": "No personagem: o que você veio fazer nesta cidade e por que está sozinho(a) no bar?", "opcoes": [{"rotulo": "Continuar", "vai": "d"}]},
   {"id": "d", "quem": "vez", "tipo": "verdade", "texto": "Ainda no personagem: o que mais chamou a sua atenção em mim quando entrei?", "opcoes": [{"rotulo": "Chegar mais perto", "vai": "f"}]},
   {"id": "e", "quem": "vez", "tipo": "desafio", "texto": "Faça charme por 30 segundos: recuse, mas sem conseguir tirar os olhos do outro.", "opcoes": [{"rotulo": "Ceder", "vai": "f"}]},
   {"id": "f", "quem": "outro", "tipo": "desafio", "texto": "Sussurre (perto da câmera ou do ouvido) o número do seu quarto e uma coisa que vai acontecer lá.", "opcoes": [{"rotulo": "Subir junto", "vai": "g"}, {"rotulo": "Deixar a chave e ir na frente", "vai": "h"}]},
   {"id": "g", "quem": "ambos", "tipo": "desafio", "texto": "No elevador: 60 segundos de beijo e provocação, sem tirar nenhuma peça de roupa ainda.", "opcoes": [{"rotulo": "Chegar ao quarto", "vai": "i"}]},
   {"id": "h", "quem": "vez", "tipo": "desafio", "texto": "Você chega ao quarto depois. Descreva o que encontra quando a porta abre, e o outro tem que fazer igual.", "opcoes": [{"rotulo": "Chegar ao quarto", "vai": "i"}]},
   {"id": "i", "quem": "ambos", "tipo": "narracao", "texto": "A porta fecha. Os estranhos param de ser estranhos. Daqui em diante, vale o nível que a sala permitir.", "fim": true}]', 2),
('Entrevista proibida', '💼', 'Uma entrevista de emprego que sai completamente do roteiro.', 'pesado', 'ambos',
 '["Quem entrevista", "Quem é entrevistado(a)"]',
 '[{"id": "a", "quem": "ambos", "tipo": "narracao", "texto": "Sala de reunião, fim de expediente. Quem entrevista olha o currículo. Quem é entrevistado(a) ajeita a roupa.", "opcoes": [{"rotulo": "Começar formal", "vai": "b"}]},
   {"id": "b", "quem": "vez", "tipo": "verdade", "texto": "Pergunta da entrevista: qual é a sua maior qualidade… e o seu maior defeito na cama?", "opcoes": [{"rotulo": "Resposta ousada", "vai": "c"}, {"rotulo": "Resposta tímida", "vai": "d"}]},
   {"id": "c", "quem": "outro", "tipo": "desafio", "texto": "Prove a qualidade que você disse, ali mesmo, por 30 segundos.", "opcoes": [{"rotulo": "Contratado(a)?", "vai": "e"}]},
   {"id": "d", "quem": "vez", "tipo": "desafio", "texto": "A timidez não convenceu. Desabotoe uma peça de roupa enquanto explica por que merece a vaga.", "opcoes": [{"rotulo": "Continuar", "vai": "e"}]},
   {"id": "e", "quem": "outro", "tipo": "verdade", "texto": "Última etapa: o que você está disposto(a) a fazer para conseguir essa vaga hoje?", "opcoes": [{"rotulo": "Aceitar a proposta", "vai": "f"}, {"rotulo": "Fazer uma contraproposta", "vai": "g"}]},
   {"id": "f", "quem": "vez", "tipo": "desafio", "texto": "Quem entrevista dá três ordens; quem é entrevistado(a) cumpre, com direito a um veto.", "opcoes": [{"rotulo": "Fim do expediente", "vai": "h"}]},
   {"id": "g", "quem": "outro", "tipo": "desafio", "texto": "Inverta o jogo: agora você dá três ordens para quem entrevista, com direito a um veto.", "opcoes": [{"rotulo": "Fim do expediente", "vai": "h"}]},
   {"id": "h", "quem": "ambos", "tipo": "narracao", "texto": "Contrato assinado. Daqui em diante, vale o nível que a sala permitir.", "fim": true}]', 3)
on conflict (nome) do nothing;

------------------------------------------------------------------------------
-- 6) Recados sem resposta (para dias ruins)
------------------------------------------------------------------------------
create table if not exists public.recados (
  id        uuid primary key default gen_random_uuid(),
  sala      text not null references public.salas(codigo) on delete cascade,
  de        int  not null check (de in (0,1)),
  texto     text not null check (char_length(btrim(texto)) between 1 and 500),
  lido_em   timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists recados_sala_idx on public.recados (sala, criado_em desc);

------------------------------------------------------------------------------
-- 7) Perguntas de espelho (cápsulas de 1 ano)
------------------------------------------------------------------------------
insert into public.cartas (tipo, nivel, texto, midia) values
  ('capsula', 'romantico', 'Qual é o seu maior medo sobre nós dois hoje?', null),
  ('capsula', 'romantico', 'O que você mais admira na minha rotina?', null),
  ('capsula', 'romantico', 'O que te faz ter certeza de que vale a pena a distância?', null),
  ('capsula', 'romantico', 'Como você descreveria o nosso namoro para alguém que não nos conhece?', null),
  ('capsula', 'romantico', 'O que você gostaria que fosse diferente entre nós daqui a um ano?', null),
  ('capsula', 'romantico', 'Qual é a coisa mais difícil de namorar a distância para você hoje?', null),
  ('capsula', 'romantico', 'Que promessa você me faz hoje para cobrar daqui a um ano?', null),
  ('capsula', 'romantico', 'Em que você mudou desde que começou a namorar comigo?', null),
  ('capsula', 'romantico', 'Qual é o seu lugar preferido para pensar em mim?', null),
  ('capsula', 'romantico', 'O que você ainda não teve coragem de me pedir?', null),
  ('capsula', 'romantico', 'Qual foi o momento deste ano em que você mais precisou de mim?', null),
  ('capsula', 'romantico', 'Onde você quer que a gente more um dia?', null)
on conflict do nothing;

------------------------------------------------------------------------------
-- 8) RLS e Realtime (mesmo modelo das outras tabelas de sala)
------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clausulas_sala','recados']
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
    execute format('alter table public.%I replica identity full', t);
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'desejos_item_criar(text, text, text, text, text)',
    'desejos_enviar(text, text, int, jsonb)',
    'desejos_status(text, text)',
    'desejos_revelar(text, text)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- Conferência
select 'vales' as o_que, count(*) from public.vales_modelos
union all select 'desejos padrão', count(*) from public.desejos_itens where sala is null
union all select 'campanhas', count(*) from public.campanhas
union all select 'cláusulas', count(*) from public.clausulas
union all select 'enredos', count(*) from public.enredos
union all select 'cápsulas', count(*) from public.cartas where tipo = 'capsula' and sala is null;
