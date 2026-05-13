import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePosition } from "@/hooks/usePosition";
import { requiredCapability, POSITION_LABEL } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/** Bloqueia rota se o cargo do usuário não tiver capability. */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { loading, position, can } = usePosition();

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Verificando permissões…</div>;
  }

  const cap = requiredCapability(pathname);

  // Cliente só pode acessar /app, /app/relatorios, /app/configuracoes, /app/notificacoes
  const clienteOk = !cap; // rotas livres
  if (position === "cliente" && !clienteOk) {
    return <AccessDenied position={position} />;
  }

  if (cap && !can(cap)) {
    return <AccessDenied position={position} />;
  }
  return <>{children}</>;
}

function AccessDenied({ position }: { position: any }) {
  return (
    <div className="p-6">
      <Card className="max-w-xl mx-auto mt-12 shadow-elegant">
        <CardContent className="p-8 text-center space-y-3">
          <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
          <h2 className="text-xl font-bold">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Seu cargo atual ({POSITION_LABEL[position as keyof typeof POSITION_LABEL] ?? "—"}) não tem permissão para acessar esta área.
          </p>
          <Button asChild variant="outline"><a href="/app">Voltar ao dashboard</a></Button>
        </CardContent>
      </Card>
    </div>
  );
}
