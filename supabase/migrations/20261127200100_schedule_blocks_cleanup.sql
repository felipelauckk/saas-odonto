-- Fase 3, P2 (limpeza): schedule_blocks.reason sai. O nome do compromisso está
-- em title (copiado na migration 20261127100100) e o código não lê nem grava
-- mais reason. Aplicada depois que o código novo estiver no ar.

-- Garantia: bloqueio criado pelo código antigo no intervalo ganha o nome.
update public.schedule_blocks
   set title = left(trim(reason), 120)
 where title = 'Bloqueio' and nullif(trim(reason), '') is not null;

alter table public.schedule_blocks drop column reason;
