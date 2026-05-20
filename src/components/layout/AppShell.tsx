import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { useOrg } from "@/contexts/OrganizationContext";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { LimitsBanner } from "@/components/LimitsBanner";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { BackButton } from "./BackButton";
import { RouteGuard } from "@/components/RouteGuard";
import { LayoutDashboard, Briefcase, Receipt, ShoppingCart, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePosition } from "@/hooks/usePosition";

/**
 * AppShell — Layout principal estilo Sensix:
 * - Topbar sempre visível (logo + Mapas/Fazendas + busca + perfil)
 * - Sidebar fixa à esquerda (escura, blocos por papel)
 * - Conteúdo principal scrollável
 * - Em rotas como /app/mapas, /app/nutrir/ndvi, /app/nutrir/coleta o
 *   conteúdo automaticamente assume layout fullscreen (sem padding,
 *   ocupando toda a área disponível abaixo da topbar).
 */
const FULLSCREEN_ROUTES = [
  "/app/mapas",
  "/app/nutrir/ndvi",
  "/app/nutrir/coleta",
  "/app/satelite",
  "/app/heatmap",
];

/** Bottom nav itens — exibido somente em mobile para usuários rep */
const BOTTOM_NAV = [
  { to: "/app/rep",          label: "Início",        icon: LayoutDashboard, end: true },
  { to: "/app/rep/rdv",      label: "RDV",           icon: Receipt },
  { to: "/app/rep/clientes", label: "Meus Clientes", icon: Briefcase },
  { to: "/app/rep/pedidos",  label: "Pedidos",       icon: ShoppingCart },
];

function MobileBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation();
  const { position } = usePosition();

  // Só mostra bottom nav para representantes
  if (!position || position === "cliente") return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border flex items-stretch h-16 safe-area-pb">
      {BOTTOM_NAV.map(({ to, label, icon: Icon, end }) => {
        const active = end ? pathname === to : pathname.startsWith(to);
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-primary")} />
            <span>{label}</span>
            {label === "RDV" && (
              <span className="absolute top-2 right-[calc(25%-8px)] h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </NavLink>
        );
      })}
      {/* Botão Menu abre o drawer completo */}
      <button
        onClick={onOpenMenu}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { current, loading, orgs } = useOrg();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { pathname } = useLocation();

  const fullscreen = FULLSCREEN_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));

  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Carregando workspace…</div>;
  if (orgs.length === 0) return <Navigate to="/app/onboarding" replace />;
  if (!current) return <Navigate to="/app/onboarding" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Sidebar — mobile drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <div onClick={() => setSheetOpen(false)}>
            <AppSidebar />
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar onOpenSidebar={() => setSheetOpen(true)} />
        {!fullscreen && <OnboardingBanner />}
        {!fullscreen && <LimitsBanner />}
        {/* Espaço extra no mobile para não cobrir conteúdo com o bottom nav */}
        <div className={cn(
          fullscreen ? "flex-1 min-w-0 min-h-0 relative" : "flex-1 min-w-0",
          "pb-16 md:pb-0"
        )}>
          <RouteGuard>{children}</RouteGuard>
        </div>
      </main>

      {/* Bottom navigation — mobile only */}
      <MobileBottomNav onOpenMenu={() => setSheetOpen(true)} />
    </div>
  );
};

export const PageHeader = ({ title, description, actions, hideBack }: { title: any; description?: string; actions?: ReactNode; hideBack?: boolean }) => (
  <header className="bg-card border-b border-border">
    <div className="px-5 md:px-7 py-5 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
      <div className="min-w-0">
        {!hideBack && <BackButton />}
        <h1 className="text-[22px] md:text-[28px] font-black tracking-tight text-foreground leading-none">{title}</h1>
        {description && (
          <p className="text-[13px] text-muted-foreground mt-2 line-clamp-2">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex gap-2 flex-wrap md:shrink-0">
          {actions}
        </div>
      )}
    </div>
  </header>
);

