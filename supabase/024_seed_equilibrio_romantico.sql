-- Longe & Perto — equilíbrio em pirâmide: quanto mais ousado o nível, menos cartas.
-- Pesado fica como está (40 verdades, 70 desafios, 15 prendas). Os outros sobem em degraus.
-- Substitui a versão anterior do 024 (se você já rodou a anterior, pode rodar esta também: nada duplica).
-- Rode DEPOIS do 017_v6.sql e do 018_seed_v6.sql.

-- verdade · romantico (+30)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('verdade', 'romantico', 'Qual é a primeira coisa que você quer fazer quando me encontrar?', null),
  ('verdade', 'romantico', 'Em que momento do dia você mais sente a minha falta?', null),
  ('verdade', 'romantico', 'Qual gesto meu te fez se apaixonar de novo?', null),
  ('verdade', 'romantico', 'Qual conversa nossa você nunca vai esquecer?', null),
  ('verdade', 'romantico', 'O que você imaginava do amor antes de me conhecer?', null),
  ('verdade', 'romantico', 'Qual foi a maior prova de amor que eu já te dei?', null),
  ('verdade', 'romantico', 'O que você quer que a gente conte para os nossos netos?', null),
  ('verdade', 'romantico', 'Qual tradição você quer criar comigo?', null),
  ('verdade', 'romantico', 'O que eu te ensinei sem perceber?', null),
  ('verdade', 'romantico', 'Qual cheiro, som ou lugar te faz lembrar de mim na hora?', null),
  ('verdade', 'romantico', 'Qual foi o elogio mais bonito que eu já te fiz?', null),
  ('verdade', 'romantico', 'O que você sente quando vê meu nome na tela?', null),
  ('verdade', 'romantico', 'Qual música você dedicaria para o nosso aniversário de namoro?', null),
  ('verdade', 'romantico', 'Que sonho meu você quer me ajudar a realizar?', null),
  ('verdade', 'romantico', 'Qual foi o dia em que você mais se sentiu cuidado(a) por mim?', null),
  ('verdade', 'romantico', 'Como você descreveria o meu abraço para quem nunca recebeu?', null),
  ('verdade', 'romantico', 'O que você quer me ouvir dizer daqui a 10 anos?', null),
  ('verdade', 'romantico', 'Qual lugar da minha cidade você mais quer conhecer comigo?', null),
  ('verdade', 'romantico', 'Qual detalhe da nossa história você acha que foi destino?', null),
  ('verdade', 'romantico', 'O que você faria num domingo perfeito comigo?', null),
  ('verdade', 'romantico', 'Qual foi a mensagem de bom dia mais bonita que você já recebeu de mim?', null),
  ('verdade', 'romantico', 'O que você mais gosta de fazer por mim?', null),
  ('verdade', 'romantico', 'Qual pequeno ritual nosso você não quer perder nunca?', null),
  ('verdade', 'romantico', 'Em que momento você se sentiu mais em casa comigo?', null),
  ('verdade', 'romantico', 'O que você quer que eu nunca esqueça sobre você?', null),
  ('verdade', 'romantico', 'Qual é o seu jeito favorito de dizer que me ama?', null),
  ('verdade', 'romantico', 'Qual momento você gostaria de ter filmado para rever sempre?', null),
  ('verdade', 'romantico', 'Qual qualidade minha você quer ter também?', null),
  ('verdade', 'romantico', 'O que você pensa quando imagina a gente velhinhos?', null),
  ('verdade', 'romantico', 'Qual foi a primeira vez que você disse "eu te amo" só na cabeça?', null)
on conflict do nothing;

-- verdade · leve (+15)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('verdade', 'leve', 'Qual foi a coisa mais engraçada que você viu esta semana?', null),
  ('verdade', 'leve', 'Qual é a sua comida de conforto?', null),
  ('verdade', 'leve', 'Que mania sua você acha que eu ainda não percebi?', null),
  ('verdade', 'leve', 'Qual foi o melhor presente que você já ganhou?', null),
  ('verdade', 'leve', 'O que você mais gosta de fazer num dia de chuva?', null),
  ('verdade', 'leve', 'Qual é o seu emoji mais usado comigo?', null),
  ('verdade', 'leve', 'Qual app você mais abre no celular?', null),
  ('verdade', 'leve', 'Qual foi o último sonho estranho que você teve?', null),
  ('verdade', 'leve', 'Qual lugar da sua casa é o seu preferido?', null),
  ('verdade', 'leve', 'Qual música você canta no banho?', null),
  ('verdade', 'leve', 'Qual série você reassistiria agora?', null),
  ('verdade', 'leve', 'Que talento escondido você tem?', null),
  ('verdade', 'leve', 'Qual foi a sua fase mais estranha na adolescência?', null),
  ('verdade', 'leve', 'Qual foi o seu primeiro emprego ou tarefa paga?', null),
  ('verdade', 'leve', 'Qual comida você pediria agora se pudesse?', null)
on conflict do nothing;

-- verdade · criativo (+10)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('verdade', 'criativo', 'Se a gente fosse uma dupla de super-heróis, qual seria o nosso nome?', null),
  ('verdade', 'criativo', 'Qual seria a trilha sonora do nosso primeiro encontro?', null),
  ('verdade', 'criativo', 'Se você pudesse morar em qualquer desenho animado, qual seria?', null),
  ('verdade', 'criativo', 'Que prato você inventaria com o meu nome?', null),
  ('verdade', 'criativo', 'Se a nossa história fosse um livro, qual seria o gênero?', null),
  ('verdade', 'criativo', 'Qual objeto seu teria o meu nome se pudesse falar?', null),
  ('verdade', 'criativo', 'Que regra você criaria para um país só nosso?', null),
  ('verdade', 'criativo', 'Se você fosse um cheiro, qual seria?', null),
  ('verdade', 'criativo', 'Qual animal representaria o nosso namoro?', null),
  ('verdade', 'criativo', 'Qual seria a bandeira do nosso casal?', null)
on conflict do nothing;

-- verdade · picante (+5)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('verdade', 'picante', 'Qual roupa sua você acha que mais me provoca?', null),
  ('verdade', 'picante', 'Qual beijo nosso você repetiria agora?', null),
  ('verdade', 'picante', 'O que você faz quando está com saudade física de mim?', null),
  ('verdade', 'picante', 'Que parte do meu pescoço você mais gosta?', null),
  ('verdade', 'picante', 'Qual foi a chamada mais quente que a gente já teve?', null)
on conflict do nothing;

-- desafio · romantico (+60)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('desafio', 'romantico', 'Descreva, com detalhes, o primeiro dia que a gente vai passar juntos depois da distância.', null),
  ('desafio', 'romantico', 'Escolha uma foto nossa na galeria, mostre na câmera e conte o que sentiu naquele dia.', null),
  ('desafio', 'romantico', 'Diga o que você mais admira em mim, sem repetir nada que já falou hoje.', null),
  ('desafio', 'romantico', 'Faça uma lista de 5 lugares aonde quer me levar e leia em voz alta.', null),
  ('desafio', 'romantico', 'Imagine que a gente está deitado junto agora e conte o que estaria fazendo.', null),
  ('desafio', 'romantico', 'Faça um carinho no próprio rosto como se fosse a minha mão e me conte como seria.', null),
  ('desafio', 'romantico', 'Escreva um bilhete de bom dia para eu ler amanhã e mostre na câmera.', null),
  ('desafio', 'romantico', 'Diga o meu nome de três jeitos: bravo(a), com saudade e apaixonado(a).', null),
  ('desafio', 'romantico', 'Conte qual foi a última vez que você sorriu sozinho(a) pensando em mim.', null),
  ('desafio', 'romantico', 'Faça uma promessa para o nosso próximo mês juntos.', null),
  ('desafio', 'romantico', 'Cante baixinho uma música de ninar para mim.', null),
  ('desafio', 'romantico', 'Escreva um acróstico com o meu nome e leia.', null),
  ('desafio', 'romantico', 'Mostre para a câmera o objeto que você mais gostaria de me dar de presente.', null),
  ('desafio', 'romantico', 'Planeje o nosso café da manhã do reencontro, item por item.', null),
  ('desafio', 'romantico', 'Descreva o nosso futuro sofá, a nossa futura cozinha e a nossa futura varanda.', null),
  ('desafio', 'romantico', 'Faça o meu retrato falado com as palavras mais bonitas que conseguir.', null),
  ('desafio', 'romantico', 'Encoste o rosto no travesseiro e me diga boa noite do jeito que diria se eu estivesse aí.', null),
  ('desafio', 'romantico', 'Diga uma coisa que você aprendeu comigo e ainda não me contou.', null),
  ('desafio', 'romantico', 'Pegue um papel, desenhe um coração e escreva dentro o que você sente agora.', null),
  ('desafio', 'romantico', 'Conte uma lembrança nossa usando só 5 palavras e me faça adivinhar qual é.', null),
  ('desafio', 'romantico', 'Faça uma dedicatória para mim, como se fosse o começo de um livro.', null),
  ('desafio', 'romantico', 'Diga três coisas que você quer fazer comigo antes de fazer 80 anos.', null),
  ('desafio', 'romantico', 'Conte um detalhe do meu jeito que você repara e que eu nem sei.', null),
  ('desafio', 'romantico', 'Mande um áudio contando por que você me ama, para eu ouvir num dia difícil.', 'audio'),
  ('desafio', 'romantico', 'Mande uma foto do lugar onde você mais pensa em mim.', 'foto'),
  ('desafio', 'romantico', 'Grave um vídeo de 10 segundos me mandando um abraço bem apertado.', 'video'),
  ('desafio', 'romantico', 'Olhe para a câmera e diga "eu te escolho" completando com o motivo.', null),
  ('desafio', 'romantico', 'Faça uma coreografia lenta de 15 segundos como se estivesse dançando comigo.', null),
  ('desafio', 'romantico', 'Monte com objetos da casa um coração e mostre na câmera.', null),
  ('desafio', 'romantico', 'Diga como você imagina o nosso primeiro Natal morando juntos.', null),
  ('desafio', 'romantico', 'Conte qual é a sua parte favorita das nossas chamadas.', null),
  ('desafio', 'romantico', 'Escolha um apelido carinhoso para cada dia da semana e me diga.', null),
  ('desafio', 'romantico', 'Descreva um passeio perfeito pela sua cidade comigo.', null),
  ('desafio', 'romantico', 'Faça uma lista de 3 coisas que quer me agradecer hoje.', null),
  ('desafio', 'romantico', 'Diga o que você sente quando a chamada termina.', null),
  ('desafio', 'romantico', 'Feche os olhos, imagine o meu rosto e descreva o que está vendo.', null),
  ('desafio', 'romantico', 'Escreva no chat uma mensagem para eu ler só no dia do reencontro.', null),
  ('desafio', 'romantico', 'Mande um áudio de 15 segundos lendo a nossa mensagem mais antiga.', 'audio'),
  ('desafio', 'romantico', 'Crie um brinde para o nosso futuro e faça com o que tiver aí.', null),
  ('desafio', 'romantico', 'Diga uma frase que você quer que seja o nosso lema.', null),
  ('desafio', 'romantico', 'Escreva no chat uma lista de 5 coisas simples que te fazem lembrar de mim.', null),
  ('desafio', 'romantico', 'Mostre na câmera algo que você guarda de presente meu e conte a história.', null),
  ('desafio', 'romantico', 'Descreva a nossa viagem dos sonhos, do avião até a volta.', null),
  ('desafio', 'romantico', 'Diga, olhando nos meus olhos pela câmera, uma coisa que você nunca me agradeceu.', null),
  ('desafio', 'romantico', 'Invente um nome para o nosso cantinho no futuro e explique.', null),
  ('desafio', 'romantico', 'Leia em voz alta a última mensagem carinhosa que eu te mandei.', null),
  ('desafio', 'romantico', 'Faça um carinho no travesseiro como se fosse no meu cabelo e me conte como seria.', null),
  ('desafio', 'romantico', 'Conte o dia em que você percebeu que queria um futuro comigo.', null),
  ('desafio', 'romantico', 'Escreva um poema de 4 versos chamado "Quando você chegar".', null),
  ('desafio', 'romantico', 'Faça um cartão de mesversário com papel e caneta e mostre na câmera.', null),
  ('desafio', 'romantico', 'Diga 5 palavras que descrevem como você se sente comigo.', null),
  ('desafio', 'romantico', 'Proponha um apelido novo para o nosso casal e defenda a sua ideia.', null),
  ('desafio', 'romantico', 'Conte uma coisa que você quer me ensinar no reencontro.', null),
  ('desafio', 'romantico', 'Descreva a nossa primeira noite de filme juntos, com pipoca e tudo.', null),
  ('desafio', 'romantico', 'Mande uma foto do céu da sua janela agora, para a gente olhar o mesmo céu.', 'foto'),
  ('desafio', 'romantico', 'Grave um áudio de boa noite para eu ouvir antes de dormir.', 'audio'),
  ('desafio', 'romantico', 'Escreva num papel a data do reencontro, faça um coração em volta e mostre.', null),
  ('desafio', 'romantico', 'Faça uma dança lenta sozinho(a) enquanto eu canto uma música.', null),
  ('desafio', 'romantico', 'Conte o que você faria se tivesse só 1 hora comigo amanhã.', null),
  ('desafio', 'romantico', 'Escolha uma estrela, uma nuvem ou uma lua na sua janela e dê o nosso nome a ela.', null)
on conflict do nothing;

-- desafio · leve (+15)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('desafio', 'leve', 'Imite o seu cantor favorito por 15 segundos.', null),
  ('desafio', 'leve', 'Faça 10 abdominais contando em voz alta com voz de robô.', null),
  ('desafio', 'leve', 'Conte uma piada usando só gestos.', null),
  ('desafio', 'leve', 'Mostre o item mais antigo que você tem no quarto.', null),
  ('desafio', 'leve', 'Tente assobiar a nossa música.', null),
  ('desafio', 'leve', 'Fale 20 segundos sem usar a letra "a".', null),
  ('desafio', 'leve', 'Faça a sua melhor imitação de mim atendendo o telefone.', null),
  ('desafio', 'leve', 'Dance a primeira música que tocar no aleatório do Spotify.', null),
  ('desafio', 'leve', 'Mostre a sua cara de quando está com sono.', null),
  ('desafio', 'leve', 'Faça um desfile com a roupa mais confortável que tiver.', null),
  ('desafio', 'leve', 'Tente fazer um avião de papel com uma mão só.', null),
  ('desafio', 'leve', 'Diga o alfabeto de trás para frente o mais rápido que conseguir.', null),
  ('desafio', 'leve', 'Mostre o que tem no seu bolso ou na sua bolsa agora.', null),
  ('desafio', 'leve', 'Imite um youtuber abrindo um vídeo.', null),
  ('desafio', 'leve', 'Faça uma careta e segure até eu conseguir tirar print.', null)
on conflict do nothing;

-- desafio · criativo (+10)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('desafio', 'criativo', 'Crie um jingle de 10 segundos para um produto que só existe na nossa casa.', null),
  ('desafio', 'criativo', 'Faça uma escultura com um lençol e me faça adivinhar o que é.', null),
  ('desafio', 'criativo', 'Invente uma dança que represente a saudade.', null),
  ('desafio', 'criativo', 'Desenhe a capa do nosso álbum de casal.', null),
  ('desafio', 'criativo', 'Conte uma notícia falsa e divertida sobre o nosso dia.', null),
  ('desafio', 'criativo', 'Faça um personagem com uma meia e apresente ele para mim.', null),
  ('desafio', 'criativo', 'Escreva um trava-língua novo com o meu nome.', null),
  ('desafio', 'criativo', 'Encene em 30 segundos como seria a gente brigando por controle remoto.', null),
  ('desafio', 'criativo', 'Imite um narrador de futebol descrevendo o nosso primeiro beijo.', null),
  ('desafio', 'criativo', 'Faça um cartaz de filme sobre nós com o que tiver na mesa.', null)
on conflict do nothing;

-- desafio · picante (+8)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('desafio', 'picante', 'Deixe a alça da roupa cair devagar olhando para a câmera e me diga o que está pensando.', null),
  ('desafio', 'picante', 'Mostre o seu pescoço de perto por 5 segundos e diga onde queria o meu beijo.', null),
  ('desafio', 'picante', 'Faça uma pose provocante com o que estiver vestindo e segure até eu dizer chega.', null),
  ('desafio', 'picante', 'Tire um acessório bem devagar olhando para a câmera.', null),
  ('desafio', 'picante', 'Faça 10 segundos de olhar provocante sem piscar.', null),
  ('desafio', 'picante', 'Mostre de perto a sua boca e mande um beijo lento.', null),
  ('desafio', 'picante', 'Diga em voz baixa a primeira coisa que faria se eu estivesse aí.', null),
  ('desafio', 'picante', 'Passe a mão devagar pelo cabelo e pelo pescoço, olhando para mim.', null)
on conflict do nothing;

-- prenda · romantico (+4)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('prenda', 'romantico', 'Diga "eu te amo" do jeito mais fofo que conseguir.', null),
  ('prenda', 'romantico', 'Mande um coração no chat para cada coisa que você ama em mim.', null),
  ('prenda', 'romantico', 'Faça uma declaração de 15 segundos, sem rir.', null),
  ('prenda', 'romantico', 'Me chame de "meu amor" nas próximas 3 frases.', null)
on conflict do nothing;

-- prenda · leve (+3)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('prenda', 'leve', 'Faça 10 polichinelos cantando parabéns.', null),
  ('prenda', 'leve', 'Imite um bicho que eu escolher por 10 segundos.', null),
  ('prenda', 'leve', 'Fique de pé numa perna só até a próxima rodada começar.', null)
on conflict do nothing;

-- prenda · criativo (+2)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('prenda', 'criativo', 'Cante a próxima frase que eu disser como se fosse ópera.', null),
  ('prenda', 'criativo', 'Desenhe um bigode no papel e use na frente da boca até a próxima rodada.', null)
on conflict do nothing;

-- prenda · picante (+1)
insert into public.cartas (tipo, nivel, texto, midia) values
  ('prenda', 'picante', 'Sussurre o meu nome três vezes, cada vez mais devagar.', null)
on conflict do nothing;

-- Esperado depois de rodar (verdades / desafios / prendas):
--   romântico 60 / 90 / 19
--   leve      55 / 85 / 18
--   criativo  50 / 80 / 17
--   picante   45 / 75 / 16
--   pesado    40 / 70 / 15
select nivel, tipo, count(*) from public.cartas where sala is null and tipo in ('verdade','desafio','prenda') group by 1, 2 order by 1, 2;
