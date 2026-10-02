import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { normalizarTelefone } from "@/lib/format"
import { mensagemErro, useSalvarCliente } from "@/lib/queries"
import type { Cliente } from "@/lib/types"

const VAZIO = { nome: "", telefone: "", email: "", endereco: "", observacoes: "" }

export function ClienteForm({ onSalvo }: { onSalvo: (cliente: Cliente) => void }) {
  const [form, setForm] = useState(VAZIO)
  const [erros, setErros] = useState<Partial<Record<keyof typeof VAZIO, string>>>({})
  const salvar = useSalvarCliente()

  function campo(nome: keyof typeof VAZIO) {
    return {
      id: `cliente-${nome}`,
      value: form[nome],
      "aria-invalid": !!erros[nome],
      onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [nome]: e.target.value })),
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const telefone = normalizarTelefone(form.telefone)
    const novosErros: typeof erros = {}
    if (!form.nome.trim()) novosErros.nome = "Informe o nome."
    if (!telefone) novosErros.telefone = "Telefone com DDD, ex: (11) 98765-4321."
    if (!form.endereco.trim()) novosErros.endereco = "Informe o endereço da instalação."
    setErros(novosErros)
    if (Object.keys(novosErros).length) return

    try {
      const cliente = await salvar.mutateAsync({
        nome: form.nome.trim(),
        telefone: telefone!,
        email: form.email.trim() || null,
        endereco: form.endereco.trim(),
        observacoes: form.observacoes.trim() || null,
      })
      toast.success(`Cliente ${cliente.nome} cadastrado.`)
      setForm(VAZIO)
      onSalvo(cliente)
    } catch (err) {
      toast.error(mensagemErro(err))
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="cliente-nome">Nome *</Label>
        <Input {...campo("nome")} />
        {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="cliente-telefone">Telefone (WhatsApp) *</Label>
          <Input {...campo("telefone")} inputMode="tel" placeholder="(11) 98765-4321" />
          {erros.telefone && <p className="text-xs text-destructive">{erros.telefone}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cliente-email">E-mail</Label>
          <Input {...campo("email")} type="email" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cliente-endereco">Endereço da instalação *</Label>
        <Input {...campo("endereco")} placeholder="Rua, número, complemento - bairro, cidade" />
        {erros.endereco && <p className="text-xs text-destructive">{erros.endereco}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cliente-observacoes">Observações</Label>
        <Textarea {...campo("observacoes")} rows={2} placeholder="Ex: avisar a portaria antes" />
      </div>
      <Button type="submit" disabled={salvar.isPending}>
        {salvar.isPending ? "Salvando..." : "Cadastrar cliente"}
      </Button>
    </form>
  )
}
