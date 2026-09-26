-- Longe & Perto v7 — pedidos de dengo padrão e sugestões de cuidado.
-- Rode DEPOIS do 020_v7.sql. Pode rodar de novo.

insert into public.pedidos_modelos (sala, jogador, chave, emoji, titulo, detalhe, ordem) values
  (null, null, 'ligar', '📞', 'Me liga agora', null, 1),
  (null, null, 'audio', '🎙️', 'Me manda um áudio', null, 2),
  (null, null, 'dormir', '😴', 'Fica na chamada até eu dormir', null, 3),
  (null, null, 'mensagem', '💌', 'Me manda uma mensagem fofa', null, 4),
  (null, null, 'foto', '📸', 'Me manda uma foto sua', null, 5),
  (null, null, 'lanche', '🍔', 'Me pede um lanche', 'O que eu quero: ', 6),
  (null, null, 'filme', '🎬', 'Vê um filme comigo', 'Filme: ', 7),
  (null, null, 'colo', '🫶', 'Só preciso de colo', null, 8),
  (null, null, 'musica', '🎵', 'Me manda uma música', null, 9),
  (null, null, 'rir', '😂', 'Me faz rir', null, 10),
  (null, null, 'desabafar', '🗣️', 'Preciso desabafar', null, 11),
  (null, null, 'sozinho', '🧘', 'Preciso ficar sozinho(a)', null, 12)
on conflict do nothing;

insert into public.sugestoes_cuidado (humor_min, humor_max, texto, acao, ordem) values
  (1, 2, 'Desenhe algo no mural para animar o dia', 'mural', 1),
  (1, 2, 'Mande uma mensagem fofa, sem cobrar resposta', 'mensagem', 2),
  (1, 2, 'Grave um áudio curto dizendo que está aqui', 'audio', 3),
  (1, 2, 'Ofereça uma chamada, sem pressão', 'ligar', 4),
  (1, 2, 'Veja no manual o que acalma', 'manual', 5),
  (1, 2, 'Peça um lanche de conforto para entregar aí', 'dengo_lanche', 6),
  (1, 2, 'Se ficou algo pendente entre vocês, peça desculpas', 'desculpas', 7),
  (1, 2, 'Deixe uma carta Abra quando… para os dias difíceis', 'abra_quando', 8),
  (1, 3, 'Mande um Pensei em você', 'pensei', 9),
  (3, 3, 'Pergunte como foi o dia e só escute', 'ligar', 10),
  (3, 4, 'Mande uma música que lembre vocês', 'musica', 11),
  (3, 4, 'Proponha um filme juntos hoje à noite', 'ligar', 12),
  (4, 5, 'Proponha uma partida hoje', 'partida', 13),
  (4, 5, 'Mande um elogio sincero', 'mensagem', 14),
  (4, 5, 'Comemore junto: pergunte o que deu certo hoje', 'ligar', 15),
  (4, 5, 'Planeje algo para o reencontro', 'reencontro', 16)
on conflict (texto) do nothing;

select 'pedidos padrão' as o_que, count(*) from public.pedidos_modelos where sala is null
union all select 'sugestões', count(*) from public.sugestoes_cuidado;
