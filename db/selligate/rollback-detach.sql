-- Disable and detach only. Preserve dispatch history and all store data.
UPDATE selligate.settings SET mode='OFF',stopped=true,generation=generation+1,updated_at=now(),updated_by='migration-rollback' WHERE id=1;
UPDATE selligate.jobs SET status='CANCELLED',reason='ROLLBACK_DETACHED',updated_at=now() WHERE status IN('QUEUED','CLAIMED');
DROP TRIGGER IF EXISTS selligate_order_placed ON public.orders;
