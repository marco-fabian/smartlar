const TZ = "America/Sao_Paulo"

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function formatBRL(valor: number | null | undefined) {
  return brl.format(valor ?? 0)
}

export function formatData(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ })
}

export function formatDataHora(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDiaSemana(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
}

export function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
}

// 5511987654321 -> (11) 98765-4321
export function formatTelefone(tel: string | null | undefined) {
  if (!tel) return "—"
  const d = tel.replace(/^55/, "")
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return tel
}

// Aceita "(11) 98765-4321", "11987654321" ou "+55 11 98765-4321"; devolve 5511987654321 ou null se inválido
export function normalizarTelefone(input: string) {
  let d = input.replace(/\D/g, "")
  if (d.length === 10 || d.length === 11) d = "55" + d
  return /^55\d{10,11}$/.test(d) ? d : null
}
