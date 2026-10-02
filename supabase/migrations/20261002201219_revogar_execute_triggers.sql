-- Funções de trigger não devem ser chamáveis via /rest/v1/rpc.
-- Triggers continuam disparando normalmente (o Postgres não checa EXECUTE ao disparar).

revoke execute on function public.pedidos_before_insert()         from public, anon, authenticated;
revoke execute on function public.pedidos_before_update()         from public, anon, authenticated;
revoke execute on function public.pedidos_registrar_historico()   from public, anon, authenticated;
revoke execute on function public.itens_pedido_before()           from public, anon, authenticated;
revoke execute on function public.itens_pedido_recalcular_total() from public, anon, authenticated;
revoke execute on function public.set_updated_at()                from public, anon, authenticated;
