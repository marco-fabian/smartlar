import type { Database } from "./database.types"

type Public = Database["public"]

export type Cliente = Public["Tables"]["clientes"]["Row"]
export type Tecnico = Public["Tables"]["tecnicos"]["Row"]
export type Produto = Public["Tables"]["produtos"]["Row"]
export type ItemPedido = Public["Tables"]["itens_pedido"]["Row"]
export type HistoricoStatus = Public["Tables"]["historico_status"]["Row"]
export type PedidoView = Public["Views"]["vw_pedidos"]["Row"]
export type PedidoStatus = Public["Enums"]["pedido_status"]
export type FormaPagamento = Public["Enums"]["forma_pagamento"]

export type Indicadores = {
  pedidos_mes: number
  faturado_mes: number
  a_receber: number
  pendentes_agendamento: number
}
