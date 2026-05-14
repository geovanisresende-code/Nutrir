import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { useOrg } from "@/contexts/OrganizationContext";
import { Navigate, useLocation } from "react-router-dom";
import { LimitsBanner } from "@/components/LimitsBanner";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { BackButton } from "./BackButton";
import { RouteGuard } from "@/components/RouteGuard";

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
        <div className={fullscreen ? "flex-1 min-w-0 min-h-0 relative" : "flex-1 min-w-0"}>
          <RouteGuard>{children}</RouteGuard>
        </div>
      </main>
    </div>
  );
};

export const PageHeader = ({ title, description, actions, hideBack }: { title: any; description?: string; actions?: ReactNode; hideBack?: boolean }) => (
  <header className="border-b bg-card/80 backdrop-blur-sm">
    {/* Accent line */}
    <div className="h-[2px] bg-gradient-to-r from-primary via-primary/60 to-transparent" />
    <div className="px-3 md:px-6 pt-2 md:pt-2.5">
      {!hideBack && <BackButton />}
    </div>
    <div className="px-3 md:px-6 pb-3 md:pb-4 pt-1 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
      <div className="min-w-0">
        <h1 className="text-[17px] md:text-[22px] font-semibold tracking-tight text-foreground leading-snug truncate">{title}</h1>
        {description && (
          <p className="text-[12px] md:text-[13px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex gap-2 flex-wrap md:shrink-0 -mx-1 px-1 overflow-x-auto md:overflow-visible">
          {actions}
        </div>
      )}
    </div>
  </header>
);

