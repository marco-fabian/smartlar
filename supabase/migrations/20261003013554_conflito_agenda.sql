-- Impede agendar o mesmo técnico em duas instalações que se sobrepõem no tempo.
-- Para isso cada instalação passa a ter uma duração estimada (padrão: 2 horas).

alter table public.pedidos
  add column duracao_minutos integer not null default 120
  check (duracao_minutos between 30 and 480);

comment on column public.pedidos.duracao_minutos is 'Duração estimada da instalação, usada para evitar conflito na agenda do técnico';

-- Intervalos semiabertos [início, fim): uma instalação pode começar exatamente quando a outra termina.
create function public.pedidos_validar_agenda()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_conflito record;
begin
  if new.status not in ('agendado', 'em_andamento') or new.tecnico_id is null or new.data_instalacao is null then
    return new;
  end if;

  select p.numero, p.data_instalacao, p.duracao_minutos, t.nome as tecnico
    into v_conflito
    from public.pedidos p
    join public.tecnicos t on t.id = p.tecnico_id
   where p.tecnico_id = new.tecnico_id
     and p.id <> new.id
     and p.status in ('agendado', 'em_andamento')
     and p.data_instalacao < new.data_instalacao + make_interval(mins => new.duracao_minutos)
     and new.data_instalacao < p.data_instalacao + make_interval(mins => p.duracao_minutos)
   order by p.data_instalacao
   limit 1;

  if found then
    raise exception 'Conflito de agenda: % já tem a instalação #% de % até %',
      v_conflito.tecnico,
      v_conflito.numero,
      to_char(v_conflito.data_instalacao at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      to_char((v_conflito.data_instalacao + make_interval(mins => v_conflito.duracao_minutos))
              at time zone 'America/Sao_Paulo', 'HH24:MI')
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.pedidos_validar_agenda() from public, anon, authenticated;

create trigger pedidos_validar_agenda
  before insert or update of status, tecnico_id, data_instalacao, duracao_minutos on public.pedidos
  for each row execute function public.pedidos_validar_agenda();

-- A view usa p.*: com a coluna nova ela precisa ser recriada (create or replace não muda a ordem das colunas)
drop view public.vw_pedidos;

create view public.vw_pedidos with (security_invoker = true) as
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
    where i.pedido_id = p.id) as itens_resumo
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.tecnicos t on t.id = p.tecnico_id;
