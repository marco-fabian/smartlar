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

## Frontend

### Código próprio em vez de Lovable/Bolt
React + Vite + TypeScript + Tailwind + shadcn/ui, o mesmo stack que o Lovable gera, mas escrito direto no repositório. Ganho: controle total do código, histórico de commits limpo e tipos gerados a partir do banco (`database.types.ts`), então se uma coluna mudar o build quebra em vez de dar erro em produção.

### Login simples (bônus)
Um usuário (o Rafael), criado direto no painel do Supabase. Sem tela de cadastro nem recuperação de senha. Sem login o RLS não teria como proteger os dados, já que a chave pública fica exposta no navegador.

### Regras de tela vêm do banco
- Os botões de status ("Aprovar", "Agendar instalação"...) são montados a partir de `status_transicoes`: o front não tem uma cópia da regra.
- Aprovar pede a forma de pagamento; agendar pede técnico e data/hora (não deixa data no passado). Cancelar pede confirmação.
- Mensagens de erro dos triggers aparecem direto para o usuário (já estão em português).

### Cálculo no front só para exibição
O total exibido enquanto o pedido é montado é calculado em centavos (inteiros) para não ter erro de arredondamento. O valor que vale é o do banco: o pedido é salvo pela função `criar_pedido()` e o total é recalculado pelos triggers.

### Detalhes de usabilidade
- Novo pedido: busca de cliente por nome ou telefone, cadastro de cliente sem sair da tela, e adicionar o mesmo produto de novo soma na quantidade.
- Dashboard: orçamentos parados há 7 dias ou mais ficam destacados (dor do Rafael: "esquece orçamentos que mandou").
- Agenda: pensada para o técnico no celular. Agrupada por dia, com link para o endereço no Google Maps, link para o WhatsApp do cliente e lista do que instalar.
- Telefone aceita qualquer formato na digitação e é salvo só com dígitos.

## Deploy

Cloudflare Workers com arquivos estáticos (a Cloudflare hoje encaminha projetos novos de Pages para Workers). O build do Vite é publicado com `npm run deploy`, e o modo `single-page-application` faz rotas como `/pedidos/123` abrirem direto no navegador, inclusive com F5. A URL do Supabase e a chave pública entram no build; a proteção dos dados é o RLS + login.

## Automações (n8n)

### Supabase chama o n8n por trigger, não por polling
Um trigger em `pedidos` usa `pg_net` para chamar o webhook do n8n. A requisição só sai depois do COMMIT, então quando o n8n consulta o pedido ele já está completo (itens e total). O trigger de faturamento tem um `WHEN` que só dispara na transição para `concluido`: o n8n não recebe eventos que vai descartar.

### Segredos fora do código
URLs dos webhooks e o segredo do header `X-Webhook-Secret` ficam no Supabase Vault; a migration só lê de lá. As chaves (Supabase service role, Evolution) ficam nas credenciais do n8n. O telefone do Rafael entra só no deploy, porque o repositório é público.

### n8n busca o pedido de novo em vez de confiar no payload
O evento de INSERT chega com `valor_total = 0` (os itens entram depois, na mesma transação). Consultar a view `vw_pedidos` pelo ID devolve o dado certo e já traz nome do cliente e técnico.

### Sub-workflow para o WhatsApp
Três automações mandam WhatsApp. A chamada à Evolution API fica num lugar só (com retry de 3 tentativas): trocar de provedor (ex: API oficial da Meta) é mexer em um workflow.

### Tratamento de erro
Todas as automações apontam para *[Erro] Alerta de falha*, que manda no WhatsApp o workflow, o nó, o erro e o link da execução. O resumo diário avisa também quando não há instalações, assim dá pra saber que a rotina rodou. O faturamento usa *append or update* pelo ID do pedido: se o evento chegar duas vezes, a linha não duplica.

### Sem nó de código
Datas com Luxon nas expressões, filtros no nó do Supabase, IF para o caso "sem instalações", Sort + Aggregate para montar a lista. O fluxo fica legível no canvas.

### Workflows versionados no repositório
`n8n/build.py` gera os JSON em `n8n/workflows/` e `n8n/deploy.py` publica pela API do n8n. O JSON no git é a fonte da verdade; o histórico de versões do n8n fica como segunda camada.

## Interpretações do enunciado
- **Cancelamento**: a tabela do enunciado lista `... → concluido → cancelado`, mas as regras dizem que só `orcamento` e `aprovado` podem ser cancelados. Segui as regras. Se um pedido `agendado` puder ser cancelado, é uma linha a mais em `status_transicoes`.
- **"Total de pedidos do mês"**: pedidos criados no mês atual, em qualquer status.
- **"Valor a receber"**: soma dos pedidos `aprovado`, `agendado` e `em_andamento`, sem filtro de mês.

## Limitações conhecidas / próximos passos
- WhatsApp pela Evolution API (não oficial, risco de bloqueio do número). Em produção: API oficial da Meta (Cloud API).
- Se o n8n estiver fora do ar, o `pg_net` registra a falha em `net._http_response` mas não reenvia. Com mais tempo: fila com retry (ou reprocessar pela tabela de respostas).
- Os técnicos ainda não recebem a própria agenda no WhatsApp: o sub-workflow já aceita `telefone`, então seria um envio por técnico no resumo diário.
- Um único perfil de acesso: técnicos não têm login próprio. Com mais tempo: papéis (admin/técnico) e RLS por técnico.
- Categorias são uma lista fixa (`check`). Se o Rafael precisar criar categorias, viram tabela própria.
- Sem controle de pagamento parcial/recebido: "a receber" é uma estimativa pelo status.
