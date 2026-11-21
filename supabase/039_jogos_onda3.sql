-- Longe & Perto — Onda 3: RPCs de tabuleiro seguro e seed de Estratégia e Turnos.
-- Migração idempotente: pode ser executada novamente sem duplicar dados.

------------------------------------------------------------------------------
-- 0) Ajusta índice de unicidade de jogos_conteudo para suportar campanhas grandes
------------------------------------------------------------------------------
alter table public.jogos_conteudo drop constraint if exists jogos_conteudo_unico_uk;
create unique index if not exists jogos_conteudo_unico_md5_idx
  on public.jogos_conteudo (jogo_id, md5(dados::text));

------------------------------------------------------------------------------
-- 1) RPCs security definer para Batalha Naval e Código a dois
------------------------------------------------------------------------------
create or replace function public.jogo_batalha_disparar(
  p_sala_codigo         text,
  p_partida_id          uuid,
  p_rodada              integer,
  p_alvo                text,
  p_celula              text,
  p_disparos_anteriores jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_frota       jsonb;
  v_navios      jsonb;
  v_navio       jsonb;
  v_acertado    jsonb := null;
  v_disparos    text[];
  v_cel         text;
  v_afundou     boolean := true;
  v_vitoria     boolean := true;
  v_nav_check   jsonb;
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
  into v_frota
  from public.jogos_segredos s
  where s.partida_id = p_partida_id
    and s.rodada = p_rodada
    and s.jogador = p_alvo
    and s.chave = 'frota';

  if v_frota is null then
    raise exception 'Frota do adversário ainda não está pronta.';
  end if;

  v_navios := case
    when jsonb_typeof(v_frota) = 'array' then v_frota
    else coalesce(v_frota->'navios', '[]'::jsonb)
  end;

  select coalesce(array_agg(distinct x), array[]::text[])
  into v_disparos
  from (
    select jsonb_array_elements_text(coalesce(p_disparos_anteriores, '[]'::jsonb)) as x
    union all
    select p_celula as x
  ) t;

  for v_navio in select * from jsonb_array_elements(v_navios)
  loop
    if exists (
      select 1
      from jsonb_array_elements_text(coalesce(v_navio->'celulas', '[]'::jsonb)) c
      where c = p_celula
    ) then
      v_acertado := v_navio;
      exit;
    end if;
  end loop;

  if v_acertado is null then
    return jsonb_build_object('resultado', 'agua');
  end if;

  for v_cel in select jsonb_array_elements_text(coalesce(v_acertado->'celulas', '[]'::jsonb))
  loop
    if not (v_cel = any(v_disparos)) then
      v_afundou := false;
      exit;
    end if;
  end loop;

  if not v_afundou then
    return jsonb_build_object(
      'resultado', 'acerto',
      'navio_id', v_acertado->>'id'
    );
  end if;

  for v_nav_check in select * from jsonb_array_elements(v_navios)
  loop
    for v_cel in select jsonb_array_elements_text(coalesce(v_nav_check->'celulas', '[]'::jsonb))
    loop
      if not (v_cel = any(v_disparos)) then
        v_vitoria := false;
        exit;
      end if;
    end loop;
    exit when not v_vitoria;
  end loop;

  return jsonb_build_object(
    'resultado', 'afundou',
    'navio_id', v_acertado->>'id',
    'celulas', coalesce(v_acertado->'celulas', '[]'::jsonb),
    'recompensa', coalesce(v_acertado->>'recompensa', ''),
    'vitoria', v_vitoria
  );
end;
$$;

create or replace function public.jogo_codigo_marcar(
  p_sala_codigo text,
  p_partida_id  uuid,
  p_rodada      integer,
  p_guia        text,
  p_indice      integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mapa jsonb;
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
  into v_mapa
  from public.jogos_segredos s
  where s.partida_id = p_partida_id
    and s.rodada = p_rodada
    and s.jogador = p_guia
    and s.chave = 'mapa';

  if v_mapa is null then
    raise exception 'Mapa secreto da rodada ainda não foi criado.';
  end if;

  if (v_mapa->>'armadilha')::integer = p_indice then
    return jsonb_build_object('tipo', 'armadilha');
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_mapa->'casal', '[]'::jsonb)) idx
    where idx::integer = p_indice
  ) then
    return jsonb_build_object('tipo', 'casal');
  end if;

  return jsonb_build_object('tipo', 'neutro');
end;
$$;

grant execute on function public.jogo_batalha_disparar(text, uuid, integer, text, text, jsonb) to anon, authenticated;
grant execute on function public.jogo_codigo_marcar(text, uuid, integer, text, integer) to anon, authenticated;

------------------------------------------------------------------------------
-- 2) Seed: batalha-naval (32 sugestões de recompensas/prendas)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Ambos (14)
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Escolher o próximo filme sem veto"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Receber um elogio sincero de 30 segundos"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Escolher a música que toca agora"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Ganhar uma carta curta no cofre hoje"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Definir o tema da nossa próxima noite de jogos"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Ouvir uma confissão honesta sobre a semana"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Escolher a sobremesa do próximo encontro"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Pedir um desenho exclusivo no Mural"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Ganhar passe livre para pular uma prenda futura"}'),
  ('batalha-naval', 'mimo', 'ambos', false, '{"texto": "Decidir qual será a próxima série do casal"}'),
  ('batalha-naval', 'ousado', 'ambos', true, '{"texto": "Ouvir um segredo ousado só para vocês dois"}'),
  ('batalha-naval', 'ousado', 'ambos', true, '{"texto": "Escolher o clima e o nível das próximas rodadas"}'),
  ('batalha-naval', 'ousado', 'ambos', true, '{"texto": "Receber um elogio sem filtro sobre o que mais atrai"}'),
  ('batalha-naval', 'ousado', 'ambos', true, '{"texto": "Criar um combinado ousado para o próximo reencontro"}'),

  -- Longe (10)
  ('batalha-naval', 'longe', 'longe', false, '{"texto": "Áudio especial de bom dia amanhã"}'),
  ('batalha-naval', 'longe', 'longe', false, '{"texto": "Foto espontânea com dedicatória no álbum"}'),
  ('batalha-naval', 'longe', 'longe', false, '{"texto": "Escolher a cor da roupa da próxima chamada"}'),
  ('batalha-naval', 'longe', 'longe', false, '{"texto": "Serenata de 15 segundos na chamada"}'),
  ('batalha-naval', 'longe', 'longe', false, '{"texto": "Envelope surpresa para abrir amanhã"}'),
  ('batalha-naval', 'longe', 'longe', false, '{"texto": "História inventada antes de dormir na chamada"}'),
  ('batalha-naval', 'longe', 'longe', false, '{"texto": "Marcar uma chamada extra no horário escolhido"}'),
  ('batalha-naval', 'ousado', 'longe', true, '{"texto": "Chamada só de voz no escuro por 10 minutos"}'),
  ('batalha-naval', 'ousado', 'longe', true, '{"texto": "Descrever em detalhes o primeiro abraço do reencontro"}'),
  ('batalha-naval', 'ousado', 'longe', true, '{"texto": "Enviar uma mensagem provocante amanhã no meio do dia"}'),

  -- Juntos (8)
  ('batalha-naval', 'juntos', 'juntos', false, '{"texto": "Café da manhã preparado na cama"}'),
  ('batalha-naval', 'juntos', 'juntos', false, '{"texto": "Massagem nos ombros por 10 minutos"}'),
  ('batalha-naval', 'juntos', 'juntos', false, '{"texto": "Folga total da louça hoje"}'),
  ('batalha-naval', 'juntos', 'juntos', false, '{"texto": "20 minutos de cafuné garantido no sofá"}'),
  ('batalha-naval', 'juntos', 'juntos', false, '{"texto": "Escolher onde jantar hoje"}'),
  ('batalha-naval', 'ousado', 'juntos', true, '{"texto": "Beijo demorado de cinema sem pressa"}'),
  ('batalha-naval', 'ousado', 'juntos', true, '{"texto": "Massagem relaxante com luz baixa"}'),
  ('batalha-naval', 'ousado', 'juntos', true, '{"texto": "Conduzir o ritmo da noite dentro do combinado"}')
on conflict do nothing;

------------------------------------------------------------------------------
-- 3) Seed: codigo-a-dois (120 palavras curtas e evocativas)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Âncora"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Aurora"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Bússola"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Farol"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Chave"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Espelho"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Relógio"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Vela"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Ponte"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Ilha"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Tempestade"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Sombra"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Estrela"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Lua"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Sol"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Maré"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Vento"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Chuva"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Neve"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Fogo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Café"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Vinho"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Mel"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Sal"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Pão"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Limão"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Maçã"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Rosa"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Folha"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Raiz"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Floresta"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Deserto"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Montanha"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Vale"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Rio"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Lago"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Cachoeira"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Caverna"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Vulcão"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Horizonte"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Mapa"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Mala"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Trem"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Navio"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Avião"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Estrada"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Trilha"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Porto"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Torre"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Castelo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Janela"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Porta"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Escada"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Telhado"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Varanda"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Jardim"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Praça"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Teatro"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Cinema"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Museu"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Livro"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Carta"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Caderno"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Caneta"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Tinta"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Quadro"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Foto"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Pintura"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Violão"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Piano"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Tambor"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Rádio"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Disco"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Sino"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Eco"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Silêncio"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Dança"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Palco"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Máscara"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Coroa"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Espada"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Escudo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Flecha"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Anel"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Ouro"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Prata"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Cristal"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Pedra"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Areia"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Vidro"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Ferro"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Corda"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Rede"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Seda"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Cobertor"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Tapete"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Lanterna"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Fósforo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Cinza"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Fumaça"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Coruja"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Lobo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Raposa"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Gato"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Baleia"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Águia"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Borboleta"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Abelha"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Tartaruga"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Cavalo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Saudade"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Abraço"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Segredo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Sonho"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Sorte"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Tempo"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Destino"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Enigma"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Rastro"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Labirinto"}'),
  ('codigo-a-dois', 'geral', 'ambos', false, '{"palavra": "Promessa"}')
on conflict do nothing;

------------------------------------------------------------------------------
-- 4) Seed: expedicao (3 campanhas completas de gestão por turnos)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
(
  'expedicao',
  'campanha',
  'ambos',
  false,
  '{
    "titulo": "Estrada sem mapa",
    "subtitulo": "8 dias cruzando estradas secundárias até a cidade costeira",
    "ambiente": "Rodovia e interior",
    "recursos_iniciais": { "suprimentos": 65, "energia": 65, "moral": 65 },
    "papeis": [
      { "id": "navegadora", "nome": "Navegadora", "descricao": "Lê o clima, atalhos e sinais da estrada." },
      { "id": "mecanico", "nome": "Mecânico", "descricao": "Avalia o motor, combustível e desgaste do carro." }
    ],
    "dias": [
      {
        "dia": 1,
        "titulo": "Saída sob neblina",
        "evento": "Logo no início da viagem, a rodovia principal fecha por obra. Vocês precisam decidir como contornar o bloqueio antes que escureça.",
        "dicas": {
          "0": "O desvio de terra é mais curto, mas pode atrasar se a neblina engrossar.",
          "1": "O motor está frio; forçar subida íngreme agora vai gastar bastante combustível."
        },
        "opcoes": [
          { "id": "a", "titulo": "Seguir pelo desvio de terra", "efeitos": { "suprimentos": -5, "energia": -10, "moral": 5 }, "desfecho": "O caminho sacode bastante, mas rende uma paisagem linda e economiza tempo." },
          { "id": "b", "titulo": "Esperar 2 horas num café de beira de estrada", "efeitos": { "suprimentos": -10, "energia": 10, "moral": 10 }, "desfecho": "O café quente anima os dois e vocês retomam a viagem descansados." },
          { "id": "c", "titulo": "Fazer a volta longa pelo asfalto", "efeitos": { "suprimentos": 0, "energia": -15, "moral": -5 }, "desfecho": "O trajeto é seguro para o carro, mas cansativo demais para o primeiro dia." }
        ]
      },
      {
        "dia": 2,
        "titulo": "Pneu murcho no mirante",
        "evento": "Um pneu perde pressão perto de um mirante isolado. Há um borracheiro a 6 km e um estepe no porta-malas.",
        "dicas": {
          "0": "O mirante tem vista incrível para um piquenique improvisado enquanto resolvem.",
          "1": "Trocar pelo estepe economiza dinheiro, mas exige esforço físico no sol."
        },
        "opcoes": [
          { "id": "a", "titulo": "Trocar o pneu vocês mesmos", "efeitos": { "suprimentos": 5, "energia": -15, "moral": 5 }, "desfecho": "Deu trabalho, mas a parceria funcionou e sobrou comida extra." },
          { "id": "b", "titulo": "Ir devagar até o borracheiro", "efeitos": { "suprimentos": -15, "energia": -5, "moral": 5 }, "desfecho": "Conserto rápido e seguro, embora tenha pesado no orçamento dos suprimentos." },
          { "id": "c", "titulo": "Pausar no mirante e trocar com calma", "efeitos": { "suprimentos": -5, "energia": 5, "moral": 10 }, "desfecho": "O descanso transformou o imprevisto numa ótima lembrança." }
        ]
      },
      {
        "dia": 3,
        "titulo": "Feira de cidade pequena",
        "evento": "Vocês passam por uma praça em dia de feira local. Dá para abastecer a despensa, revisar o carro ou descansar na pousada.",
        "dicas": {
          "0": "Os produtores locais vendem frutas e pães baratos que duram vários dias.",
          "1": "Há uma oficina simples ali perto que regula o carro antes da serra."
        },
        "opcoes": [
          { "id": "a", "titulo": "Abastecer tudo na feira", "efeitos": { "suprimentos": 20, "energia": -10, "moral": 5 }, "desfecho": "Mochilas cheias de comida fresca para o resto da serra." },
          { "id": "b", "titulo": "Fazer revisão preventiva na oficina", "efeitos": { "suprimentos": -10, "energia": 15, "moral": 0 }, "desfecho": "O carro ficou leve e confiável para os trechos difíceis." },
          { "id": "c", "titulo": "Passar a tarde passeando pela praça", "efeitos": { "suprimentos": -5, "energia": 5, "moral": 15 }, "desfecho": "Tarde leve de conversa, música ao vivo e recarga emocional." }
        ]
      },
      {
        "dia": 4,
        "titulo": "Chuva forte na serra",
        "evento": "Uma tempestade reduz a visibilidade na descida da serra. A estrada exige atenção redobrada.",
        "dicas": {
          "0": "A chuva deve diminuir em 3 horas; há um abrigo rodoviário adiante.",
          "1": "Os limpadores estão gastos e dirigir sob temporal cansa rápido."
        },
        "opcoes": [
          { "id": "a", "titulo": "Parar no abrigo e fazer lanche", "efeitos": { "suprimentos": -10, "energia": 10, "moral": 5 }, "desfecho": "Esperaram o pior passar ouvindo chuva no teto e rindo." },
          { "id": "b", "titulo": "Seguir em velocidade reduzida", "efeitos": { "suprimentos": 0, "energia": -20, "moral": -10 }, "desfecho": "Avançaram no cronograma, mas chegaram tensos e exaustos." },
          { "id": "c", "titulo": "Buscar uma pousada improvisada", "efeitos": { "suprimentos": -15, "energia": 15, "moral": 10 }, "desfecho": "Dormiram em cama quente e acordaram renovados." }
        ]
      },
      {
        "dia": 5,
        "titulo": "Atalho das cachoeiras",
        "evento": "Um morador sugere uma estrada cênica que passa por duas cachoeiras, mas sem posto de gasolina por 80 km.",
        "dicas": {
          "0": "O visual vale muito para levantar o astral da viagem.",
          "1": "O tanque aguenta se dirigirem sem ar-condicionado e sem acelerar demais."
        },
        "opcoes": [
          { "id": "a", "titulo": "Pegar o atalho e mergulhar na cachoeira", "efeitos": { "suprimentos": -5, "energia": -10, "moral": 20 }, "desfecho": "Água gelada e risadas renovaram completamente o ânimo." },
          { "id": "b", "titulo": "Seguir pela rota convencional com posto", "efeitos": { "suprimentos": 10, "energia": 0, "moral": -10 }, "desfecho": "Rota segura e bem abastecida, mas monótona." },
          { "id": "c", "titulo": "Ir pelo atalho sem parar", "efeitos": { "suprimentos": 0, "energia": -15, "moral": 5 }, "desfecho": "Belas curvas e economia de tempo, mas cansaço acumulado." }
        ]
      },
      {
        "dia": 6,
        "titulo": "Noite sem sinal de celular",
        "evento": "O sinal desaparece no vale e vocês precisam escolher onde pernoitar antes de a bateria auxiliar acabar.",
        "dicas": {
          "0": "O céu está limpo: dormir olhando as estrelas seria inesquecível.",
          "1": "Deixar o carro ligado para carregar aparelhos drena energia demais."
        },
        "opcoes": [
          { "id": "a", "titulo": "Acampar sob as estrelas", "efeitos": { "suprimentos": -10, "energia": -5, "moral": 20 }, "desfecho": "Uma das noites mais bonitas da viagem, sem pressa nem telas." },
          { "id": "b", "titulo": "Dirigir até a próxima vila iluminada", "efeitos": { "suprimentos": -5, "energia": -15, "moral": 0 }, "desfecho": "Encontraram sinal e apoio, mas foram dormir tarde." },
          { "id": "c", "titulo": "Economizar tudo e dormir no carro", "efeitos": { "suprimentos": 5, "energia": -10, "moral": -10 }, "desfecho": "Pouparam recursos, mas acordaram com dor nas costas." }
        ]
      },
      {
        "dia": 7,
        "titulo": "Balsa quase partindo",
        "evento": "A última balsa para o trecho costeiro sai em 20 minutos. A fila tem dois caminhões e um quiosque ao lado.",
        "dicas": {
          "0": "Se perderem esta balsa, só amanhã cedo — mas a vila tem ótimo jantar.",
          "1": "Acelerar no trecho final força o freio, mas ainda dá para alcançar."
        },
        "opcoes": [
          { "id": "a", "titulo": "Correr para pegar a última balsa", "efeitos": { "suprimentos": -5, "energia": -15, "moral": 10 }, "desfecho": "Entraram no último segundo sob aplausos da tripulação." },
          { "id": "b", "titulo": "Dormir na vila e cruzar no amanhecer", "efeitos": { "suprimentos": -15, "energia": 15, "moral": 10 }, "desfecho": "Jantar tranquilo e travessia dourada ao nascer do sol." },
          { "id": "c", "titulo": "Dar a volta pela ponte antiga", "efeitos": { "suprimentos": 5, "energia": -20, "moral": -5 }, "desfecho": "Não gastaram com balsa, mas foi uma maratona ao volante." }
        ]
      },
      {
        "dia": 8,
        "titulo": "Chegada à costa",
        "evento": "O cheiro de mar aparece no horizonte. Falta decidir como fechar a expedição nos últimos quilômetros.",
        "dicas": {
          "0": "O pôr do sol no píer acontece em 40 minutos.",
          "1": "O carro precisa de um último cuidado antes de estacionar."
        },
        "opcoes": [
          { "id": "a", "titulo": "Ir direto para o píer ver o pôr do sol", "efeitos": { "suprimentos": -5, "energia": -5, "moral": 20 }, "desfecho": "Brinde final olhando o mar depois de 8 dias na estrada." },
          { "id": "b", "titulo": "Abastecer e organizar tudo antes de celebrar", "efeitos": { "suprimentos": 10, "energia": 5, "moral": 5 }, "desfecho": "Chegada tranquila e organizada, com tudo sob controle." },
          { "id": "c", "titulo": "Parar na padaria costeira para um café demorado", "efeitos": { "suprimentos": 5, "energia": 10, "moral": 10 }, "desfecho": "Fecharam a jornada sem pressa, celebrando cada quilômetro." }
        ]
      }
    ]
  }'
),
(
  'expedicao',
  'campanha',
  'ambos',
  false,
  '{
    "titulo": "Ilha do Farol",
    "subtitulo": "9 dias mantendo o antigo farol ativo até o barco de resgate",
    "ambiente": "Costa isolada",
    "recursos_iniciais": { "suprimentos": 65, "energia": 65, "moral": 65 },
    "papeis": [
      { "id": "cartografa", "nome": "Cartógrafa", "descricao": "Observa marés, ventos e rotas de barco." },
      { "id": "socorrista", "nome": "Socorrista", "descricao": "Cuida do abrigo, provisões e bem-estar da dupla." }
    ],
    "dias": [
      {
        "dia": 1,
        "titulo": "Inventário do farol",
        "evento": "A tempestade cortou o rádio principal. Vocês têm luz do dia para organizar o farol antes da primeira noite.",
        "dicas": {
          "0": "A maré baixa nas próximas 2 horas expõe a trilha até o galpão de madeira.",
          "1": "As caixas de mantimentos precisam ser vedadas contra umidade."
        },
        "opcoes": [
          { "id": "a", "titulo": "Correr ao galpão na maré baixa", "efeitos": { "suprimentos": 15, "energia": -15, "moral": 5 }, "desfecho": "Trouxeram lenha seca e conservas extras antes da maré subir." },
          { "id": "b", "titulo": "Arrumar o alojamento e cozinhar algo quente", "efeitos": { "suprimentos": -5, "energia": 10, "moral": 15 }, "desfecho": "O farol ficou acolhedor logo na primeira noite." },
          { "id": "c", "titulo": "Revisar o gerador e a lente do farol", "efeitos": { "suprimentos": -5, "energia": 15, "moral": -5 }, "desfecho": "A luz brilhou firme no mar, mesmo com o cansaço." }
        ]
      },
      {
        "dia": 2,
        "titulo": "Sinal no horizonte",
        "evento": "Uma embarcação distante passa fora da rota. Vocês podem gastar combustível no sinalizador ou poupar para depois.",
        "dicas": {
          "0": "O vento está contra; o barco provavelmente só verá luz forte do topo.",
          "1": "Usar o gerador no máximo hoje pode faltar nos dias de tempestade."
        },
        "opcoes": [
          { "id": "a", "titulo": "Acionar o farol em potência máxima", "efeitos": { "suprimentos": 0, "energia": -20, "moral": 15 }, "desfecho": "O barco respondeu com dois sinais de luz — sabem que estão aí." },
          { "id": "b", "titulo": "Poupar energia e usar espelhos manuais", "efeitos": { "suprimentos": 0, "energia": -5, "moral": -5 }, "desfecho": "Economizaram bateria, mas o barco seguiu viagem." },
          { "id": "c", "titulo": "Aproveitar o tempo bom para pescar no cais", "efeitos": { "suprimentos": 15, "energia": -10, "moral": 5 }, "desfecho": "Garantiram jantar fresco para dois dias." }
        ]
      },
      {
        "dia": 3,
        "titulo": "Goteira na despensa",
        "evento": "Uma telha soltou durante a madrugada e a água ameaça atingir os mantimentos.",
        "dicas": {
          "0": "O vento deve acalmar ao meio-dia, momento mais seguro para subir.",
          "1": "Mover as caixas primeiro evita perder comida, mas exige esforço."
        },
        "opcoes": [
          { "id": "a", "titulo": "Subir imediatamente para vedar o telhado", "efeitos": { "suprimentos": 5, "energia": -15, "moral": 0 }, "desfecho": "Conserto rápido sob vento forte preservou tudo." },
          { "id": "b", "titulo": "Realocar os mantimentos e esperar o meio-dia", "efeitos": { "suprimentos": -5, "energia": -5, "moral": 10 }, "desfecho": "Trabalharam com segurança e sem sustos." },
          { "id": "c", "titulo": "Improvisar lonas e descansar à tarde", "efeitos": { "suprimentos": -10, "energia": 10, "moral": 5 }, "desfecho": "Perderam parte dos biscoitos, mas recuperaram o fôlego." }
        ]
      },
      {
        "dia": 4,
        "titulo": "Diário do antigo faroleiro",
        "evento": "Vocês acham um caderno indicando um depósito escondido na ponta norte da ilha.",
        "dicas": {
          "0": "A trilha norte é íngreme e leva metade do dia para ir e voltar.",
          "1": "Se houver baterias lá, resolve o resto da semana."
        },
        "opcoes": [
          { "id": "a", "titulo": "Fazer a expedição até a ponta norte", "efeitos": { "suprimentos": 15, "energia": -15, "moral": 15 }, "desfecho": "Acharam lanternas, café e uma vista espetacular." },
          { "id": "b", "titulo": "Ler o diário juntos e planejar a semana", "efeitos": { "suprimentos": 0, "energia": 10, "moral": 10 }, "desfecho": "Descobriram dicas úteis sobre as marés sem se desgastar." },
          { "id": "c", "titulo": "Ir só metade do caminho para coletar água", "efeitos": { "suprimentos": 10, "energia": -5, "moral": 0 }, "desfecho": "Escolha prudente que garantiu água limpa." }
        ]
      },
      {
        "dia": 5,
        "titulo": "Vendaval da meia-noite",
        "evento": "Rajadas fortes balançam as janelas e fazem o gerador falhar duas vezes.",
        "dicas": {
          "0": "O vendaval dura toda a madrugada; manter a luz acessa evita naufrágios.",
          "1": "Revezar turnos de 2 horas preserva a sanidade dos dois."
        },
        "opcoes": [
          { "id": "a", "titulo": "Revezar vigília para manter o farol aceso", "efeitos": { "suprimentos": -5, "energia": -15, "moral": 15 }, "desfecho": "Cumpriram a missão juntos e viram o amanhecer aliviados." },
          { "id": "b", "titulo": "Desligar o farol e proteger o abrigo", "efeitos": { "suprimentos": 0, "energia": 10, "moral": -15 }, "desfecho": "Pouparam energia, mas ficaram preocupados a noite toda." },
          { "id": "c", "titulo": "Fazer fogueira protegida e racionar café", "efeitos": { "suprimentos": -10, "energia": -5, "moral": 10 }, "desfecho": "Passaram a noite aquecidos contando histórias." }
        ]
      },
      {
        "dia": 6,
        "titulo": "Rádio com chiado",
        "evento": "O rádio volta a captar vozes distantes por poucos minutos. Dá para tentar consertar a antena no topo.",
        "dicas": {
          "0": "Subir na torre com a maré calma facilita ajustar a direção da antena.",
          "1": "Não esqueçam de comer bem antes de qualquer esforço em altura."
        },
        "opcoes": [
          { "id": "a", "titulo": "Subir e alinhar a antena externa", "efeitos": { "suprimentos": -5, "energia": -15, "moral": 20 }, "desfecho": "Conseguiram contato! O barco confirmou chegada no dia 9." },
          { "id": "b", "titulo": "Testar peças internas com calma", "efeitos": { "suprimentos": 0, "energia": -5, "moral": 5 }, "desfecho": "Melhorou um pouco o sinal, sem grandes riscos." },
          { "id": "c", "titulo": "Deixar o rádio e reforçar provisões", "efeitos": { "suprimentos": 15, "energia": -5, "moral": -10 }, "desfecho": "Despensa cheia, mas a incerteza pesou no ânimo." }
        ]
      },
      {
        "dia": 7,
        "titulo": "Dia de calmaria",
        "evento": "O mar vira um espelho e o sol aparece forte. É a melhor chance de se preparar para os dois últimos dias.",
        "dicas": {
          "0": "O tempo vira de novo amanhã; hoje é dia de ouro para tarefas externas.",
          "1": "Um jantar especial hoje pode manter a moral alta até o resgate."
        },
        "opcoes": [
          { "id": "a", "titulo": "Preparar um jantar especial no cais", "efeitos": { "suprimentos": -15, "energia": 10, "moral": 20 }, "desfecho": "Noite inesquecível sob o farol aceso." },
          { "id": "b", "titulo": "Recarregar painéis solares e revisar baterias", "efeitos": { "suprimentos": 0, "energia": 20, "moral": 0 }, "desfecho": "Energia garantida para o restante da estadia." },
          { "id": "c", "titulo": "Colher suprimentos e água da nascente", "efeitos": { "suprimentos": 20, "energia": -10, "moral": 0 }, "desfecho": "Estoque completo até o último dia." }
        ]
      },
      {
        "dia": 8,
        "titulo": "Neblina cerrada",
        "evento": "Uma neblina espessa cobre o canal na véspera do resgate. A sirene de nevoeiro consome muita energia.",
        "dicas": {
          "0": "Sem sirene ou luz forte, o barco pode atrasar a aproximação.",
          "1": "Mantenham reservas de água e lanche prontos nas mochilas."
        },
        "opcoes": [
          { "id": "a", "titulo": "Ligar sirene e farol em ciclos curtos", "efeitos": { "suprimentos": -5, "energia": -10, "moral": 10 }, "desfecho": "Equilíbrio inteligente que guiou o canal sem zerar a bateria." },
          { "id": "b", "titulo": "Manter tudo ligado sem pausa", "efeitos": { "suprimentos": 0, "energia": -25, "moral": 15 }, "desfecho": "Sinal impossível de perder, mas drenou quase tudo." },
          { "id": "c", "titulo": "Esperar o vento limpar a neblina", "efeitos": { "suprimentos": -5, "energia": 5, "moral": -15 }, "desfecho": "Preservaram bateria, mas a ansiedade aumentou." }
        ]
      },
      {
        "dia": 9,
        "titulo": "O barco no cais",
        "evento": "O apito do barco ecoa pela baía. Vocês têm 30 minutos para fechar o farol e embarcar.",
        "dicas": {
          "0": "A maré está ideal para embarque rápido agora.",
          "1": "Deixar o farol organizado dá paz para encerrar a jornada."
        },
        "opcoes": [
          { "id": "a", "titulo": "Deixar uma carta no diário e embarcar", "efeitos": { "suprimentos": 0, "energia": -5, "moral": 20 }, "desfecho": "Partiram orgulhosos, deixando a marca de vocês no farol." },
          { "id": "b", "titulo": "Levar os suprimentos restantes para o barco", "efeitos": { "suprimentos": 10, "energia": -10, "moral": 5 }, "desfecho": "Embarque eficiente e sem desperdício." },
          { "id": "c", "titulo": "Subir uma última vez para a foto no topo", "efeitos": { "suprimentos": -5, "energia": -5, "moral": 15 }, "desfecho": "Lembrança eterna da ilha antes de voltar para casa." }
        ]
      }
    ]
  }'
),
(
  'expedicao',
  'campanha',
  'ambos',
  false,
  '{
    "titulo": "Estação Órbita 9",
    "subtitulo": "10 dias mantendo a estação orbital estável até a janela de retorno",
    "ambiente": "Órbita terrestre",
    "recursos_iniciais": { "suprimentos": 65, "energia": 65, "moral": 65 },
    "papeis": [
      { "id": "comandante", "nome": "Comandante", "descricao": "Coordena rotas orbitais, protocolos e comunicação com a Terra." },
      { "id": "engenheiro", "nome": "Engenheiro", "descricao": "Monitora painéis solares, oxigênio e módulos da estação." }
    ],
    "dias": [
      {
        "dia": 1,
        "titulo": "Tempestade solar leve",
        "evento": "Sensores detectam partículas solares. Vocês podem recolher os painéis ou manter a carga máxima.",
        "dicas": {
          "0": "A janela de comunicação com a base dura só 15 minutos hoje.",
          "1": "Recolher painéis evita dano, mas consome parte da bateria reserva."
        },
        "opcoes": [
          { "id": "a", "titulo": "Recolher painéis e proteger os circuitos", "efeitos": { "suprimentos": 0, "energia": -10, "moral": 10 }, "desfecho": "Zero danos na estação e noite tranquila." },
          { "id": "b", "titulo": "Manter painéis abertos para carregar tudo", "efeitos": { "suprimentos": -5, "energia": 15, "moral": -10 }, "desfecho": "Baterias cheias, mas alguns alarmes deram susto." },
          { "id": "c", "titulo": "Priorizar a chamada com a Terra", "efeitos": { "suprimentos": 5, "energia": -10, "moral": 15 }, "desfecho": "Ouvir as orientações da base trouxe calma e confiança." }
        ]
      },
      {
        "dia": 2,
        "titulo": "Estufa hidropônica",
        "evento": "O módulo verde precisa de manutenção. Ignorar agora pode reduzir suprimentos frescos nos próximos dias.",
        "dicas": {
          "0": "Comida fresca faz enorme diferença no humor da tripulação.",
          "1": "A bomba d''água da estufa consome energia constante."
        },
        "opcoes": [
          { "id": "a", "titulo": "Dedicar o turno à estufa", "efeitos": { "suprimentos": 20, "energia": -10, "moral": 10 }, "desfecho": "Colheita garantida e aroma de ervas na estação." },
          { "id": "b", "titulo": "Colocar a estufa em modo econômico", "efeitos": { "suprimentos": -5, "energia": 15, "moral": -5 }, "desfecho": "Economia sólida de energia, mas refeições desidratadas." },
          { "id": "c", "titulo": "Fazer reparo parcial rápido", "efeitos": { "suprimentos": 5, "energia": 0, "moral": 5 }, "desfecho": "Solução equilibrada para seguir o cronograma." }
        ]
      },
      {
        "dia": 3,
        "titulo": "Satélite à deriva",
        "evento": "Um satélite antigo passa perto com uma bateria intacta. Dá para usar o braço robótico para capturá-lo.",
        "dicas": {
          "0": "A manobra exige sincronia fina entre os dois consoles.",
          "1": "A bateria do satélite pode render +25 de energia se der certo."
        },
        "opcoes": [
          { "id": "a", "titulo": "Capturar o satélite com o braço robótico", "efeitos": { "suprimentos": -10, "energia": 25, "moral": 10 }, "desfecho": "Captura cirúrgica! Energia de sobra nos acumuladores." },
          { "id": "b", "titulo": "Apenas fotografar e seguir órbita segura", "efeitos": { "suprimentos": 0, "energia": 0, "moral": 5 }, "desfecho": "Sem riscos desnecessários e belas imagens." },
          { "id": "c", "titulo": "Desviar a estação preventivamente", "efeitos": { "suprimentos": -5, "energia": -10, "moral": 0 }, "desfecho": "Órbita limpa, mas gasto extra de propulsor." }
        ]
      },
      {
        "dia": 4,
        "titulo": "Noite na cúpula",
        "evento": "A estação cruza a aurora austral. A rotina está puxada e vocês podem abrir uma pausa na cúpula de vidro.",
        "dicas": {
          "0": "Uma pausa planejada evita erros por fadiga nos dias seguintes.",
          "1": "Os filtros de ar ainda aguentam até amanhã sem troca."
        },
        "opcoes": [
          { "id": "a", "titulo": "Jantar flutuante olhando a aurora", "efeitos": { "suprimentos": -10, "energia": 5, "moral": 25 }, "desfecho": "Momento mágico vendo luzes verdes sobre o planeta." },
          { "id": "b", "titulo": "Trocar filtros de ar e revisar estoque", "efeitos": { "suprimentos": 10, "energia": 5, "moral": -10 }, "desfecho": "Tudo impecável, mas o cansaço bateu." },
          { "id": "c", "titulo": "30 minutos na cúpula e 30 de manutenção", "efeitos": { "suprimentos": 0, "energia": 0, "moral": 10 }, "desfecho": "Meio-termo saudável que agradou os dois." }
        ]
      },
      {
        "dia": 5,
        "titulo": "Microfissura no compartimento B",
        "evento": "Um alerta indica queda lenta de pressão num depósito secundário.",
        "dicas": {
          "0": "Isolar o módulo é rápido, mas bloqueia parte dos suprimentos lá dentro.",
          "1": "Selar manualmente exige energia dos trajes, mas salva todo o estoque."
        },
        "opcoes": [
          { "id": "a", "titulo": "Selar a fissura com traje espacial", "efeitos": { "suprimentos": 10, "energia": -20, "moral": 10 }, "desfecho": "Operação tensa e bem-sucedida; nada foi perdido." },
          { "id": "b", "titulo": "Isolar o compartimento automaticamente", "efeitos": { "suprimentos": -15, "energia": 10, "moral": -5 }, "desfecho": "Estação segura em segundos, mas com menos reservas." },
          { "id": "c", "titulo": "Retirar caixas essenciais antes de isolar", "efeitos": { "suprimentos": -5, "energia": -10, "moral": 5 }, "desfecho": "Salvaram o principal sem se expor demais." }
        ]
      },
      {
        "dia": 6,
        "titulo": "Mensagem atrasada da Terra",
        "evento": "Um pacote de áudios e músicas chega com ruído. Decodificar tudo usa o computador principal por 2 horas.",
        "dicas": {
          "0": "O pacote contém atualizações da janela de reentrada e mensagens pessoais.",
          "1": "O computador principal puxa energia média, nada crítico."
        },
        "opcoes": [
          { "id": "a", "titulo": "Decodificar o pacote completo", "efeitos": { "suprimentos": 0, "energia": -10, "moral": 20 }, "desfecho": "Ouviram mensagens carinhosas e confirmaram a rota." },
          { "id": "b", "titulo": "Baixar apenas os dados técnicos", "efeitos": { "suprimentos": 5, "energia": 5, "moral": -10 }, "desfecho": "Prático e eficiente, mas faltou o calor humano." },
          { "id": "c", "titulo": "Adiar e recalibrar painéis solares", "efeitos": { "suprimentos": 0, "energia": 20, "moral": -5 }, "desfecho": "Ganharam fôlego energético para a reta final." }
        ]
      },
      {
        "dia": 7,
        "titulo": "Alarme falso ou real?",
        "evento": "O sensor térmico do módulo de carga oscila. Pode ser falha de leitura ou superaquecimento.",
        "dicas": {
          "0": "Desligar o resfriamento errado pode estragar alimentos.",
          "1": "Abrir o painel e testar sensor por sensor leva tempo, mas resolve de vez."
        },
        "opcoes": [
          { "id": "a", "titulo": "Inspeção completa nos sensores", "efeitos": { "suprimentos": 5, "energia": -15, "moral": 5 }, "desfecho": "Era um cabo solto; consertaram antes de virar problema." },
          { "id": "b", "titulo": "Ativar resfriamento de emergência", "efeitos": { "suprimentos": 0, "energia": -20, "moral": 0 }, "desfecho": "Temperatura estabilizou na hora, com alto gasto elétrico." },
          { "id": "c", "titulo": "Reiniciar o painel de controle", "efeitos": { "suprimentos": -10, "energia": 10, "moral": -5 }, "desfecho": "O alarme sumiu, mas algumas porções aqueceram demais." }
        ]
      },
      {
        "dia": 8,
        "titulo": "Ajuste fino de órbita",
        "evento": "Para pegar a janela perfeita do dia 10, é preciso alinhar a estação agora.",
        "dicas": {
          "0": "A queima curta agora evita turbulência pesada na reentrada.",
          "1": "Verifiquem se há energia acima de 30 antes de acionar os propulsores."
        },
        "opcoes": [
          { "id": "a", "titulo": "Executar o ajuste completo", "efeitos": { "suprimentos": -5, "energia": -15, "moral": 15 }, "desfecho": "Órbita cravada no milímetro! Equipe comemorou." },
          { "id": "b", "titulo": "Fazer ajuste mínimo para poupar energia", "efeitos": { "suprimentos": 0, "energia": -5, "moral": -5 }, "desfecho": "Economia segura, mas a descida será mais agitada." },
          { "id": "c", "titulo": "Reciclar reservas e preparar a cápsula", "efeitos": { "suprimentos": 15, "energia": -5, "moral": 0 }, "desfecho": "Cápsula abastecida com folga para o retorno." }
        ]
      },
      {
        "dia": 9,
        "titulo": "Última noite em órbita",
        "evento": "Faltam 24 horas para a volta. A cápsula precisa de checklist final e vocês merecem uma despedida.",
        "dicas": {
          "0": "Checklist duplo evita qualquer susto amanhã cedo.",
          "1": "Dormir bem hoje vale mais que qualquer ajuste secundário."
        },
        "opcoes": [
          { "id": "a", "titulo": "Checklist completo e descanso cedo", "efeitos": { "suprimentos": 0, "energia": 15, "moral": 10 }, "desfecho": "Acordaram afiados e tranquilos para o grande dia." },
          { "id": "b", "titulo": "Festa de despedida com o resto das reservas", "efeitos": { "suprimentos": -15, "energia": 5, "moral": 20 }, "desfecho": "Riram flutuando pela estação antes de dizer adeus." },
          { "id": "c", "titulo": "Transferir tudo para a cápsula", "efeitos": { "suprimentos": 10, "energia": -10, "moral": 5 }, "desfecho": "Tudo empacotado e pronto para desacoplar." }
        ]
      },
      {
        "dia": 10,
        "titulo": "Janela de retorno",
        "evento": "A Terra gira abaixo da cúpula e o sinal verde acende. Hora de desacoplar e voltar para casa.",
        "dicas": {
          "0": "Reentrada manual dá mais precisão; automática consome menos atenção.",
          "1": "Os escudos estão prontos — só manter a calma na descida."
        },
        "opcoes": [
          { "id": "a", "titulo": "Desacoplar no piloto automático", "efeitos": { "suprimentos": -5, "energia": -10, "moral": 15 }, "desfecho": "Pouso suave no oceano e resgate pontual." },
          { "id": "b", "titulo": "Assumir o controle manual a dois", "efeitos": { "suprimentos": -5, "energia": -5, "moral": 20 }, "desfecho": "Sintonia perfeita nos comandos até abrir os paraquedas." },
          { "id": "c", "titulo": "Fazer uma última volta orbital de segurança", "efeitos": { "suprimentos": -10, "energia": -5, "moral": 10 }, "desfecho": "Despedida serena das estrelas antes de pousar em segurança." }
        ]
      }
    ]
  }'
)
on conflict do nothing;
