-- SmartLar — schema inicial
-- Regras de negócio ficam no banco (triggers/constraints), não só no front:
-- qualquer cliente (front, n8n, SQL editor) passa pelas mesmas validações.

-- =========================================================================
-- Tipos
-- =========================================================================

create type public.pedido_status as enum (
  'orcamento', 'aprovado', 'agendado', 'em_andamento', 'concluido', 'cancelado'
);

create type public.forma_pagamento as enum (
  'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'dinheiro'
);

-- =========================================================================
-- Tabelas
-- =========================================================================

create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) > 0),
  telefone    text not null unique check (telefone ~ '^55[0-9]{10,11}$'),
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  endereco    text not null check (length(trim(endereco)) > 0),
  observacoes text,
  created_at  timestamptz not null default now()
);

comment on column public.clientes.telefone is 'Só dígitos, com DDI 55 (formato WhatsApp). Ex: 5511987654321';
comment on column public.clientes.endereco is 'Endereço onde será feita a instalação';

create table public.tecnicos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text not null check (telefone ~ '^55[0-9]{10,11}$'),
  especialidade text not null,
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.produtos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  categoria      text not null check (categoria in ('seguranca', 'iluminacao', 'automacao')),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  descricao      text,
  ativo          boolean not null default true,  -- desativar em vez de apagar: pedidos antigos referenciam o produto
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Fluxo de status como dado: o trigger valida contra esta tabela e o front
-- consulta daqui quais são os próximos status possíveis.
create table public.status_transicoes (
  de   public.pedido_status not null,
  para public.pedido_status not null,
  primary key (de, para)
);

insert into public.status_transicoes (de, para) values
  ('orcamento',    'aprovado'),
  ('aprovado',     'agendado'),
  ('agendado',     'em_andamento'),
  ('em_andamento', 'concluido'),
  ('orcamento',    'cancelado'),
  ('aprovado',     'cancelado');

create table public.pedidos (
  id              uuid primary key default gen_random_uuid(),
  numero          integer generated always as identity unique,  -- "Pedido #12" pro Rafael, em vez de UUID
  cliente_id      uuid not null references public.clientes(id) on delete restrict,
  tecnico_id      uuid references public.tecnicos(id) on delete restrict,
  status          public.pedido_status not null default 'orcamento',
  data_instalacao timestamptz,                                  -- data + horário (Automação 2 precisa do horário)
  valor_total     numeric(12,2) not null default 0 check (valor_total >= 0),
  forma_pagamento public.forma_pagamento,
  observacoes     text,
  concluido_em    timestamptz,                                  -- base do "faturado no mês"
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint pedidos_pagamento_definido check (
    status not in ('aprovado', 'agendado', 'em_andamento', 'concluido')
    or forma_pagamento is not null
  ),
  constraint pedidos_agendamento_completo check (
    status not in ('agendado', 'em_andamento', 'concluido')
    or (tecnico_id is not null and data_instalacao is not null)
  )
);

comment on column public.pedidos.valor_total is 'Calculado pelo banco (soma dos subtotais). Não aceita escrita direta.';

create index pedidos_cliente_id_idx on public.pedidos (cliente_id);
create index pedidos_tecnico_id_idx on public.pedidos (tecnico_id);
create index pedidos_status_idx on public.pedidos (status);
create index pedidos_data_instalacao_idx on public.pedidos (data_instalacao);

create table public.itens_pedido (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos(id) on delete cascade,
  produto_id     uuid not null references public.produtos(id) on delete restrict,
  quantidade     integer not null check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),  -- preço congelado no momento do pedido
  subtotal       numeric(12,2) generated always as (quantidade * preco_unitario) stored,
  created_at     timestamptz not null default now(),
  unique (pedido_id, produto_id)
);

create index itens_pedido_produto_id_idx on public.itens_pedido (produto_id);

create table public.historico_status (
  id              bigint generated always as identity primary key,
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  status_anterior public.pedido_status,
  status_novo     public.pedido_status not null,
  alterado_por    uuid default auth.uid(),
  alterado_em     timestamptz not null default now()
);

create index historico_status_pedido_id_idx on public.historico_status (pedido_id);

-- =========================================================================
-- Triggers — pedidos
-- =========================================================================

-- Todo pedido nasce como orçamento e com total zero (o total vem dos itens).
create function public.pedidos_before_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> 'orcamento' then
    raise exception 'Pedido novo deve começar como orcamento (recebido: %)', new.status
      using errcode = 'check_violation';
  end if;
  new.valor_total := 0;
  return new;
end;
$$;

create trigger pedidos_before_insert
  before insert on public.pedidos
  for each row execute function public.pedidos_before_insert();

create function public.pedidos_before_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();

  -- valor_total só muda pelo recálculo disparado pelos itens (trigger aninhado, depth > 1)
  if new.valor_total is distinct from old.valor_total and pg_trigger_depth() = 1 then
    raise exception 'valor_total é calculado a partir dos itens e não pode ser alterado diretamente'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    if not exists (
      select 1 from public.status_transicoes t
      where t.de = old.status and t.para = new.status
    ) then
      raise exception 'Transição de status inválida: % → %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.status = 'concluido' then
      new.concluido_em := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger pedidos_before_update
  before update on public.pedidos
  for each row execute function public.pedidos_before_update();

-- security definer: usuários leem o histórico, mas só o trigger escreve nele.
create function public.pedidos_registrar_historico()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historico_status (pedido_id, status_anterior, status_novo, alterado_por)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.historico_status (pedido_id, status_anterior, status_novo, alterado_por)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end;
$$;

create trigger pedidos_registrar_historico
  after insert or update of status on public.pedidos
  for each row execute function public.pedidos_registrar_historico();

-- =========================================================================
-- Triggers — itens_pedido
-- =========================================================================

-- Itens só mudam enquanto o pedido é orçamento; preço é copiado do catálogo.
create function public.itens_pedido_before()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_pedido_id uuid;
  v_status    public.pedido_status;
  v_ativo     boolean;
begin
  if tg_op = 'DELETE' then
    v_pedido_id := old.pedido_id;
  else
    v_pedido_id := new.pedido_id;
  end if;

  select status into v_status from public.pedidos where id = v_pedido_id;

  -- v_status nulo = pedido sendo apagado (cascade): deixa passar
  if v_status is not null and v_status <> 'orcamento' then
    raise exception 'Itens só podem ser alterados enquanto o pedido é orçamento (status atual: %)', v_status
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'INSERT' then
    select preco_unitario, ativo into new.preco_unitario, v_ativo
    from public.produtos where id = new.produto_id;

    if v_ativo is false then
      raise exception 'Produto inativo não pode ser adicionado a pedidos' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger itens_pedido_before
  before insert or update or delete on public.itens_pedido
  for each row execute function public.itens_pedido_before();

create function public.itens_pedido_recalcular_total()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_pedido_id uuid;
begin
  if tg_op = 'DELETE' then
    v_pedido_id := old.pedido_id;
  else
    v_pedido_id := new.pedido_id;
  end if;

  update public.pedidos p
     set valor_total = coalesce(
       (select sum(i.subtotal) from public.itens_pedido i where i.pedido_id = v_pedido_id), 0)
   where p.id = v_pedido_id;

  return null;
end;
$$;

create trigger itens_pedido_recalcular_total
  after insert or update or delete on public.itens_pedido
  for each row execute function public.itens_pedido_recalcular_total();

-- =========================================================================
-- Triggers — produtos
-- =========================================================================

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger produtos_set_updated_at
  before update on public.produtos
  for each row execute function public.set_updated_at();

-- =========================================================================
-- View e funções (RPC) usadas pelo front e pelo n8n
-- =========================================================================

create view public.vw_pedidos with (security_invoker = true) as
select
  p.*,
  c.nome     as cliente_nome,
  c.telefone as cliente_telefone,
  c.email    as cliente_email,
  c.endereco as cliente_endereco,
  t.nome     as tecnico_nome,
  t.telefone as tecnico_telefone
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
left join public.tecnicos t on t.id = p.tecnico_id;

-- Cria pedido + itens numa transação só: não fica orçamento vazio se um item falhar.
-- p_itens: [{"produto_id": "...", "quantidade": 2}, ...]
create function public.criar_pedido(p_cliente_id uuid, p_itens jsonb, p_observacoes text default null)
returns public.pedidos language plpgsql set search_path = '' as $$
declare
  v_pedido public.pedidos;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido precisa ter pelo menos um item' using errcode = 'check_violation';
  end if;

  insert into public.pedidos (cliente_id, observacoes)
  values (p_cliente_id, nullif(trim(p_observacoes), ''))
  returning * into v_pedido;

  insert into public.itens_pedido (pedido_id, produto_id, quantidade)
  select v_pedido.id, (i->>'produto_id')::uuid, (i->>'quantidade')::int
  from jsonb_array_elements(p_itens) i;

  select * into v_pedido from public.pedidos where id = v_pedido.id;
  return v_pedido;
end;
$$;

-- Indicadores do dashboard, com "mês" no fuso de São Paulo (o banco guarda em UTC).
create function public.dashboard_indicadores()
returns json language sql stable set search_path = '' as $$
  with mes as (
    select date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as inicio
  )
  select json_build_object(
    'pedidos_mes',           (select count(*) from public.pedidos p, mes where p.created_at >= mes.inicio),
    'faturado_mes',          (select coalesce(sum(p.valor_total), 0) from public.pedidos p, mes
                               where p.status = 'concluido' and p.concluido_em >= mes.inicio),
    'a_receber',             (select coalesce(sum(p.valor_total), 0) from public.pedidos p
                               where p.status in ('aprovado', 'agendado', 'em_andamento')),
    'pendentes_agendamento', (select count(*) from public.pedidos p where p.status = 'aprovado')
  );
$$;

revoke execute on function public.criar_pedido(uuid, jsonb, text) from public, anon;
revoke execute on function public.dashboard_indicadores() from public, anon;
grant execute on function public.criar_pedido(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.dashboard_indicadores() to authenticated, service_role;

-- =========================================================================
-- RLS — sistema interno de um usuário só (Rafael): logado acessa tudo,
-- anônimo não acessa nada. O n8n usa a service_role (ignora RLS).
-- =========================================================================

alter table public.clientes          enable row level security;
alter table public.tecnicos          enable row level security;
alter table public.produtos          enable row level security;
alter table public.status_transicoes enable row level security;
alter table public.pedidos           enable row level security;
alter table public.itens_pedido      enable row level security;
alter table public.historico_status  enable row level security;

create policy "autenticado gerencia clientes" on public.clientes
  for all to authenticated using (true) with check (true);
create policy "autenticado gerencia tecnicos" on public.tecnicos
  for all to authenticated using (true) with check (true);
create policy "autenticado gerencia produtos" on public.produtos
  for all to authenticated using (true) with check (true);
create policy "autenticado gerencia pedidos" on public.pedidos
  for all to authenticated using (true) with check (true);
create policy "autenticado gerencia itens" on public.itens_pedido
  for all to authenticated using (true) with check (true);
create policy "autenticado le transicoes" on public.status_transicoes
  for select to authenticated using (true);
create policy "autenticado le historico" on public.historico_status
  for select to authenticated using (true);
