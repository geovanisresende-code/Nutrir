import { NavLink, useLocation } from "react-router-dom";
import { Map, Building2, Search, ChevronsUpDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onOpenSidebar?: () => void;
}

const primaryNav = [
  { to: "/app/mapas", label: "Mapas", icon: Map },
  { to: "/app/fazendas", label: "Fazendas", icon: Building2 },
];

export const Topbar = ({ onOpenSidebar }: TopbarProps) => {
  const { orgs, current, switchOrg } = useOrg();
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();

  return (
    <header className="topbar-h sticky top-0 z-30 bg-topbar text-topbar-foreground border-b border-topbar-border shadow-topbar">
      <div className="h-full flex items-center gap-3 px-3 md:px-5">
        {/* Mobile menu */}
        <Button
          variant="ghost" size="icon" className="md:hidden -ml-1"
          onClick={onOpenSidebar} aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Brand */}
        <NavLink to="/app" className="flex items-center gap-2 shrink-0 mr-2">
          <Logo className="h-7 md:h-8" />
        </NavLink>

        {/* Primary nav (Sensix-style: itens principais sempre visíveis na top) */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {primaryNav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 px-3 h-9 rounded-md text-sm font-medium transition-base",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-auto hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, fazenda, talhão, produto…"
              className="pl-9 h-9 bg-muted/40 border-transparent focus-visible:bg-card focus-visible:border-input"
            />
          </div>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2">
          <OfflineIndicator />

          {/* Workspace switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 hidden sm:flex gap-2 max-w-[180px]">
                <span className="truncate">{current?.name ?? "—"}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end">
              <DropdownMenuLabel>Suas organizações</DropdownMenuLabel>
              {orgs.map(o => (
                <DropdownMenuItem key={o.id} onClick={() => switchOrg(o.id)}>
                  <span className="flex-1 truncate">{o.name}</span>
                  <Badge variant="secondary" className="ml-2 text-[10px]">{o.plan_tier}</Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/app/organizacao/nova">+ Nova organização</NavLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <NotificationBell />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center text-xs font-semibold text-primary">
                  {user?.email?.[0]?.toUpperCase() ?? "?"}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="text-xs text-muted-foreground">Conta</div>
                <div className="font-medium truncate">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><NavLink to="/app/configuracoes">Configurações</NavLink></DropdownMenuItem>
              <DropdownMenuItem asChild><NavLink to="/app/equipe">Equipe</NavLink></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
