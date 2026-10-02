import { Badge } from "@/components/ui/badge"
import { STATUS } from "@/lib/status"
import type { PedidoStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export function StatusBadge({ status }: { status: PedidoStatus | null }) {
  if (!status) return null
  const s = STATUS[status]
  return <Badge className={cn("border-transparent", s.className)}>{s.label}</Badge>
}
