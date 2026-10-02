import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { PlusIcon, SearchIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { PedidosTable } from "@/components/pedidos-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePedidos } from "@/lib/queries"
import { STATUS, STATUS_ORDEM } from "@/lib/status"
import type { PedidoStatus } from "@/lib/types"

export function PedidosPage() {
  const [params, setParams] = useSearchParams()
  const filtro = (params.get("status") as PedidoStatus | null) ?? "todos"
  const [busca, setBusca] = useState("")
  const { data: pedidos, isLoading } = usePedidos()

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos?.length ?? 0 }
    for (const p of pedidos ?? []) c[p.status!] = (c[p.status!] ?? 0) + 1
    return c
  }, [pedidos])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase().replace(/^#/, "")
    return (pedidos ?? []).filter(
      (p) =>
        (filtro === "todos" || p.status === filtro) &&
        (!termo || p.cliente_nome?.toLowerCase().includes(termo) || String(p.numero) === termo),
    )
  }, [pedidos, filtro, busca])

  return (
    <>
      <PageHeader titulo="Pedidos" descricao="Todos os orçamentos e instalações">
        <Button asChild>
          <Link to="/pedidos/novo">
            <PlusIcon /> Novo pedido
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-3">
        <div className="overflow-x-auto">
          <Tabs value={filtro} onValueChange={(v) => setParams(v === "todos" ? {} : { status: v }, { replace: true })}>
            <TabsList>
              <TabsTrigger value="todos">Todos ({contagem.todos})</TabsTrigger>
              {STATUS_ORDEM.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {STATUS[s].label} ({contagem[s] ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="relative max-w-sm">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por cliente ou nº do pedido" value={busca}
            onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <PedidosTable pedidos={filtrados} carregando={isLoading} />
    </>
  )
}
