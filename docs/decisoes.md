# Decisões técnicas

Registro das decisões que vão além (ou interpretam) o escopo do enunciado, com o motivo de cada uma.

## Banco de dados

### Regras de negócio no banco, não só no front
Cálculo de valores, fluxo de status e validações ficam em constraints e triggers do Postgres. Assim front, n8n e SQL editor passam pelas mesmas regras, e não dá pra burlar chamando a API direto.

### Duas tabelas além das 5 pedidas
- **`historico_status`**: bônus do enunciado. Preenchida por trigger a cada mudança de status (quem mudou e quando). Usuários só leem; só o trigger escreve.
- **`status_transicoes`**: guarda as transições permitidas (`orcamento → aprovado`, `aprovado → cancelado`...). O trigger valida contra ela e o front consulta ela pra mostrar só as ações válidas. A regra fica num lugar só; mudar o fluxo é inserir/remover uma linha.

### Valores
- `itens_pedido.subtotal` é coluna gerada (`quantidade × preco_unitario`), não tem como ficar inconsistente.
- `pedidos.valor_total` é recalculado por trigger sempre que um item muda. Escrita direta nesse campo é bloqueada.
- `itens_pedido.preco_unitario` é copiado do catálogo na hora em que o item entra no pedido. Se o preço do produto mudar depois, pedidos antigos não mudam.
- Valores em `numeric`, nunca `float` (dinheiro não pode ter erro de arredondamento).

### Fluxo do pedido
- Todo pedido nasce como `orcamento` (bloqueado inserir em outro status).
- Itens só podem ser alterados enquanto o pedido é orçamento. Depois de aprovado, o que foi combinado com o cliente fica congelado.
- `aprovado` em diante exige `forma_pagamento`.
- `agendado` em diante exige técnico e data de instalação.
- `concluido_em` é preenchido automaticamente; é a base do "faturado no mês" (o mês em que concluiu, não o mês em que o orçamento foi criado).

### Campos extras
- `pedidos.numero`: sequencial legível ("Pedido #12") pro Rafael e pros clientes, em vez de UUID.
- `pedidos.data_instalacao` é `timestamptz` (data + hora), porque o alerta de instalação precisa do horário.
- `clientes.telefone` só com dígitos e DDI 55 (formato do WhatsApp), validado por regex e único (evita cliente duplicado).
- `produtos.ativo` e `tecnicos.ativo`: desativar em vez de apagar, porque pedidos antigos referenciam esses registros.
- `clientes.observacoes`: detalhes da instalação (portaria, horário de contato).

### Funções e view
- `criar_pedido()`: cria pedido e itens numa única transação. Se um item falhar, não sobra orçamento vazio no banco.
- `dashboard_indicadores()`: indicadores calculados no banco, com "mês atual" no fuso de São Paulo (o banco guarda em UTC).
- `vw_pedidos`: pedido + cliente + técnico numa consulta só, usada pelo front e pelo n8n.

### Segurança (RLS)
- RLS ligado em todas as tabelas. Usuário logado acessa tudo; anônimo não acessa nada.
- O n8n usa a chave `service_role` (ignora RLS), guardada como credencial no n8n.
- Funções de trigger sem permissão de execução via API.

### Dados de exemplo
O seed cria os pedidos passando pelo fluxo real de status (os mesmos triggers que o sistema usa). As datas são relativas ao dia em que roda ("amanhã", "daqui 4 dias"), então dá pra rodar de novo antes de uma demo.

## Interpretações do enunciado
- **Cancelamento**: a tabela do enunciado lista `... → concluido → cancelado`, mas as regras dizem que só `orcamento` e `aprovado` podem ser cancelados. Segui as regras. Se um pedido `agendado` puder ser cancelado, é uma linha a mais em `status_transicoes`.
- **"Total de pedidos do mês"**: pedidos criados no mês atual, em qualquer status.
- **"Valor a receber"**: soma dos pedidos `aprovado`, `agendado` e `em_andamento`, sem filtro de mês.

## Limitações conhecidas / próximos passos
- Um único perfil de acesso: técnicos não têm login próprio. Com mais tempo: papéis (admin/técnico) e RLS por técnico.
- Categorias são uma lista fixa (`check`). Se o Rafael precisar criar categorias, viram tabela própria.
- Sem controle de pagamento parcial/recebido: "a receber" é uma estimativa pelo status.
