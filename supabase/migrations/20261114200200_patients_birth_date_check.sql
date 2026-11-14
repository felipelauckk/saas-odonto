-- CHECK não deve depender de current_date (não é imutável e pode falhar ao
-- restaurar um backup). "Data no futuro" é validada no app.
alter table public.patients drop constraint patients_birth_date_check;
alter table public.patients add constraint patients_birth_date_check check (birth_date >= '1900-01-01');
