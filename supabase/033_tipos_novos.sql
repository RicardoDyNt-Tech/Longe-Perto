-- Longe & Perto — Investigação: tipos novos de caso (Folclore e Futuro) e o selo do caso.
-- Rode DEPOIS do 030 e do 031, e ANTES do 034_casos_novos.sql. Pode rodar de novo.

-- 1. Libera os tipos novos na tabela de casos.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.casos'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%tema%'
  loop
    execute format('alter table public.casos drop constraint %I', c);
  end loop;
  alter table public.casos add constraint casos_tema_check
    check (tema in ('policial', 'misterio', 'sombrio', 'fantasia', 'folclore', 'futuro'));
end $$;

-- 2. Selo: uma marca extra que a prateleira mostra no cartão do caso.
--    'lenda'     = folclore em que a lenda é um disfarce (tudo tem explicação)
--    'criaturas' = folclore em que as criaturas existem, com regras fixas
--    'mundo'     = caso dos dias de hoje, fora do Brasil
--    vazio       = sem selo
alter table public.casos add column if not exists selo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'casos_selo_check') then
    alter table public.casos add constraint casos_selo_check
      check (selo is null or selo in ('lenda', 'criaturas', 'mundo'));
  end if;
end $$;

select 'ok' as tipos_novos;
