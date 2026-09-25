-- Longe & Perto v4 — novos tipos de carta (efeito, duelo, sintonia, missões).
-- Rode ANTES do 007_seed_v4.sql. Pode rodar de novo.

alter table public.cartas add column if not exists rodadas  int;
alter table public.cartas add column if not exists segundos int;

-- Remove as checks antigas que mencionam tipo, rodadas ou segundos (os nomes podem variar)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cartas'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%tipo%'
        or pg_get_constraintdef(oid) ilike '%rodadas%'
        or pg_get_constraintdef(oid) ilike '%segundos%')
  loop
    execute format('alter table public.cartas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.cartas
  add constraint cartas_tipo_check
    check (tipo in ('verdade','desafio','prenda','efeito','duelo','sintonia','missao_dupla','missao_secreta')),
  add constraint cartas_rodadas_check
    check (rodadas is null or rodadas between 1 and 5),
  add constraint cartas_segundos_check
    check (segundos is null or segundos between 5 and 600),
  add constraint cartas_efeito_tem_rodadas
    check (tipo <> 'efeito' or rodadas is not null);

-- Conferência: deve listar as 4 constraints novas
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.cartas'::regclass and contype = 'c'
order by conname;
