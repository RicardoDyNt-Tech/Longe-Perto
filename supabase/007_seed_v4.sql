-- Longe & Perto v4 — cartas especiais (efeitos, duelos, sintonia, missões).
-- Rode DEPOIS do 006_v4.sql. Pode rodar de novo: cartas repetidas são ignoradas.

-- efeito · leve (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('efeito', 'leve', 'Fale com voz de narrador de desenho animado até o efeito acabar.', 2, null),
  ('efeito', 'leve', 'Termine toda frase com "meu amor".', 3, null),
  ('efeito', 'leve', 'Comece todas as respostas com "Então...".', 2, null),
  ('efeito', 'leve', 'Fique com um boné, chapéu ou qualquer coisa na cabeça até o efeito acabar.', 3, null),
  ('efeito', 'leve', 'Fale sempre com uma mão no queixo, com cara de pensador(a).', 2, null),
  ('efeito', 'leve', 'Toda vez que eu disser o seu nome, mande um beijo para a câmera.', 3, null)
on conflict do nothing;

-- efeito · criativo (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('efeito', 'criativo', 'Fale com sotaque de outro país até o efeito acabar.', 2, null),
  ('efeito', 'criativo', 'Responda tudo rimando.', 2, null),
  ('efeito', 'criativo', 'Você virou personagem de novela: fale sempre de forma dramática.', 3, null),
  ('efeito', 'criativo', 'Antes de cada resposta, faça uma pose de modelo.', 2, null),
  ('efeito', 'criativo', 'Fale de você mesmo(a) sempre em terceira pessoa.', 3, null),
  ('efeito', 'criativo', 'Só pode usar uma palavra por frase, o resto é mímica.', 2, null)
on conflict do nothing;

-- efeito · picante (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('efeito', 'picante', 'Responda tudo sussurrando.', 3, null),
  ('efeito', 'picante', 'Fique sem camiseta até o efeito acabar.', 2, null),
  ('efeito', 'picante', 'Mantenha a mão no pescoço sempre que estiver falando.', 2, null),
  ('efeito', 'picante', 'Mande um beijo provocante antes de cada resposta.', 3, null),
  ('efeito', 'picante', 'Me chame pelo apelido provocante que eu escolher.', 3, null),
  ('efeito', 'picante', 'Mantenha o olhar na câmera: desviar por mais de 3 segundos quebra o efeito.', 2, null)
on conflict do nothing;

-- efeito · pesado (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('efeito', 'pesado', 'Tire uma peça de roupa; ela só volta quando o efeito acabar.', 3, null),
  ('efeito', 'pesado', 'Fique só de roupa íntima até o efeito acabar.', 2, null),
  ('efeito', 'pesado', 'Toda resposta sua precisa vir acompanhada de uma confissão ousada.', 2, null),
  ('efeito', 'pesado', 'Deixe a câmera no ângulo que eu escolher até o efeito acabar.', 3, null),
  ('efeito', 'pesado', 'A cada vez sua, tire mais uma peça de roupa até o efeito acabar.', 3, null),
  ('efeito', 'pesado', 'Fale comigo só com a voz mais sedutora que você tiver.', 3, null)
on conflict do nothing;

-- duelo · leve (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('duelo', 'leve', 'Quem rir primeiro perde: encarem-se pela câmera em silêncio.', null, null),
  ('duelo', 'leve', 'Quem piscar primeiro perde.', null, null),
  ('duelo', 'leve', 'Pedra, papel e tesoura, melhor de 3.', null, null),
  ('duelo', 'leve', 'Quem mostrar mais objetos da mesma cor em 30 segundos ganha.', null, 30),
  ('duelo', 'leve', 'Quem fizer a careta mais feia ganha (o outro precisa admitir).', null, null),
  ('duelo', 'leve', 'Quem ficar mais tempo numa perna só ganha.', null, null)
on conflict do nothing;

-- duelo · criativo (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('duelo', 'criativo', 'Cada um busca um objeto que represente o namoro e explica; a escolha mais criativa ganha.', null, 30),
  ('duelo', 'criativo', 'Batalha de rap: 4 versos cada, sobre o outro.', null, null),
  ('duelo', 'criativo', 'Quem desenhar o outro melhor em 60 segundos ganha.', null, 60),
  ('duelo', 'criativo', 'Mímica de filme: quem fizer o outro adivinhar mais rápido ganha.', null, 30),
  ('duelo', 'criativo', 'Quem imitar melhor a risada do outro ganha.', null, null),
  ('duelo', 'criativo', 'Os dois dançam a mesma música por 15 segundos; a melhor dança ganha.', null, 15)
on conflict do nothing;

-- duelo · picante (4)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('duelo', 'picante', 'Encarem-se de forma provocante: quem desviar o olhar primeiro perde.', null, null),
  ('duelo', 'picante', 'Pedra, papel e tesoura, melhor de 3: quem perder cada rodada tira uma peça de roupa.', null, null),
  ('duelo', 'picante', 'Quem mandar o beijo mais provocante para a câmera ganha.', null, null),
  ('duelo', 'picante', 'Quem fizer a pose mais sensual em 10 segundos ganha.', null, 10)
on conflict do nothing;

-- duelo · pesado (4)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('duelo', 'pesado', 'Um fala as coisas mais ousadas que conseguir enquanto o outro tenta não sorrir; depois troca. Quem aguentar mais ganha.', null, null),
  ('duelo', 'pesado', 'Striptease relâmpago: quem tirar uma peça do jeito mais sensual em 20 segundos ganha.', null, 20),
  ('duelo', 'pesado', 'Cada um descreve a fantasia mais ousada em 30 segundos; a mais ousada ganha.', null, 30),
  ('duelo', 'pesado', 'Pedra, papel e tesoura, melhor de 5: cada rodada perdida é uma peça a menos.', null, null)
on conflict do nothing;

-- sintonia · leve (10)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('sintonia', 'leve', 'Qual comida você pediria agora, se pudesse?', null, null),
  ('sintonia', 'leve', 'Qual música você mais ouviu esta semana?', null, null),
  ('sintonia', 'leve', 'O que você faria primeiro no nosso reencontro?', null, null),
  ('sintonia', 'leve', 'Qual foi a melhor parte do seu dia hoje?', null, null),
  ('sintonia', 'leve', 'Qual lugar você escolheria para a nossa próxima viagem?', null, null),
  ('sintonia', 'leve', 'Qual série ou filme você reassistiria agora?', null, null),
  ('sintonia', 'leve', 'Qual apelido meu você prefere?', null, null),
  ('sintonia', 'leve', 'Qual seria o seu presente ideal hoje?', null, null),
  ('sintonia', 'leve', 'A que horas você acordou hoje?', null, null),
  ('sintonia', 'leve', 'Qual é o seu doce favorito?', null, null)
on conflict do nothing;

-- sintonia · criativo (8)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('sintonia', 'criativo', 'Que animal você acha que eu seria?', null, null),
  ('sintonia', 'criativo', 'Qual superpoder você escolheria?', null, null),
  ('sintonia', 'criativo', 'O que você faria num dia inteiro sem regras?', null, null),
  ('sintonia', 'criativo', 'Qual seria o nome do seu livro de memórias?', null, null),
  ('sintonia', 'criativo', 'Que personagem de filme você gostaria de ser por um dia?', null, null),
  ('sintonia', 'criativo', 'Qual profissão você teria em outra vida?', null, null),
  ('sintonia', 'criativo', 'Qual emoji mais representa você hoje?', null, null),
  ('sintonia', 'criativo', 'Qual música tocaria no nosso casamento?', null, null)
on conflict do nothing;

-- sintonia · picante (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('sintonia', 'picante', 'Qual parte de mim você mais gosta de olhar?', null, null),
  ('sintonia', 'picante', 'Qual roupa minha você mais gosta?', null, null),
  ('sintonia', 'picante', 'Onde você gostaria de me beijar primeiro no reencontro?', null, null),
  ('sintonia', 'picante', 'Qual foi o nosso beijo mais marcante?', null, null),
  ('sintonia', 'picante', 'De 0 a 10, quanta saudade física você está sentindo agora?', null, null),
  ('sintonia', 'picante', 'Qual é o seu ponto fraco para ser provocado(a)?', null, null)
on conflict do nothing;

-- sintonia · pesado (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('sintonia', 'pesado', 'Qual é a sua posição favorita comigo?', null, null),
  ('sintonia', 'pesado', 'Qual fantasia você mais quer realizar comigo?', null, null),
  ('sintonia', 'pesado', 'Qual foi a nossa noite mais intensa?', null, null),
  ('sintonia', 'pesado', 'O que você quer que eu vista no reencontro?', null, null),
  ('sintonia', 'pesado', 'Qual cômodo você escolheria para a primeira vez no reencontro?', null, null),
  ('sintonia', 'pesado', 'Qual foto minha você mais gostaria de receber agora?', null, null)
on conflict do nothing;

-- missao_dupla · leve (5)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_dupla', 'leve', 'Inventem uma história juntos, uma frase cada, por 1 minuto sem travar.', null, 60),
  ('missao_dupla', 'leve', 'Contem de 1 a 20 alternando, sem errar.', null, null),
  ('missao_dupla', 'leve', 'Façam o mesmo gesto ao mesmo tempo, sem combinar: contem 3-2-1 e mostrem. Precisam acertar 1 de 3 tentativas.', null, null),
  ('missao_dupla', 'leve', 'Descubram 5 coisas em comum que ainda não sabiam.', null, 120),
  ('missao_dupla', 'leve', 'Cantem juntos um refrão inteiro sem errar a letra.', null, null)
on conflict do nothing;

-- missao_dupla · criativo (5)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_dupla', 'criativo', 'Criem juntos um jingle do casal e cantem.', null, 120),
  ('missao_dupla', 'criativo', 'Cada um desenha metade de um rosto; juntem as metades na câmera e precisam combinar.', null, 90),
  ('missao_dupla', 'criativo', 'Montem juntos o roteiro do próximo encontro.', null, 90),
  ('missao_dupla', 'criativo', 'Criem um aperto de mão pela câmera e façam sincronizado.', null, null),
  ('missao_dupla', 'criativo', 'Inventem uma palavra nova e usem ela 3 vezes na próxima rodada.', null, null)
on conflict do nothing;

-- missao_dupla · picante (3)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_dupla', 'picante', 'Escrevam juntos, alternando palavras, uma mensagem picante de 3 frases.', null, null),
  ('missao_dupla', 'picante', 'Façam uma dança sensual sincronizada.', null, 15),
  ('missao_dupla', 'picante', 'Montem juntos a playlist da primeira noite do reencontro: 5 músicas.', null, 120)
on conflict do nothing;

-- missao_dupla · pesado (2)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_dupla', 'pesado', 'Montem juntos o cardápio da primeira noite do reencontro: 3 posições e um lugar.', null, null),
  ('missao_dupla', 'pesado', 'Escrevam juntos, uma frase cada, a fantasia do casal para o reencontro.', null, null)
on conflict do nothing;

-- missao_secreta · leve (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_secreta', 'leve', 'Faça o outro dizer "eu te amo" sem pedir diretamente.', null, null),
  ('missao_secreta', 'leve', 'Faça o outro contar uma história da infância.', null, null),
  ('missao_secreta', 'leve', 'Faça o outro cantar um trecho de música.', null, null),
  ('missao_secreta', 'leve', 'Faça o outro rir três vezes na mesma rodada.', null, null),
  ('missao_secreta', 'leve', 'Faça o outro falar o nome de um animal.', null, null),
  ('missao_secreta', 'leve', 'Consiga um elogio espontâneo do outro.', null, null)
on conflict do nothing;

-- missao_secreta · criativo (6)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_secreta', 'criativo', 'Faça o outro imitar alguém.', null, null),
  ('missao_secreta', 'criativo', 'Faça o outro mostrar um objeto do quarto.', null, null),
  ('missao_secreta', 'criativo', 'Faça o outro dizer a palavra "abacaxi".', null, null),
  ('missao_secreta', 'criativo', 'Faça o outro fazer uma careta.', null, null),
  ('missao_secreta', 'criativo', 'Faça o outro dançar, nem que seja um pouquinho.', null, null),
  ('missao_secreta', 'criativo', 'Faça o outro contar um plano para o futuro de vocês.', null, null)
on conflict do nothing;

-- missao_secreta · picante (4)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_secreta', 'picante', 'Faça o outro mandar um beijo para a câmera sem pedir.', null, null),
  ('missao_secreta', 'picante', 'Faça o outro dizer o que mais gosta no seu corpo.', null, null),
  ('missao_secreta', 'picante', 'Faça o outro ficar com vergonha.', null, null),
  ('missao_secreta', 'picante', 'Faça o outro morder o lábio.', null, null)
on conflict do nothing;

-- missao_secreta · pesado (4)
insert into public.cartas (tipo, nivel, texto, rodadas, segundos) values
  ('missao_secreta', 'pesado', 'Faça o outro tirar uma peça de roupa sem ser por carta.', null, null),
  ('missao_secreta', 'pesado', 'Faça o outro contar uma fantasia sem ser por carta.', null, null),
  ('missao_secreta', 'pesado', 'Faça o outro dizer que está com vontade de você.', null, null),
  ('missao_secreta', 'pesado', 'Faça o outro prometer algo ousado para o reencontro.', null, null)
on conflict do nothing;

-- Confira: efeito 24 · duelo 20 · sintonia 30 · missao_dupla 15 · missao_secreta 20
select tipo, nivel, count(*) from public.cartas where sala is null and tipo in ('efeito','duelo','sintonia','missao_dupla','missao_secreta') group by 1, 2 order by 1, 2;
