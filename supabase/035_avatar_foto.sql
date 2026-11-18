-- Longe & Perto — Foto no avatar (guardada na tabela manuais, junto com a cor do avatar).
-- Pode rodar de novo.

alter table public.manuais add column if not exists avatar_foto text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'manuais_avatar_foto_check') then
    alter table public.manuais add constraint manuais_avatar_foto_check
      check (avatar_foto is null or length(avatar_foto) <= 60000);
  end if;
end $$;

select 'ok' as avatar_foto;
