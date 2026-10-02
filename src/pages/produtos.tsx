import { useState, type FormEvent } from "react"
import { PencilIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatBRL } from "@/lib/format"
import { mensagemErro, useProdutos, useSalvarProduto } from "@/lib/queries"
import { CATEGORIAS } from "@/lib/status"
import type { Produto } from "@/lib/types"

// "1.234,56" ou "1234.56" -> 1234.56
function parsePreco(valor: string) {
  const limpo = valor.trim().replace(/\s|R\$/g, "")
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

function ProdutoDialog({ produto, aberto, onClose }: { produto: Produto | null; aberto: boolean; onClose: () => void }) {
  const salvar = useSalvarProduto()
  const [nome, setNome] = useState(produto?.nome ?? "")
  const [categoria, setCategoria] = useState(produto?.categoria ?? "")
  const [preco, setPreco] = useState(produto ? produto.preco_unitario.toFixed(2).replace(".", ",") : "")
  const [descricao, setDescricao] = useState(produto?.descricao ?? "")
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const valor = parsePreco(preco)
    if (!nome.trim() || !categoria) return setErro("Preencha nome e categoria.")
    if (valor === null) return setErro("Preço inválido. Use o formato 1.234,56.")
    try {
      await salvar.mutateAsync({
        id: produto?.id,
        nome: nome.trim(),
        categoria,
        preco_unitario: valor,
        descricao: descricao.trim() || null,
      })
      toast.success(produto ? "Produto atualizado." : "Produto cadastrado.")
      onClose()
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="produto-nome">Nome *</Label>
            <Input id="produto-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIAS).map(([valor, label]) => (
                    <SelectItem key={valor} value={valor}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="produto-preco">Preço unitário (R$) *</Label>
              <Input id="produto-preco" inputMode="decimal" placeholder="0,00" value={preco}
                onChange={(e) => setPreco(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="produto-descricao">Descrição</Label>
            <Textarea id="produto-descricao" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          {produto && (
            <p className="text-xs text-muted-foreground">
              Mudar o preço vale só para pedidos novos. Pedidos já criados mantêm o preço da época.
            </p>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProdutosPage() {
  const { data: produtos, isLoading } = useProdutos()
  // undefined = fechado, null = novo produto
  const [editando, setEditando] = useState<Produto | null | undefined>(undefined)

  return (
    <>
      <PageHeader titulo="Produtos" descricao="Catálogo de equipamentos vendidos e instalados">
        <Button onClick={() => setEditando(null)}>
          <PlusIcon /> Novo produto
        </Button>
      </PageHeader>

      {isLoading && <Skeleton className="h-64" />}

      <div className="grid gap-6">
        {Object.entries(CATEGORIAS).map(([categoria, label]) => {
          const itens = (produtos ?? []).filter((p) => p.categoria === categoria)
          if (!isLoading && itens.length === 0) return null
          return (
            <Card key={categoria} className="gap-0 pb-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  {label} <Badge variant="secondary">{itens.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Produto</TableHead>
                      <TableHead className="hidden md:table-cell">Descrição</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="w-12 pr-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((p) => (
                      <TableRow key={p.id} className={p.ativo ? "" : "opacity-50"}>
                        <TableCell className="pl-6 font-medium">
                          {p.nome} {!p.ativo && <Badge variant="outline">Inativo</Badge>}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{p.descricao}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(p.preco_unitario)}</TableCell>
                        <TableCell className="pr-6">
                          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${p.nome}`} onClick={() => setEditando(p)}>
                            <PencilIcon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {editando !== undefined && (
        <ProdutoDialog key={editando?.id ?? "novo"} produto={editando} aberto onClose={() => setEditando(undefined)} />
      )}
    </>
  )
}
