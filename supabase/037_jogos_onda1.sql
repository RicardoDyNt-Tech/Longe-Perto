-- Longe & Perto — Onda 1: tabela compartilhada de conteúdo e carga inicial.
-- Migração idempotente: pode ser executada novamente sem duplicar dados.

------------------------------------------------------------------------------
-- 1) Tabela jogos_conteudo
------------------------------------------------------------------------------
create table if not exists public.jogos_conteudo (
  id        uuid primary key default gen_random_uuid(),
  jogo_id   text not null,
  categoria text not null default 'geral',
  modo      text not null default 'ambos' check (modo in ('ambos', 'longe', 'juntos')),
  ousado    boolean not null default false,
  dados     jsonb not null,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint jogos_conteudo_unico_uk unique (jogo_id, dados)
);

create index if not exists jogos_conteudo_busca_idx
  on public.jogos_conteudo (jogo_id, ativo, modo, ousado);

alter table public.jogos_conteudo enable row level security;

drop policy if exists "jogos_conteudo_ler" on public.jogos_conteudo;
create policy "jogos_conteudo_ler"
  on public.jogos_conteudo for select to anon, authenticated
  using (ativo = true);

------------------------------------------------------------------------------
-- 2) Seed: adivinhe-o-traco (60 itens)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Objetos (15)
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Chaleira", "dica": "Objeto da cozinha"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Guarda-chuva", "dica": "Usa em dia de chuva"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Ampulheta", "dica": "Mede o tempo com areia"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Binóculo", "dica": "Para enxergar longe"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Bússola", "dica": "Aponta para o norte"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Cadeado", "dica": "Tranca com chave"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Violão", "dica": "Instrumento de cordas"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Abajur", "dica": "Luz suave ao lado da cama"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Mochila", "dica": "Vai nas costas"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Óculos de sol", "dica": "Protege da claridade"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Vela aromática", "dica": "Ilumina e perfuma"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Fone de ouvido", "dica": "Para ouvir música só você"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Cafeteira", "dica": "Faz café pela manhã"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Câmera fotográfica", "dica": "Registra lembranças"}'),
  ('adivinhe-o-traco', 'objetos', 'ambos', false, '{"palavra": "Travesseiro", "dica": "Apoia a cabeça para dormir"}'),

  -- Filmes e cenas (15)
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Titanic", "dica": "Navio famoso e cena na proa"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Up: Altas Aventuras", "dica": "Casa voando com balões"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "O Rei Leão", "dica": "Filhote erguido na pedra"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Ratatouille", "dica": "Rato cozinheiro em Paris"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "A Dama e o Vagabundo", "dica": "Jantar de espaguete"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Homem-Aranha", "dica": "Beijo de cabeça para baixo"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "De Volta para o Futuro", "dica": "Carro que viaja no tempo"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Harry Potter", "dica": "Óculos redondos e cicatriz"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Toy Story", "dica": "Brinquedos que ganham vida"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "La La Land", "dica": "Dança sob o céu estrelado"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Procurando Nemo", "dica": "Peixe-palhaço no oceano"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Shrek", "dica": "Ogro verde no pântano"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "E.T.", "dica": "Bicicleta passando pela lua"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Star Wars", "dica": "Sabre de luz"}'),
  ('adivinhe-o-traco', 'filmes', 'ambos', false, '{"palavra": "Jurassic Park", "dica": "Parque de dinossauros"}'),

  -- Lugares (15)
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Praia ao pôr do sol", "dica": "Mar, areia e sol baixando"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Cafeteria", "dica": "Lugar de tomar café e conversar"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Roda-gigante", "dica": "Parque de diversões"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Aeroporto", "dica": "Embarque de viagem"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Cinema", "dica": "Tela grande e pipoca"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Acampamento", "dica": "Barraca e fogueira"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Mirante", "dica": "Vista do alto da cidade"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Livraria", "dica": "Prateleiras cheias de livros"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Estação de trem", "dica": "Trilhos e plataforma"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Pizzaria", "dica": "Forno a lenha"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Cachoeira", "dica": "Queda d''água na trilha"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Planetário", "dica": "Cúpula cheia de estrelas"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Padaria", "dica": "Pão quentinho de manhã"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Varanda", "dica": "Espaço aberto do apartamento"}'),
  ('adivinhe-o-traco', 'lugares', 'ambos', false, '{"palavra": "Chalé na serra", "dica": "Casa de madeira no frio"}'),

  -- Situações de casal (15)
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Chamada de vídeo", "dica": "Conversar olhando pela tela"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Piquenique", "dica": "Toalha xadrez no parque"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Café na cama", "dica": "Bandeja de manhã"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Abraço no aeroporto", "dica": "Reencontro depois da viagem"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Cozinhar juntos", "dica": "Dois na cozinha fazendo jantar"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Maratona de série", "dica": "Sofá, cobertor e TV"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Dançar na sala", "dica": "Música tocando em casa"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Olhar as estrelas", "dica": "Céu noturno a dois"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Brinde de vinho", "dica": "Duas taças se encontrando"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Dividir o fone", "dica": "Um lado para cada"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Mala de viagem", "dica": "Arrumando tudo para viajar"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Dormir no sofá", "dica": "Sono no meio do filme"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Carta de amor", "dica": "Envelope com coração"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Passeio de bicicleta", "dica": "Duas bikes no parque"}'),
  ('adivinhe-o-traco', 'casal', 'ambos', false, '{"palavra": "Guerra de travesseiro", "dica": "Brincadeira na cama"}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 3) Seed: duelo-musical (30 cenários)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "Trilha para a nossa próxima viagem de carro"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Música que define o seu humor hoje"}'),
  ('duelo-musical', 'reencontro', 'ambos', false, '{"cenario": "Para tocar assim que a gente se abraçar no reencontro"}'),
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "A música perfeita para dançar na cozinha"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Trilha sonora de um domingo chuvoso embaixo do cobertor"}'),
  ('duelo-musical', 'criativo', 'ambos', false, '{"cenario": "Música de abertura de um filme sobre nós dois"}'),
  ('duelo-musical', 'reencontro', 'ambos', false, '{"cenario": "Para ouvir preparando o jantar juntos"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Música que levanta o astral em qualquer dia difícil"}'),
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "A que mais combina com uma noite à luz de velas"}'),
  ('duelo-musical', 'criativo', 'ambos', false, '{"cenario": "Para tocar nos créditos finais da nossa melhor viagem"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Música de sexta-feira à noite para comemorar"}'),
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "A que dá vontade de mandar mensagem dizendo que está com saudade"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Para acordar juntos num sábado sem despertador"}'),
  ('duelo-musical', 'criativo', 'ambos', false, '{"cenario": "Se essa música fosse um lugar, seria a praia ao entardecer"}'),
  ('duelo-musical', 'reencontro', 'ambos', false, '{"cenario": "Música para a primeira noite na mesma cidade"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Som perfeito para dirigir à noite com a janela aberta"}'),
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "Música que parece um abraço apertado"}'),
  ('duelo-musical', 'criativo', 'ambos', false, '{"cenario": "Para cantar bem alto sem se importar com quem ouve"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Trilha de um café da manhã demorado"}'),
  ('duelo-musical', 'reencontro', 'ambos', false, '{"cenario": "A música que marca a contagem regressiva do próximo encontro"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Para relaxar depois de uma semana corrida"}'),
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "Música para ouvir olhando o céu à noite"}'),
  ('duelo-musical', 'criativo', 'ambos', false, '{"cenario": "A faixa que nunca pode faltar na nossa playlist oficial"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "Para dar energia na hora de arrumar a casa"}'),
  ('duelo-musical', 'reencontro', 'ambos', false, '{"cenario": "Som de aeroporto quando o voo finalmente pousa"}'),
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "Música que resume carinho sem precisar de muitas palavras"}'),
  ('duelo-musical', 'criativo', 'ambos', false, '{"cenario": "Trilha para uma caminhada de mãos dadas no fim da tarde"}'),
  ('duelo-musical', 'geral', 'ambos', false, '{"cenario": "A melhor faixa para fechar a noite em paz"}'),
  ('duelo-musical', 'romantico', 'ambos', false, '{"cenario": "Música que você dedicaria para mim hoje"}'),
  ('duelo-musical', 'criativo', 'ambos', false, '{"cenario": "Para tocar no nosso aniversário de relacionamento"}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 4) Seed: mata-mata (8 listas prontas com 8 opções cada)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  ('mata-mata', 'reencontro', 'ambos', false, '{"titulo": "Jantar do próximo reencontro", "opcoes": ["Pizza artesanal", "Japonês completo", "Massa caseira", "Hambúrguer gourmet", "Churrasco a dois", "Fondue de queijo", "Tacos e nachos", "Risoto de cogumelos"]}'),
  ('mata-mata', 'filmes', 'ambos', false, '{"titulo": "Filme para maratonar hoje", "opcoes": ["Comédia romântica", "Suspense policial", "Animação nostálgica", "Ficção científica", "Drama premiado", "Aventura de época", "Mistério investigativo", "Documentário musical"]}'),
  ('mata-mata', 'viagem', 'ambos', false, '{"titulo": "Destino da nossa próxima viagem", "opcoes": ["Praia tranquila", "Chalé na serra", "Cidade histórica", "Resort com piscina", "Capital gastronômica", "Trilha e cachoeiras", "Vinícola no sul", "Ilha paradisíaca"]}'),
  ('mata-mata', 'fim-de-semana', 'ambos', false, '{"titulo": "Programa de sábado perfeito", "opcoes": ["Piquenique no parque", "Cinema e sorvete", "Noite de jogos em casa", "Café da manhã fora", "Show ou música ao vivo", "Feira e livraria", "Cozinhar receita nova", "Dormir até tarde"]}'),
  ('mata-mata', 'noite', 'ambos', false, '{"titulo": "Tema da nossa noite especial", "opcoes": ["Noite de vinhos e queijos", "Maratona com pipoca", "Degustação de sobremesas", "Karaokê na sala", "Noite sem telas", "Jogos de mistério", "Spa caseiro e massagem", "Pôr do sol no mirante"]}'),
  ('mata-mata', 'comida', 'ambos', false, '{"titulo": "Sobremesa imbatível", "opcoes": ["Petit gâteau", "Torta de limão", "Brigadeiro de panela", "Cheesecake de frutas", "Sorvete artesanal", "Pudim de leite", "Banoffee", "Brownie quentinho"]}'),
  ('mata-mata', 'rotina', 'ambos', false, '{"titulo": "Ritual a distância favorito", "opcoes": ["Chamada antes de dormir", "Foto aleatória do dia", "Assistir série sincronizados", "Jogar no Longe & Perto", "Mandar áudio contando o dia", "Ouvir a mesma música", "Planejar o reencontro", "Escrever carta no cofre"]}'),
  ('mata-mata', 'serie', 'ambos', false, '{"titulo": "Próxima série para começar", "opcoes": ["Mistério curto (8 eps)", "Sitcom leve de 20 min", "Drama envolvente", "Minissérie criminal", "Fantasia épica", "Romance de época", "Reality de culinária", "Sci-fi distópico"]}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 5) Seed: leitura-labial (50 frases curtas)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Leve (15)
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Estou com muita saudade de você"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Precisamos pedir pizza hoje"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Não esqueci do nosso combinado"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "O café acabou aqui em casa"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Você fica lindo quando sorri"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Quero dormir de conchinha"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Vamos assistir um filme depois"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Já arrumei a mala inteira"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Hoje o dia foi uma correria"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Toma um copo de água agora"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Sonhei com a nossa viagem"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Acho que deixei a janela aberta"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Você é minha pessoa favorita"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Me conta uma novidade boa"}'),
  ('leitura-labial', 'leve', 'longe', false, '{"frase": "Quero um abraço bem demorado"}'),

  -- Absurdo (15)
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Um pombo roubou meu lanche"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Coloquei sal no café sem querer"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "O gato aprendeu a abrir a geladeira"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Esqueci onde estacionei a bicicleta"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Meu vizinho está cantando ópera"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Saí de casa com duas meias diferentes"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "O entregador trouxe sushi para o cachorro"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Tropecei no meu próprio chinelo"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Comi o último pedaço de bolo escondido"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "A planta da sala está me julgando"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Fui ao mercado e só comprei chocolate"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "O despertador tocou em pleno domingo"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Derrubei pipoca no teclado inteiro"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Acenei para alguém que não era comigo"}'),
  ('leitura-labial', 'absurdo', 'longe', false, '{"frase": "Falei com a geladeira esperando resposta"}'),

  -- Romântico (10)
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Conto os dias para te ver"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Seu abraço é o meu lugar"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Amo ouvir a sua risada"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Você melhora qualquer dia meu"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Quero viajar o mundo com você"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Pensei em você hoje cedo"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "A distância não muda o que sinto"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Mal posso esperar o próximo encontro"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Você tem o sorriso mais bonito"}'),
  ('leitura-labial', 'romantico', 'longe', false, '{"frase": "Obrigado por estar sempre comigo"}'),

  -- Ousado (10)
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Não estou pensando em dormir cedo"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Quando a gente se ver não te largo"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Você me deixa sem fôlego"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Quero um beijo no pescoço agora"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Essa camiseta fica melhor no chão"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Guardei uma surpresa para o reencontro"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Seu olhar hoje está perigoso"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Quero repetir aquela noite inteira"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "A chamada está ficando quente demais"}'),
  ('leitura-labial', 'ousado', 'longe', true, '{"frase": "Me deve uma massagem sem pressa"}')
on conflict (jogo_id, dados) do nothing;

------------------------------------------------------------------------------
-- 6) Seed: caca-ao-objeto (40 comandos)
------------------------------------------------------------------------------
insert into public.jogos_conteudo (jogo_id, categoria, modo, ousado, dados) values
  -- Ambos (20)
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Traga algo que lembra o outro"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "O objeto mais antigo do seu quarto"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo da cor azul que caiba na mão"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Um livro ou caderno importante para você"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "A caneca ou copo que você mais usa"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo que faz barulho"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Um objeto que tenha alguma história engraçada"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo muito macio ou confortável"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "O item mais aleatório da sua mochila ou bolsa"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo que tenha a cor vermelha"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Um presente que você guardou com carinho"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo que você usa todo dia antes de dormir"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Um objeto redondo que não seja comida"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo que cheire bem"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "A peça de roupa mais confortável que tiver por perto"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo transparente"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Um item de viagem ou lembrança de algum lugar"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo feito de madeira"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "O objeto mais pequeno que você achar em 10 segundos"}'),
  ('caca-ao-objeto', 'geral', 'ambos', false, '{"comando": "Algo que represente o seu hobby favorito"}'),

  -- Longe (12)
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Mostre na câmera algo que você compraria para nós dois"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Traga algo da cozinha para a gente adivinhar o que você vai comer"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Ache algo verde para mostrar na chamada"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Mostre o melhor lanche rápido que existe aí agora"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Pegue algo que você levaria na próxima viagem comigo"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Mostre uma foto impressa ou desenho que esteja por perto"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Traga um chapéu, boné ou óculos engraçado para usar na câmera"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Ache algo brilhante ou metálico"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Mostre a coisa mais útil da sua mesa"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Pegue um objeto e invente uma propaganda de 10 segundos na câmera"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Traga algo que comece com a primeira letra do nome do outro"}'),
  ('caca-ao-objeto', 'longe', 'longe', false, '{"comando": "Mostre a vista da janela mais próxima ou algo que esteja perto dela"}'),

  -- Juntos (8)
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Traga algo do cômodo ao lado sem o outro ver até revelar"}'),
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Ache dois objetos que formem um par improvável"}'),
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Pegue algo para montar um mini brinde agora"}'),
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Traga um objeto que você acha que o outro escolheria"}'),
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Ache algo amarelo pela casa"}'),
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Pegue um objeto para usar de microfone numa declaração"}'),
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Traga algo que dê para equilibrar na cabeça por 5 segundos"}'),
  ('caca-ao-objeto', 'juntos', 'juntos', false, '{"comando": "Ache algo escondido numa gaveta que ninguém lembra que existe"}')
on conflict (jogo_id, dados) do nothing;
