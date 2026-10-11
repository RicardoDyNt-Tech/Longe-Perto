-- Longe & Perto — Modo Presencial.
-- Estrutura + cartas presenciais + itens do dado. Pode rodar de novo.
-- Rode depois de todos os SQL anteriores (precisa do nível 'romantico' da v6).

-- 1) Modo de cada carta: distancia, presencial ou ambos
alter table public.cartas add column if not exists modo text not null default 'distancia';

do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.cartas'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%modo%'
  loop
    execute format('alter table public.cartas drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.cartas add constraint cartas_modo_check check (modo in ('distancia','presencial','ambos'));

-- Verdades, sintonias e perguntas funcionam nos dois modos
update public.cartas set modo = 'ambos'
where modo = 'distancia' and tipo in ('verdade','sintonia','pergunta_dia','capsula','boa_noite');

create index if not exists cartas_modo_idx on public.cartas (modo, tipo, nivel) where sala is null and ativa;

-- 2) Dado do casal (presencial): ação + parte do corpo + tempo
create table if not exists public.dado_itens (
  id    uuid primary key default gen_random_uuid(),
  face  text not null check (face in ('acao','parte','tempo')),
  nivel text not null check (nivel in ('romantico','leve','criativo','picante','pesado')),
  texto text not null check (char_length(btrim(texto)) between 2 and 60),
  ativo boolean not null default true,
  unique (face, nivel, texto)
);
alter table public.dado_itens enable row level security;
drop policy if exists "ler" on public.dado_itens;
create policy "ler" on public.dado_itens for select to anon, authenticated using (true);

-- desafio presencial · romantico (30)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('desafio', 'romantico', 'Dance coladinho comigo uma música lenta inteira.', 'presencial'),
  ('desafio', 'romantico', 'Faça cafuné em mim por 2 minutos sem falar nada.', 'presencial'),
  ('desafio', 'romantico', 'Me abrace por trás e diga no meu ouvido o que mais sentiu falta.', 'presencial'),
  ('desafio', 'romantico', 'Segure minhas mãos e fale 3 promessas para os próximos dias.', 'presencial'),
  ('desafio', 'romantico', 'Me dê um beijo na testa, um no nariz e um na boca, bem devagar.', 'presencial'),
  ('desafio', 'romantico', 'Deite no meu colo e me conte o que imaginou deste reencontro.', 'presencial'),
  ('desafio', 'romantico', 'Faça um carinho no meu rosto com os olhos fechados, como se estivesse me decorando.', 'presencial'),
  ('desafio', 'romantico', 'Escolha uma música e me tire para dançar agora.', 'presencial'),
  ('desafio', 'romantico', 'Me dê o abraço mais demorado que você conseguir.', 'presencial'),
  ('desafio', 'romantico', 'Escreva com o dedo nas minhas costas uma palavra e eu tento adivinhar.', 'presencial'),
  ('desafio', 'romantico', 'Me olhe nos olhos por 1 minuto sem rir, segurando minhas mãos.', 'presencial'),
  ('desafio', 'romantico', 'Faça uma massagem nas minhas mãos enquanto me conta seu dia favorito comigo.', 'presencial'),
  ('desafio', 'romantico', 'Me dê um beijo para cada dia que a gente ficou longe, até perder a conta.', 'presencial'),
  ('desafio', 'romantico', 'Penteie meu cabelo com os dedos enquanto diz por que me ama.', 'presencial'),
  ('desafio', 'romantico', 'Deite abraçado(a) comigo e fiquem 3 minutos só respirando juntos.', 'presencial'),
  ('desafio', 'romantico', 'Me sirva um copo de água ou um petisco como se fosse um garçom apaixonado.', 'presencial'),
  ('desafio', 'romantico', 'Escolha um lugar da casa para tirarmos uma foto juntos agora.', 'presencial'),
  ('desafio', 'romantico', 'Me conte, olhando nos meus olhos, o momento em que mais sentiu minha falta.', 'presencial'),
  ('desafio', 'romantico', 'Faça um coração com as mãos e me beije através dele.', 'presencial'),
  ('desafio', 'romantico', 'Me leve até a janela e diga o que você quer para nós daqui a um ano.', 'presencial'),
  ('desafio', 'romantico', 'Beije a palma da minha mão e me diga uma coisa que nunca falou.', 'presencial'),
  ('desafio', 'romantico', 'Faça uma massagem nos meus ombros por 2 minutos.', 'presencial'),
  ('desafio', 'romantico', 'Me dê um selinho a cada elogio que você conseguir falar em 30 segundos.', 'presencial'),
  ('desafio', 'romantico', 'Cante baixinho no meu ouvido a nossa música.', 'presencial'),
  ('desafio', 'romantico', 'Faça um piquenique de 5 minutos no chão da sala com o que tiver na cozinha.', 'presencial'),
  ('desafio', 'romantico', 'Me abrace e fiquem balançando como se tivesse música, mesmo sem ter.', 'presencial'),
  ('desafio', 'romantico', 'Faça carinho no meu braço com a ponta dos dedos até eu arrepiar.', 'presencial'),
  ('desafio', 'romantico', 'Escolha uma foto nossa da distância e conte como foi viver aquele dia longe.', 'presencial'),
  ('desafio', 'romantico', 'Me dê um beijo de esquimó e um beijo de borboleta.', 'presencial'),
  ('desafio', 'romantico', 'Segure meu rosto com as duas mãos e diga "cheguei".', 'presencial')
on conflict do nothing;

-- desafio presencial · leve (27)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('desafio', 'leve', 'Faça cócegas em mim por 10 segundos, ou deixe eu fazer em você.', 'presencial'),
  ('desafio', 'leve', 'Desafio do sério: a gente se encara e quem rir primeiro paga prenda.', 'presencial'),
  ('desafio', 'leve', 'Me carregue no colo por 5 segundos (ou tente).', 'presencial'),
  ('desafio', 'leve', 'Imite como eu ando, aqui na minha frente.', 'presencial'),
  ('desafio', 'leve', 'Faça um penteado em mim com o que tiver por perto.', 'presencial'),
  ('desafio', 'leve', 'Brigue de travesseiro comigo por 15 segundos.', 'presencial'),
  ('desafio', 'leve', 'Me ensine um passo de dança que você sabe.', 'presencial'),
  ('desafio', 'leve', 'Faça a melhor careta para eu tirar uma foto.', 'presencial'),
  ('desafio', 'leve', 'Faça uma pose de casal de capa de revista comigo.', 'presencial'),
  ('desafio', 'leve', 'Me dê um abraço de urso tão forte que me levante do chão.', 'presencial'),
  ('desafio', 'leve', 'Descasque ou prepare uma fruta e me dê na boca.', 'presencial'),
  ('desafio', 'leve', 'Pedra, papel e tesoura: quem perder dá um beijo onde o outro escolher.', 'presencial'),
  ('desafio', 'leve', 'Esconda um objeto no cômodo e me guie com "quente ou frio" até eu achar.', 'presencial'),
  ('desafio', 'leve', 'Faça uma guerra de dedão comigo, melhor de 3.', 'presencial'),
  ('desafio', 'leve', 'Conte uma piada olhando nos meus olhos sem rir.', 'presencial'),
  ('desafio', 'leve', 'Faça um desfile para mim com uma peça de roupa minha.', 'presencial'),
  ('desafio', 'leve', 'Me dê 10 beijos em 10 lugares diferentes do rosto.', 'presencial'),
  ('desafio', 'leve', 'Sente nas minhas costas e me faça andar de cavalinho por 5 segundos (ou o contrário).', 'presencial'),
  ('desafio', 'leve', 'Faça um sanduíche ou lanche para mim em até 5 minutos.', 'presencial'),
  ('desafio', 'leve', 'Me imite atendendo o telefone, olhando para mim.', 'presencial'),
  ('desafio', 'leve', 'Batalha de olhar: o primeiro a piscar faz massagem no outro.', 'presencial'),
  ('desafio', 'leve', 'Tirem uma selfie juntos fazendo a mesma careta.', 'presencial'),
  ('desafio', 'leve', 'Me ensine uma palavra em outra língua e me faça repetir até acertar.', 'presencial'),
  ('desafio', 'leve', 'Coloque uma música e dancem a coreografia mais boba possível.', 'presencial'),
  ('desafio', 'leve', 'Deixe eu desenhar um coração na sua mão com caneta.', 'presencial'),
  ('desafio', 'leve', 'Faça uma cabaninha com lençol e entrem os dois nela.', 'presencial'),
  ('desafio', 'leve', 'Me faça rir em menos de 30 segundos sem fazer cócegas.', 'presencial')
on conflict do nothing;

-- desafio presencial · criativo (24)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('desafio', 'criativo', 'Desenhe meu retrato olhando para mim, em 2 minutos.', 'presencial'),
  ('desafio', 'criativo', 'Escreva um poema em um guardanapo ou papel e leia segurando minha mão.', 'presencial'),
  ('desafio', 'criativo', 'Monte uma escultura com objetos da casa que represente nós dois.', 'presencial'),
  ('desafio', 'criativo', 'Invente uma história em que a gente se conhece de um jeito diferente, contando juntos.', 'presencial'),
  ('desafio', 'criativo', 'Faça uma estátua viva comigo: eu monto sua pose e você não pode se mexer por 30 segundos.', 'presencial'),
  ('desafio', 'criativo', 'Criem juntos um aperto de mão secreto que só vale ao vivo.', 'presencial'),
  ('desafio', 'criativo', 'Escreva na minha mão, com caneta, o nome do nosso casal.', 'presencial'),
  ('desafio', 'criativo', 'Encene comigo o nosso primeiro encontro, cada um no seu papel.', 'presencial'),
  ('desafio', 'criativo', 'Faça mímica de um filme e eu tenho 1 minuto para acertar.', 'presencial'),
  ('desafio', 'criativo', 'Invente uma receita com o que tiver na cozinha e preparem juntos.', 'presencial'),
  ('desafio', 'criativo', 'Façam um vídeo de 15 segundos juntos dançando para guardar.', 'presencial'),
  ('desafio', 'criativo', 'Crie um ritual de boas-vindas para todo reencontro nosso e façam agora.', 'presencial'),
  ('desafio', 'criativo', 'Me maquie ou me desenhe algo no rosto com o que tiver em casa.', 'presencial'),
  ('desafio', 'criativo', 'Montem um forte de almofadas e batizem com um nome.', 'presencial'),
  ('desafio', 'criativo', 'Façam um desfile de casal com roupas trocadas.', 'presencial'),
  ('desafio', 'criativo', 'Invente uma brincadeira nova em 1 minuto e a gente joga uma rodada.', 'presencial'),
  ('desafio', 'criativo', 'Desenhem juntos, um traço cada, um retrato do casal.', 'presencial'),
  ('desafio', 'criativo', 'Dublem juntos uma cena de filme, cada um fazendo uma voz.', 'presencial'),
  ('desafio', 'criativo', 'Façam uma sessão de fotos de casal em 3 cômodos diferentes.', 'presencial'),
  ('desafio', 'criativo', 'Escreva 3 bilhetes e esconda pela casa para eu achar depois.', 'presencial'),
  ('desafio', 'criativo', 'Me ensine uma coisa que você aprendeu enquanto a gente estava longe.', 'presencial'),
  ('desafio', 'criativo', 'Criem uma música de 4 versos sobre o reencontro e cantem juntos.', 'presencial'),
  ('desafio', 'criativo', 'Façam uma pose de estátua juntos e segurem até o cronômetro acabar.', 'presencial'),
  ('desafio', 'criativo', 'Contem a história do namoro de vocês como se fossem narradores de documentário.', 'presencial')
on conflict do nothing;

-- desafio presencial · picante (21)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('desafio', 'picante', 'Me beije devagar no pescoço por 10 segundos.', 'presencial'),
  ('desafio', 'picante', 'Sussurre no meu ouvido o que você pensava em fazer quando a gente se visse.', 'presencial'),
  ('desafio', 'picante', 'Me dê um beijo de 30 segundos sem parar.', 'presencial'),
  ('desafio', 'picante', 'Tire uma peça de roupa minha, bem devagar.', 'presencial'),
  ('desafio', 'picante', 'Faça uma massagem nas minhas costas por baixo da blusa por 1 minuto.', 'presencial'),
  ('desafio', 'picante', 'Morda de leve a minha orelha.', 'presencial'),
  ('desafio', 'picante', 'Me beije em 3 lugares que não sejam a boca.', 'presencial'),
  ('desafio', 'picante', 'Sente no meu colo de frente por 1 minuto, sem beijar.', 'presencial'),
  ('desafio', 'picante', 'Passe a mão devagar pela minha nuca e pelas costas.', 'presencial'),
  ('desafio', 'picante', 'Me olhe fixo e chegue cada vez mais perto, mas sem beijar, por 20 segundos.', 'presencial'),
  ('desafio', 'picante', 'Faça uma dança sensual para mim por 30 segundos.', 'presencial'),
  ('desafio', 'picante', 'Deixe eu escolher onde você vai me beijar agora.', 'presencial'),
  ('desafio', 'picante', 'Me prense na parede e me beije.', 'presencial'),
  ('desafio', 'picante', 'Faça um caminho de beijos do ombro até a mão.', 'presencial'),
  ('desafio', 'picante', 'Me dê um beijo com os olhos vendados.', 'presencial'),
  ('desafio', 'picante', 'Tire a sua blusa e fique assim até a próxima rodada.', 'presencial'),
  ('desafio', 'picante', 'Me abrace por trás e beije meu pescoço até eu pedir para parar.', 'presencial'),
  ('desafio', 'picante', 'Passe gelo devagar no meu pescoço.', 'presencial'),
  ('desafio', 'picante', 'Diga, colado(a) no meu ouvido, a parte do meu corpo que mais sentiu falta.', 'presencial'),
  ('desafio', 'picante', 'Me deite e me beije por cima por 30 segundos.', 'presencial'),
  ('desafio', 'picante', 'Desabotoe ou abaixe o zíper da minha roupa sem usar as mãos.', 'presencial')
on conflict do nothing;

-- desafio presencial · pesado (18)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('desafio', 'pesado', 'Tire a minha roupa peça por peça, no seu ritmo.', 'presencial'),
  ('desafio', 'pesado', 'Escolha uma posição do nosso guia e façam por 2 minutos.', 'presencial'),
  ('desafio', 'pesado', 'Me vende os olhos e me provoque por 2 minutos do jeito que quiser.', 'presencial'),
  ('desafio', 'pesado', 'Faça em mim o que você descreveu na carta mais ousada da distância.', 'presencial'),
  ('desafio', 'pesado', 'Beije todo o meu corpo, de cima a baixo, sem pular nada.', 'presencial'),
  ('desafio', 'pesado', 'Me deixe no comando pelos próximos 3 minutos, com direito a veto.', 'presencial'),
  ('desafio', 'pesado', 'Use só a boca para me provocar por 1 minuto.', 'presencial'),
  ('desafio', 'pesado', 'Cumpra agora um item ousado do nosso cofre do reencontro.', 'presencial'),
  ('desafio', 'pesado', 'Façam a primeira posição do cardápio que vocês montaram a distância.', 'presencial'),
  ('desafio', 'pesado', 'Me amarre as mãos com algo macio e faça o que quiser por 2 minutos.', 'presencial'),
  ('desafio', 'pesado', 'Tome banho comigo agora.', 'presencial'),
  ('desafio', 'pesado', 'Me provoque até eu pedir mais, sem me deixar tocar em você.', 'presencial'),
  ('desafio', 'pesado', 'Fique sem roupa e deixe eu te olhar por 30 segundos sem me mexer.', 'presencial'),
  ('desafio', 'pesado', 'Escolham juntos uma fantasia contada a distância e realizem agora.', 'presencial'),
  ('desafio', 'pesado', 'Me beije onde eu apontar, do jeito que eu pedir.', 'presencial'),
  ('desafio', 'pesado', 'Faça uma massagem completa com óleo ou creme por 5 minutos.', 'presencial'),
  ('desafio', 'pesado', 'Me leve para o cômodo da casa que você escolheu na carta da distância.', 'presencial'),
  ('desafio', 'pesado', 'Troquem de comando a cada 1 minuto, por 4 minutos.', 'presencial')
on conflict do nothing;

-- prenda presencial · romantico (6)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('prenda', 'romantico', 'Me dê 10 beijos seguidos.', 'presencial'),
  ('prenda', 'romantico', 'Faça um cafuné de 1 minuto.', 'presencial'),
  ('prenda', 'romantico', 'Diga 5 coisas que ama em mim olhando nos meus olhos.', 'presencial'),
  ('prenda', 'romantico', 'Me abrace até eu dizer chega.', 'presencial'),
  ('prenda', 'romantico', 'Me faça uma declaração de joelhos.', 'presencial'),
  ('prenda', 'romantico', 'Me leve um copo de água como se fosse champanhe.', 'presencial')
on conflict do nothing;

-- prenda presencial · leve (5)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('prenda', 'leve', 'Faça 10 polichinelos na minha frente.', 'presencial'),
  ('prenda', 'leve', 'Me carregue de cavalinho por 5 segundos.', 'presencial'),
  ('prenda', 'leve', 'Deixe eu fazer cócegas em você por 10 segundos.', 'presencial'),
  ('prenda', 'leve', 'Imite um bicho que eu escolher até eu rir.', 'presencial'),
  ('prenda', 'leve', 'Faça uma massagem de 1 minuto nos meus pés.', 'presencial')
on conflict do nothing;

-- prenda presencial · criativo (5)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('prenda', 'criativo', 'Cante uma música inventada sobre mim.', 'presencial'),
  ('prenda', 'criativo', 'Desenhe meu rosto com a mão não dominante.', 'presencial'),
  ('prenda', 'criativo', 'Faça uma estátua engraçada por 30 segundos.', 'presencial'),
  ('prenda', 'criativo', 'Conte uma história de 1 minuto com 3 palavras que eu escolher.', 'presencial'),
  ('prenda', 'criativo', 'Faça um comercial de você mesmo(a) para mim.', 'presencial')
on conflict do nothing;

-- prenda presencial · picante (4)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('prenda', 'picante', 'Tire uma peça de roupa.', 'presencial'),
  ('prenda', 'picante', 'Me beije no pescoço por 15 segundos.', 'presencial'),
  ('prenda', 'picante', 'Faça uma dança sensual de 20 segundos.', 'presencial'),
  ('prenda', 'picante', 'Sussurre uma coisa ousada no meu ouvido.', 'presencial')
on conflict do nothing;

-- prenda presencial · pesado (4)
insert into public.cartas (tipo, nivel, texto, modo) values
  ('prenda', 'pesado', 'Fique sem roupa até a próxima rodada.', 'presencial'),
  ('prenda', 'pesado', 'Obedeça às minhas ordens por 1 minuto, com direito a veto.', 'presencial'),
  ('prenda', 'pesado', 'Me deixe escolher uma posição do guia.', 'presencial'),
  ('prenda', 'pesado', 'Me beije onde eu escolher, por 20 segundos.', 'presencial')
on conflict do nothing;

-- dado (46)
insert into public.dado_itens (face, nivel, texto) values
  ('acao', 'romantico', 'Beije'),
  ('acao', 'romantico', 'Acaricie'),
  ('acao', 'romantico', 'Abrace'),
  ('acao', 'romantico', 'Faça cafuné em'),
  ('acao', 'leve', 'Faça cócegas em'),
  ('acao', 'leve', 'Sopre'),
  ('acao', 'leve', 'Massageie'),
  ('acao', 'leve', 'Dê um selinho em'),
  ('acao', 'picante', 'Beije devagar'),
  ('acao', 'picante', 'Morda de leve'),
  ('acao', 'picante', 'Passe gelo em'),
  ('acao', 'picante', 'Sussurre perto de'),
  ('acao', 'picante', 'Massageie devagar'),
  ('acao', 'pesado', 'Lamba'),
  ('acao', 'pesado', 'Beije demoradamente'),
  ('acao', 'pesado', 'Provoque só com a boca'),
  ('acao', 'pesado', 'Explore com as mãos'),
  ('parte', 'romantico', 'a testa'),
  ('parte', 'romantico', 'as mãos'),
  ('parte', 'romantico', 'o rosto'),
  ('parte', 'romantico', 'o cabelo'),
  ('parte', 'leve', 'o nariz'),
  ('parte', 'leve', 'as bochechas'),
  ('parte', 'leve', 'os ombros'),
  ('parte', 'leve', 'os pés'),
  ('parte', 'picante', 'o pescoço'),
  ('parte', 'picante', 'a orelha'),
  ('parte', 'picante', 'a nuca'),
  ('parte', 'picante', 'as costas'),
  ('parte', 'picante', 'a barriga'),
  ('parte', 'picante', 'a cintura'),
  ('parte', 'pesado', 'o peito'),
  ('parte', 'pesado', 'as coxas'),
  ('parte', 'pesado', 'a parte de dentro do braço'),
  ('parte', 'pesado', 'o quadril'),
  ('parte', 'pesado', 'onde o outro escolher'),
  ('tempo', 'romantico', '10 segundos'),
  ('tempo', 'romantico', '30 segundos'),
  ('tempo', 'leve', '10 segundos'),
  ('tempo', 'leve', '20 segundos'),
  ('tempo', 'picante', '20 segundos'),
  ('tempo', 'picante', '40 segundos'),
  ('tempo', 'picante', '1 minuto'),
  ('tempo', 'pesado', '1 minuto'),
  ('tempo', 'pesado', '2 minutos'),
  ('tempo', 'pesado', 'até o outro pedir para parar')
on conflict do nothing;

-- Conferência
select modo, tipo, nivel, count(*) from public.cartas
where sala is null and modo = 'presencial' group by 1, 2, 3 order by 2, 3;
select face, nivel, count(*) from public.dado_itens group by 1, 2 order by 1, 2;
