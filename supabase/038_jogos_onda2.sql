-- Longe & Perto — Onda 2: cartas próprias de sala e seed de Sintonia e Blefe.
-- Migração idempotente: pode ser executada novamente sem duplicar dados.

------------------------------------------------------------------------------
-- 1) Tabela jogos_cartas_sala (cartas criadas pelo casal no Leilão às cegas)
------------------------------------------------------------------------------
create table if not exists public.jogos_cartas_sala (
  id          uuid primary key default gen_random_uuid(),
  sala_codigo text not null references public.salas(codigo) on delete cascade,
  jogo_id     text not null,
  dados       jsonb not null,
  criado_em   timestamptz not null default now()
);

create index if not exists jogos_cartas_sala_idx
  on public.jogos_cartas_sala (sala_codigo, jogo_id);

alter table public.jogos_cartas_sala enable row level security;

drop policy if exists "jogos_cartas_sala_ler" on public.jogos_cartas_sala;
create policy "jogos_cartas_sala_ler"
  on public.jogos_cartas_sala for select to anon, authenticated
  using (true);

drop policy if exists "jogos_cartas_sala_criar" on public.jogos_cartas_sala;
create policy "jogos_cartas_sala_criar"
  on public.jogos_cartas_sala for insert to anon, authenticated
  with check (exists (select 1 from public.salas s where s.codigo = jogos_cartas_sala.sala_codigo));

drop policy if exists "jogos_cartas_sala_apagar" on public.jogos_cartas_sala;
create policy "jogos_cartas_sala_apagar"
  on public.jogos_cartas_sala for delete to anon, authenticated
  using (true);

------------------------------------------------------------------------------
-- 2) Seed: sintonizador (45 pares de extremos)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Filme ruim que diverte", "direita": "Obra-prima do cinema"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Café fraco", "direita": "Café que acorda o prédio"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Frio de congelar", "direita": "Calor insuportável"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Silêncio absoluto", "direita": "Barulho de carnaval"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Totalmente planejado", "direita": "Improviso completo"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Comida super simples", "direita": "Jantar de restaurante estrelado"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Animal inofensivo", "direita": "Animal perigoso"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Barato demais", "direita": "Caro demais"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Coisa do passado", "direita": "Coisa do futuro"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Preguiça total", "direita": "Energia infinita"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Programa caseiro", "direita": "Aventura ao ar livre"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Fácil de esquecer", "direita": "Inesquecível"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Segredo bobo", "direita": "Segredo gravíssimo"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Presente prático", "direita": "Presente puramente sentimental"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Clichê demais", "direita": "Super original"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Música para dormir", "direita": "Música para pular"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Lanche rápido", "direita": "Banquete de domingo"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Superstição boba", "direita": "Fato científico"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Pessoa tímida", "direita": "Alma da festa"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Passeio de 10 minutos", "direita": "Viagem de um mês"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Roupa de ficar em casa", "direita": "Traje de gala"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Superpoder inútil", "direita": "Superpoder invencível"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Manhã preguiçosa", "direita": "Madrugada agitada"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Conversa fiada", "direita": "Papo profundo de madrugada"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Totalmente desnecessário", "direita": "Item de sobrevivência"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Pior lugar para primeiro encontro", "direita": "Lugar perfeito para primeiro encontro"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Hábito irritante", "direita": "Mania fofa"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Série leve de 20 min", "direita": "Drama denso de 3 horas"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Doce enjoativo", "direita": "Doce perfeito"}'),
  ('sintonizador', 'geral', 'ambos', false, '{"esquerda": "Coisa de criança", "direita": "Coisa de adulto responsável"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Gesto discreto", "direita": "Declaração de cinema"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Carinho rápido", "direita": "Abraço de não querer soltar"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Encontro improvisado", "direita": "Noite planejada nos detalhes"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Elogio tímido", "direita": "Elogio que deixa sem jeito"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Saudade tranquila", "direita": "Saudade que aperta o peito"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Beijo de bom dia", "direita": "Beijo de reencontro"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Mensagem curta", "direita": "Carta enorme no cofre"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Rotina comum", "direita": "Data super comemorativa"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Ciúme zero", "direita": "Ciúme assumido"}'),
  ('sintonizador', 'romantico', 'ambos', false, '{"esquerda": "Sonho pé no chão", "direita": "Plano maluco a dois"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Inocente", "direita": "Cheio de segundas intenções"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Clima fofo", "direita": "Clima intenso"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Olhar discreto", "direita": "Olhar que diz tudo"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Toque leve na mão", "direita": "Beijo no pescoço"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Dormir cedo", "direita": "Perder a hora juntos"}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 3) Seed: leilao-as-cegas (40 cartas)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Ambos (16)
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Escolha do próximo filme", "descricao": "O vencedor escolhe o próximo filme ou série sem direito a veto."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Playlist exclusiva de 1 hora", "descricao": "O outro monta uma seleção musical sob medida para você."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Carta longa no cofre", "descricao": "Direito a uma carta sincera escrita sem pressa."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Elogio em áudio de 1 minuto", "descricao": "O outro grava 1 minuto só elogiando você."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Poder de pular uma prenda", "descricao": "Passe livre para trocar qualquer prenda futura."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Tema do próximo encontro", "descricao": "Você decide todo o roteiro do nosso próximo encontro."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Foto especial no álbum", "descricao": "O outro envia uma foto exclusiva com dedicatória."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Pedido de história antes de dormir", "descricao": "O outro conta ou inventa uma história na chamada."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Direito a uma confissão", "descricao": "O outro responde com 100% de sinceridade a uma pergunta sua."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Sobremesa escolhida por você", "descricao": "Você escolhe a próxima sobremesa que vamos comer."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Vale-conselho sem interrupção", "descricao": "5 minutos de escuta total sobre qualquer assunto."}'),
  ('leilao-as-cegas', 'mimo', 'ambos', false, '{"titulo": "Desenho exclusivo no Mural", "descricao": "O outro faz um desenho dedicado para você no Mural."}'),
  ('leilao-as-cegas', 'ousado', 'ambos', true, '{"titulo": "Segredo ao pé do ouvido", "descricao": "Uma revelação ousada dita só para vocês dois."}'),
  ('leilao-as-cegas', 'ousado', 'ambos', true, '{"titulo": "Controle do clima da noite", "descricao": "Você escolhe o ritmo e o nível das próximas cartas."}'),
  ('leilao-as-cegas', 'ousado', 'ambos', true, '{"titulo": "Elogio sem filtro", "descricao": "O outro diz exatamente o que mais atrai nele em você."}'),
  ('leilao-as-cegas', 'ousado', 'ambos', true, '{"titulo": "Convite surpresa para o reencontro", "descricao": "Você cria um combinado ousado para o próximo dia juntos."}'),

  -- Longe (12)
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Chamada de vídeo extra", "descricao": "Uma chamada sem pressa no horário que você escolher."}'),
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Delivery surpresa", "descricao": "Um mimo ou lanche combinado para o próximo fim de semana."}'),
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Áudio de bom dia caprichado", "descricao": "Amanhã você acorda com um áudio especial."}'),
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Look escolhido na chamada", "descricao": "Você escolhe uma peça ou cor para o outro usar na próxima chamada."}'),
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Sessão de filme sincronizado", "descricao": "O outro topa assistir ao filme que você escolher."}'),
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Envelope surpresa aberto amanhã", "descricao": "O outro cria um envelope especial para você abrir amanhã."}'),
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Tour pelo quarto com desafio", "descricao": "O outro mostra 3 objetos com histórias secretas na câmera."}'),
  ('leilao-as-cegas', 'longe', 'longe', false, '{"titulo": "Serenata improvisada", "descricao": "O outro canta um trecho da sua música favorita na chamada."}'),
  ('leilao-as-cegas', 'longe', 'longe', true, '{"titulo": "Chamada só de voz no escuro", "descricao": "15 minutos conversando baixo antes de dormir."}'),
  ('leilao-as-cegas', 'longe', 'longe', true, '{"titulo": "Foto de detalhe à sua escolha", "descricao": "Você pede uma foto de um detalhe específico dentro do combinado."}'),
  ('leilao-as-cegas', 'longe', 'longe', true, '{"titulo": "Desafio de provocação na chamada", "descricao": "O outro cumpre um desafio ousado escolhido por você."}'),
  ('leilao-as-cegas', 'longe', 'longe', true, '{"titulo": "Primeira coisa do reencontro", "descricao": "Você define qual será a primeira coisa que farão ao fechar a porta."}'),

  -- Juntos (12)
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Café da manhã na cama", "descricao": "O vencedor acorda sem fazer nada enquanto o outro prepara tudo."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Massagem de 15 minutos", "descricao": "Massagem nos ombros ou costas sem olhar o celular."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Folga total da louça", "descricao": "O vencedor não lava nada depois do próximo jantar."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Escolha do restaurante", "descricao": "Você decide onde vamos comer hoje sem discussão."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Cafuné garantido no sofá", "descricao": "Pelo menos 20 minutos de cafuné durante a série."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Passeio surpresa no fim de semana", "descricao": "O outro organiza um passeio sem você precisar planejar nada."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Travesseiro e lado da cama", "descricao": "Prioridade absoluta na escolha do lado da cama hoje."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', false, '{"titulo": "Jantar cozinhado pelo outro", "descricao": "Você vira jurado enquanto o outro cozinha o prato."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', true, '{"titulo": "Massagem com óleo e luz baixa", "descricao": "20 minutos de atenção total em clima tranquilo."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', true, '{"titulo": "Beijo de cinema sem pressa", "descricao": "Direito de pausar tudo para um beijo demorado."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', true, '{"titulo": "Noite sob o seu comando", "descricao": "Você dita o ritmo da noite dentro dos limites do casal."}'),
  ('leilao-as-cegas', 'juntos', 'juntos', true, '{"titulo": "Banho relaxante preparado", "descricao": "Toalha separada, música e clima calmo preparados para você."}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 4) Seed: tabu-do-casal (50 cartas)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Leve (14)
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Aeroporto", "proibidas": ["Avião", "Mala", "Embarque", "Viagem"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Piquenique", "proibidas": ["Parque", "Toalha", "Cesta", "Grama"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Cinema", "proibidas": ["Filme", "Pipoca", "Tela", "Ingresso"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Churrasco", "proibidas": ["Carne", "Grelha", "Carvão", "Domingo"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Praia", "proibidas": ["Mar", "Areia", "Sol", "Onda"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Karaokê", "proibidas": ["Cantar", "Microfone", "Música", "Letra"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Roda-gigante", "proibidas": ["Parque", "Altura", "Girar", "Cabine"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Sorvete", "proibidas": ["Gelado", "Casquinha", "Sabor", "Verão"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Fogueira", "proibidas": ["Fogo", "Lenha", "Acampamento", "Quente"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Pizzaria", "proibidas": ["Pizza", "Queijo", "Forno", "Fatia"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Carnaval", "proibidas": ["Festa", "Bloco", "Fantasia", "Samba"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Cachoeira", "proibidas": ["Água", "Queda", "Trilha", "Rio"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Fotografia", "proibidas": ["Câmera", "Foto", "Imagem", "Lembrança"]}'),
  ('tabu-do-casal', 'leve', 'ambos', false, '{"palavra": "Bicicleta", "proibidas": ["Pedalar", "Roda", "Guidão", "Parque"]}'),

  -- Romântico (14)
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Reencontro", "proibidas": ["Saudade", "Abraço", "Voltar", "Distância"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Saudade", "proibidas": ["Falta", "Longe", "Sentir", "Vontade"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Declaração", "proibidas": ["Amor", "Falar", "Texto", "Sentimento"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Aniversário", "proibidas": ["Data", "Comemorar", "Ano", "Presente"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Cafuné", "proibidas": ["Cabeça", "Cabelo", "Carinho", "Mão"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Conchinha", "proibidas": ["Dormir", "Cama", "Abraçado", "Costas"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Serenata", "proibidas": ["Cantar", "Janela", "Noite", "Violão"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Aliança", "proibidas": ["Anel", "Dedo", "Casamento", "Ouro"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Pôr do sol", "proibidas": ["Sol", "Céu", "Tarde", "Laranja"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Brinde", "proibidas": ["Taça", "Vinho", "Comemorar", "Bater"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Carta de amor", "proibidas": ["Papel", "Escrever", "Envelope", "Amor"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Primeiro beijo", "proibidas": ["Boca", "Começo", "Lábios", "Nervoso"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Lua de mel", "proibidas": ["Viagem", "Casal", "Casamento", "Romântico"]}'),
  ('tabu-do-casal', 'romantico', 'ambos', false, '{"palavra": "Buquê", "proibidas": ["Flores", "Presente", "Rosa", "Ramo"]}'),

  -- Cotidiano (12)
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Despertador", "proibidas": ["Acordar", "Hora", "Tocar", "Manhã"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Supermercado", "proibidas": ["Compras", "Carrinho", "Comida", "Caixa"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Chamada de vídeo", "proibidas": ["Celular", "Câmera", "Tela", "Conversar"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Cafeteira", "proibidas": ["Café", "Manhã", "Água", "Pó"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Geladeira", "proibidas": ["Frio", "Comida", "Cozinha", "Porta"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Travesseiro", "proibidas": ["Cabeça", "Dormir", "Cama", "Macio"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Fone de ouvido", "proibidas": ["Ouvir", "Música", "Orelha", "Som"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Chave reserva", "proibidas": ["Porta", "Abrir", "Casa", "Esquecer"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Guarda-chuva", "proibidas": ["Chuva", "Molhar", "Abrir", "Água"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Maratona de série", "proibidas": ["Assistir", "Episódio", "Sofá", "TV"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Delivery", "proibidas": ["Comida", "Entregador", "Pedir", "Aplicativo"]}'),
  ('tabu-do-casal', 'cotidiano', 'ambos', false, '{"palavra": "Mala de viagem", "proibidas": ["Roupas", "Viajar", "Fechar", "Rodinha"]}'),

  -- Ousado (10)
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Massagem", "proibidas": ["Costas", "Mãos", "Relaxar", "Óleo"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Sussurro", "proibidas": ["Baixo", "Ouvido", "Falar", "Segredo"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Flerte", "proibidas": ["Olhar", "Paquera", "Sorriso", "Interesse"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Luz de velas", "proibidas": ["Escuro", "Fogo", "Clima", "Jantar"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Beijo no pescoço", "proibidas": ["Boca", "Pele", "Arrepio", "Carinho"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Clima quente", "proibidas": ["Calor", "Desejo", "Noite", "Intenso"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Provocação", "proibidas": ["Brincar", "Tentar", "Olhar", "Desejo"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Madrugada a dois", "proibidas": ["Noite", "Dormir", "Tarde", "Acordado"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Química", "proibidas": ["Atração", "Conexão", "Combinação", "Faísca"]}'),
  ('tabu-do-casal', 'ousado', 'ambos', true, '{"palavra": "Surpresa no quarto", "proibidas": ["Cama", "Segredo", "Porta", "Noite"]}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 5) Seed: cena-de-improviso (30 cenários + 40 objetivos secretos)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Cenários (30)
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Elevador parado", "contexto": "Dois desconhecidos ficam presos no elevador por 10 minutos."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Mesa trocada no restaurante", "contexto": "O garçom trouxe o prato errado e vocês dois acham que o pedido é de vocês."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Vizinhos de parede fina", "contexto": "Um toca violão às 23h e o outro bate na porta para reclamar."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Portão de embarque errado", "contexto": "Faltam 5 minutos para o voo e os dois descobriram que o portão mudou."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Entrevista de emprego inusitada", "contexto": "Um é o entrevistador exigente e o outro quer a vaga de testador de colchões."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Caixa de supermercado", "contexto": "Só sobrou um pacote do último doce da prateleira e os dois seguraram ao mesmo tempo."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Quarto de hotel com vista errada", "contexto": "O hóspede pediu vista para o mar e recebeu vista para o estacionamento."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Primeira aula de dança", "contexto": "Um acha que sabe dançar perfeitamente e o outro nunca pisou num salão."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Chuva na parada de ônibus", "contexto": "Só há um guarda-chuva pequeno para duas pessoas esperando carona."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Reencontro de colegas de escola", "contexto": "Vocês fingem que lembram perfeitamente do nome um do outro."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Detetives amadores", "contexto": "Sumiu o bolo da geladeira do escritório e vocês dois interrogam um ao outro."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Compra do sofá", "contexto": "Um quer o sofá gigante de veludo e o outro quer o minimalista duro."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Receita improvisada", "contexto": "Faltou metade dos ingredientes do jantar e os convidados chegam em 15 minutos."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Sala de cinema vazia", "contexto": "Os dois compraram exatamente a mesma poltrona por erro do sistema."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Museu de arte moderna", "contexto": "Um acha que a cadeira do segurança é uma obra de arte caríssima."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Cabine telefônica antiga", "contexto": "Começa a chover forte e vocês dividem espaço num abrigo apertado."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Motorista e passageiro perdidos", "contexto": "O GPS acabou a bateria numa estrada cheia de curvas."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Livraria fechando", "contexto": "Faltam 2 minutos para fechar e vocês disputam a atenção do atendente."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Acampamento improvisado", "contexto": "Esqueceram as estacas da barraca e o vento está aumentando."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Cafeteria sem energia", "contexto": "Acabou a luz do bairro e vocês ficam conversando à luz de velas."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Troca de presentes secretos", "contexto": "Vocês abriram o presente errado e precisam disfarçar a reação."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Viagem de trem noturno", "contexto": "Dois viajantes dividem a última mesa do vagão-restaurante."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Aula de culinária", "contexto": "O chefe tenta manter a calma enquanto o aprendiz confunde sal com açúcar."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Varanda na virada do ano", "contexto": "Faltam 60 segundos para a meia-noite e vocês acabaram de se conhecer."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Planeta recém-descoberto", "contexto": "Dois astronautas decidem o nome oficial do novo planeta."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Festa fantasia", "contexto": "Os dois foram fantasiados exatamente da mesma coisa."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Loja de antiguidades", "contexto": "Um quer vender uma bússola quebrada e o outro jura que ela é mágica."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Madrugada na rodoviária", "contexto": "O ônibus atrasou 2 horas e só há um banco livre."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Primeiro encontro às escuras", "contexto": "Os dois acham que estão falando com a pessoa errada da reserva."}'),
  ('cena-de-improviso', 'cenario', 'ambos', false, '{"tipo": "cenario", "titulo": "Bastidores de um show", "contexto": "Um fã entrou sem querer no camarim do artista."}'),

  -- Objetivos secretos (40)
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro mencionar uma cor sem pedir diretamente."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Termine a cena convencendo o outro a trocar de lugar ou função com você."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Encaixe o nome de três frutas naturalmente na conversa."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro rir ou sorrir antes dos últimos 15 segundos."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Finja que tem um segredo urgente que nunca chega a contar."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Concorde com absolutamente tudo o que o outro disser, mesmo que seja absurdo."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro perguntar que horas são."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Use a palavra abacaxi no meio de uma frase séria."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Tente vender um objeto imaginário para o outro até o fim da cena."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça um elogio inesperado ao outro no auge da discussão."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Mude de humor completamente no meio da cena sem explicar o motivo."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro dizer a palavra café."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Aja como se estivesse com muito frio durante toda a cena."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Termine a cena combinando uma viagem com o outro."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Responda pelo menos três falas do outro fazendo uma nova pergunta."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Invente um apelido para o personagem do outro e use até o fim."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Dê um conselho filosófico totalmente fora de hora."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro contar até três ou mencionar um número."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Finja que perdeu algo pequeno e procure durante a cena."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Fale sussurrando nos últimos 15 segundos como se alguém estivesse ouvindo."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Cite o nome de um filme famoso como se tivesse acontecido com você."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Discorde do primeiro argumento do outro e depois mude de lado."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro mencionar uma cidade ou país."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Tente encerrar a cena apertando as mãos ou fazendo um brinde."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Inclua uma previsão do tempo inventada no seu diálogo."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Reaja com surpresa exagerada a algo comum que o outro falar."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Mencione um animal doméstico que não existe na cena."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Peça opinião ao outro sobre uma escolha imaginária (A ou B)."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Diga uma frase inteira rimando duas palavras."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Aja como se estivesse com muita pressa para um compromisso secreto."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro repetir uma palavra que você acabou de falar."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Comece duas frases seguidas com Na verdade."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Termine a cena dizendo que tudo fazia parte do seu plano."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Invente uma regra maluca do lugar onde vocês estão."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Faça o outro concordar em dividir alguma coisa com você."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Mencione uma música real como trilha do momento."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Fale como um locutor de rádio por 5 segundos no meio da cena."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Tente descobrir qual é o objetivo secreto do outro sem sair do personagem."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Peça desculpas por algo que claramente foi culpa do outro."}'),
  ('cena-de-improviso', 'objetivo', 'ambos', false, '{"tipo": "objetivo", "objetivo": "Feche a cena fazendo um convite inesperado para o outro."}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 6) Seed: dilemas-as-cegas (60 dilemas)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Leve (15)
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Acordar às 6h com energia", "opcao_b": "Dormir até 11h sem culpa"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Viajar só com mala de mão", "opcao_b": "Levar mala gigante com tudo"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Comer só doce por uma semana", "opcao_b": "Comer só salgado por uma semana"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Ver o mesmo filme favorito 10x", "opcao_b": "Só poder ver filmes inéditos"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Férias numa praia deserta", "opcao_b": "Férias numa metrópole agitada"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Ter café infinito de graça", "opcao_b": "Ter pizza infinita de graça"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Sexta em casa de pijama", "opcao_b": "Sexta jantando fora arrumados"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Inverno o ano inteiro", "opcao_b": "Verão o ano inteiro"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Saber cozinhar como chef", "opcao_b": "Tocar qualquer instrumento"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Adotar um cachorro agitado", "opcao_b": "Adotar um gato independente"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Receber presente surpresa", "opcao_b": "Escolher exatamente o presente"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Viagem de trem panorâmico", "opcao_b": "Viagem de carro com playlist"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Nunca mais pegar trânsito", "opcao_b": "Nunca mais pegar fila"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Morar perto da praia", "opcao_b": "Morar no alto da serra"}'),
  ('dilemas-as-cegas', 'leve', 'ambos', false, '{"opcao_a": "Tirar mil fotos da viagem", "opcao_b": "Guardar poucas fotos e viver sem celular"}'),

  -- Profundo (15)
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Saber exatamente o futuro", "opcao_b": "Viver com a surpresa de cada fase"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Pedir desculpas primeiro", "opcao_b": "Esperar a poeira baixar em silêncio"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Ter mais tempo livre juntos", "opcao_b": "Ter mais dinheiro para realizar sonhos"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Conversar sobre tudo na hora", "opcao_b": "Pensar antes de falar para não magoar"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Relembrar o passado com nostalgia", "opcao_b": "Focar só nos próximos planos"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Mudar de país por 2 anos juntos", "opcao_b": "Construir raízes fortes perto da família"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Receber apoio em silêncio", "opcao_b": "Ouvir conselhos práticos na hora"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Planejar os próximos 5 anos", "opcao_b": "Decidir ano a ano sem pressão"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Demonstrar amor com atitudes", "opcao_b": "Demonstrar amor com palavras"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Ter uma rotina previsível e calma", "opcao_b": "Viver mudanças frequentes"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Guardar memórias em cartas", "opcao_b": "Guardar memórias em vídeos"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Resolver um conflito por chamada", "opcao_b": "Esperar para conversar pessoalmente"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Comemorar datas todo mês", "opcao_b": "Fazer uma celebração gigante por ano"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Ser elogiado em público", "opcao_b": "Receber um bilhete secreto só seu"}'),
  ('dilemas-as-cegas', 'profundo', 'ambos', false, '{"opcao_a": "Ter um ano sabático viajando", "opcao_b": "Construir a casa dos sonhos primeiro"}'),

  -- Absurdo (15)
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Só falar cantando por 1 dia", "opcao_b": "Só falar rimando por 1 dia"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Ter um pato que te segue sempre", "opcao_b": "Ter um papagaio que repete seus segredos"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Teletransporte que bagunça o cabelo", "opcao_b": "Voar só a 1 metro do chão"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Seu riso virar som de buzina", "opcao_b": "Seu espirro virar confete"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Viver num mundo sem música", "opcao_b": "Viver num mundo sem filmes"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Acordar falando outro idioma todo dia", "opcao_b": "Esquecer o nome de todas as comidas"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Ter trilha sonora tocando ao andar", "opcao_b": "Ter narrador comentando sua vida"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Comer pizza com garfo e faca para sempre", "opcao_b": "Tomar sopa de canudinho para sempre"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Viajar 100 anos para o passado", "opcao_b": "Viajar 100 anos para o futuro"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Trocar de altura por uma semana", "opcao_b": "Trocar de voz por uma semana"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Ler pensamentos por 10 min/dia", "opcao_b": "Ficar invisível por 10 min/dia"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Só poder usar uma cor de roupa", "opcao_b": "Usar fantasia uma vez por semana"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Ter Wi-Fi perfeito na lua", "opcao_b": "Ter passagem grátis para qualquer ilha"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Nunca mais sentir sono", "opcao_b": "Nunca mais sentir fome"}'),
  ('dilemas-as-cegas', 'absurdo', 'ambos', false, '{"opcao_a": "Entender o que os gatos pensam", "opcao_b": "Entender o que os bebês pensam"}'),

  -- Ousado (15)
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Noite longa cheia de provocações", "opcao_b": "Manhã preguiçosa sem sair da cama"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Tomar a iniciativa primeiro", "opcao_b": "Deixar o outro conduzir o ritmo"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Clima de velas e música lenta", "opcao_b": "Clima espontâneo no meio do dia"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Receber mensagem ousada no trabalho", "opcao_b": "Receber surpresa ao chegar em casa"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Beijo demorado na chuva", "opcao_b": "Beijo no sofá com a casa vazia"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Contar uma fantasia em áudio", "opcao_b": "Contar olhando nos olhos na chamada"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Massagem demorada com óleo", "opcao_b": "Banho quente juntos sem pressa"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Jantar romântico com vinho", "opcao_b": "Pular o jantar e ir direto para o quarto"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Sussurrar no ouvido", "opcao_b": "Olhar fixo sem dizer nada"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Repetir uma noite inesquecível", "opcao_b": "Testar algo inédito juntos"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Dormir abraçados sem soltar", "opcao_b": "Acordar no meio da noite só para conversar"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Jogar com prendas picantes", "opcao_b": "Jogar com perguntas sem filtro"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Surpresa planejada no hotel", "opcao_b": "Noite improvisada em casa"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Elogio direto e sem rodeios", "opcao_b": "Provocação sutil o dia inteiro"}'),
  ('dilemas-as-cegas', 'ousado', 'ambos', true, '{"opcao_a": "Primeira hora do reencontro em silêncio e abraço", "opcao_b": "Primeira hora cheia de beijos e risadas"}')
on conflict (jogo_id, dados) do nothing;
