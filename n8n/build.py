"""Gera os workflows do SmartLar em n8n/workflows/*.json.

Os JSON são a fonte versionada; o deploy (deploy.py) publica no n8n.
IDs de credenciais e de workflows ficam em n8n/ids.json (não são segredos).
"""
import json
import uuid
from pathlib import Path

RAIZ = Path(__file__).parent
SAIDA = RAIZ / 'workflows'
IDS = json.loads((RAIZ / 'ids.json').read_text(encoding='utf-8'))

TZ = 'America/Sao_Paulo'
VERSAO = 'v1.0 · 02/10/2026'
PLANILHA_ID = '1dP6mTmua0hU049ypz6i9Y7rUfY50n-AD2LXrdldlxeo'
DESTINO_PADRAO = 'DESTINO_WHATSAPP'  # substituído no deploy por SMARTLAR_WHATSAPP_DESTINO
NUMEROS_LIBERADOS = 'NUMEROS_LIBERADOS'  # substituído no deploy por SMARTLAR_WHATSAPP_LIBERADOS


# ------------------------------------------------------------------ helpers

def _id(*partes):
    # IDs derivados do conteúdo: gerar de novo não muda o JSON se o nó não mudou
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'smartlar/' + '/'.join(map(str, partes))))


def node(nome, tipo, versao, pos, params, **extra):
    n = {'id': _id('no', nome), 'name': nome, 'type': f'n8n-nodes-base.{tipo}', 'typeVersion': versao,
         'position': pos, 'parameters': params}
    n.update(extra)
    return n


def nota(nome, conteudo, pos, largura, altura, cor=None):
    params = {'content': conteudo, 'width': largura, 'height': altura}
    if cor:
        params['color'] = cor
    return node(nome, 'stickyNote', 1, pos, params)


def campos(*itens, manter_outros=False):
    # item: (nome, valor) ou (nome, valor, tipo)
    params = {'assignments': {'assignments': [
        {'id': _id('campo', i[0], i[1]), 'name': i[0], 'value': i[1], 'type': i[2] if len(i) > 2 else 'string'} for i in itens]},
        'options': {}}
    if manter_outros:
        params['includeOtherFields'] = True
    return params


def condicao(esquerda, operacao, direita='', tipo='string'):
    c = {'id': _id('condicao', esquerda, operacao, direita), 'leftValue': esquerda, 'rightValue': direita,
         'operator': {'type': tipo, 'operation': operacao}}
    if operacao in ('exists', 'notExists', 'empty', 'notEmpty', 'true', 'false'):
        c['operator']['singleValue'] = True
    return c


def condicoes(*cs):
    return {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'strict', 'version': 2},
                           'conditions': list(cs), 'combinator': 'and'}, 'options': {}}


def credencial(chave):
    return {'id': IDS['credenciais'][chave]['id'], 'name': IDS['credenciais'][chave]['name']}


def webhook(nome, caminho, pos):
    return node(nome, 'webhook', 2.1, pos,
                {'httpMethod': 'POST', 'path': caminho, 'authentication': 'headerAuth', 'options': {}},
                webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, caminho)),
                credentials={'httpHeaderAuth': credencial('webhook')})


def buscar_pedido(nome, pos):
    return node(nome, 'supabase', 1, pos,
                {'operation': 'get', 'tableId': 'vw_pedidos',
                 'filters': {'conditions': [{'keyName': 'id', 'keyValue': '={{ $json.body.record.id }}'}]}},
                credentials={'supabaseApi': credencial('supabase')})


def enviar_whatsapp(nome, pos, para_cliente=False):
    # Sem telefone, a mensagem vai para o grupo do Rafael
    colunas = ('mensagem', 'telefone', 'destinatario')
    valores = {'mensagem': '={{ $json.mensagem }}'}
    if para_cliente:
        valores.update(telefone='={{ $json.telefone }}', destinatario='={{ $json.destinatario }}')
    return node(nome, 'executeWorkflow', 1.3, pos, {
        'workflowId': {'__rl': True, 'value': IDS['workflows'].get('sub', ''), 'mode': 'list',
                       'cachedResultName': 'SmartLar | [Sub] Enviar WhatsApp'},
        'workflowInputs': {
            'mappingMode': 'defineBelow',
            'value': valores,
            'matchingColumns': [],
            'schema': [{'id': c, 'displayName': c, 'required': False, 'defaultMatch': False, 'display': True,
                        'canBeUsedToMatch': True, 'type': 'string', 'removed': c not in valores} for c in colunas],
            'attemptToConvertTypes': False, 'convertFieldsToString': True},
        'options': {}})


def ligar(*pares):
    conexoes = {}
    for origem, destino, *saida in pares:
        saidas = conexoes.setdefault(origem, {'main': []})['main']
        indice = saida[0] if saida else 0
        while len(saidas) <= indice:
            saidas.append([])
        saidas[indice].append({'node': destino, 'type': 'main', 'index': 0})
    return conexoes


def configuracoes(alerta_de_erro=True):
    s = {'executionOrder': 'v1', 'timezone': TZ, 'saveManualExecutions': True}
    if alerta_de_erro and IDS['workflows'].get('erro'):
        s['errorWorkflow'] = IDS['workflows']['erro']
    return s


TELEFONE = r"$json.cliente_telefone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')"
VALOR = "Number($json.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })"
HORA_SP = "DateTime.fromISO({}).setZone('America/Sao_Paulo')"

workflows = {}

# ------------------------------------------------------------------ [Sub] Enviar WhatsApp

workflows['sub'] = {
    'name': 'SmartLar | [Sub] Enviar WhatsApp',
    'nodes': [
        nota('Sobre este workflow',
             '## 📲 Enviar WhatsApp\n'
             'Sub-workflow: **único ponto de contato com a Evolution API**. '
             'As outras automações do SmartLar chamam este.\n\n'
             '**Entrada**\n- `mensagem` (obrigatório)\n'
             '- `telefone` e `destinatario` (opcionais): mensagem para cliente ou técnico. '
             'Sem telefone, vai para o grupo de notificações do Rafael\n\n'
             '**Configuração:** URL, instância, destino padrão e modo demonstração no nó *Config da Evolution*\n'
             '**Credencial:** SmartLar · Evolution API\n'
             '**Falhas:** 3 tentativas com 3s de intervalo; depois o erro sobe para quem chamou\n\n'
             f'`#smartlar` `#whatsapp` · `{VERSAO}`',
             [-60, -420], 1240, 340, 6),
        nota('Modo demonstração',
             '### 🛡️ Modo demonstração\n'
             'Os telefones dos dados de exemplo são fictícios, mas existem de verdade. '
             'Com `modo_demonstracao` ligado, mensagens para clientes e técnicos **caem no grupo do Rafael** '
             'com o aviso *[Para Fulano]*.\n\n'
             'Números em `numeros_liberados` recebem de verdade (ex: o seu, para demonstrar).',
             [400, -60], 520, 440),
        node('Quando chamado', 'executeWorkflowTrigger', 1.1, [0, 100],
             {'workflowInputs': {'values': [{'name': 'mensagem'}, {'name': 'telefone'}, {'name': 'destinatario'}]}}),
        node('Config da Evolution', 'set', 3.4, [220, 100], campos(
            ('evolution_url', 'https://n8n-evolution-api.dnfcju.easypanel.host'),
            ('instancia', 'smartlar'),
            ('destino_padrao', DESTINO_PADRAO),
            ('modo_demonstracao', True, 'boolean'),
            ('numeros_liberados', NUMEROS_LIBERADOS),
            manter_outros=True)),
        node('Enviar direto ao destinatário?', 'if', 2.2, [460, 100], condicoes(condicao(
            "={{ !!$json.telefone && (!$json.modo_demonstracao || "
            "$json.numeros_liberados.split(',').map(n => n.trim()).includes($json.telefone)) }}",
            'true', tipo='boolean'))),
        node('Destino: destinatário', 'set', 3.4, [700, 0], campos(
            ('numero', '={{ $json.telefone }}'),
            ('texto', '={{ $json.mensagem }}'))),
        node('Destino: grupo do Rafael', 'set', 3.4, [700, 220], campos(
            ('numero', '={{ $json.destino_padrao }}'),
            ('texto', "={{ $json.telefone ? '📨 *[Para ' + ($json.destinatario || $json.telefone) + ']*\\n\\n' + $json.mensagem : $json.mensagem }}"))),
        node('Enviar mensagem (Evolution)', 'httpRequest', 4.2, [960, 100], {
            'method': 'POST',
            'url': "={{ $('Config da Evolution').first().json.evolution_url }}/message/sendText/"
                   "{{ $('Config da Evolution').first().json.instancia }}",
            'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
            'sendBody': True, 'specifyBody': 'json',
            'jsonBody': '={{ JSON.stringify({ number: $json.numero, text: $json.texto }) }}',
            'options': {}},
            credentials={'httpHeaderAuth': credencial('evolution')},
            retryOnFail=True, maxTries=3, waitBetweenTries=3000),
    ],
    'connections': ligar(('Quando chamado', 'Config da Evolution'),
                         ('Config da Evolution', 'Enviar direto ao destinatário?'),
                         ('Enviar direto ao destinatário?', 'Destino: destinatário', 0),
                         ('Enviar direto ao destinatário?', 'Destino: grupo do Rafael', 1),
                         ('Destino: destinatário', 'Enviar mensagem (Evolution)'),
                         ('Destino: grupo do Rafael', 'Enviar mensagem (Evolution)')),
    'settings': {**configuracoes(alerta_de_erro=False), 'callerPolicy': 'workflowsFromSameOwner'},
}

# ------------------------------------------------------------------ [Erro] Alerta de falha

workflows['erro'] = {
    'name': 'SmartLar | [Erro] Alerta de falha',
    'nodes': [
        nota('Sobre este workflow',
             '## 🚨 Alerta de falha\n'
             'Workflow de erro de todas as automações do SmartLar (*Settings → Error workflow*).\n\n'
             'Quando uma execução falha, manda no WhatsApp: workflow, nó, mensagem de erro e link da execução.\n\n'
             f'`#smartlar` `#monitoramento` · `{VERSAO}`',
             [-60, -320], 700, 280, 3),
        node('Quando um workflow falhar', 'errorTrigger', 1, [0, 0], {}),
        node('Montar alerta', 'set', 3.4, [240, 0], campos((
            'mensagem',
            '=⚠️ *SmartLar · falha em automação*\n\n'
            '*Workflow:* {{ $json.workflow.name }}\n'
            '*Nó:* {{ $json.execution.lastNodeExecuted }}\n'
            '*Erro:* {{ $json.execution.error.message }}\n'
            "*Quando:* {{ $now.setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm') }}\n\n"
            '🔗 {{ $json.execution.url }}'))),
        enviar_whatsapp('Enviar alerta no WhatsApp', [480, 0]),
    ],
    'connections': ligar(('Quando um workflow falhar', 'Montar alerta'),
                         ('Montar alerta', 'Enviar alerta no WhatsApp')),
    'settings': configuracoes(alerta_de_erro=False),
}

# ------------------------------------------------------------------ Automação 1: novo pedido

workflows['novo_pedido'] = {
    'name': 'SmartLar | Novo pedido → WhatsApp',
    'nodes': [
        nota('Sobre este workflow',
             '## 🆕 Novo pedido → WhatsApp\n'
             '**Automação 1 (obrigatória).** Avisa o Rafael no WhatsApp sempre que um orçamento é criado.\n\n'
             '**Gatilho:** trigger `pedidos_notificar_novo` no Supabase (pg_net) → webhook autenticado pelo header `X-Webhook-Secret`\n'
             '**Destino:** WhatsApp do Rafael, via *[Sub] Enviar WhatsApp*\n'
             '**Falhas:** *[Erro] Alerta de falha*\n\n'
             f'`#smartlar` `#supabase` `#whatsapp` · `{VERSAO}`',
             [-60, -420], 1260, 300, 6),
        nota('Etapa 1', '### 1. Recebe o evento\nSó segue se for INSERT de pedido em `orcamento`.',
             [-60, -100], 460, 320),
        nota('Etapa 2', '### 2. Busca os dados atualizados\n'
                        'O evento chega com `valor_total = 0` (os itens entram depois, na mesma transação). '
                        'Por isso o pedido é consultado de novo na view `vw_pedidos`, já com cliente e total.',
             [420, -100], 280, 320),
        nota('Etapa 3', '### 3. Notifica', [720, -100], 480, 320),
        webhook('Pedido criado (Supabase)', 'smartlar/novo-pedido', [0, 60]),
        node('É um orçamento novo?', 'filter', 2.2, [220, 60], condicoes(
            condicao('={{ $json.body.type }}', 'equals', 'INSERT'),
            condicao('={{ $json.body.record.status }}', 'equals', 'orcamento'))),
        buscar_pedido('Buscar pedido completo', [480, 60]),
        node('Montar mensagem', 'set', 3.4, [780, 60], campos((
            'mensagem',
            '=🆕 *Novo orçamento #{{ $json.numero }}*\n\n'
            '👤 {{ $json.cliente_nome }}\n'
            '📞 {{ ' + TELEFONE + ' }}\n'
            '💰 {{ ' + VALOR + ' }}\n'
            '📅 {{ ' + HORA_SP.format('$json.created_at') + '.toFormat("dd/MM/yyyy \'às\' HH:mm") }}'
            "{{ $json.observacoes ? '\\n📝 ' + $json.observacoes : '' }}"))),
        enviar_whatsapp('Enviar no WhatsApp', [1000, 60]),
    ],
    'connections': ligar(('Pedido criado (Supabase)', 'É um orçamento novo?'),
                         ('É um orçamento novo?', 'Buscar pedido completo'),
                         ('Buscar pedido completo', 'Montar mensagem'),
                         ('Montar mensagem', 'Enviar no WhatsApp')),
    'settings': configuracoes(),
}

# ------------------------------------------------------------------ Automação 2: instalações de amanhã

PERIODO = "$('Definir período de amanhã').first().json.data_label"
AMANHA = "$now.setZone('America/Sao_Paulo').plus({{ days: {} }}).startOf('day')"

workflows['amanha'] = {
    'name': 'SmartLar | Instalações de amanhã → WhatsApp',
    'nodes': [
        nota('Sobre este workflow',
             '## 📋 Instalações de amanhã → WhatsApp\n'
             '**Automação 2 (obrigatória) + agenda dos técnicos.** Todo dia às 18h:\n'
             '- o Rafael recebe o resumo de todas as instalações do dia seguinte (horário, técnico, cliente, endereço);\n'
             '- **cada técnico recebe a própria agenda**, com endereço, link do Maps, telefone do cliente e o que instalar '
             '(resolve *"os técnicos não sabem a agenda sem ligar pro Rafael"*).\n\n'
             '**Fuso:** America/Sao_Paulo. O banco guarda em UTC; a janela de "amanhã" é calculada em SP.\n'
             '**Sem instalações:** o Rafael recebe um aviso mesmo assim, pra confirmar que a rotina rodou.\n'
             '**Falhas:** *[Erro] Alerta de falha*\n\n'
             f'`#smartlar` `#supabase` `#whatsapp` `#agendado` · `{VERSAO}`',
             [-60, -480], 2200, 360, 6),
        nota('Etapa 1', '### 1. Consulta o banco\n'
                        'Pedidos `agendado` com `data_instalacao` de 00:00 até 23:59 de amanhã.\n'
                        '*Always Output Data* ligado na busca: sem resultado, o fluxo segue para o aviso.',
             [-60, -100], 900, 820),
        nota('Etapa 2', '### 2. Resumo para o Rafael', [860, -100], 1000, 480),
        nota('Etapa 3', '### 3. Agenda de cada técnico\n'
                        'Uma linha por instalação → agrupa por técnico (*Summarize*) → uma mensagem por técnico.',
             [1080, 400], 1060, 320),
        node('Todo dia às 18h', 'scheduleTrigger', 1.2, [0, 100],
             {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 18}]}}),
        node('Definir período de amanhã', 'set', 3.4, [240, 100], campos(
            ('inicio', '={{ ' + AMANHA.format(1) + '.toUTC().toISO() }}'),
            ('fim', '={{ ' + AMANHA.format(2) + '.toUTC().toISO() }}'),
            ('data_label', "={{ " + AMANHA.format(1) + ".setLocale('pt-BR').toFormat('cccc, dd/MM') }}"))),
        node('Buscar instalações de amanhã', 'supabase', 1, [480, 100], {
            'operation': 'getAll', 'tableId': 'vw_pedidos', 'returnAll': True,
            'filterType': 'manual', 'matchType': 'allFilters',
            'filters': {'conditions': [
                {'keyName': 'status', 'condition': 'eq', 'keyValue': 'agendado'},
                {'keyName': 'data_instalacao', 'condition': 'gte', 'keyValue': '={{ $json.inicio }}'},
                {'keyName': 'data_instalacao', 'condition': 'lt', 'keyValue': '={{ $json.fim }}'}]}},
            credentials={'supabaseApi': credencial('supabase')}, alwaysOutputData=True),
        node('Tem instalação amanhã?', 'if', 2.2, [720, 100], condicoes(condicao('={{ $json.id }}', 'exists'))),
        node('Ordenar por horário', 'sort', 1, [960, 100],
             {'sortFieldsUi': {'sortField': [{'fieldName': 'data_instalacao'}]}, 'options': {}}),
        node('Agrupar em uma lista', 'aggregate', 1, [1180, 0],
             {'aggregate': 'aggregateAllItemData', 'destinationFieldName': 'instalacoes', 'options': {}}),
        node('Montar resumo do dia', 'set', 3.4, [1400, 0], campos((
            'mensagem',
            '=📋 *Instalações de amanhã ({{ ' + PERIODO + ' }})*\n\n'
            "{{ $json.instalacoes.map(i => '🕐 *' + " + HORA_SP.format('i.data_instalacao') + ".toFormat('HH:mm') + '* · ' + i.tecnico_nome"
            " + '\\n👤 ' + i.cliente_nome + '\\n📍 ' + i.cliente_endereco).join('\\n\\n') }}\n\n"
            "Total: {{ $json.instalacoes.length }} {{ $json.instalacoes.length === 1 ? 'instalação' : 'instalações' }}"))),
        node('Montar aviso sem instalações', 'set', 3.4, [1180, 220], campos((
            'mensagem',
            '=📋 *Instalações de amanhã ({{ ' + PERIODO + ' }})*\n\nNenhuma instalação agendada. ✅'))),
        enviar_whatsapp('Enviar resumo ao Rafael', [1620, 100]),
        node('Formatar instalação para o técnico', 'set', 3.4, [1180, 540], campos(
            ('tecnico_nome', '={{ $json.tecnico_nome }}'),
            ('tecnico_telefone', '={{ $json.tecnico_telefone }}'),
            ('linha',
             "=🕐 *{{ " + HORA_SP.format('$json.data_instalacao') + ".toFormat('HH:mm') }}* · {{ $json.cliente_nome }}\n"
             "📍 {{ $json.cliente_endereco }}\n"
             "🗺️ https://www.google.com/maps/search/?api=1&query={{ encodeURIComponent($json.cliente_endereco) }}\n"
             "📞 {{ " + TELEFONE + " }}\n"
             "📦 {{ $json.itens_resumo }}"
             "{{ $json.observacoes ? '\\n📝 ' + $json.observacoes : '' }}"))),
        node('Agrupar por técnico', 'summarize', 1.1, [1400, 540], {
            'fieldsToSummarize': {'values': [
                {'aggregation': 'concatenate', 'field': 'linha', 'separateBy': 'other', 'customSeparator': '\n\n'},
                {'aggregation': 'count', 'field': 'linha'}]},
            'fieldsToSplitBy': 'tecnico_nome, tecnico_telefone',
            'options': {}}),
        node('Montar agenda do técnico', 'set', 3.4, [1620, 540], campos(
            ('telefone', '={{ $json.tecnico_telefone }}'),
            ('destinatario', '={{ $json.tecnico_nome }} (técnico)'),
            ('mensagem',
             "=Olá, {{ $json.tecnico_nome.split(' ')[0] }}! 🔧\n\n"
             '*Sua agenda de amanhã ({{ ' + PERIODO + ' }}):*\n\n'
             '{{ $json.concatenated_linha }}\n\n'
             "Total: {{ $json.count_linha }} {{ $json.count_linha === 1 ? 'instalação' : 'instalações' }}. Bom trabalho!\n\n"
             '_SmartLar_'))),
        enviar_whatsapp('Enviar agenda ao técnico', [1840, 540], para_cliente=True),
    ],
    'connections': ligar(('Todo dia às 18h', 'Definir período de amanhã'),
                         ('Definir período de amanhã', 'Buscar instalações de amanhã'),
                         ('Buscar instalações de amanhã', 'Tem instalação amanhã?'),
                         ('Tem instalação amanhã?', 'Ordenar por horário', 0),
                         ('Tem instalação amanhã?', 'Montar aviso sem instalações', 1),
                         ('Ordenar por horário', 'Agrupar em uma lista'),
                         ('Ordenar por horário', 'Formatar instalação para o técnico'),
                         ('Agrupar em uma lista', 'Montar resumo do dia'),
                         ('Montar resumo do dia', 'Enviar resumo ao Rafael'),
                         ('Montar aviso sem instalações', 'Enviar resumo ao Rafael'),
                         ('Formatar instalação para o técnico', 'Agrupar por técnico'),
                         ('Agrupar por técnico', 'Montar agenda do técnico'),
                         ('Montar agenda do técnico', 'Enviar agenda ao técnico')),
    'settings': configuracoes(),
}

# ------------------------------------------------------------------ Automação 3 (bônus): faturamento

PAGAMENTOS = ("{ pix: 'Pix', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito', "
              "boleto: 'Boleto', dinheiro: 'Dinheiro' }")
COLUNAS = {
    'Concluído em': '={{ ' + HORA_SP.format('$json.concluido_em') + ".toFormat('dd/MM/yyyy HH:mm') }}",
    'Pedido': '=#{{ $json.numero }}',
    'Cliente': '={{ $json.cliente_nome }}',
    'Valor (R$)': '={{ $json.valor_total }}',
    'Forma de pagamento': '={{ (' + PAGAMENTOS + ')[$json.forma_pagamento] }}',
    'Técnico': '={{ $json.tecnico_nome }}',
    'ID do pedido': '={{ $json.id }}',
}

workflows['faturamento'] = {
    'name': 'SmartLar | Pedido concluído → Faturamento (Sheets)',
    'nodes': [
        nota('Sobre este workflow',
             '## 💰 Pedido concluído → Faturamento\n'
             '**Automação 3 (bônus).** Cada pedido concluído vira uma linha na planilha *SmartLar · Faturamento*: '
             'o começo de um controle financeiro.\n\n'
             '**Gatilho:** trigger `pedidos_notificar_concluido` (só dispara na transição para `concluido`)\n'
             '**Idempotente:** *append or update* pela coluna *ID do pedido*. Se o evento chegar duas vezes, a linha não duplica.\n'
             '**Falhas:** *[Erro] Alerta de falha*\n\n'
             f'`#smartlar` `#supabase` `#google-sheets` · `{VERSAO}`',
             [-60, -420], 1060, 320, 6),
        webhook('Pedido concluído (Supabase)', 'smartlar/pedido-concluido', [0, 60]),
        node('Mudou para concluído?', 'filter', 2.2, [220, 60], condicoes(
            condicao('={{ $json.body.record.status }}', 'equals', 'concluido'),
            condicao('={{ $json.body.old_record.status }}', 'notEquals', 'concluido'))),
        buscar_pedido('Buscar pedido completo', [480, 60]),
        node('Registrar no Google Sheets', 'googleSheets', 4.7, [760, 60], {
            'operation': 'appendOrUpdate',
            'documentId': {'__rl': True, 'value': PLANILHA_ID, 'mode': 'id'},
            'sheetName': {'__rl': True, 'value': 'gid=0', 'mode': 'list', 'cachedResultName': 'Página1'},
            'columns': {
                'mappingMode': 'defineBelow', 'value': COLUNAS, 'matchingColumns': ['ID do pedido'],
                'schema': [{'id': c, 'displayName': c, 'required': False, 'defaultMatch': False, 'display': True,
                            'type': 'string', 'canBeUsedToMatch': True} for c in COLUNAS],
                'attemptToConvertTypes': False, 'convertFieldsToString': False},
            'options': {}},
            credentials={'googleSheetsOAuth2Api': IDS['credenciais']['google_sheets']}),
    ],
    'connections': ligar(('Pedido concluído (Supabase)', 'Mudou para concluído?'),
                         ('Mudou para concluído?', 'Buscar pedido completo'),
                         ('Buscar pedido completo', 'Registrar no Google Sheets')),
    'settings': configuracoes(),
}

# ------------------------------------------------------------------ Extra: cliente acompanha o pedido

PRIMEIRO_NOME = "$json.cliente_nome.split(' ')[0]"
ASSINATURA = '\n\n_Equipe SmartLar_'


def mensagem_cliente(nome, pos, texto):
    return node(nome, 'set', 3.4, pos, campos(
        ('telefone', '={{ $json.cliente_telefone }}'),
        ('destinatario', '={{ $json.cliente_nome }}'),
        ('mensagem', texto + ASSINATURA)))


def etapa(status):
    return {'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'strict', 'version': 2},
                           'conditions': [condicao('={{ $json.status }}', 'equals', status)],
                           'combinator': 'and'},
            'renameOutput': True, 'outputKey': status}


workflows['status_cliente'] = {
    'name': 'SmartLar | Status do pedido → WhatsApp do cliente',
    'nodes': [
        nota('Sobre este workflow',
             '## 📣 Status do pedido → WhatsApp do cliente\n'
             '**Além do escopo.** Resolve a dor *"clientes ligam perguntando status"*: o cliente recebe uma mensagem '
             'a cada etapa do pedido (aprovado, agendado, em andamento, concluído).\n\n'
             '**Gatilho:** trigger `pedidos_notificar_status` (só nas etapas acima)\n'
             '**Destino:** WhatsApp do cliente, via *[Sub] Enviar WhatsApp*. '
             'Em **modo demonstração**, cai no grupo do Rafael com o aviso *[Para Fulano]*\n'
             '**Falhas:** *[Erro] Alerta de falha*\n\n'
             f'`#smartlar` `#supabase` `#whatsapp` `#cliente` · `{VERSAO}`',
             [-60, -440], 1460, 320, 6),
        nota('Etapa 1', '### 1. Recebe o evento e busca o pedido\n'
                        'Busca na `vw_pedidos` para ter nome do cliente, técnico e data atualizados.',
             [-60, -100], 740, 820),
        nota('Etapa 2', '### 2. Uma mensagem por etapa', [700, -100], 480, 820),
        nota('Etapa 3', '### 3. Envia', [1200, -100], 280, 820),
        webhook('Status do pedido mudou (Supabase)', 'smartlar/status-pedido', [0, 280]),
        node('É uma etapa avisada ao cliente?', 'filter', 2.2, [220, 280], condicoes(
            condicao('={{ ["aprovado", "agendado", "em_andamento", "concluido"].includes($json.body.record.status) }}',
                     'true', tipo='boolean'),
            condicao('={{ $json.body.record.status }}', 'notEquals', '={{ $json.body.old_record.status }}'))),
        buscar_pedido('Buscar pedido completo', [460, 280]),
        node('Qual etapa?', 'switch', 3.2, [520 + 220, 280],
             {'rules': {'values': [etapa(st) for st in ('aprovado', 'agendado', 'em_andamento', 'concluido')]},
              'options': {}}),
        mensagem_cliente('Mensagem: aprovado', [960, 40],
            '=Olá, {{ ' + PRIMEIRO_NOME + ' }}! 👋\n\n'
            'Seu pedido *#{{ $json.numero }}* foi *aprovado*. Obrigado pela confiança!\n\n'
            '💰 {{ ' + VALOR + ' }}\n\n'
            'Em breve entramos em contato para agendar a instalação.'),
        mensagem_cliente('Mensagem: agendado', [960, 220],
            '=Olá, {{ ' + PRIMEIRO_NOME + ' }}! 📅\n\n'
            'Sua instalação está *agendada*:\n\n'
            "🗓️ {{ " + HORA_SP.format('$json.data_instalacao') + ".setLocale('pt-BR').toFormat(\"cccc, dd/MM 'às' HH:mm\") }}\n"
            '🔧 Técnico: {{ $json.tecnico_nome }}\n'
            '📍 {{ $json.cliente_endereco }}\n\n'
            'Precisa remarcar? É só responder esta mensagem.'),
        mensagem_cliente('Mensagem: em andamento', [960, 400],
            '=Olá, {{ ' + PRIMEIRO_NOME + ' }}! 🔧\n\n'
            'O técnico *{{ $json.tecnico_nome }}* começou a instalação do seu pedido *#{{ $json.numero }}*.'),
        mensagem_cliente('Mensagem: concluído', [960, 580],
            '=Olá, {{ ' + PRIMEIRO_NOME + ' }}! ✅\n\n'
            'Sua instalação foi *concluída*. Obrigado por escolher a SmartLar!\n\n'
            'Ficou alguma dúvida sobre os equipamentos? É só responder esta mensagem.'),
        enviar_whatsapp('Enviar ao cliente no WhatsApp', [1260, 280], para_cliente=True),
    ],
    'connections': ligar(('Status do pedido mudou (Supabase)', 'É uma etapa avisada ao cliente?'),
                         ('É uma etapa avisada ao cliente?', 'Buscar pedido completo'),
                         ('Buscar pedido completo', 'Qual etapa?'),
                         ('Qual etapa?', 'Mensagem: aprovado', 0),
                         ('Qual etapa?', 'Mensagem: agendado', 1),
                         ('Qual etapa?', 'Mensagem: em andamento', 2),
                         ('Qual etapa?', 'Mensagem: concluído', 3),
                         ('Mensagem: aprovado', 'Enviar ao cliente no WhatsApp'),
                         ('Mensagem: agendado', 'Enviar ao cliente no WhatsApp'),
                         ('Mensagem: em andamento', 'Enviar ao cliente no WhatsApp'),
                         ('Mensagem: concluído', 'Enviar ao cliente no WhatsApp')),
    'settings': configuracoes(),
}

# ------------------------------------------------------------------ Extra: follow-up de orçamentos parados

CONFIG_FOLLOWUP = "$('Configuração').first().json"
TEXTO_FOLLOWUP = ("'Olá, ' + $json.cliente_nome.split(' ')[0] + '! Tudo bem? Passando para saber se ficou alguma dúvida "
                  "sobre o orçamento #' + $json.numero + ' da SmartLar. Posso ajudar em algo?'")

workflows['follow_up'] = {
    'name': 'SmartLar | Orçamentos parados → Lembrete',
    'nodes': [
        nota('Sobre este workflow',
             '## ⏰ Orçamentos parados → Lembrete\n'
             '**Além do escopo.** Resolve a dor *"esquece orçamentos que mandou e perde vendas"*: '
             'todo dia às 9h o Rafael recebe os orçamentos sem resposta há alguns dias, do mais antigo para o mais novo.\n\n'
             'Cada orçamento vem com um **link de WhatsApp com a mensagem de follow-up pronta** para o cliente: '
             'o Rafael revisa e envia com um toque.\n\n'
             '**Sem orçamento parado:** não manda nada (evita mensagem diária inútil)\n'
             '**Falhas:** *[Erro] Alerta de falha*\n\n'
             f'`#smartlar` `#supabase` `#whatsapp` `#agendado` · `{VERSAO}`',
             [-60, -440], 1880, 320, 6),
        nota('Etapa 1', '### 1. Configuração e consulta\n'
                        '`dias_parado`: a partir de quantos dias o orçamento entra no lembrete.',
             [-60, -100], 900, 560),
        nota('Etapa 2', '### 2. Monta e envia o lembrete', [860, -100], 1100, 560),
        node('Todo dia às 9h', 'scheduleTrigger', 1.2, [0, 100],
             {'rule': {'interval': [{'field': 'days', 'triggerAtHour': 9}]}}),
        node('Configuração', 'set', 3.4, [240, 100], campos(
            ('dias_parado', 3, 'number'),
            ('url_sistema', 'https://smartlar.marcofabianufmg.workers.dev'))),
        node('Buscar orçamentos parados', 'supabase', 1, [480, 100], {
            'operation': 'getAll', 'tableId': 'vw_pedidos', 'returnAll': True,
            'filterType': 'manual', 'matchType': 'allFilters',
            'filters': {'conditions': [
                {'keyName': 'status', 'condition': 'eq', 'keyValue': 'orcamento'},
                {'keyName': 'created_at', 'condition': 'lt',
                 'keyValue': '={{ $now.minus({ days: $json.dias_parado }).toUTC().toISO() }}'}]}},
            credentials={'supabaseApi': credencial('supabase')}, alwaysOutputData=True),
        node('Tem orçamento parado?', 'if', 2.2, [720, 100], condicoes(condicao('={{ $json.id }}', 'exists'))),
        node('Nenhum orçamento parado', 'noOp', 1, [960, 300], {}),
        node('Ordenar do mais antigo', 'sort', 1, [960, 0],
             {'sortFieldsUi': {'sortField': [{'fieldName': 'created_at'}]}, 'options': {}}),
        node('Formatar cada orçamento', 'set', 3.4, [1180, 0], campos(
            ('valor_total', '={{ Number($json.valor_total) }}', 'number'),
            ('linha',
             '=*#{{ $json.numero }}* · {{ $json.cliente_nome }} · {{ ' + VALOR + ' }}\n'
             "⏳ enviado há {{ Math.floor($now.diff(DateTime.fromISO($json.created_at), 'days').days) }} dias\n"
             '💬 https://wa.me/{{ $json.cliente_telefone }}?text={{ encodeURIComponent(' + TEXTO_FOLLOWUP + ') }}\n'
             '🔗 {{ ' + CONFIG_FOLLOWUP + '.url_sistema }}/pedidos/{{ $json.id }}'))),
        node('Resumir orçamentos', 'summarize', 1.1, [1400, 0], {
            'fieldsToSummarize': {'values': [
                {'aggregation': 'concatenate', 'field': 'linha', 'separateBy': 'other', 'customSeparator': '\n\n'},
                {'aggregation': 'sum', 'field': 'valor_total'},
                {'aggregation': 'count', 'field': 'linha'}]},
            'options': {}}),
        node('Montar lembrete', 'set', 3.4, [1620, 0], campos((
            'mensagem',
            '=⏰ *Orçamentos aguardando resposta*\n'
            '_Sem retorno há {{ ' + CONFIG_FOLLOWUP + '.dias_parado }}+ dias, do mais antigo para o mais novo_\n\n'
            '{{ $json.concatenated_linha }}\n\n'
            "💰 *{{ Number($json.sum_valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}* "
            "parados em {{ $json.count_linha }} {{ $json.count_linha === 1 ? 'orçamento' : 'orçamentos' }}.\n"
            'Toque no 💬 para mandar o follow-up pronto ao cliente.'))),
        enviar_whatsapp('Enviar lembrete ao Rafael', [1840, 0]),
    ],
    'connections': ligar(('Todo dia às 9h', 'Configuração'),
                         ('Configuração', 'Buscar orçamentos parados'),
                         ('Buscar orçamentos parados', 'Tem orçamento parado?'),
                         ('Tem orçamento parado?', 'Ordenar do mais antigo', 0),
                         ('Tem orçamento parado?', 'Nenhum orçamento parado', 1),
                         ('Ordenar do mais antigo', 'Formatar cada orçamento'),
                         ('Formatar cada orçamento', 'Resumir orçamentos'),
                         ('Resumir orçamentos', 'Montar lembrete'),
                         ('Montar lembrete', 'Enviar lembrete ao Rafael')),
    'settings': configuracoes(),
}

ARQUIVOS = {
    'sub': 'sub-enviar-whatsapp',
    'erro': 'erro-alerta-de-falha',
    'novo_pedido': 'novo-pedido-whatsapp',
    'amanha': 'instalacoes-de-amanha-whatsapp',
    'faturamento': 'pedido-concluido-faturamento',
    'status_cliente': 'status-pedido-cliente-whatsapp',
    'follow_up': 'orcamentos-parados-lembrete',
}

if __name__ == '__main__':
    SAIDA.mkdir(exist_ok=True)
    for chave, wf in workflows.items():
        (SAIDA / f'{ARQUIVOS[chave]}.json').write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{ARQUIVOS[chave]}.json: {len(wf["nodes"])} nós')
