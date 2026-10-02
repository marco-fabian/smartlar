import type { FormaPagamento, PedidoStatus } from "./types"

export const STATUS: Record<PedidoStatus, { label: string; className: string }> = {
  orcamento: { label: "Orçamento", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  aprovado: { label: "Aprovado", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  agendado: { label: "Agendado", className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  em_andamento: { label: "Em andamento", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  concluido: { label: "Concluído", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
}

export const STATUS_ORDEM: PedidoStatus[] = [
  "orcamento",
  "aprovado",
  "agendado",
  "em_andamento",
  "concluido",
  "cancelado",
]

// Texto do botão que leva o pedido para cada status
export const ACAO_STATUS: Record<PedidoStatus, string> = {
  orcamento: "Voltar para orçamento",
  aprovado: "Aprovar",
  agendado: "Agendar instalação",
  em_andamento: "Iniciar instalação",
  concluido: "Concluir",
  cancelado: "Cancelar pedido",
}

export const PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
}

export const CATEGORIAS: Record<string, string> = {
  seguranca: "Segurança",
  iluminacao: "Iluminação",
  automacao: "Automação",
}
