-- Etapa 19: quem opera o financeiro marca/desmarca "em negociação" (pausa a
-- régua). É a única coluna de recebíveis que o app atualiza direto; o resto
-- muda só pelas funções (baixa, estorno, cancelamento).
create policy "recebíveis: quem opera marca negociação" on public.receivables for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()) and public.can_access_unit(unit_id))
  with check (clinic_id = (select public.current_clinic_id()));
