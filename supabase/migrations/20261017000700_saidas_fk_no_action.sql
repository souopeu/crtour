-- RESTRICT is checked immediately, which broke "delete account" (the cascade removes tours and
-- departures in the same statement). NO ACTION is checked at the end of the statement: deleting a
-- tour that still has departures is still refused, but a cascade that removes both sides works.
alter table public.saidas drop constraint saidas_passeio_id_agencia_id_fkey;
alter table public.saidas
  add constraint saidas_passeio_id_agencia_id_fkey
  foreign key (passeio_id, agencia_id) references public.passeios (id, agencia_id);
