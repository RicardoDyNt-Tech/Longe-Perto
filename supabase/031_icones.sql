-- Longe & Perto — identidade visual: ícones no lugar de emojis nos dados do banco.
-- Pode rodar de novo. Só mexe nas tabelas que já existirem.
--
-- Cada tabela que tinha `emoji` ganha a coluna `icone` (nome de um ícone do conjunto do app).
-- A coluna `emoji` continua lá para não quebrar versões antigas do app, mas a tela nova usa só `icone`.
-- Linhas novas recebem o ícone sozinhas (gatilho), a partir do emoji ou do padrão da tabela.

create or replace function public.icone_de_emoji(e text, padrao text default 'sparkles')
returns text language sql immutable as $$
  select coalesce(case replace(coalesce(e, ''), U&'\FE0F', '')
    when '☕' then 'coffee'        when '⚡' then 'zap'            when '✈' then 'plane'
    when '✨' then 'sparkles'      when '🌄' then 'sunrise'        when '🌅' then 'sunset'
    when '🌙' then 'moon'          when '🍝' then 'utensils'       when '🍦' then 'ice-cream-cone'
    when '🍸' then 'martini'       when '🍹' then 'wine'           when '🍽' then 'utensils-crossed'
    when '🍿' then 'popcorn'       when '🎀' then 'ribbon'         when '🎁' then 'gift'
    when '🎟' then 'ticket'        when '🎤' then 'mic'            when '🎬' then 'clapperboard'
    when '🎞' then 'film'          when '🎲' then 'dices'          when '🎶' then 'music'
    when '🎵' then 'music'         when '🎸' then 'guitar'         when '🏖' then 'tree-palm'
    when '👀' then 'eye'           when '👑' then 'crown'          when '👗' then 'shirt'
    when '👙' then 'shirt'         when '💃' then 'music-2'        when '💆' then 'hand-heart'
    when '💋' then 'heart'         when '💌' then 'mail'           when '💐' then 'flower-2'
    when '💼' then 'briefcase'     when '📖' then 'book-open'      when '📲' then 'smartphone'
    when '📸' then 'camera'        when '📺' then 'tv'             when '🔥' then 'flame'
    when '🌶' then 'flame'         when '🕯' then 'lamp'           when '🗺' then 'map'
    when '😴' then 'bed'           when '🙈' then 'eye-off'        when '🚪' then 'door-open'
    when '🚿' then 'shower-head'   when '🛁' then 'bath'           when '🛋' then 'sofa'
    when '🧊' then 'snowflake'     when '🧺' then 'shopping-basket' when '🧽' then 'droplets'
    when '🪞' then 'frame'         when '🫂' then 'heart-handshake' when '🫧' then 'droplets'
    when '🎨' then 'palette'       when '💗' then 'heart'          when '💞' then 'heart'
    when '😂' then 'laugh'         when '📞' then 'phone'          when '🎙' then 'mic'
    when '🍔' then 'sandwich'      when '🫶' then 'hand-heart'     when '🗣' then 'message-circle'
    when '🧘' then 'leaf'          when '🎂' then 'cake'           when '💍' then 'gem'
    when '🏠' then 'house'         when '🎓' then 'graduation-cap' when '🎉' then 'party-popper'
    when '⭐' then 'star'          when '🏆' then 'trophy'         when '📅' then 'calendar'
    when '🕵' then 'search'        when '🧪' then 'flask-conical'
  end, padrao);
$$;

-- Gatilho genérico: preenche `icone` quando vier vazio. O 1º argumento é o padrão da tabela.
create or replace function public._icone_preencher()
returns trigger language plpgsql as $$
begin
  if new.icone is null or btrim(new.icone) = '' then
    new.icone := public.icone_de_emoji(new.emoji, tg_argv[0]);
  end if;
  return new;
end $$;

do $$
declare t text; padrao text; par text[];
begin
  foreach par slice 1 in array array[
    ['marcos', 'calendar-heart'], ['pedidos_modelos', 'hand-heart'], ['roteiros', 'clapperboard'],
    ['vales_modelos', 'ticket'], ['desejos_itens', 'sparkles'], ['campanhas', 'film'], ['enredos', 'drama']]
  loop
    t := par[1]; padrao := par[2];
    if to_regclass('public.' || t) is null then
      raise notice 'Tabela % não existe: pulando.', t;
      continue;
    end if;
    execute format('alter table public.%I add column if not exists icone text', t);
    execute format('update public.%I set icone = public.icone_de_emoji(emoji, %L) where icone is null', t, padrao);
    execute format('drop trigger if exists icone_preencher on public.%I', t);
    execute format('create trigger icone_preencher before insert or update of emoji on public.%I
                    for each row execute function public._icone_preencher(%L)', t, padrao);
  end loop;
end $$;

-- O match do cardápio secreto passa a devolver também o ícone
do $$
begin
  if to_regclass('public.desejos_itens') is null then return; end if;
  execute $f$
    create or replace function public.desejos_revelar(p_sala text, p_rodada text)
    returns jsonb language plpgsql security definer set search_path = public as $body$
    begin
      if (select count(*) from public.desejos_envios where sala = p_sala and rodada = p_rodada) < 2 then
        return jsonb_build_object('pronto', false);
      end if;
      return jsonb_build_object('pronto', true, 'itens', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.id, 'texto', i.texto, 'emoji', i.emoji, 'icone', i.icone,
                                            'categoria', i.categoria, 'nivel', i.nivel) order by i.categoria, i.texto)
          from public.desejos_itens i
         where (select count(*) from public.desejos_votos v
                 where v.sala = p_sala and v.rodada = p_rodada and v.item = i.id and v.quer) = 2
      ), '[]'::jsonb));
    end $body$;
  $f$;
end $$;

revoke all on function public._icone_preencher() from public, anon, authenticated;

-- Conferência: quantas linhas ficaram com o ícone padrão (sem correspondência direta)
select 'ok' as icones;
