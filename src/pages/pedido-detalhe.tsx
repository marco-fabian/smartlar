import { Link, useParams } from "react-router"
import { ArrowLeftIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusActions } from "@/components/status-actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatBRL, formatData, formatDataHora, formatIntervalo, formatTelefone } from "@/lib/format"
import { useHistorico, useItensPedidos, usePedido } from "@/lib/queries"
import { PAGAMENTO, STATUS } from "@/lib/status"

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  )
}

export function PedidoDetalhePage() {
  const { id } = useParams()
  const { data: pedido, isLoading } = usePedido(id)
  const { data: itens } = useItensPedidos(id ? [id] : [])
  const { data: historico } = useHistorico(id)

  if (isLoading) return <Skeleton className="h-64" />
  if (!pedido) return <p>Pedido não encontrado.</p>

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/pedidos">
          <ArrowLeftIcon /> Pedidos
        </Link>
      </Button>
      <PageHeader titulo={`Pedido #${pedido.numero}`} descricao={`Criado em ${formatDataHora(pedido.created_at)}`}>
        <StatusActions pedido={pedido} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Cliente</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Campo label="Nome">
                  <Link className="hover:underline" to={`/clientes/${pedido.cliente_id}`}>
                    {pedido.cliente_nome}
                  </Link>
                </Campo>
                <Campo label="Telefone">
                  <a className="hover:underline" href={`https://wa.me/${pedido.cliente_telefone}`} target="_blank" rel="noreferrer">
                    {formatTelefone(pedido.cliente_telefone)}
                  </a>
                </Campo>
                <Campo label="Endereço da instalação">{pedido.cliente_endereco}</Campo>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Instalação <StatusBadge status={pedido.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Campo label="Técnico">{pedido.tecnico_nome ?? "Não definido"}</Campo>
                <Campo label="Data e horário">{pedido.data_instalacao
                    ? `${formatData(pedido.data_instalacao)}, ${formatIntervalo(pedido.data_instalacao, pedido.duracao_minutos)}`
                    : "Não agendada"}</Campo>
                <Campo label="Forma de pagamento">
                  {pedido.forma_pagamento ? PAGAMENTO[pedido.forma_pagamento] : "Definida na aprovação"}
                </Campo>
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 pb-0">
            <CardHeader className="pb-3">
              <CardTitle>Itens</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Produto</TableHead>
                    <TableHead className="text-center">Qtd.</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Unitário</TableHead>
                    <TableHead className="pr-6 text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-6 font-medium whitespace-normal">{item.produtos?.nome}</TableCell>
                      <TableCell className="text-center tabular-nums">{item.quantidade}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatBRL(item.preco_unitario)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{formatBRL(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-6" colSpan={2}>Total</TableCell>
                    <TableCell className="hidden sm:table-cell" />
                    <TableCell className="pr-6 text-right tabular-nums">{formatBRL(pedido.valor_total)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {pedido.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{pedido.observacoes}</CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative grid gap-4 border-l pl-4">
              {historico?.map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border bg-background" />
                  <div className="font-medium">{STATUS[h.status_novo].label}</div>
                  <div className="text-xs text-muted-foreground">{formatDataHora(h.alterado_em)}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
