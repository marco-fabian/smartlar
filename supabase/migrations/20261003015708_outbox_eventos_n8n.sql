-- Reenvio de eventos para o n8n (padrão outbox).
--
-- Antes: o trigger chamava o webhook direto; se o n8n estivesse fora do ar, o evento se perdia
-- (o pg_net registra a falha, mas não guarda o corpo da requisição e apaga a resposta em 6 horas).
--
-- Agora: todo evento é gravado em eventos_n8n na MESMA transação do pedido e enviado em seguida.
-- A cada 5 minutos (pg_cron) uma rotina confirma as entregas e reenvia o que falhou,
-- com intervalo crescente: 5, 10, 20, 40, 80, 160, 320 min e depois a cada 6 horas, até 10 tentativas.
-- A rotina roda no banco: quando o n8n volta, os eventos pendentes chegam sozinhos.

create extension if not exists pg_cron;

create table public.eventos_n8n (
  id                bigint generated always as identity primary key,
  webhook           text not null,                       -- nome do segredo no Vault com a URL do webhook
  payload           jsonb not null,
  tentativas        integer not null default 0,
  request_id        bigint,                              -- última requisição no pg_net
  proxima_tentativa timestamptz not null default now(),
  enviado_em        timestamptz,                         -- preenchido quando o n8n responde 2xx
  ultimo_erro       text,
  criado_em         timestamptz not null default now()
);

create index eventos_n8n_pendentes_idx on public.eventos_n8n (proxima_tentativa) where enviado_em is null;

comment on table public.eventos_n8n is 'Outbox: eventos enviados ao n8n, com confirmação de entrega e reenvio automático';

alter table public.eventos_n8n enable row level security;
create policy "autenticado le eventos" on public.eventos_n8n
  for select to authenticated using (true);

-- Uma tentativa de envio: dispara o webhook e agenda a próxima tentativa (usada só se esta falhar)
create function public.enviar_evento_n8n(p_evento_id bigint)
returns void language plpgsql set search_path = '' as $$
declare
  v_evento  public.eventos_n8n;
  v_url     text;
  v_segredo text;
  v_request bigint;
begin
  select * into v_evento from public.eventos_n8n where id = p_evento_id for update;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = v_evento.webhook;
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  if v_url is not null and v_segredo is not null then
    v_request := net.http_post(
      url     := v_url,
      body    := v_evento.payload || jsonb_build_object('evento_id', v_evento.id, 'tentativa', v_evento.tentativas + 1),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Webhook-Secret', v_segredo),
      timeout_milliseconds := 5000
    );
  end if;

  update public.eventos_n8n
     set tentativas        = tentativas + 1,
         request_id        = v_request,
         ultimo_erro       = case when v_request is null then 'Webhook não configurado no Vault' else ultimo_erro end,
         proxima_tentativa = now() + least(5 * power(2, tentativas), 360) * interval '1 minute'
   where id = p_evento_id;
end;
$$;

-- Confirma entregas, registra falhas e reenvia o que está pendente
create function public.reprocessar_eventos_n8n()
returns integer language plpgsql set search_path = '' as $$
declare
  v_id         bigint;
  v_reenviados integer := 0;
begin
  update public.eventos_n8n e
     set enviado_em = r.created, ultimo_erro = null
    from net._http_response r
   where r.id = e.request_id
     and e.enviado_em is null
     and r.status_code between 200 and 299;

  update public.eventos_n8n e
     set ultimo_erro = coalesce(r.error_msg, case when r.timed_out then 'Tempo esgotado' end, 'HTTP ' || r.status_code)
    from net._http_response r
   where r.id = e.request_id
     and e.enviado_em is null
     and (r.status_code is null or r.status_code not between 200 and 299);

  -- Sem resposta 2xx até a hora da próxima tentativa = falhou ou se perdeu: reenvia
  for v_id in
    select id from public.eventos_n8n
     where enviado_em is null
       and tentativas < 10
       and proxima_tentativa <= now()
     order by id
     limit 50
  loop
    perform public.enviar_evento_n8n(v_id);
    v_reenviados := v_reenviados + 1;
  end loop;

  return v_reenviados;
end;
$$;

-- O trigger passa a gravar o evento antes de enviar
create or replace function public.notificar_n8n()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_evento_id bigint;
begin
  -- O seed marca a sessão com app.seed = on para não disparar notificações
  if current_setting('app.seed', true) = 'on' then
    return null;
  end if;

  insert into public.eventos_n8n (webhook, payload)
  values (tg_argv[0], jsonb_build_object(
    'type',       tg_op,
    'table',      tg_table_name,
    'record',     to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end))
  returning id into v_evento_id;

  perform public.enviar_evento_n8n(v_evento_id);
  return null;
end;
$$;

revoke execute on function public.enviar_evento_n8n(bigint) from public, anon, authenticated;
revoke execute on function public.reprocessar_eventos_n8n() from public, anon, authenticated;

select cron.schedule('smartlar-reprocessar-eventos-n8n', '*/5 * * * *', 'select public.reprocessar_eventos_n8n()');
