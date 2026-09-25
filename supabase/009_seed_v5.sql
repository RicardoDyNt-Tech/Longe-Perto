-- Longe & Perto v5 — apostas, missões de observação e perguntas de cápsula.
-- Rode DEPOIS do 008_v5.sql. Pode rodar de novo.
-- Nas apostas, {nome} é trocado pelo nome da outra pessoa no app.

-- aposta · leve (14)
insert into public.cartas (tipo, nivel, texto) values
  ('aposta', 'leve', 'Qual música {nome} vai ouvir mais esta semana?'),
  ('aposta', 'leve', 'O que {nome} vai comer no almoço de domingo?'),
  ('aposta', 'leve', 'Quantas horas {nome} vai dormir na noite de sexta?'),
  ('aposta', 'leve', 'Qual série ou filme {nome} vai assistir esta semana?'),
  ('aposta', 'leve', 'Qual vai ser o dia mais corrido da semana de {nome}?'),
  ('aposta', 'leve', '{nome} vai acordar antes das 7h em algum dia desta semana?'),
  ('aposta', 'leve', 'Qual vai ser a maior reclamação de {nome} esta semana?'),
  ('aposta', 'leve', 'Quantas vezes {nome} vai dizer "saudade" esta semana?'),
  ('aposta', 'leve', 'Qual doce {nome} vai comer esta semana?'),
  ('aposta', 'leve', 'Quantas vezes {nome} vai fazer exercício esta semana?'),
  ('aposta', 'leve', 'Qual vai ser o assunto mais falado entre vocês esta semana?'),
  ('aposta', 'leve', 'O que vai deixar {nome} mais feliz esta semana?'),
  ('aposta', 'leve', 'Que roupa {nome} vai usar no sábado?'),
  ('aposta', 'leve', 'Qual app {nome} vai usar mais esta semana?')
on conflict do nothing;

-- aposta · criativo (8)
insert into public.cartas (tipo, nivel, texto) values
  ('aposta', 'criativo', 'Qual vai ser a primeira foto que {nome} vai me mandar esta semana?'),
  ('aposta', 'criativo', 'Qual emoji {nome} vai usar mais comigo esta semana?'),
  ('aposta', 'criativo', 'Qual vai ser a melhor ideia de {nome} esta semana?'),
  ('aposta', 'criativo', 'Que música {nome} vai me mandar esta semana?'),
  ('aposta', 'criativo', 'Qual apelido novo {nome} vai me dar esta semana?'),
  ('aposta', 'criativo', 'Sobre o que vai ser o meme que {nome} vai me mandar?'),
  ('aposta', 'criativo', 'O que {nome} vai querer fazer no próximo encontro?'),
  ('aposta', 'criativo', 'Qual vai ser a primeira mensagem de {nome} na segunda de manhã?')
on conflict do nothing;

-- aposta · picante (5)
insert into public.cartas (tipo, nivel, texto) values
  ('aposta', 'picante', 'Em que dia desta semana {nome} vai sentir mais a minha falta?'),
  ('aposta', 'picante', 'Sobre o que vai ser a mensagem mais ousada de {nome} esta semana?'),
  ('aposta', 'picante', 'Que foto minha {nome} vai pedir esta semana?'),
  ('aposta', 'picante', 'Em que horário {nome} vai me mandar a mensagem mais quente?'),
  ('aposta', 'picante', 'Que peça de roupa {nome} vai me pedir para mostrar?')
on conflict do nothing;

-- aposta · pesado (3)
insert into public.cartas (tipo, nivel, texto) values
  ('aposta', 'pesado', 'Qual fantasia {nome} vai me contar esta semana?'),
  ('aposta', 'pesado', 'Em qual dia {nome} vai me mandar um nude?'),
  ('aposta', 'pesado', 'Que carta Pesada {nome} vai querer jogar na próxima chamada?')
on conflict do nothing;

-- observacao · leve (10)
insert into public.cartas (tipo, nivel, texto) values
  ('observacao', 'leve', 'Encontre algo da cor favorita da outra pessoa e mostre na próxima chamada.'),
  ('observacao', 'leve', 'Ache um lugar na sua cidade aonde você gostaria de levar a outra pessoa.'),
  ('observacao', 'leve', 'Descubra uma música nova que lembre vocês dois.'),
  ('observacao', 'leve', 'Guarde uma história engraçada da semana para contar.'),
  ('observacao', 'leve', 'Tire uma foto do céu no fim de uma tarde e mostre.'),
  ('observacao', 'leve', 'Encontre um objeto que lembre o primeiro encontro de vocês.'),
  ('observacao', 'leve', 'Descubra uma comida da sua cidade que a outra pessoa precisa provar.'),
  ('observacao', 'leve', 'Ache uma frase num livro, placa ou post que combine com vocês.'),
  ('observacao', 'leve', 'Encontre um bicho na rua e invente a história dele.'),
  ('observacao', 'leve', 'Anote três coisas boas que aconteceram na sua semana.')
on conflict do nothing;

-- observacao · criativo (8)
insert into public.cartas (tipo, nivel, texto) values
  ('observacao', 'criativo', 'Desenhe algo da sua semana e mostre na chamada.'),
  ('observacao', 'criativo', 'Monte uma playlist de 5 músicas sobre a sua semana.'),
  ('observacao', 'criativo', 'Monte um look pensando na outra pessoa e mostre.'),
  ('observacao', 'criativo', 'Invente uma receita com o que tiver em casa e mostre o resultado.'),
  ('observacao', 'criativo', 'Escreva um bilhete à mão e leia na chamada.'),
  ('observacao', 'criativo', 'Encontre um objeto que represente como você está se sentindo.'),
  ('observacao', 'criativo', 'Fotografe algo que seja bonito e sem graça ao mesmo tempo.'),
  ('observacao', 'criativo', 'Dê um nome para cada dia da sua semana e explique.')
on conflict do nothing;

-- observacao · picante (4)
insert into public.cartas (tipo, nivel, texto) values
  ('observacao', 'picante', 'Escolha uma roupa que você acha que a outra pessoa vai adorar e mostre na próxima chamada.'),
  ('observacao', 'picante', 'Encontre uma música que te faça pensar na outra pessoa de um jeito quente.'),
  ('observacao', 'picante', 'Guarde uma confissão ousada da semana para contar.'),
  ('observacao', 'picante', 'Escolha o perfume que você quer que a outra pessoa sinta no reencontro.')
on conflict do nothing;

-- observacao · pesado (2)
insert into public.cartas (tipo, nivel, texto) values
  ('observacao', 'pesado', 'Escolha a lingerie ou cueca da próxima chamada e só revele nela.'),
  ('observacao', 'pesado', 'Planeje uma surpresa ousada para a próxima chamada.')
on conflict do nothing;

-- capsula · leve (15)
insert into public.cartas (tipo, nivel, texto) values
  ('capsula', 'leve', 'Onde você acha que a gente vai estar daqui a um ano?'),
  ('capsula', 'leve', 'Qual é o nosso maior sonho juntos hoje?'),
  ('capsula', 'leve', 'O que mais te preocupa na distância agora?'),
  ('capsula', 'leve', 'Qual música é a nossa neste momento?'),
  ('capsula', 'leve', 'O que você quer ter feito comigo até o fim do ano?'),
  ('capsula', 'leve', 'Descreva a gente em três palavras hoje.'),
  ('capsula', 'leve', 'Qual foi o nosso melhor momento até agora?'),
  ('capsula', 'leve', 'Qual é o seu maior medo sobre o futuro?'),
  ('capsula', 'leve', 'O que você quer mudar em você nos próximos meses?'),
  ('capsula', 'leve', 'Qual lugar a gente vai conhecer juntos primeiro?'),
  ('capsula', 'leve', 'O que você mais admira em mim hoje?'),
  ('capsula', 'leve', 'O que você acha que vai mudar entre nós quando a distância acabar?'),
  ('capsula', 'leve', 'Como você imagina o nosso reencontro?'),
  ('capsula', 'leve', 'Qual é o nosso maior desafio agora?'),
  ('capsula', 'leve', 'O que você quer me dizer daqui a seis meses?')
on conflict do nothing;

-- Confira: aposta 30 · observacao 24 · capsula 15
select tipo, nivel, count(*) from public.cartas where sala is null and tipo in ('aposta','observacao','capsula') group by 1, 2 order by 1, 2;
