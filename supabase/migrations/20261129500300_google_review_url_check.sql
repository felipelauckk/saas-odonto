-- P10: a checagem do link de avaliação usava {8,400}, acima do limite de
-- repetição das expressões regulares do Postgres (255). Troca por tamanho + padrão.
alter table public.clinics drop constraint clinics_google_review_url_check;
alter table public.clinics add constraint clinics_google_review_url_check
  check (google_review_url ~ '^https://\S+$' and length(google_review_url) between 16 and 400);
