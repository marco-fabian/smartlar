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
PLANILHA_ID = '13OkBYxolO4HRbwPhkv9juVr-3mBw1y6zMUE1yyPf33o'
DESTINO_PADRAO = 'DESTINO_WHATSAPP'  # substituído no deploy por SMARTLAR_WHATSAPP_DESTINO


# ------------------------------------------------------------------ helpers

_contador = 0


def _id():
    # IDs determinísticos: gerar de novo não muda o JSON se o workflow não mudou
    global _contador
    _contador += 1
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f'smartlar/{_contador}'))


def node(nome, tipo, versao, pos, params, **extra):
    n = {'id': _id(), 'name': nome, 'type': f'n8n-nodes-base.{tipo}', 'typeVersion': versao,
         'position': pos, 'parameters': params}
    n.update(extra)
    return n


def nota(nome, conteudo, pos, largura, altura, cor=None):
    params = {'content': conteudo, 'width': largura, 'height': altura}
    if cor:
        params['color'] = cor
    return node(nome, 'stickyNote', 1, pos, params)


def campos(*itens, manter_outros=False):
    params = {'assignments': {'assignments': [
        {'id': _id(), 'name': nome, 'value': valor, 'type': 'string'} for nome, valor in itens]}, 'options': {}}
    if manter_outros:
        params['includeOtherFields'] = True
    return params


def condicao(esquerda, operacao, direita=''):
    c = {'id': _id(), 'leftValue': esquerda, 'rightValue': direita,
         'operator': {'type': 'string', 'operation': operacao}}
    if operacao in ('exists', 'notExists', 'empty', 'notEmpty'):
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


def enviar_whatsapp(nome, pos):
    colunas = ('mensagem', 'telefone')
    return node(nome, 'executeWorkflow', 1.3, pos, {
        'workflowId': {'__rl': True, 'value': IDS['workflows'].get('sub', ''), 'mode': 'list',
                       'cachedResultName': 'SmartLar | [Sub] Enviar WhatsApp'},
        'workflowInputs': {
            'mappingMode': 'defineBelow',
            'value': {'mensagem': '={{ $json.mensagem }}'},
            'matchingColumns': [],
            'schema': [{'id': c, 'displayName': c, 'required': False, 'defaultMatch': False, 'display': True,
                        'canBeUsedToMatch': True, 'type': 'string', 'removed': c != 'mensagem'} for c in colunas],
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
             '**Entrada**\n- `mensagem` (obrigatório)\n- `telefone` (opcional, padrão: grupo de notificações do Rafael)\n\n'
             '**Configuração:** URL, instância e destino padrão (número ou grupo) no nó *Config da Evolution*\n'
             '**Credencial:** SmartLar · Evolution API\n'
             '**Falhas:** 3 tentativas com 3s de intervalo; depois o erro sobe para quem chamou\n\n'
             f'`#smartlar` `#whatsapp` · `{VERSAO}`',
             [-60, -400], 700, 360, 6),
        node('Quando chamado', 'executeWorkflowTrigger', 1.1, [0, 0],
             {'workflowInputs': {'values': [{'name': 'mensagem'}, {'name': 'telefone'}]}}),
        node('Config da Evolution', 'set', 3.4, [240, 0], campos(
            ('evolution_url', 'https://n8n-evolution-api.dnfcju.easypanel.host'),
            ('instancia', 'smartlar'),
            ('destino_padrao', DESTINO_PADRAO),
            manter_outros=True)),
        node('Enviar mensagem (Evolution)', 'httpRequest', 4.2, [480, 0], {
            'method': 'POST',
            'url': '={{ $json.evolution_url }}/message/sendText/{{ $json.instancia }}',
            'authentication': 'genericCredentialType', 'genericAuthType': 'httpHeaderAuth',
            'sendBody': True, 'specifyBody': 'json',
            'jsonBody': '={{ JSON.stringify({ number: $json.telefone || $json.destino_padrao, text: $json.mensagem }) }}',
            'options': {}},
            credentials={'httpHeaderAuth': credencial('evolution')},
            retryOnFail=True, maxTries=3, waitBetweenTries=3000),
    ],
    'connections': ligar(('Quando chamado', 'Config da Evolution'),
                         ('Config da Evolution', 'Enviar mensagem (Evolution)')),
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
             '**Automação 2 (obrigatória).** Todo dia às 18h manda pro Rafael o resumo das instalações '
             'do dia seguinte: horário, técnico, cliente e endereço.\n\n'
             '**Fuso:** America/Sao_Paulo. O banco guarda em UTC; a janela de "amanhã" é calculada em SP.\n'
             '**Sem instalações:** manda um aviso mesmo assim, pra confirmar que a rotina rodou.\n'
             '**Falhas:** *[Erro] Alerta de falha*\n\n'
             f'`#smartlar` `#supabase` `#whatsapp` `#agendado` · `{VERSAO}`',
             [-60, -440], 1820, 320, 6),
        nota('Etapa 1', '### 1. Consulta o banco\n'
                        'Pedidos `agendado` com `data_instalacao` de 00:00 até 23:59 de amanhã.\n'
                        '*Always Output Data* ligado na busca: sem resultado, o fluxo segue para o aviso.',
             [-60, -100], 900, 520),
        nota('Etapa 2', '### 2. Monta e envia o resumo', [860, -100], 900, 520),
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
        node('Ordenar por horário', 'sort', 1, [960, 0],
             {'sortFieldsUi': {'sortField': [{'fieldName': 'data_instalacao'}]}, 'options': {}}),
        node('Agrupar em uma lista', 'aggregate', 1, [1180, 0],
             {'aggregate': 'aggregateAllItemData', 'destinationFieldName': 'instalacoes', 'options': {}}),
        node('Montar resumo do dia', 'set', 3.4, [1400, 0], campos((
            'mensagem',
            '=📋 *Instalações de amanhã ({{ ' + PERIODO + ' }})*\n\n'
            "{{ $json.instalacoes.map(i => '🕐 *' + " + HORA_SP.format('i.data_instalacao') + ".toFormat('HH:mm') + '* · ' + i.tecnico_nome"
            " + '\\n👤 ' + i.cliente_nome + '\\n📍 ' + i.cliente_endereco).join('\\n\\n') }}\n\n"
            "Total: {{ $json.instalacoes.length }} {{ $json.instalacoes.length === 1 ? 'instalação' : 'instalações' }}"))),
        node('Montar aviso sem instalações', 'set', 3.4, [1180, 240], campos((
            'mensagem',
            '=📋 *Instalações de amanhã ({{ ' + PERIODO + ' }})*\n\nNenhuma instalação agendada. ✅'))),
        enviar_whatsapp('Enviar resumo no WhatsApp', [1620, 100]),
    ],
    'connections': ligar(('Todo dia às 18h', 'Definir período de amanhã'),
                         ('Definir período de amanhã', 'Buscar instalações de amanhã'),
                         ('Buscar instalações de amanhã', 'Tem instalação amanhã?'),
                         ('Tem instalação amanhã?', 'Ordenar por horário', 0),
                         ('Tem instalação amanhã?', 'Montar aviso sem instalações', 1),
                         ('Ordenar por horário', 'Agrupar em uma lista'),
                         ('Agrupar em uma lista', 'Montar resumo do dia'),
                         ('Montar resumo do dia', 'Enviar resumo no WhatsApp'),
                         ('Montar aviso sem instalações', 'Enviar resumo no WhatsApp')),
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

ARQUIVOS = {
    'sub': 'sub-enviar-whatsapp',
    'erro': 'erro-alerta-de-falha',
    'novo_pedido': 'novo-pedido-whatsapp',
    'amanha': 'instalacoes-de-amanha-whatsapp',
    'faturamento': 'pedido-concluido-faturamento',
}

if __name__ == '__main__':
    SAIDA.mkdir(exist_ok=True)
    for chave, wf in workflows.items():
        (SAIDA / f'{ARQUIVOS[chave]}.json').write_text(json.dumps(wf, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'{ARQUIVOS[chave]}.json: {len(wf["nodes"])} nós')
