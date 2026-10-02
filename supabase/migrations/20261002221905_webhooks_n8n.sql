-- Eventos de pedidos enviados para o n8n.
-- URLs e segredo ficam no Supabase Vault, não no código:
--   n8n_webhook_novo_pedido       URL do webhook "Novo pedido"
--   n8n_webhook_pedido_concluido  URL do webhook "Faturamento"
--   n8n_webhook_secret            valor do header X-Webhook-Secret
-- Sem o segredo cadastrado (ex: ambiente local), nada é enviado.
--
-- O pg_net só dispara a requisição depois do COMMIT, então o n8n já encontra
-- o pedido completo (itens e valor_total) quando consulta o banco.

create extension if not exists pg_net with schema extensions;

create function public.notificar_n8n()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_url     text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = tg_argv[0];
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  -- O seed marca a sessão com app.seed = on para não disparar notificações
  if v_url is null or v_segredo is null or current_setting('app.seed', true) = 'on' then
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
      'type',       tg_op,
      'table',      tg_table_name,
      'record',     to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Secret', v_segredo),
    timeout_milliseconds := 5000
  );

  return null;
end;
$$;

revoke execute on function public.notificar_n8n() from public, anon, authenticated;

create trigger pedidos_notificar_novo
  after insert on public.pedidos
  for each row execute function public.notificar_n8n('n8n_webhook_novo_pedido');

-- Só a transição para "concluido" interessa ao faturamento
create trigger pedidos_notificar_concluido
  after update of status on public.pedidos
  for each row
  when (new.status = 'concluido' and old.status is distinct from 'concluido')
  execute function public.notificar_n8n('n8n_webhook_pedido_concluido');
