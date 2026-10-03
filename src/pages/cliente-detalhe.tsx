import { useState } from "react"
import { Link, useParams } from "react-router"
import { ArrowLeftIcon, MapPinIcon, MailIcon, MessageCircleIcon, PhoneIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { PedidosTable } from "@/components/pedidos-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatBRL, formatData, formatTelefone } from "@/lib/format"
import { useAutorizarWhatsapp, useCliente, usePedidos } from "@/lib/queries"

export function ClienteDetalhePage() {
  const { id } = useParams()
  const { data: cliente, isLoading } = useCliente(id)
  const { data: pedidos, isLoading: carregandoPedidos } = usePedidos({ clienteId: id })
  const autorizar = useAutorizarWhatsapp()
  const [confirmando, setConfirmando] = useState(false)

  async function alterarAutorizacao(autorizado: boolean) {
    try {
      await autorizar.mutateAsync({ id: id!, autorizado })
      toast.success(autorizado ? "Avisos pelo WhatsApp ativados." : "Avisos pelo WhatsApp desativados.")
    } catch {
      // o erro já aparece no toast da mutação
    }
  }

  const totalConcluido = (pedidos ?? [])
    .filter((p) => p.status === "concluido")
    .reduce((soma, p) => soma + (p.valor_total ?? 0), 0)

  if (isLoading) return <Skeleton className="h-40" />
  if (!cliente) return <p>Cliente não encontrado.</p>

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link to="/clientes">
          <ArrowLeftIcon /> Clientes
        </Link>
      </Button>
      <PageHeader titulo={cliente.nome} descricao={`Cliente desde ${formatData(cliente.created_at)}`}>
        <Button asChild>
          <Link to={`/pedidos/novo?cliente=${cliente.id}`}>
            <PlusIcon /> Novo pedido
          </Link>
        </Button>
      </PageHeader>

      <Card className="mb-6">
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <PhoneIcon className="size-4 text-muted-foreground" />
            <a className="hover:underline" href={`https://wa.me/${cliente.telefone}`} target="_blank" rel="noreferrer">
              {formatTelefone(cliente.telefone)}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <MailIcon className="size-4 text-muted-foreground" />
            {cliente.email ?? "—"}
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {cliente.endereco}
          </div>
          {cliente.observacoes && (
            <p className="text-muted-foreground sm:col-span-2">Obs.: {cliente.observacoes}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 sm:col-span-2">
            <MessageCircleIcon className="size-4 text-muted-foreground" />
            <span>Avisos do pedido pelo WhatsApp:</span>
            {cliente.notificar_whatsapp ? (
              <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Autorizado
              </Badge>
            ) : (
              <Badge variant="secondary">Não autorizado</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={autorizar.isPending}
              onClick={() => (cliente.notificar_whatsapp ? alterarAutorizacao(false) : setConfirmando(true))}
            >
              {cliente.notificar_whatsapp ? "Desativar" : "Ativar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar avisos pelo WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              O número {formatTelefone(cliente.telefone)} vai receber uma mensagem a cada etapa do pedido.
              Confirme que o cliente autorizou e que o número é dele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => alterarAutorizacao(true)}>Ativar avisos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Pedidos ({pedidos?.length ?? 0})</h2>
        <span className="text-sm text-muted-foreground">Total concluído: {formatBRL(totalConcluido)}</span>
      </div>
      <PedidosTable pedidos={pedidos} carregando={carregandoPedidos} ocultarCliente />
    </>
  )
}
