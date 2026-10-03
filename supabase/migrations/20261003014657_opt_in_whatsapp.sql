-- Consentimento (opt-in) do cliente para receber atualizações do pedido pelo WhatsApp.
-- Sem autorização, a mensagem não vai para o cliente (LGPD e políticas do WhatsApp).

alter table public.clientes
  add column notificar_whatsapp boolean not null default false;

comment on column public.clientes.notificar_whatsapp is 'Cliente autorizou receber atualizações do pedido pelo WhatsApp (opt-in)';

-- Coluna nova no final da view: o n8n decide o envio direto por ela
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
  c.notificar_whatsapp as cliente_notificar_whatsapp
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.tecnicos t on t.id = p.tecnico_id;
