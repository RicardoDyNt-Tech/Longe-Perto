-- Longe & Perto — Guia de posições (texto, sem imagens).
-- Pode rodar de novo.

create table if not exists public.posicoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique check (char_length(btrim(nome)) between 2 and 60),
  descricao   text not null check (char_length(btrim(descricao)) between 10 and 300),
  dificuldade text not null check (dificuldade in ('facil','media','dificil')),
  clima       text not null check (clima in ('romantica','intensa','aventura')),
  nivel       text not null check (nivel in ('picante','pesado')),
  ativa       boolean not null default true,
  criada_em   timestamptz not null default now()
);

-- Marcas do casal por sala: favorita, queremos testar, já fizemos
create table if not exists public.posicoes_marcadas (
  sala       text not null references public.salas(codigo) on delete cascade,
  posicao_id uuid not null references public.posicoes(id) on delete cascade,
  marca      text not null check (marca in ('favorita','testar','feita')),
  link       text check (link is null or link ~ '^https://'),  -- referência externa opcional, escolhida pelo casal
  criada_em  timestamptz not null default now(),
  primary key (sala, posicao_id, marca)
);

alter table public.posicoes enable row level security;
drop policy if exists "ler" on public.posicoes;
create policy "ler" on public.posicoes for select to anon, authenticated using (true);
-- sem insert/update/delete pelo app: o guia só muda pelo SQL Editor

alter table public.posicoes_marcadas enable row level security;
drop policy if exists "ler" on public.posicoes_marcadas;
create policy "ler" on public.posicoes_marcadas for select to anon, authenticated using (true);
drop policy if exists "criar" on public.posicoes_marcadas;
create policy "criar" on public.posicoes_marcadas for insert to anon, authenticated
  with check (exists (select 1 from public.salas s where s.codigo = sala));
drop policy if exists "alterar" on public.posicoes_marcadas;
create policy "alterar" on public.posicoes_marcadas for update to anon, authenticated using (true) with check (true);
drop policy if exists "apagar" on public.posicoes_marcadas;
create policy "apagar" on public.posicoes_marcadas for delete to anon, authenticated using (true);

do $$
begin
  execute 'alter table public.posicoes_marcadas replica identity full';
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posicoes_marcadas') then
    alter publication supabase_realtime add table public.posicoes_marcadas;
  end if;
end $$;

insert into public.posicoes (nome, descricao, dificuldade, clima, nivel) values
  ('Papai e mamãe', 'Um deitado de costas, o outro por cima, de frente. Dá para se beijar e se olhar o tempo todo.', 'facil', 'romantica', 'picante'),
  ('Conchinha', 'Os dois deitados de lado, um atrás do outro, bem encaixados. Calma e muito próxima.', 'facil', 'romantica', 'picante'),
  ('Lótus', 'Um sentado de pernas cruzadas, o outro sentado no colo, de frente, abraçados. Movimento lento e muito contato.', 'media', 'romantica', 'picante'),
  ('Sentado na beira da cama', 'Um sentado na beira da cama, o outro no colo, de frente. Parecida com a lótus, mais fácil de manter.', 'facil', 'romantica', 'picante'),
  ('Na cadeira', 'Um sentado numa cadeira firme, o outro no colo, de frente ou de costas.', 'facil', 'intensa', 'picante'),
  ('Cavalgada', 'Um deitado de costas, o outro por cima, sentado de frente e controlando o ritmo.', 'facil', 'intensa', 'picante'),
  ('Cavalgada invertida', 'Igual à cavalgada, mas quem está por cima fica de costas para o outro.', 'media', 'intensa', 'pesado'),
  ('Amazona', 'Quem está por cima fica de cócoras em vez de ajoelhado, com mais controle e mais esforço nas pernas.', 'media', 'intensa', 'pesado'),
  ('De quatro', 'Um apoiado nas mãos e nos joelhos, o outro ajoelhado por trás.', 'facil', 'intensa', 'pesado'),
  ('De bruços', 'Um deitado de bruços, com um travesseiro sob o quadril; o outro deitado por cima, por trás.', 'facil', 'intensa', 'pesado'),
  ('Pernas no ombro', 'Um deitado de costas, com as pernas apoiadas nos ombros do outro, que fica ajoelhado de frente.', 'media', 'intensa', 'pesado'),
  ('Borda da cama', 'Um deitado de costas com o quadril na borda da cama; o outro de pé, de frente.', 'facil', 'intensa', 'pesado'),
  ('Borboleta', 'Como a borda da cama, com as pernas de quem está deitado apoiadas no peito ou nos ombros de quem está de pé.', 'media', 'intensa', 'pesado'),
  ('Tesoura', 'Os dois deitados, com as pernas entrelaçadas em forma de X.', 'media', 'aventura', 'pesado'),
  ('Em pé na parede', 'Os dois em pé, um encostado na parede, de frente ou de costas.', 'dificil', 'aventura', 'pesado'),
  ('No chuveiro', 'Em pé no banho, um apoiado na parede. Cuidado com o chão escorregadio.', 'dificil', 'aventura', 'pesado'),
  ('Carrinho de mão', 'Um apoiado com as mãos no chão; o outro de pé, segurando as pernas dele pela cintura.', 'dificil', 'aventura', 'pesado'),
  ('69', 'Os dois deitados em sentidos opostos, para carícias orais ao mesmo tempo.', 'media', 'intensa', 'pesado')
on conflict (nome) do nothing;

select nivel, dificuldade, count(*) from public.posicoes group by 1, 2 order by 1, 2;
