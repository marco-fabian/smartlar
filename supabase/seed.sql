-- SmartLar — dados de exemplo
-- Datas são relativas ao momento em que o seed roda ("amanhã", "daqui 4 dias"),
-- então rode de novo antes de uma demo pra Automação 2 e o dashboard terem dados.
-- ATENÇÃO: apaga todos os dados das tabelas antes de popular.

-- Não dispara os webhooks do n8n durante o seed
set app.seed = 'on';

truncate public.historico_status, public.itens_pedido, public.pedidos,
         public.produtos, public.tecnicos, public.clientes, public.eventos_n8n
  restart identity cascade;

-- Data/hora no fuso de São Paulo: pg_temp.dia(1, 14) = amanhã às 14h
create function pg_temp.dia(p_offset int, p_hora int default 9)
returns timestamptz language sql as $$
  select ((now() at time zone 'America/Sao_Paulo')::date + p_offset + make_interval(hours => p_hora))
         at time zone 'America/Sao_Paulo'
$$;

insert into public.tecnicos (nome, telefone, especialidade) values
  ('Lucas', '5511976540001', 'Câmeras e sensores'),
  ('Pedro', '5511976540002', 'Fechaduras e iluminação');

insert into public.produtos (nome, categoria, preco_unitario, descricao) values
  ('Câmera IP Wi-Fi',                   'seguranca',  450.00, 'Full HD, visão noturna, áudio bidirecional'),
  ('Sensor de presença',                'seguranca',  180.00, 'Infravermelho, alcance de 10 m, integra com alarme'),
  ('Sensor de abertura (porta/janela)', 'seguranca',   95.00, 'Magnético, notifica abertura no app'),
  ('Fechadura digital biométrica',      'seguranca',  890.00, 'Digital, senha, cartão e app'),
  ('Lâmpada inteligente RGB',           'iluminacao',  79.90, 'E27, 10 W, 16 milhões de cores'),
  ('Interruptor inteligente 3 teclas',  'iluminacao', 159.00, 'Touch, Wi-Fi, compatível com Alexa e Google'),
  ('Fita LED inteligente 5 m',          'iluminacao', 129.90, 'RGB, controle por app e voz'),
  ('Assistente de voz (Echo Dot)',      'automacao',  399.00, 'Central de comandos por voz'),
  ('Hub de automação Zigbee',           'automacao',  349.00, 'Centraliza sensores e cria rotinas'),
  ('Controlador de portão Wi-Fi',       'automacao',  289.00, 'Abre o portão eletrônico pelo app');

insert into public.clientes (nome, telefone, email, endereco, observacoes) values
  ('Ana Souza',      '5511987650001', 'ana.souza@email.com',    'Rua Harmonia, 120 - Vila Madalena, São Paulo/SP', null),
  ('Bruno Lima',     '5511987650002', 'bruno.lima@email.com',   'Av. Rebouças, 1500, ap 82 - Pinheiros, São Paulo/SP', 'Prefere contato à noite'),
  ('Carla Mendes',   '5511987650003', null,                     'Rua Tuim, 45 - Moema, São Paulo/SP', null),
  ('Diego Ferreira', '5511987650004', 'diego.f@email.com',      'Alameda Santos, 900, ap 141 - Jardim Paulista, São Paulo/SP', null),
  ('Eduarda Rocha',  '5511987650005', 'eduarda.rocha@email.com','Rua das Acácias, 300 - Alphaville, Barueri/SP', 'Condomínio: avisar a portaria antes'),
  ('Felipe Costa',   '5511987650006', 'felipe.costa@email.com', 'Rua Augusta, 2200, ap 33 - Cerqueira César, São Paulo/SP', null);

-- Cria o pedido como orçamento, adiciona os itens e avança pelo fluxo real de
-- status até o status final, passando pelos mesmos triggers que o front usa.
create function pg_temp.seed_pedido(
  p_cliente_tel  text,
  p_itens        jsonb,
  p_status_final public.pedido_status,
  p_criado_em    timestamptz,
  p_tecnico      text default null,
  p_data         timestamptz default null,
  p_pagamento    public.forma_pagamento default null,
  p_obs          text default null
) returns uuid language plpgsql as $$
declare
  v_id      uuid;
  v_n       int;
  v_s       public.pedido_status;
  v_caminho public.pedido_status[];
begin
  insert into public.pedidos (cliente_id, observacoes, created_at)
  select id, p_obs, p_criado_em from public.clientes where telefone = p_cliente_tel
  returning id into v_id;

  if v_id is null then
    raise exception 'Cliente % não encontrado', p_cliente_tel;
  end if;

  insert into public.itens_pedido (pedido_id, produto_id, quantidade)
  select v_id, pr.id, (i->>'qtd')::int
  from jsonb_array_elements(p_itens) i
  join public.produtos pr on pr.nome = i->>'produto';

  get diagnostics v_n = row_count;
  if v_n <> jsonb_array_length(p_itens) then
    raise exception 'Algum produto do pedido não foi encontrado: %', p_itens;
  end if;

  v_caminho := case p_status_final
    when 'orcamento'    then '{}'
    when 'cancelado'    then '{cancelado}'
    when 'aprovado'     then '{aprovado}'
    when 'agendado'     then '{aprovado,agendado}'
    when 'em_andamento' then '{aprovado,agendado,em_andamento}'
    when 'concluido'    then '{aprovado,agendado,em_andamento,concluido}'
  end::public.pedido_status[];

  foreach v_s in array v_caminho loop
    update public.pedidos set
      status          = v_s,
      forma_pagamento = case when v_s = 'aprovado' then p_pagamento else forma_pagamento end,
      tecnico_id      = case when v_s = 'agendado'
                          then (select t.id from public.tecnicos t where t.nome = p_tecnico)
                          else tecnico_id end,
      data_instalacao = case when v_s = 'agendado' then p_data else data_instalacao end
    where id = v_id;
  end loop;

  -- Datas coerentes com a história do pedido (o trigger usaria "agora")
  if p_status_final = 'concluido' then
    update public.pedidos set concluido_em = p_data + interval '3 hours' where id = v_id;
  end if;

  update public.historico_status h set alterado_em = case h.status_novo
      when 'orcamento'    then p_criado_em
      when 'aprovado'     then p_criado_em + interval '1 day'
      when 'agendado'     then p_criado_em + interval '1 day 2 hours'
      when 'em_andamento' then p_data
      when 'concluido'    then p_data + interval '3 hours'
      when 'cancelado'    then p_criado_em + interval '2 days'
    end
  where h.pedido_id = v_id;

  return v_id;
end;
$$;

-- Orçamentos aguardando aprovação
select pg_temp.seed_pedido('5511987650001',
  '[{"produto":"Câmera IP Wi-Fi","qtd":2},{"produto":"Sensor de presença","qtd":1}]',
  'orcamento', now() - interval '1 day',
  p_obs => 'Quer monitorar a entrada e a garagem');                       -- total esperado: R$ 1.080,00

select pg_temp.seed_pedido('5511987650002',
  '[{"produto":"Lâmpada inteligente RGB","qtd":4},{"produto":"Interruptor inteligente 3 teclas","qtd":2},{"produto":"Assistente de voz (Echo Dot)","qtd":1}]',
  'orcamento', now() - interval '3 days');

select pg_temp.seed_pedido('5511987650003',
  '[{"produto":"Fechadura digital biométrica","qtd":1},{"produto":"Controlador de portão Wi-Fi","qtd":1}]',
  'orcamento', now() - interval '12 days',
  p_obs => 'Portão eletrônico antigo, verificar compatibilidade');

-- Aprovado, pendente de agendamento
select pg_temp.seed_pedido('5511987650004',
  '[{"produto":"Câmera IP Wi-Fi","qtd":3},{"produto":"Hub de automação Zigbee","qtd":1}]',
  'aprovado', now() - interval '5 days',
  p_pagamento => 'pix');

-- Agendados (dois amanhã, para a Automação 2)
select pg_temp.seed_pedido('5511987650005',
  '[{"produto":"Fechadura digital biométrica","qtd":1},{"produto":"Sensor de abertura (porta/janela)","qtd":2}]',
  'agendado', now() - interval '6 days',
  p_tecnico => 'Pedro', p_data => pg_temp.dia(1, 9), p_pagamento => 'cartao_credito',
  p_obs => 'Avisar a portaria do condomínio');

select pg_temp.seed_pedido('5511987650006',
  '[{"produto":"Câmera IP Wi-Fi","qtd":2},{"produto":"Sensor de presença","qtd":2}]',
  'agendado', now() - interval '4 days',
  p_tecnico => 'Lucas', p_data => pg_temp.dia(1, 14), p_pagamento => 'pix');

select pg_temp.seed_pedido('5511987650001',
  '[{"produto":"Lâmpada inteligente RGB","qtd":6},{"produto":"Fita LED inteligente 5 m","qtd":1},{"produto":"Interruptor inteligente 3 teclas","qtd":1}]',
  'agendado', now() - interval '2 days',
  p_tecnico => 'Pedro', p_data => pg_temp.dia(4, 10), p_pagamento => 'boleto');

-- Em andamento hoje
select pg_temp.seed_pedido('5511987650002',
  '[{"produto":"Hub de automação Zigbee","qtd":1},{"produto":"Sensor de abertura (porta/janela)","qtd":4}]',
  'em_andamento', now() - interval '8 days',
  p_tecnico => 'Lucas', p_data => pg_temp.dia(0, 8), p_pagamento => 'cartao_debito');

-- Concluídos
select pg_temp.seed_pedido('5511987650004',
  '[{"produto":"Fechadura digital biométrica","qtd":1}]',
  'concluido', now() - interval '15 days',
  p_tecnico => 'Pedro', p_data => pg_temp.dia(-6, 10), p_pagamento => 'pix');

select pg_temp.seed_pedido('5511987650005',
  '[{"produto":"Assistente de voz (Echo Dot)","qtd":2},{"produto":"Lâmpada inteligente RGB","qtd":4}]',
  'concluido', now() - interval '9 days',
  p_tecnico => 'Pedro', p_data => pg_temp.dia(-1, 13), p_pagamento => 'cartao_credito');

-- Cancelado direto do orçamento
select pg_temp.seed_pedido('5511987650003',
  '[{"produto":"Câmera IP Wi-Fi","qtd":1}]',
  'cancelado', now() - interval '20 days',
  p_obs => 'Cliente desistiu, achou caro');

reset app.seed;
