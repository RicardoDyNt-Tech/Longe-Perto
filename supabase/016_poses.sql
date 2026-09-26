-- Longe & Perto — Guia de poses para fotos e vídeos (texto, sem imagens).
-- Pode rodar de novo.

create table if not exists public.poses (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique check (char_length(btrim(nome)) between 2 and 60),
  como         text not null check (char_length(btrim(como)) between 10 and 300),
  tipo         text not null check (tipo in ('foto','video')),
  nivel        text not null check (nivel in ('leve','picante','pesado')),
  enquadramento text not null check (enquadramento in ('close','meio','inteiro','espelho','silhueta')),
  icone        text check (icone is null or icone ~ '^[a-z0-9-]+\.(svg|png)$'),
  ativa        boolean not null default true,
  criada_em    timestamptz not null default now()
);

alter table public.poses enable row level security;
drop policy if exists "ler" on public.poses;
create policy "ler" on public.poses for select to anon, authenticated using (true);
-- sem escrita pelo app: o guia só muda pelo SQL Editor

insert into public.poses (nome, como, tipo, nivel, enquadramento) values
  ('Selfie de cima', 'Segure o celular acima da cabeça, incline um pouco o rosto e olhe para a câmera.', 'foto', 'leve', 'close'),
  ('Luz da janela', 'Fique de lado para a janela, com a luz batendo no rosto, olhando para fora.', 'foto', 'leve', 'meio'),
  ('Café na cama', 'Sentado(a) na cama com uma caneca, enquadrando do peito para cima.', 'foto', 'leve', 'meio'),
  ('Look no espelho', 'Corpo inteiro no espelho, com o celular na altura do peito.', 'foto', 'leve', 'espelho'),
  ('De bruços nos cotovelos', 'Deitado(a) de bruços na cama, apoiado(a) nos cotovelos, câmera na altura dos olhos.', 'foto', 'leve', 'meio'),
  ('Meio escondido', 'Close com parte do rosto coberta pelo lençol ou pela mão.', 'foto', 'leve', 'close'),
  ('Por cima do ombro', 'De costas para a câmera, vire só o rosto por cima do ombro.', 'foto', 'picante', 'meio'),
  ('Alça caída', 'Close do ombro e do colo, com uma alça escorregando.', 'foto', 'picante', 'close'),
  ('Enrolado(a) no lençol', 'Deitado(a) de lado, com o lençol preso na altura do peito.', 'foto', 'picante', 'meio'),
  ('Espelho de costas', 'De costas para o espelho, em roupa íntima, olhando o reflexo por cima do ombro.', 'foto', 'picante', 'espelho'),
  ('Beira da cama', 'Sentado(a) na beira da cama, pernas cruzadas, câmera um pouco abaixo dos olhos.', 'foto', 'picante', 'inteiro'),
  ('Mordida no lábio', 'Close da boca mordendo o lábio, com luz vindo de um lado só.', 'foto', 'picante', 'close'),
  ('Cabelo no travesseiro', 'Deitado(a) de costas, câmera de cima, cabelo espalhado no travesseiro.', 'foto', 'picante', 'meio'),
  ('Camisa aberta', 'Só com uma camisa grande desabotoada, do quadril para cima.', 'foto', 'picante', 'meio'),
  ('Silhueta', 'De pé contra a janela ou uma luz forte, deixando o corpo só em contorno.', 'foto', 'picante', 'inteiro'),
  ('Pernas na parede', 'Deitado(a), com as pernas para cima apoiadas na parede; foto só das pernas.', 'foto', 'picante', 'close'),
  ('Nude de costas no espelho', 'Corpo inteiro de costas no espelho, sem roupa, com o rosto fora do quadro.', 'foto', 'pesado', 'espelho'),
  ('De bruços sem roupa', 'De bruços na cama, câmera na altura do quadril, luz baixa.', 'foto', 'pesado', 'meio'),
  ('De lado, braço cobrindo', 'Deitado(a) de lado, sem roupa, com o braço cobrindo parte do corpo.', 'foto', 'pesado', 'inteiro'),
  ('Abraçando os joelhos', 'Sentado(a) sem a parte de cima, abraçando os joelhos.', 'foto', 'pesado', 'meio'),
  ('Detalhe com luz lateral', 'Close de clavícula, cintura ou quadril, com a luz vindo de um lado só.', 'foto', 'pesado', 'close'),
  ('Lençol estratégico', 'Sem roupa, com o lençol cobrindo só uma parte — você escolhe qual.', 'foto', 'pesado', 'inteiro'),
  ('De quatro na cama', 'De quatro na cama, câmera de lado, rosto fora do quadro.', 'foto', 'pesado', 'inteiro'),
  ('Box embaçado', 'No chuveiro, atrás do vidro embaçado, deixando só a silhueta.', 'foto', 'pesado', 'silhueta'),
  ('Caminhando até a câmera', 'Câmera parada na cômoda; caminhe devagar na direção dela por 5 segundos.', 'video', 'picante', 'inteiro'),
  ('Mão no cabelo', 'Passe a mão pelo cabelo e desça pelo pescoço, em câmera lenta.', 'video', 'picante', 'close'),
  ('Giro no espelho', 'Gire devagar uma volta inteira na frente do espelho.', 'video', 'picante', 'espelho'),
  ('Tirando uma peça', 'Câmera fixa; tire uma peça devagar, sem mostrar o rosto.', 'video', 'pesado', 'meio'),
  ('Mão pelo corpo', 'Deitado(a), câmera de cima; passe a mão pelo corpo devagar por 5 segundos.', 'video', 'pesado', 'meio'),
  ('Chuveiro', 'Câmera apoiada fora do box; silhueta atrás do vidro, com a água caindo.', 'video', 'pesado', 'silhueta')
on conflict (nome) do nothing;

select tipo, nivel, count(*) from public.poses group by 1, 2 order by 1, 2;
