import { Navigate, NavLink, Outlet, useLocation } from "react-router"
import {
  CalendarDaysIcon,
  ClipboardListIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PackageIcon,
  PlusCircleIcon,
  UsersIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

const MENU = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon, end: true },
  { to: "/pedidos/novo", label: "Novo pedido", icon: PlusCircleIcon, end: true },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardListIcon, end: false },
  { to: "/clientes", label: "Clientes", icon: UsersIcon, end: false },
  { to: "/produtos", label: "Produtos", icon: PackageIcon, end: false },
  { to: "/agenda", label: "Agenda dos técnicos", icon: CalendarDaysIcon, end: false },
]

function MenuLink({ item }: { item: (typeof MENU)[number] }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  // "/pedidos" não deve ficar ativo em "/pedidos/novo"
  const ativo = item.end
    ? pathname === item.to
    : pathname.startsWith(item.to) && !(item.to === "/pedidos" && pathname === "/pedidos/novo")

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={ativo}>
        <NavLink to={item.to} onClick={() => setOpenMobile(false)}>
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppLayout() {
  const { session, carregando } = useAuth()

  if (carregando) return null
  if (!session) return <Navigate to="/login" replace />

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HouseIcon className="size-4" />
            </div>
            <span className="font-semibold">SmartLar</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {MENU.map((item) => (
                  <MenuLink key={item.to} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="truncate px-2 pb-1 text-xs text-muted-foreground">{session.user.email}</div>
              <SidebarMenuButton onClick={() => supabase.auth.signOut()}>
                <LogOutIcon />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="font-semibold">SmartLar</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
