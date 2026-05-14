import { NavLink, useLocation } from "react-router-dom";
import { Map, Building2, Search, ChevronsUpDown, Menu, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface TopbarProps { onOpenSidebar?: () => void; }

const primaryNav = [
  { to: "/app/mapas",    label: "Mapas",    icon: Map },
  { to: "/app/fazendas", label: "Fazendas", icon: Building2 },
];

export const Topbar = ({ onOpenSidebar }: TopbarProps) => {
  const { orgs, current, switchOrg } = useOrg();
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();

  const initials = (user?.email ?? "?").split("@")[0].slice(0, 2).toUpperCase();

  return (
    <header
      className="topbar-h sticky top-0 z-30 bg-topbar text-topbar-foreground border-b border-topbar-border"
      style={{ boxShadow: "var(--shadow-topbar)" }}
    >
      <div className="h-full flex items-center gap-2 px-3 md:px-4">

        {/* Mobile menu */}
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onOpenSidebar}>
          <Menu className="h-4 w-4" />
        </Button>

        {/* Logo */}
        <NavLink to="/app" className="hidden md:flex items-center shrink-0">
          <Logo className="h-7" />
        </NavLink>

        <div className="hidden md:block h-4 w-px bg-border mx-1" />

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {primaryNav.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <NavLink key={to} to={to} className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-md text-[13px] font-medium transition-colors duration-150",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}>
                <Icon className="h-3.5 w-3.5" />{label}
              </NavLink>
            );
          })}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-sm mx-auto hidden lg:block">
          <div className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-md",
            "border border-border bg-muted/50 text-[13px] text-muted-foreground",
            "hover:bg-muted hover:border-border/80 cursor-text transition-colors duration-150",
          )}>
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Buscar cliente, fazenda, produto…</span>
            <kbd className="hidden xl:flex items-center gap-0.5 text-[10px] text-muted-foreground/50 font-mono border border-border/60 rounded px-1 py-0.5">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-1.5">
          <OfflineIndicator />

          {/* Workspace */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:flex h-8 gap-1.5 max-w-[180px] text-[13px] border-border/70 shadow-none">
                <span className="truncate">{current?.name ?? "—"}</span>
                <ChevronsUpDown className="h-3 w-3 opacity-40 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end" sideOffset={6}>
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Organizações
              </DropdownMenuLabel>
              {orgs.map(o => (
                <DropdownMenuItem
                  key={o.id} onClick={() => switchOrg(o.id)}
                  className={cn("text-[13px]", o.id === current?.id && "bg-primary/8 font-medium")}
                >
                  <span className="flex-1 truncate">{o.name}</span>
                  <Badge variant="secondary" className="ml-2 text-[10px] py-0">{o.plan_tier}</Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-[13px]">
                <NavLink to="/app/organizacao/nova" className="text-primary">+ Nova organização</NavLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <NotificationBell />

          {/* Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
                "ring-2 ring-background hover:ring-primary/25 transition-all duration-150",
              )}>
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" sideOffset={6}>
              <div className="px-3 py-2.5 border-b border-border/60">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Conta</div>
                <div className="text-[13px] font-medium truncate mt-0.5">{user?.email}</div>
              </div>
              <div className="py-1">
                <DropdownMenuItem asChild className="text-[13px]"><NavLink to="/app/configuracoes">Configurações</NavLink></DropdownMenuItem>
                <DropdownMenuItem asChild className="text-[13px]"><NavLink to="/app/equipe">Equipe</NavLink></DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-[13px] text-destructive focus:text-destructive focus:bg-destructive/8">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
