-- Itens do pedido em lista estruturada (quantidade, produto, subtotal) para as mensagens do n8n.
-- Coluna nova no final: create or replace view só aceita colunas novas depois das existentes.

create or replace view public.vw_pedidos with (security_invoker = true) as
select
  p.*,
  c.nome     as cliente_nome,
  c.telefone as cliente_telefone,
  c.email    as cliente_email,
  c.endereco as cliente_endereco,
  t.nome     as tecnico_nome,
  t.telefone as tecnico_telefone,
  (select string_agg(i.quantidade || '× ' || pr.nome, ', ' order by pr.nome)
     from public.itens_pedido i
     join public.produtos pr on pr.id = i.produto_id
    where i.pedido_id = p.id) as itens_resumo,
  c.notificar_whatsapp as cliente_notificar_whatsapp,
  (select jsonb_agg(jsonb_build_object('quantidade', i.quantidade, 'produto', pr.nome, 'subtotal', i.subtotal)
                    order by pr.nome)
     from public.itens_pedido i
     join public.produtos pr on pr.id = i.produto_id
    where i.pedido_id = p.id) as itens
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.tecnicos t on t.id = p.tecnico_id;
