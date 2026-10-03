# Automações (n8n)

| Workflow | Gatilho | O que faz |
|---|---|---|
| `SmartLar \| Novo pedido → WhatsApp` | Webhook ← trigger `pedidos_notificar_novo` | Avisa o Rafael de cada orçamento novo (cliente, itens, total, data) |
| `SmartLar \| Instalações de amanhã → WhatsApp` | Todo dia às 18h (America/Sao_Paulo) | Resumo das instalações do dia seguinte para o Rafael (avisa também quando não há nenhuma) e a agenda individual de cada técnico |
| `SmartLar \| Pedido concluído → Faturamento (Sheets)` | Webhook ← trigger `pedidos_notificar_concluido` | Registra o faturamento na planilha *SmartLar · Faturamento* (bônus) |
| `SmartLar \| Status do pedido → WhatsApp do cliente` | Webhook ← trigger `pedidos_notificar_status` | Avisa o cliente a cada etapa: aprovado, agendado, em andamento, concluído (além do escopo) |
| `SmartLar \| Orçamentos parados → Lembrete` | Todo dia às 9h | Lista os orçamentos sem resposta há 3+ dias, com link de follow-up pronto para cada cliente (além do escopo) |
| `SmartLar \| [Sub] Enviar WhatsApp` | Chamado pelos outros | Único ponto de contato com a Evolution API; decide o destino pelo consentimento |
| `SmartLar \| [Erro] Alerta de falha` | Error Trigger | Avisa no WhatsApp quando qualquer automação falha |

## Como o Supabase chama o n8n

```
INSERT/UPDATE em pedidos ──trigger──▶ eventos_n8n (outbox, na mesma transação)
                                          │
                                          └─▶ enviar_evento_n8n() ──pg_net (após o COMMIT)──▶ webhook do n8n
                                                     ▲
pg_cron, a cada 5 min ──▶ reprocessar_eventos_n8n(): confirma entregas (2xx) e reenvia falhas
```

- O webhook só aceita requisições com o header `X-Webhook-Secret` correto (credencial *SmartLar · Webhook Supabase*).
- Nenhum segredo fica no repositório: URLs e segredo estão no Vault; chaves de API, nas credenciais do n8n.
- Reenvio com intervalo crescente (5, 10, 20, 40 min... até 6 h), no máximo 10 tentativas. O corpo leva `evento_id` e `tentativa`.
- URL e segredo de cada webhook são lidos do Supabase Vault na hora do envio.
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

## Consentimento (opt-in)

Mensagem direta só para quem autorizou: o cliente com *Avisar pelo WhatsApp* marcado no cadastro (`clientes.notificar_whatsapp`, repassado como `whatsapp_autorizado`). Sem autorização (os telefones fictícios dos dados de exemplo, os técnicos), a mensagem vai para o grupo do Rafael com o aviso *[Para Fulano]*, nunca para o número.

## Convenções

- Nome: `SmartLar | <evento> → <destino>`; sub-workflows com `[Sub]`, tratamento de erro com `[Erro]`
- Tags: `smartlar` + sistemas envolvidos (`supabase`, `whatsapp`, `google-sheets`, `agendado`, `monitoramento`)
- Cada workflow tem uma nota no topo com objetivo, gatilho, destino, tratamento de falhas e versão
- Nós com nomes que descrevem a ação ("Buscar pedido completo", não "Supabase1")
- Sem nó de código: datas com Luxon nas expressões, filtros no próprio nó do Supabase
