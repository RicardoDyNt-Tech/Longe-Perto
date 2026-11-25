-- Longe & Perto — Sintonizador: memória de baralho por sala e +120 novos pares de extremos.
-- Migração idempotente: pode ser executada novamente sem duplicar dados.

------------------------------------------------------------------------------
-- 1) Tabela jogos_baralho_visto (memória de itens já jogados por sala/jogo)
------------------------------------------------------------------------------
create table if not exists public.jogos_baralho_visto (
  sala_codigo text not null references public.salas(codigo) on delete cascade,
  jogo_id     text not null,
  item_id     text not null,
  visto_em    timestamptz not null default now(),
  primary key (sala_codigo, jogo_id, item_id)
);

create index if not exists jogos_baralho_visto_busca_idx
  on public.jogos_baralho_visto (sala_codigo, jogo_id, visto_em);

alter table public.jogos_baralho_visto enable row level security;

drop policy if exists "jogos_baralho_visto_ler" on public.jogos_baralho_visto;
create policy "jogos_baralho_visto_ler"
  on public.jogos_baralho_visto for select to anon, authenticated
  using (true);

drop policy if exists "jogos_baralho_visto_criar" on public.jogos_baralho_visto;
create policy "jogos_baralho_visto_criar"
  on public.jogos_baralho_visto for insert to anon, authenticated
  with check (exists (select 1 from public.salas s where s.codigo = jogos_baralho_visto.sala_codigo));

drop policy if exists "jogos_baralho_visto_atualizar" on public.jogos_baralho_visto;
create policy "jogos_baralho_visto_atualizar"
  on public.jogos_baralho_visto for update to anon, authenticated
  using (true)
  with check (exists (select 1 from public.salas s where s.codigo = jogos_baralho_visto.sala_codigo));

drop policy if exists "jogos_baralho_visto_apagar" on public.jogos_baralho_visto;
create policy "jogos_baralho_visto_apagar"
  on public.jogos_baralho_visto for delete to anon, authenticated
  using (true);

------------------------------------------------------------------------------
-- 2) Seed: sintonizador (+120 novos pares inéditos, divididos por categoria)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Cotidiano (30)
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Acordar no primeiro toque", "direita": "Dez sonecas no alarme"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Pia sempre vazia", "direita": "Torre de louça"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Banho relâmpago", "direita": "Show inteiro no chuveiro"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Mercado com lista", "direita": "Comprar por impulso"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Marmita caseira", "direita": "Pedir delivery toda vez"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Mesa minimalista", "direita": "Caos criativo"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Chegar adiantado", "direita": "Sair em cima da hora"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Áudio de 5 segundos", "direita": "Podcast no WhatsApp"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Bateria sempre em 100%", "direita": "Viver no 3%"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Chuva gostosa", "direita": "Tempestade que alaga"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Segunda animada", "direita": "Sexta no piloto automático"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Cozinhar por prazer", "direita": "Só miojo e ovo"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Economizar cada centavo", "direita": "Eu mereço hoje"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Dormir com cobertor fino", "direita": "Edredom no verão"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Responder na hora", "direita": "Sumir três dias"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Trânsito livre", "direita": "Engarrafamento parado"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Pão na chapa", "direita": "Café da manhã de hotel"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Casa em silêncio", "direita": "TV ligada de fundo"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Trabalho tranquilo", "direita": "Reunião que vira e-mail"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Tênis surrado", "direita": "Sapato novo apertando"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Mochila leve", "direita": "Mudança na bolsa"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Fruta de sobremesa", "direita": "Bolo com calda"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Treino leve", "direita": "Sair sem sentir as pernas"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Anotar tudo no papel", "direita": "Confiar só na memória"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Luz branca forte", "direita": "Meia-luz de abajur"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Cabelo arrumado", "direita": "Acordei assim mesmo"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Água gelada", "direita": "Chá pelando"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Feriado em casa", "direita": "Bate e volta na estrada"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Guardar caixa vazia", "direita": "Jogar tudo fora"}'),
  ('sintonizador', 'cotidiano', 'ambos', false, '{"esquerda": "Ler o manual", "direita": "Apertar botões até ir"}'),

  -- Casal (30)
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Chamada rápida", "direita": "Dormir na ligação"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Foto espontânea", "direita": "Ensaio super posado"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Dividir a sobremesa", "direita": "Cada um no seu prato"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Filme agarradinho", "direita": "Maratona comentada"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Apelido discreto", "direita": "Apelido constrangedor"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Viagem de praia", "direita": "Chalé na serra"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Mala organizada antes", "direita": "Fechar correndo no táxi"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Surpresa simples", "direita": "Produção com trilha"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Cozinhar juntos", "direita": "Sair para jantar fora"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "DR resolvida em 5 min", "direita": "Conversa de madrugada"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Dar espaço", "direita": "Grude o dia inteiro"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Falar por indireta", "direita": "Sincericídio total"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Lembrar a data exata", "direita": "Esquecer o dia da semana"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Escutar em silêncio", "direita": "Resolver na hora"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Andar de mãos dadas", "direita": "Braço por cima do ombro"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Rir de piada interna", "direita": "Gargalhada escandalosa"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Jantar à luz de velas", "direita": "Pizza no chão da sala"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Presente surpresa", "direita": "Escolher juntos na loja"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Bom dia de texto", "direita": "Áudio ainda rouco"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Dançar na cozinha", "direita": "Show lotado juntos"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Contar o dia inteiro", "direita": "Só os melhores momentos"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Combinar o look", "direita": "Cada um no seu estilo"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Caminhada sem rumo", "direita": "Roteiro por horário"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Reencontro no portão", "direita": "Abraço no aeroporto"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Assistir sem pausar", "direita": "Comentar cada cena"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Ficar só os dois", "direita": "Juntar toda a turma"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Mandar meme o dia todo", "direita": "Declaração do nada"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Tirar cochilo juntos", "direita": "Virar a noite jogando"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Torcer igual", "direita": "Rivalidade saudável"}'),
  ('sintonizador', 'casal', 'ambos', false, '{"esquerda": "Pequeno mimo diário", "direita": "Viagem dos sonhos"}'),

  -- Cultura pop (25)
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Comédia bobinha", "direita": "Suspense de roer unhas"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Herói certinho", "direita": "Vilão carismático"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Trilha nostálgica", "direita": "Hit do momento"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Livro muito melhor", "direita": "Filme superou o livro"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Série cancelada cedo", "direita": "Série longa demais"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Final previsível", "direita": "Plot twist genial"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Clássico dos anos 90", "direita": "Lançamento desta semana"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Animação fofa", "direita": "Terror psicológico"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Jogo relaxante", "direita": "Chefão impossível"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Banda indie secreta", "direita": "Estádio lotado"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Reality show viciante", "direita": "Documentário premiado"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Personagem secundário", "direita": "Protagonista icônico"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Dublado clássico", "direita": "Legendado sempre"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Refrão chiclete", "direita": "Letra poética"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Cinema vazio", "direita": "Estreia com fila"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Spoiler leve", "direita": "Estragou a série toda"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Sequência desnecessária", "direita": "Continuação perfeita"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Desenho da infância", "direita": "Anime épico"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Videoclipe simples", "direita": "Superprodução pop"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Karaokê desafinado", "direita": "Show particular"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Episódio enrolação", "direita": "Episódio obra de arte"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Celebridade discreta", "direita": "Polêmica toda semana"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Meme antigo", "direita": "Trend passageira"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Tabuleiro clássico", "direita": "Videogame moderno"}'),
  ('sintonizador', 'cultura-pop', 'ambos', false, '{"esquerda": "Abertura que pula", "direita": "Abertura que canta junto"}'),

  -- Absurdo (20)
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Lutar com um pato gigante", "direita": "Cem patinhos furiosos"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Falar com plantas", "direita": "Ler mente de gatos"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Viajar para os dinossauros", "direita": "Morar em Marte"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Invisível por 10 minutos", "direita": "Voar bem devagar"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Sobreviver a zumbis", "direita": "Sobreviver sem Wi-Fi"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Pizza com abacaxi", "direita": "Sorvete de feijão"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Andar de patinete", "direita": "Pilotar nave espacial"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Esquecer o próprio nome", "direita": "Saber todos os idiomas"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Morar numa árvore", "direita": "Castelo mal-assombrado"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Ter um dragão de estimação", "direita": "Robô que faz faxina"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Chover chocolate", "direita": "Nevar no Nordeste"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Teletransporte com atraso", "direita": "Voltar 5 minutos no tempo"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Virar meme nacional", "direita": "Ganhar prêmio secreto"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Falar só cantando", "direita": "Andar só pulando"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Encontro com alienígena", "direita": "Conversa com seu eu futuro"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Meia molhada", "direita": "Pedra no sapato"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Bola de cristal borrada", "direita": "Mapa do tesouro rasgado"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Trocar de corpo um dia", "direita": "Pausar o tempo uma hora"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Rir em hora séria", "direita": "Chorar em comercial"}'),
  ('sintonizador', 'absurdo', 'ambos', false, '{"esquerda": "Teoria da conspiração boba", "direita": "Mistério sem explicação"}'),

  -- Ousado (15)
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Sussurro tímido", "direita": "Provocação direta"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Luz acesa", "direita": "Quase no escuro"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Ritmo bem devagar", "direita": "Sem perder tempo"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Beijo na testa", "direita": "Beijo de tirar o fôlego"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Conversa comportada", "direita": "Papo de deixar corado"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Massagem relaxante", "direita": "Massagem com segundas intenções"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Perfume suave", "direita": "Cheiro que vicia"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Foto fofa de bom dia", "direita": "Foto só para os dois"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Brincadeira leve", "direita": "Desafio de verdade"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Mão na cintura", "direita": "Puxar para bem perto"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Clima de filme romântico", "direita": "Clima de depois da meia-noite"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Fazer suspense", "direita": "Ir direto ao ponto"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Elogio discreto", "direita": "Confissão sem filtro"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Abraço apertado", "direita": "Não deixar sair da cama"}'),
  ('sintonizador', 'ousado', 'ambos', true, '{"esquerda": "Seguir o combinado", "direita": "Quebrar a rotina a dois"}')
on conflict (jogo_id, dados) do nothing;
