import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { CheckIcon, ChevronsUpDownIcon, MinusIcon, PlusIcon, Trash2Icon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"
import { ClienteForm } from "@/components/cliente-form"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatBRL, formatTelefone } from "@/lib/format"
import { mensagemErro, useClientes, useCriarPedido, useProdutos } from "@/lib/queries"
import { CATEGORIAS } from "@/lib/status"
import type { Produto } from "@/lib/types"
import { cn } from "@/lib/utils"

type Item = { produto: Produto; quantidade: number }

// Conta em centavos (inteiros) para não acumular erro de ponto flutuante
const centavos = (valor: number) => Math.round(valor * 100)
const subtotalCentavos = (item: Item) => centavos(item.produto.preco_unitario) * item.quantidade

export function NovoPedidoPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: clientes } = useClientes()
  const { data: produtos } = useProdutos()
  const criar = useCriarPedido()

  const [clienteId, setClienteId] = useState<string | null>(params.get("cliente"))
  const [buscaClienteAberta, setBuscaClienteAberta] = useState(false)
  const [novoClienteAberto, setNovoClienteAberto] = useState(false)
  const [buscaProdutoAberta, setBuscaProdutoAberta] = useState(false)
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState("1")
  const [itens, setItens] = useState<Item[]>([])
  const [observacoes, setObservacoes] = useState("")

  const cliente = clientes?.find((c) => c.id === clienteId)
  const produtoSelecionado = produtos?.find((p) => p.id === produtoId)
  const ativos = useMemo(() => (produtos ?? []).filter((p) => p.ativo), [produtos])
  const totalCentavos = itens.reduce((soma, item) => soma + subtotalCentavos(item), 0)
  const qtdNumero = Number.parseInt(quantidade, 10)

  function adicionarItem() {
    if (!produtoSelecionado || !(qtdNumero > 0)) return
    setItens((atual) => {
      // mesmo produto de novo: soma na quantidade em vez de duplicar a linha
      const existente = atual.find((i) => i.produto.id === produtoSelecionado.id)
      if (existente) {
        return atual.map((i) => (i === existente ? { ...i, quantidade: i.quantidade + qtdNumero } : i))
      }
      return [...atual, { produto: produtoSelecionado, quantidade: qtdNumero }]
    })
    setProdutoId(null)
    setQuantidade("1")
  }

  function alterarQuantidade(produtoId: string, quantidade: number) {
    if (quantidade < 1) return
    setItens((atual) => atual.map((i) => (i.produto.id === produtoId ? { ...i, quantidade } : i)))
  }

  async function salvar() {
    if (!clienteId) return toast.error("Selecione o cliente.")
    if (itens.length === 0) return toast.error("Adicione pelo menos um produto.")
    try {
      const pedido = await criar.mutateAsync({
        clienteId,
        itens: itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
        observacoes,
      })
      toast.success(`Orçamento #${pedido.numero} criado: ${formatBRL(pedido.valor_total)}`)
      navigate(`/pedidos/${pedido.id}`)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <>
      <PageHeader titulo="Novo pedido" descricao="O pedido é salvo como orçamento e depois segue o fluxo de aprovação." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-6">
          {/* 1. Cliente */}
          <Card>
            <CardHeader>
              <CardTitle>1. Cliente</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Popover open={buscaClienteAberta} onOpenChange={setBuscaClienteAberta}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="min-w-0 flex-1 justify-between font-normal">
                      <span className={cn("truncate", !cliente && "text-muted-foreground")}>
                        {cliente ? cliente.nome : "Buscar cliente por nome ou telefone..."}
                      </span>
                      <ChevronsUpDownIcon className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Nome ou telefone" />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clientes?.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.nome} ${c.telefone} ${formatTelefone(c.telefone)}`}
                              onSelect={() => {
                                setClienteId(c.id)
                                setBuscaClienteAberta(false)
                              }}
                            >
                              <CheckIcon className={cn(c.id === clienteId ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{c.nome}</span>
                              <span className="ml-auto text-xs text-muted-foreground">{formatTelefone(c.telefone)}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button variant="secondary" onClick={() => setNovoClienteAberto(true)}>
                  <UserPlusIcon /> Cadastrar novo
                </Button>
              </div>
              {cliente && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div>{formatTelefone(cliente.telefone)}</div>
                  <div className="text-muted-foreground">{cliente.endereco}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Produtos */}
          <Card>
            <CardHeader>
              <CardTitle>2. Produtos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid min-w-0 flex-1 gap-2">
                  <Label>Produto</Label>
                  <Popover open={buscaProdutoAberta} onOpenChange={setBuscaProdutoAberta}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="justify-between font-normal">
                        <span className={cn("truncate", !produtoSelecionado && "text-muted-foreground")}>
                          {produtoSelecionado
                            ? `${produtoSelecionado.nome} · ${formatBRL(produtoSelecionado.preco_unitario)}`
                            : "Selecione um produto..."}
                        </span>
                        <ChevronsUpDownIcon className="opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar produto" />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          {Object.entries(CATEGORIAS).map(([categoria, label]) => (
                            <CommandGroup key={categoria} heading={label}>
                              {ativos
                                .filter((p) => p.categoria === categoria)
                                .map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={p.nome}
                                    onSelect={() => {
                                      setProdutoId(p.id)
                                      setBuscaProdutoAberta(false)
                                    }}
                                  >
                                    <span className="truncate">{p.nome}</span>
                                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                      {formatBRL(p.preco_unitario)}
                                    </span>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid w-24 gap-2">
                  <Label htmlFor="quantidade">Qtd.</Label>
                  <Input id="quantidade" type="number" min={1} value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && adicionarItem()} />
                </div>
                <Button onClick={adicionarItem} disabled={!produtoSelecionado || !(qtdNumero > 0)}>
                  <PlusIcon /> Adicionar
                </Button>
              </div>
              {produtoSelecionado && qtdNumero > 0 && (
                <p className="-mt-2 text-sm text-muted-foreground">
                  Subtotal: {qtdNumero} × {formatBRL(produtoSelecionado.preco_unitario)} ={" "}
                  <span className="font-medium text-foreground">
                    {formatBRL((centavos(produtoSelecionado.preco_unitario) * qtdNumero) / 100)}
                  </span>
                </p>
              )}

              {itens.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd.</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Unitário</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item) => (
                      <TableRow key={item.produto.id}>
                        <TableCell className="font-medium whitespace-normal">{item.produto.nome}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon-xs" aria-label="Diminuir"
                              disabled={item.quantidade <= 1}
                              onClick={() => alterarQuantidade(item.produto.id, item.quantidade - 1)}>
                              <MinusIcon />
                            </Button>
                            <span className="w-6 text-center tabular-nums">{item.quantidade}</span>
                            <Button variant="ghost" size="icon-xs" aria-label="Aumentar"
                              onClick={() => alterarQuantidade(item.produto.id, item.quantidade + 1)}>
                              <PlusIcon />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {formatBRL(item.produto.preco_unitario)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(subtotalCentavos(item) / 100)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon-xs" aria-label={`Remover ${item.produto.nome}`}
                            onClick={() => setItens((atual) => atual.filter((i) => i !== item))}>
                            <Trash2Icon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="hidden sm:table-cell">Total</TableCell>
                      <TableCell colSpan={1} className="sm:hidden">Total</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(totalCentavos / 100)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum produto adicionado ainda.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 3. Observações */}
          <Card>
            <CardHeader>
              <CardTitle>3. Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: portão eletrônico antigo, verificar compatibilidade" />
            </CardContent>
          </Card>
        </div>

        {/* Resumo */}
        <Card className="h-fit lg:sticky lg:top-8">
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Cliente</span>
              <span className="truncate text-right">{cliente?.nome ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens</span>
              <span>{itens.reduce((s, i) => s + i.quantidade, 0)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t pt-3">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-semibold tabular-nums">{formatBRL(totalCentavos / 100)}</span>
            </div>
            <Button size="lg" onClick={salvar} disabled={criar.isPending || !clienteId || itens.length === 0}>
              {criar.isPending ? "Salvando..." : "Salvar orçamento"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={novoClienteAberto} onOpenChange={setNovoClienteAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <ClienteForm
            onSalvo={(c) => {
              setClienteId(c.id)
              setNovoClienteAberto(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
