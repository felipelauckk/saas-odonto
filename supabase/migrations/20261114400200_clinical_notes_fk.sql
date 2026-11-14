-- Complemento → evolução original: NO ACTION (checado no fim do comando).
-- A proteção é a mesma (o app nem tem permissão de DELETE), mas permite que
-- uma limpeza administrativa apague original e complementos juntos.
alter table public.clinical_notes drop constraint clinical_notes_complements_note_id_fkey;
alter table public.clinical_notes
  add constraint clinical_notes_complements_note_id_fkey
  foreign key (complements_note_id) references public.clinical_notes (id) on delete no action;
