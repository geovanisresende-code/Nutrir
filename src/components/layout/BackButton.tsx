import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botão Voltar — usa history se houver, senão sobe um nível na URL. */
export function BackButton({ to, className }: { to?: string; className?: string }) {
  const nav = useNavigate();
  const { pathname } = useLocation();

  const handle = () => {
    if (to) return nav(to);
    if (window.history.length > 1) return nav(-1);
    // fallback: sobe um nível
    const up = pathname.replace(/\/[^/]+$/, "") || "/app";
    nav(up);
  };

  // Não exibe na raiz /app
  if (pathname === "/app") return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handle}
      className={`h-8 px-2 -ml-2 text-muted-foreground hover:text-foreground ${className ?? ""}`}
      aria-label="Voltar"
    >
      <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
    </Button>
  );
}
