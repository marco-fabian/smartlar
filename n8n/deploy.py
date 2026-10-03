"""Publica os workflows de n8n/workflows/*.json na instância do n8n.

Uso:
  N8N_API_URL=... N8N_API_KEY=... python n8n/deploy.py [chave ...]

Cria o workflow se ainda não existe (guardando o ID em ids.json) ou atualiza
o existente, e aplica as tags. Não ativa nada: a ativação é feita no n8n,
depois de testar.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

import build

RAIZ = Path(__file__).parent
URL = os.environ['N8N_API_URL'].rstrip('/')
CHAVE = os.environ['N8N_API_KEY']

TAGS = {
    'sub': ['smartlar', 'whatsapp', 'sub-workflow'],
    'erro': ['smartlar', 'monitoramento'],
    'novo_pedido': ['smartlar', 'supabase', 'whatsapp'],
    'amanha': ['smartlar', 'supabase', 'whatsapp', 'agendado'],
    'faturamento': ['smartlar', 'supabase', 'google-sheets'],
    'status_cliente': ['smartlar', 'supabase', 'whatsapp', 'cliente'],
    'follow_up': ['smartlar', 'supabase', 'whatsapp', 'agendado'],
}


def api(metodo, caminho, corpo=None):
    req = urllib.request.Request(
        f'{URL}/api/v1{caminho}', method=metodo,
        data=None if corpo is None else json.dumps(corpo).encode(),
        headers={'X-N8N-API-KEY': CHAVE, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            texto = resp.read().decode()
            return json.loads(texto) if texto else {}
    except urllib.error.HTTPError as e:
        sys.exit(f'Erro {e.code} em {metodo} {caminho}: {e.read().decode()[:800]}')


def ids_das_tags(nomes):
    existentes = {t['name']: t['id'] for t in api('GET', '/tags?limit=250')['data']}
    for nome in nomes:
        if nome not in existentes:
            existentes[nome] = api('POST', '/tags', {'name': nome})['id']
    return [{'id': existentes[n]} for n in nomes]


def publicar(chave):
    ids = json.loads((RAIZ / 'ids.json').read_text(encoding='utf-8'))
    texto = (build.SAIDA / f'{build.ARQUIVOS[chave]}.json').read_text(encoding='utf-8')
    # O destino (número ou grupo do Rafael) não vai para o repositório público: entra só na publicação
    if os.environ.get('SMARTLAR_WHATSAPP_DESTINO'):
        texto = texto.replace(build.DESTINO_PADRAO, os.environ['SMARTLAR_WHATSAPP_DESTINO'])
    # Números que recebem de verdade mesmo em modo demonstração (separados por vírgula)
    texto = texto.replace(build.NUMEROS_LIBERADOS, os.environ.get('SMARTLAR_WHATSAPP_LIBERADOS', ''))
    wf = json.loads(texto)
    corpo = {k: wf[k] for k in ('name', 'nodes', 'connections', 'settings')}

    wf_id = ids['workflows'].get(chave)
    if wf_id:
        api('PUT', f'/workflows/{wf_id}', corpo)
        acao = 'atualizado'
    else:
        wf_id = api('POST', '/workflows', corpo)['id']
        ids['workflows'][chave] = wf_id
        (RAIZ / 'ids.json').write_text(json.dumps(ids, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        acao = 'criado'

    api('PUT', f'/workflows/{wf_id}/tags', ids_das_tags(TAGS[chave]))
    print(f'{wf["name"]}: {acao} ({wf_id})')


if __name__ == '__main__':
    for chave in sys.argv[1:] or build.ARQUIVOS:
        publicar(chave)
