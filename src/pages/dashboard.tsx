import { useState } from "react"
import { Link } from "react-router"
import { AlertCircleIcon, CalendarClockIcon, ClipboardListIcon, HourglassIcon, WalletIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBRL, formatData, formatDiaSemana, formatIntervalo } from "@/lib/format"
import { useIndicadores, usePedidos } from "@/lib/queries"

const DIA_MS = 24 * 60 * 60 * 1000

function Indicador({ titulo, valor, icone: Icone, detalhe }: {
  titulo: string
  valor: string | undefined
  icone: typeof WalletIcon
  detalhe: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center justify-between">
          {titulo} <Icone className="size-4" />
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{valor ?? <Skeleton className="h-8 w-24" />}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{detalhe}</CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { data: ind } = useIndicadores()
  // Fixo por montagem da tela: se mudasse a cada render, a chave da consulta mudaria e a busca repetiria sem parar
  const [agora] = useState(() => new Date())
  const { data: agendados, isLoading: carregandoAgendados } = usePedidos({
    status: ["agendado"],
    instalacaoAte: new Date(agora.getTime() + 7 * DIA_MS).toISOString(),
  })
  const { data: orcamentos, isLoading: carregandoOrcamentos } = usePedidos({ status: ["orcamento"] })

  const inicioHoje = new Date(agora)
  inicioHoje.setHours(0, 0, 0, 0)
  const proximas = (agendados ?? [])
    .filter((p) => new Date(p.data_instalacao!) >= inicioHoje)
    .sort((a, b) => a.data_instalacao!.localeCompare(b.data_instalacao!))
  const aguardando = [...(orcamentos ?? [])].sort((a, b) => a.created_at!.localeCompare(b.created_at!))
  const mes = agora.toLocaleDateString("pt-BR", { month: "long" })

  return (
    <>
      <PageHeader titulo="Dashboard" descricao={`Resumo de ${mes}`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Pedidos no mês" icone={ClipboardListIcon}
          valor={ind && String(ind.pedidos_mes)} detalhe="Criados neste mês, em qualquer status" />
        <Indicador titulo="Faturado no mês" icone={WalletIcon}
          valor={ind && formatBRL(ind.faturado_mes)} detalhe="Pedidos concluídos neste mês" />
        <Indicador titulo="A receber" icone={HourglassIcon}
          valor={ind && formatBRL(ind.a_receber)} detalhe="Aprovados, agendados e em andamento" />
        <Indicador titulo="Aguardando agendamento" icone={CalendarClockIcon}
          valor={ind && String(ind.pendentes_agendamento)} detalhe="Aprovados sem data de instalação" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximas instalações</CardTitle>
            <CardDescription>Agendadas para os próximos 7 dias</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {carregandoAgendados && <Skeleton className="h-16" />}
            {!carregandoAgendados && proximas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma instalação agendada.</p>}
            {proximas.map((p) => (
              <Link key={p.id} to={`/pedidos/${p.id}`}
                className="flex gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
                <div className="w-20 shrink-0">
                  <div className="font-medium capitalize">{formatDiaSemana(p.data_instalacao!)}</div>
                  <div className="text-muted-foreground tabular-nums">{formatIntervalo(p.data_instalacao!, p.duracao_minutos)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.cliente_nome}</div>
                  <div className="truncate text-muted-foreground">{p.cliente_endereco}</div>
                </div>
                <Badge variant="secondary" className="self-start">{p.tecnico_nome}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orçamentos aguardando aprovação</CardTitle>
            <CardDescription>Do mais antigo para o mais recente</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {carregandoOrcamentos && <Skeleton className="h-16" />}
            {!carregandoOrcamentos && aguardando.length === 0 && <p className="text-sm text-muted-foreground">Nenhum orçamento pendente.</p>}
            {aguardando.map((p) => {
              const dias = Math.floor((agora.getTime() - new Date(p.created_at!).getTime()) / DIA_MS)
              return (
                <Link key={p.id} to={`/pedidos/${p.id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      #{p.numero} · {p.cliente_nome}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      Enviado em {formatData(p.created_at)}
                      {dias >= 7 && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <AlertCircleIcon className="size-3.5" /> há {dias} dias
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-medium tabular-nums">{formatBRL(p.valor_total)}</span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
