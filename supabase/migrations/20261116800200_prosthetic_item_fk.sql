-- Etapa 20: liga a ordem protética ao item do orçamento (faltou a chave estrangeira).
alter table public.prosthetic_orders
  add constraint prosthetic_orders_plan_item_fk foreign key (plan_item_id) references public.treatment_items (id) on delete set null;
