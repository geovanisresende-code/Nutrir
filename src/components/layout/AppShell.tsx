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
import { cn } from "@/lib/utils";

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

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-[13px] text-muted-foreground">Carregando workspace…</span>
      </div>
    </div>
  );
  if (orgs.length === 0) return <Navigate to="/app/onboarding" replace />;
  if (!current) return <Navigate to="/app/onboarding" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Sidebar mobile drawer */}
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

/* ── PageHeader ─────────────────────────────────────────────────────────── */
interface PageHeaderProps {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  hideBack?: boolean;
  badge?: ReactNode;
}

export const PageHeader = ({ title, description, actions, hideBack, badge }: PageHeaderProps) => (
  <header
    className="bg-card border-b border-border/70"
    style={{ boxShadow: "0 1px 0 hsl(150 12% 90%), 0 2px 8px hsl(155 38% 10% / 0.03)" }}
  >
    {/* Accent line */}
    <div className="h-[2px] w-full" style={{ background: "var(--gradient-primary)" }} />

    <div className="px-5 md:px-6 pt-2">
      {!hideBack && <BackButton />}
    </div>

    <div className="px-5 md:px-6 pb-4 pt-1.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="min-w-0 flex items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-foreground leading-tight truncate">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  </header>
);
