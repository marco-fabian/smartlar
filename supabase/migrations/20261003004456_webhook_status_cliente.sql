-- Avisa o cliente no WhatsApp a cada etapa do pedido (resolve "clientes ligam perguntando status").
-- URL no Vault: n8n_webhook_status_pedido

create trigger pedidos_notificar_status
  after update of status on public.pedidos
  for each row
  when (new.status in ('aprovado', 'agendado', 'em_andamento', 'concluido')
        and old.status is distinct from new.status)
  execute function public.notificar_n8n('n8n_webhook_status_pedido');
