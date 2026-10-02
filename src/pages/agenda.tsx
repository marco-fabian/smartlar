import { useState } from "react"
import { Link } from "react-router"
import { MapPinIcon, PhoneIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusActions } from "@/components/status-actions"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatHora, formatTelefone } from "@/lib/format"
import { useItensPedidos, usePedidos, useTecnicos } from "@/lib/queries"
import type { PedidoView } from "@/lib/types"

const TZ = "America/Sao_Paulo"

function chaveDia(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ }) // AAAA-MM-DD
}

function tituloDia(iso: string) {
  const hoje = chaveDia(new Date().toISOString())
  const amanha = chaveDia(new Date(Date.now() + 86400000).toISOString())
  const chave = chaveDia(iso)
  const data = new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" })
  if (chave === hoje) return `Hoje · ${data}`
  if (chave === amanha) return `Amanhã · ${data}`
  if (chave < hoje) return `Atrasada · ${data}`
  return data
}

export function AgendaPage() {
  const { data: tecnicos } = useTecnicos()
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const tecnicoId = escolhido ?? tecnicos?.[0]?.id
  const { data: pedidos, isLoading } = usePedidos({ tecnicoId, status: ["agendado", "em_andamento"] })
  const { data: itens } = useItensPedidos((pedidos ?? []).map((p) => p.id!))

  // Agrupa por dia, em ordem cronológica
  const porDia = new Map<string, PedidoView[]>()
  for (const p of [...(pedidos ?? [])].sort((a, b) => a.data_instalacao!.localeCompare(b.data_instalacao!))) {
    const chave = chaveDia(p.data_instalacao!)
    porDia.set(chave, [...(porDia.get(chave) ?? []), p])
  }

  return (
    <>
      <PageHeader titulo="Agenda dos técnicos" descricao="Instalações agendadas e em andamento">
        <Select value={tecnicoId ?? ""} onValueChange={setEscolhido}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione o técnico" />
          </SelectTrigger>
          <SelectContent>
            {tecnicos?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome} · {t.especialidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {isLoading && <Skeleton className="h-40" />}
      {!isLoading && porDia.size === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma instalação na agenda deste técnico.
        </p>
      )}

      <div className="grid gap-8">
        {[...porDia.values()].map((doDia) => (
          <section key={chaveDia(doDia[0].data_instalacao!)}>
            <h2 className="mb-3 text-sm font-semibold first-letter:uppercase">{tituloDia(doDia[0].data_instalacao!)}</h2>
            <div className="grid gap-3">
              {doDia.map((p) => (
                <Card key={p.id}>
                  <CardContent className="grid gap-4 sm:grid-cols-[80px_1fr_auto]">
                    <div>
                      <div className="text-xl font-semibold tabular-nums">{formatHora(p.data_instalacao!)}</div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="grid min-w-0 gap-1.5 text-sm">
                      <Link to={`/pedidos/${p.id}`} className="font-medium hover:underline">
                        #{p.numero} · {p.cliente_nome}
                      </Link>
                      <a className="flex items-start gap-1.5 text-muted-foreground hover:underline" target="_blank" rel="noreferrer"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.cliente_endereco ?? "")}`}>
                        <MapPinIcon className="mt-0.5 size-4 shrink-0" /> {p.cliente_endereco}
                      </a>
                      <a className="flex items-center gap-1.5 text-muted-foreground hover:underline" target="_blank" rel="noreferrer"
                        href={`https://wa.me/${p.cliente_telefone}`}>
                        <PhoneIcon className="size-4" /> {formatTelefone(p.cliente_telefone)}
                      </a>
                      <ul className="mt-1 text-muted-foreground">
                        {itens?.filter((i) => i.pedido_id === p.id).map((i) => (
                          <li key={i.id}>
                            {i.quantidade}× {i.produtos?.nome}
                          </li>
                        ))}
                      </ul>
                      {p.observacoes && <p className="text-amber-700 dark:text-amber-400">Obs.: {p.observacoes}</p>}
                    </div>
                    <div className="flex items-start gap-2 sm:flex-col">
                      <StatusActions pedido={p} size="sm" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
