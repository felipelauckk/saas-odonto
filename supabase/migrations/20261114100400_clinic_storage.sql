-- Etapa 3: bucket privado de arquivos da clínica e regras da pasta de logo.
-- Caminho: {clinic_id}/logo/{arquivo}. Arquivos clínicos ({clinic_id}/patients/...)
-- ganham políticas próprias na Etapa 6.

insert into storage.buckets (id, name, public, file_size_limit)
values ('clinic', 'clinic', false, 20 * 1024 * 1024)
on conflict (id) do nothing;

create policy "membro lê o logo da clínica ativa"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'logo'
  );

create policy "owner e manager enviam o logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'logo'
    and (select public.has_role('owner', 'manager'))
  );

create policy "owner e manager trocam o logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'logo'
    and (select public.has_role('owner', 'manager'))
  );

create policy "owner e manager removem o logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'logo'
    and (select public.has_role('owner', 'manager'))
  );
