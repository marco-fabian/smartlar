import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { MessageCircleIcon, PlusIcon, SearchIcon } from "lucide-react"
import { ClienteForm } from "@/components/cliente-form"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTelefone } from "@/lib/format"
import { useClientes } from "@/lib/queries"

export function ClientesPage() {
  const { data: clientes, isLoading } = useClientes()
  const [busca, setBusca] = useState("")
  const [aberto, setAberto] = useState(false)
  const navigate = useNavigate()

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const digitos = termo.replace(/\D/g, "")
    if (!termo) return clientes ?? []
    return (clientes ?? []).filter(
      (c) => c.nome.toLowerCase().includes(termo) || (digitos && c.telefone.includes(digitos)),
    )
  }, [clientes, busca])

  return (
    <>
      <PageHeader titulo="Clientes" descricao={`${clientes?.length ?? 0} clientes cadastrados`}>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon /> Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
            </DialogHeader>
            <ClienteForm onSalvo={() => setAberto(false)} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por nome ou telefone"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead className="hidden lg:table-cell">Endereço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5" />
                  </TableCell>
                </TableRow>
              ))}
            {filtrados.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {c.nome}
                    {c.notificar_whatsapp && (
                      <MessageCircleIcon className="size-3.5 text-emerald-600" aria-label="Recebe avisos pelo WhatsApp" />
                    )}
                  </span>
                </TableCell>
                <TableCell>{formatTelefone(c.telefone)}</TableCell>
                <TableCell className="hidden md:table-cell">{c.email ?? "—"}</TableCell>
                <TableCell className="hidden max-w-xs truncate lg:table-cell">{c.endereco}</TableCell>
              </TableRow>
            ))}
            {!isLoading && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
