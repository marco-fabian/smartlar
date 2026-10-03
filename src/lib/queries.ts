import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "./supabase"
import type { Database } from "./database.types"
import type { Indicadores, PedidoStatus } from "./types"

type Tables = Database["public"]["Tables"]

// Erros do Postgres (triggers/constraints) já vêm com mensagem em português
function check<R extends { data: unknown; error: { message: string } | null }>(res: R) {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<R["data"]>
}

export function mensagemErro(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes("clientes_telefone_key")) return "Já existe um cliente com esse telefone."
  if (msg.includes("produtos_nome_key")) return "Já existe um produto com esse nome."
  return msg
}

// ---------- Consultas ----------

export function useClientes() {
  return useQuery({
    queryKey: ["clientes"],
    queryFn: async () => check(await supabase.from("clientes").select("*").order("nome")),
  })
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: ["clientes", id],
    enabled: !!id,
    queryFn: async () => check(await supabase.from("clientes").select("*").eq("id", id!).single()),
  })
}

export function useProdutos() {
  return useQuery({
    queryKey: ["produtos"],
    queryFn: async () => check(await supabase.from("produtos").select("*").order("nome")),
  })
}

export function useTecnicos() {
  return useQuery({
    queryKey: ["tecnicos"],
    queryFn: async () => check(await supabase.from("tecnicos").select("*").eq("ativo", true).order("nome")),
  })
}

export function useTransicoes() {
  return useQuery({
    queryKey: ["status_transicoes"],
    staleTime: Infinity,
    queryFn: async () => check(await supabase.from("status_transicoes").select("*")),
  })
}

export function proximosStatus(transicoes: Tables["status_transicoes"]["Row"][] | undefined, atual: PedidoStatus | null) {
  return (transicoes ?? []).filter((t) => t.de === atual).map((t) => t.para)
}

type FiltroPedidos = {
  status?: PedidoStatus[]
  clienteId?: string
  tecnicoId?: string
  instalacaoAte?: string
}

export function usePedidos(filtro: FiltroPedidos = {}) {
  return useQuery({
    queryKey: ["pedidos", filtro],
    queryFn: async () => {
      let q = supabase.from("vw_pedidos").select("*")
      if (filtro.status?.length) q = q.in("status", filtro.status)
      if (filtro.clienteId) q = q.eq("cliente_id", filtro.clienteId)
      if (filtro.tecnicoId) q = q.eq("tecnico_id", filtro.tecnicoId)
      if (filtro.instalacaoAte) q = q.lte("data_instalacao", filtro.instalacaoAte)
      return check(await q.order("numero", { ascending: false }))
    },
  })
}

export function usePedido(id: string | undefined) {
  return useQuery({
    queryKey: ["pedidos", "detalhe", id],
    enabled: !!id,
    queryFn: async () => check(await supabase.from("vw_pedidos").select("*").eq("id", id!).single()),
  })
}

export function useItensPedidos(pedidoIds: string[]) {
  return useQuery({
    queryKey: ["itens", pedidoIds],
    enabled: pedidoIds.length > 0,
    queryFn: async () =>
      check(
        await supabase
          .from("itens_pedido")
          .select("*, produtos(nome, categoria)")
          .in("pedido_id", pedidoIds)
          .order("created_at"),
      ),
  })
}

export function useHistorico(pedidoId: string | undefined) {
  return useQuery({
    queryKey: ["historico", pedidoId],
    enabled: !!pedidoId,
    queryFn: async () =>
      check(
        await supabase.from("historico_status").select("*").eq("pedido_id", pedidoId!).order("alterado_em"),
      ),
  })
}

export function useIndicadores() {
  return useQuery({
    queryKey: ["indicadores"],
    queryFn: async () => check(await supabase.rpc("dashboard_indicadores")) as Indicadores,
  })
}

// ---------- Mutações ----------

// Qualquer escrita pode afetar dashboard, listas e agenda: invalida tudo (app pequeno, custo baixo)
function useInvalidar() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

export function useSalvarCliente() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (cliente: Tables["clientes"]["Insert"]) =>
      check(await supabase.from("clientes").insert(cliente).select().single()),
    onSuccess: invalidar,
  })
}

export function useAutorizarWhatsapp() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, autorizado }: { id: string; autorizado: boolean }) =>
      check(await supabase.from("clientes").update({ notificar_whatsapp: autorizado }).eq("id", id).select().single()),
    onSuccess: invalidar,
    onError: (e) => toast.error(mensagemErro(e)),
  })
}

export function useSalvarProduto() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, ...produto }: Tables["produtos"]["Insert"]) =>
      id
        ? check(await supabase.from("produtos").update(produto).eq("id", id).select().single())
        : check(await supabase.from("produtos").insert(produto).select().single()),
    onSuccess: invalidar,
  })
}

export function useCriarPedido() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (args: {
      clienteId: string
      itens: { produto_id: string; quantidade: number }[]
      observacoes: string
    }) =>
      check(
        await supabase.rpc("criar_pedido", {
          p_cliente_id: args.clienteId,
          p_itens: args.itens,
          p_observacoes: args.observacoes,
        }),
      ),
    onSuccess: invalidar,
  })
}

export function useAlterarStatus() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (args: { id: string; status: PedidoStatus } & Partial<Tables["pedidos"]["Update"]>) => {
      const { id, ...campos } = args
      return check(await supabase.from("pedidos").update(campos).eq("id", id).select().single())
    },
    onSuccess: invalidar,
    onError: (e) => toast.error(mensagemErro(e)),
  })
}
