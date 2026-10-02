import { useState, type FormEvent } from "react"
import { toast } from "sonner"
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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { proximosStatus, useAlterarStatus, useTecnicos, useTransicoes } from "@/lib/queries"
import { ACAO_STATUS, PAGAMENTO, STATUS } from "@/lib/status"
import type { FormaPagamento, PedidoStatus, PedidoView } from "@/lib/types"

// O erro já vira toast no onError da mutação; aqui só evita seguir como se tivesse dado certo
async function tentar(promessa: Promise<unknown>) {
  try {
    await promessa
    return true
  } catch {
    return false
  }
}

// ISO (UTC) -> valor de <input type="datetime-local"> no horário local
function paraInputLocal(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function AprovarDialog({ pedido, onClose }: { pedido: PedidoView; onClose: () => void }) {
  const alterar = useAlterarStatus()
  const [pagamento, setPagamento] = useState<FormaPagamento | "">(pedido.forma_pagamento ?? "")

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!pagamento) return
    if (!(await tentar(alterar.mutateAsync({ id: pedido.id!, status: "aprovado", forma_pagamento: pagamento })))) return
    toast.success(`Pedido #${pedido.numero} aprovado.`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Aprovar pedido #{pedido.numero}</DialogTitle>
          <DialogDescription>Informe como o cliente vai pagar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Forma de pagamento *</Label>
            <Select value={pagamento} onValueChange={(v) => setPagamento(v as FormaPagamento)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAGAMENTO).map(([valor, label]) => (
                  <SelectItem key={valor} value={valor}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!pagamento || alterar.isPending}>
            Aprovar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AgendarDialog({ pedido, onClose }: { pedido: PedidoView; onClose: () => void }) {
  const alterar = useAlterarStatus()
  const { data: tecnicos } = useTecnicos()
  const [tecnicoId, setTecnicoId] = useState(pedido.tecnico_id ?? "")
  const [data, setData] = useState(paraInputLocal(pedido.data_instalacao))
  const [agora] = useState(() => paraInputLocal(new Date().toISOString()))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!tecnicoId || !data) return
    if (data < agora) return toast.error("A data da instalação não pode estar no passado.")
    const ok = await tentar(
      alterar.mutateAsync({
        id: pedido.id!,
        status: "agendado",
        tecnico_id: tecnicoId,
        data_instalacao: new Date(data).toISOString(),
      }),
    )
    if (!ok) return
    toast.success(`Instalação do pedido #${pedido.numero} agendada.`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Agendar instalação</DialogTitle>
          <DialogDescription>
            Pedido #{pedido.numero} · {pedido.cliente_nome}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Técnico responsável *</Label>
            <Select value={tecnicoId} onValueChange={setTecnicoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {tecnicos?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} · {t.especialidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="data-instalacao">Data e horário *</Label>
            <Input id="data-instalacao" type="datetime-local" min={agora} value={data}
              onChange={(e) => setData(e.target.value)} />
          </div>
          <Button type="submit" disabled={!tecnicoId || !data || alterar.isPending}>
            Agendar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CancelarDialog({ pedido, onClose }: { pedido: PedidoView; onClose: () => void }) {
  const alterar = useAlterarStatus()
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar o pedido #{pedido.numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            O pedido de {pedido.cliente_nome} fica registrado como cancelado e não pode ser reaberto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={async () => {
              if (!(await tentar(alterar.mutateAsync({ id: pedido.id!, status: "cancelado" })))) return
              toast.success(`Pedido #${pedido.numero} cancelado.`)
              onClose()
            }}
          >
            Cancelar pedido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Botões com os próximos status válidos (vindos de status_transicoes)
export function StatusActions({ pedido, size }: { pedido: PedidoView; size?: "sm" | "default" }) {
  const { data: transicoes } = useTransicoes()
  const alterar = useAlterarStatus()
  const [dialogo, setDialogo] = useState<PedidoStatus | null>(null)
  const proximos = proximosStatus(transicoes, pedido.status)

  async function avancar(status: PedidoStatus) {
    if (status === "aprovado" || status === "agendado" || status === "cancelado") return setDialogo(status)
    if (!(await tentar(alterar.mutateAsync({ id: pedido.id!, status })))) return
    toast.success(`Pedido #${pedido.numero}: ${STATUS[status].label.toLowerCase()}.`)
  }

  if (proximos.length === 0) return null

  return (
    <>
      {proximos.map((status) => (
        <Button
          key={status}
          size={size}
          variant={status === "cancelado" ? "outline" : "default"}
          disabled={alterar.isPending}
          onClick={() => avancar(status)}
        >
          {ACAO_STATUS[status]}
        </Button>
      ))}
      {dialogo === "aprovado" && <AprovarDialog pedido={pedido} onClose={() => setDialogo(null)} />}
      {dialogo === "agendado" && <AgendarDialog pedido={pedido} onClose={() => setDialogo(null)} />}
      {dialogo === "cancelado" && <CancelarDialog pedido={pedido} onClose={() => setDialogo(null)} />}
    </>
  )
}
