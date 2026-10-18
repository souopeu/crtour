-- Why an activity exists. Shown to the seller so a reminder never reads as a bare task.
alter table public.atividades
  add column motivo text check (motivo is null or char_length(btrim(motivo)) between 1 and 200);
