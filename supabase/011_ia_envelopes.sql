-- Longe & Perto — ideias para envelopes e controle de uso da IA.
-- Pode rodar de novo.

-- 1) Novo tipo de carta: ideia_mensagem (sugestões para escrever envelopes)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cartas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.cartas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.cartas
  add constraint cartas_tipo_check check (tipo in (
    'verdade','desafio','prenda','efeito','duelo','sintonia','missao_dupla','missao_secreta',
    'aposta','observacao','capsula','ideia_mensagem')),
  add constraint cartas_efeito_tem_rodadas check (tipo <> 'efeito' or rodadas is not null);

-- 2) Limite diário de uso da IA por sala. Só a Edge Function (service role) acessa:
--    RLS ligado e nenhuma policy para anon.
create table if not exists public.ia_uso (
  sala  text not null references public.salas(codigo) on delete cascade,
  dia   date not null,
  qtd   int  not null default 0 check (qtd >= 0),
  primary key (sala, dia)
);
alter table public.ia_uso enable row level security;

-- Incremento atômico usado pela Edge Function; devolve o total do dia depois de somar
create or replace function public.ia_registrar_uso(p_sala text, p_dia date)
returns int language sql security definer set search_path = public as $$
  insert into public.ia_uso (sala, dia, qtd) values (p_sala, p_dia, 1)
  on conflict (sala, dia) do update set qtd = public.ia_uso.qtd + 1
  returning qtd;
$$;
revoke all on function public.ia_registrar_uso(text, date) from public, anon, authenticated;

-- 3) Ideias de mensagem
insert into public.cartas (tipo, nivel, texto) values
  ('ideia_mensagem', 'leve', 'Conte a lembrança nossa que você mais repassa na cabeça.'),
  ('ideia_mensagem', 'leve', 'Escreva o que você sentiu na primeira vez que me viu.'),
  ('ideia_mensagem', 'leve', 'Liste 5 coisas pequenas que eu faço e que você ama.'),
  ('ideia_mensagem', 'leve', 'Escreva uma carta para eu abrir num dia difícil.'),
  ('ideia_mensagem', 'leve', 'Conte um sonho que você tem para nós dois.'),
  ('ideia_mensagem', 'leve', 'Escreva o que você quer fazer no primeiro dia do reencontro.'),
  ('ideia_mensagem', 'leve', 'Conte algo bom que você nunca teve coragem de me dizer.'),
  ('ideia_mensagem', 'leve', 'Agradeça por algo que eu fiz e você nunca comentou.'),
  ('ideia_mensagem', 'criativo', 'Escreva um poema curto usando o nosso apelido.'),
  ('ideia_mensagem', 'criativo', 'Invente o começo de uma história sobre nós dois daqui a 10 anos.'),
  ('ideia_mensagem', 'criativo', 'Descreva o nosso namoro como se fosse o resumo de uma série.'),
  ('ideia_mensagem', 'criativo', 'Escreva a receita do nosso amor, com ingredientes e modo de preparo.'),
  ('ideia_mensagem', 'criativo', 'Monte a trilha sonora do filme da nossa história, com 5 músicas.'),
  ('ideia_mensagem', 'criativo', 'Escreva um convite formal para o nosso próximo encontro.'),
  ('ideia_mensagem', 'picante', 'Conte o que você pensou de mim hoje e não disse.'),
  ('ideia_mensagem', 'picante', 'Descreva o beijo que você quer me dar no reencontro.'),
  ('ideia_mensagem', 'picante', 'Escreva o que você faria se eu aparecesse aí agora.'),
  ('ideia_mensagem', 'picante', 'Conte qual roupa você quer me ver usando, e por quê.'),
  ('ideia_mensagem', 'picante', 'Descreva como seria a nossa próxima chamada ideal.'),
  ('ideia_mensagem', 'pesado', 'Conte a sua fantasia comigo, com detalhes.'),
  ('ideia_mensagem', 'pesado', 'Descreva a primeira noite do reencontro, do começo ao fim.'),
  ('ideia_mensagem', 'pesado', 'Escreva o que você quer que eu faça com você na próxima chamada.'),
  ('ideia_mensagem', 'pesado', 'Conte o pensamento mais ousado que você teve comigo esta semana.')
on conflict do nothing;

select nivel, count(*) from public.cartas where tipo = 'ideia_mensagem' group by 1 order by 1;
