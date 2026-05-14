import { NavLink, useLocation } from "react-router-dom";
import { Map, Building2, Search, ChevronsUpDown, Menu, Command } from "lucide-react";
import nutrirLogo from "@/assets/logo-nutrir-3d.png";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
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
    <header className="topbar-h sticky top-0 z-30 bg-topbar text-topbar-foreground border-b border-topbar-border">
      <div className="h-full flex items-center gap-2 px-4 md:px-5">

        {/* Mobile menu */}
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={onOpenSidebar}>
          <Menu className="h-4 w-4" />
        </Button>

        {/* Logo */}
        <NavLink to="/app" className="hidden md:flex items-center shrink-0 mr-3">
          <img src={nutrirLogo} alt="Nutrir" className="h-9 w-auto object-contain" />
        </NavLink>

        {/* Separador */}
        <div className="hidden md:block h-5 w-px bg-white/15 mr-1" />

        {/* Nav primary */}
        <nav className="hidden md:flex items-center gap-0.5">
          {primaryNav.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <NavLink key={to} to={to} className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-md text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10",
              )}>
                <Icon className="h-3.5 w-3.5" />{label}
              </NavLink>
            );
          })}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-xs mx-auto hidden lg:block">
          <div className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-md cursor-text",
            "bg-white/10 border border-white/15 text-[13px] text-white/50",
            "hover:bg-white/15 transition-colors duration-150",
          )}>
            <Search className="h-3.5 w-3.5 shrink-0 text-white/40" />
            <span className="flex-1 text-white/45">Buscar cliente, fazenda, produto…</span>
            <kbd className="hidden xl:flex items-center gap-0.5 text-[10px] text-white/30 font-mono border border-white/20 rounded px-1 py-0.5">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <OfflineIndicator />

          {/* Workspace switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium bg-white/10 border border-white/15 text-white/80 hover:bg-white/15 hover:text-white transition-colors duration-150 max-w-[180px]">
                <span className="truncate">{current?.name ?? "—"}</span>
                <ChevronsUpDown className="h-3 w-3 opacity-50 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end" sideOffset={8}>
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Organizações
              </DropdownMenuLabel>
              {orgs.map(o => (
                <DropdownMenuItem
                  key={o.id} onClick={() => switchOrg(o.id)}
                  className={cn("text-[13px]", o.id === current?.id && "font-medium text-primary")}
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

          {/* Notifications */}
          <div className="[&_button]:text-white/70 [&_button]:hover:text-white [&_button]:hover:bg-white/10">
            <NotificationBell />
          </div>

          {/* Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-emerald-400 text-emerald-900 hover:bg-emerald-300 transition-colors duration-150">
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
              <div className="px-3 py-2.5 border-b border-border/60">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Conta</div>
                <div className="text-[13px] font-medium truncate mt-0.5">{user?.email}</div>
              </div>
              <div className="py-1">
                <DropdownMenuItem asChild className="text-[13px]"><NavLink to="/app/configuracoes">Configurações</NavLink></DropdownMenuItem>
                <DropdownMenuItem asChild className="text-[13px]"><NavLink to="/app/equipe">Equipe</NavLink></DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-[13px] text-destructive focus:text-destructive">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
