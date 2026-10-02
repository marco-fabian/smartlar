import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createBrowserRouter, RouterProvider } from "react-router"
import { AppLayout } from "@/components/app-layout"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/lib/auth"
import { AgendaPage } from "@/pages/agenda"
import { ClienteDetalhePage } from "@/pages/cliente-detalhe"
import { ClientesPage } from "@/pages/clientes"
import { DashboardPage } from "@/pages/dashboard"
import { LoginPage } from "@/pages/login"
import { NovoPedidoPage } from "@/pages/novo-pedido"
import { PedidoDetalhePage } from "@/pages/pedido-detalhe"
import { PedidosPage } from "@/pages/pedidos"
import { ProdutosPage } from "@/pages/produtos"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 } },
})

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "pedidos", element: <PedidosPage /> },
      { path: "pedidos/novo", element: <NovoPedidoPage /> },
      { path: "pedidos/:id", element: <PedidoDetalhePage /> },
      { path: "clientes", element: <ClientesPage /> },
      { path: "clientes/:id", element: <ClienteDetalhePage /> },
      { path: "produtos", element: <ProdutosPage /> },
      { path: "agenda", element: <AgendaPage /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
