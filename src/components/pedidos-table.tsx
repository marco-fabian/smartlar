import { useNavigate } from "react-router"
import { StatusBadge } from "@/components/status-badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatBRL, formatData, formatDataHora } from "@/lib/format"
import type { PedidoView } from "@/lib/types"

export function PedidosTable({
  pedidos,
  carregando,
  ocultarCliente = false,
}: {
  pedidos: PedidoView[] | undefined
  carregando?: boolean
  ocultarCliente?: boolean
}) {
  const navigate = useNavigate()
  const colunas = ocultarCliente ? 6 : 7

  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Nº</TableHead>
            {!ocultarCliente && <TableHead>Cliente</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="hidden md:table-cell">Técnico</TableHead>
            <TableHead className="hidden md:table-cell">Instalação</TableHead>
            <TableHead className="hidden lg:table-cell">Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {carregando &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={colunas}>
                  <Skeleton className="h-5" />
                </TableCell>
              </TableRow>
            ))}
          {pedidos?.map((p) => (
            <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/pedidos/${p.id}`)}>
              <TableCell className="font-medium">#{p.numero}</TableCell>
              {!ocultarCliente && <TableCell>{p.cliente_nome}</TableCell>}
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatBRL(p.valor_total)}</TableCell>
              <TableCell className="hidden md:table-cell">{p.tecnico_nome ?? "—"}</TableCell>
              <TableCell className="hidden md:table-cell">{formatDataHora(p.data_instalacao)}</TableCell>
              <TableCell className="hidden lg:table-cell">{formatData(p.created_at)}</TableCell>
            </TableRow>
          ))}
          {!carregando && pedidos?.length === 0 && (
            <TableRow>
              <TableCell colSpan={colunas} className="py-8 text-center text-muted-foreground">
                Nenhum pedido encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
