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
  { to: "/app/mapas",   label: "Mapas",    icon: Map },
  { to: "/app/fazendas", label: "Fazendas", icon: Building2 },
];

export const Topbar = ({ onOpenSidebar }: TopbarProps) => {
  const { orgs, current, switchOrg } = useOrg();
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();

  const initials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "??";

  return (
    <header
      className="topbar-h sticky top-0 z-30 flex items-center"
      style={{
        background: "hsl(var(--topbar-background))",
        borderBottom: "1px solid hsl(var(--topbar-border))",
        boxShadow: "0 1px 0 hsl(150 12% 90%), 0 2px 8px hsl(155 38% 10% / 0.04)",
      }}
    >
      <div className="h-full w-full flex items-center gap-2 px-3 md:px-4">

        {/* Mobile menu */}
        <Button
          variant="ghost" size="icon"
          className="md:hidden shrink-0 h-8 w-8 text-muted-foreground"
          onClick={onOpenSidebar}
        >
          <Menu className="h-4.5 w-4.5" />
        </Button>

        {/* Brand */}
        <NavLink to="/app" className="hidden md:flex items-center shrink-0 mr-1">
          <Logo className="h-[28px]" />
        </NavLink>

        {/* Divider */}
        <div className="hidden md:block h-5 w-px bg-border/70 mx-1" />

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {primaryNav.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 px-3 h-8 rounded-md text-[13px] font-medium transition-colors duration-150",
                  active
                    ? "bg-primary/9 text-primary"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Search */}
        <div className="flex-1 max-w-md mx-auto hidden lg:block">
          <button
            className={cn(
              "w-full flex items-center gap-2 h-8 px-3 rounded-md",
              "border border-border/80 bg-muted/50",
              "text-[13px] text-muted-foreground",
              "hover:bg-muted hover:border-border transition-colors duration-150",
              "cursor-text",
            )}
            onClick={() => {/* futuro: abrir command palette */}}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Buscar cliente, fazenda, produto…</span>
            <span className="hidden xl:flex items-center gap-0.5 text-[11px] text-muted-foreground/60">
              <Command className="h-2.5 w-2.5" /><span>K</span>
            </span>
          </button>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5">
          <OfflineIndicator />

          {/* Workspace switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex h-8 gap-1.5 max-w-[200px] text-[13px] border-border/70"
              >
                <span className="truncate font-medium">{current?.name ?? "—"}</span>
                <ChevronsUpDown className="h-3 w-3 opacity-40 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" sideOffset={6}>
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold pb-1">
                Organizações
              </DropdownMenuLabel>
              {orgs.map(o => (
                <DropdownMenuItem
                  key={o.id}
                  onClick={() => switchOrg(o.id)}
                  className={cn("text-[13px]", o.id === current?.id && "bg-primary/8 text-primary font-medium")}
                >
                  <span className="flex-1 truncate">{o.name}</span>
                  <Badge variant="secondary" className="ml-2 text-[10px] py-0">{o.plan_tier}</Badge>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-[13px]">
                <NavLink to="/app/organizacao/nova">
                  <span className="text-primary">+ Nova organização</span>
                </NavLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <NotificationBell />

          {/* Avatar menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0",
                  "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground",
                  "ring-2 ring-background hover:ring-primary/30 transition-all duration-150",
                  "shadow-[0_0_0_1px_hsl(152_68%_20%/0.3)]",
                )}
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end" sideOffset={6}>
              <div className="px-3 py-2.5 border-b border-border/60">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Conta</div>
                <div className="text-[13px] font-medium truncate mt-0.5">{user?.email}</div>
              </div>
              <div className="py-1">
                <DropdownMenuItem asChild className="text-[13px]">
                  <NavLink to="/app/configuracoes">Configurações</NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-[13px]">
                  <NavLink to="/app/equipe">Equipe</NavLink>
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="text-[13px] text-destructive focus:text-destructive focus:bg-destructive/8"
              >
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
