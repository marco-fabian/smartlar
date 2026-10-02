# Automações (n8n)

| Workflow | Gatilho | O que faz |
|---|---|---|
| `SmartLar \| Novo pedido → WhatsApp` | Webhook ← trigger `pedidos_notificar_novo` | Avisa o Rafael de cada orçamento novo (cliente, valor, data) |
| `SmartLar \| Instalações de amanhã → WhatsApp` | Todo dia às 18h (America/Sao_Paulo) | Resumo das instalações do dia seguinte; avisa também quando não há nenhuma |
| `SmartLar \| Pedido concluído → Faturamento (Sheets)` | Webhook ← trigger `pedidos_notificar_concluido` | Registra o faturamento na planilha *SmartLar · Faturamento* (bônus) |
| `SmartLar \| [Sub] Enviar WhatsApp` | Chamado pelos outros | Único ponto de contato com a Evolution API |
| `SmartLar \| [Erro] Alerta de falha` | Error Trigger | Avisa no WhatsApp quando qualquer automação falha |

## Como o Supabase chama o n8n

```
INSERT/UPDATE em pedidos ──trigger──▶ notificar_n8n() ──pg_net (após o COMMIT)──▶ webhook do n8n
                                         │
                                         └─ URL e segredo lidos do Supabase Vault
```

- O webhook só aceita requisições com o header `X-Webhook-Secret` correto (credencial *SmartLar · Webhook Supabase*).
- Nenhum segredo fica no repositório: URLs e segredo estão no Vault; chaves de API, nas credenciais do n8n.
- O seed não dispara notificações (`set app.seed = 'on'`).

## Versionamento

Os JSON em `workflows/` são a fonte da verdade. Para alterar um workflow:

1. Edite `build.py` e gere os JSON: `python n8n/build.py`
2. Publique: `python n8n/deploy.py` (ou só um: `python n8n/deploy.py novo_pedido`)
3. Faça o commit dos JSON junto com a mudança

O deploy cria ou atualiza cada workflow pelo ID guardado em `ids.json` e aplica as tags. Ele não ativa workflows: a ativação é feita no n8n depois de testar.

Variáveis de ambiente do deploy:

| Variável | Uso |
|---|---|
| `N8N_API_URL`, `N8N_API_KEY` | API da instância do n8n |
| `SMARTLAR_WHATSAPP_DESTINO` | Número ou grupo (`...@g.us`) que recebe as notificações (fica fora do repositório público) |

## Convenções

- Nome: `SmartLar | <evento> → <destino>`; sub-workflows com `[Sub]`, tratamento de erro com `[Erro]`
- Tags: `smartlar` + sistemas envolvidos (`supabase`, `whatsapp`, `google-sheets`, `agendado`, `monitoramento`)
- Cada workflow tem uma nota no topo com objetivo, gatilho, destino, tratamento de falhas e versão
- Nós com nomes que descrevem a ação ("Buscar pedido completo", não "Supabase1")
- Sem nó de código: datas com Luxon nas expressões, filtros no próprio nó do Supabase
