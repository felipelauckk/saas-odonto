-- A trava de itens não deve impedir apagar o orçamento inteiro (cascade):
-- nesse caso o orçamento já não existe quando o gatilho do item roda.
create or replace function public.guard_treatment_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _status public.treatment_plan_status;
begin
  select status into _status from public.treatment_plans where id = coalesce(new.plan_id, old.plan_id);
  if _status is null or _status in ('draft', 'presented') then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE'
     and new.price_cents = old.price_cents
     and new.tooth is not distinct from old.tooth
     and new.faces = old.faces
     and new.description = old.description then
    return new;
  end if;
  raise exception 'Orçamento já aprovado ou fechado: os itens não podem ser alterados.' using errcode = 'OT001';
end;
$$;
