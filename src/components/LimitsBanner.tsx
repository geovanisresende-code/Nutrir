import { useLimits } from "@/hooks/useLimits";
import { AlertTriangle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function LimitsBanner() {
  const { plan, usage, isOverHectares, isOverUsers, isOverAI, isOverNDVI } = useLimits();
  const [dismissed, setDismissed] = useState(false);

  if (!plan || !usage || dismissed) return null;
  const issues: string[] = [];
  if (isOverHectares) issues.push(`hectares (${usage.hectares.toFixed(0)}/${plan.max_hectares})`);
  if (isOverUsers) issues.push(`usuários (${usage.members}/${plan.max_users})`);
  if (isOverAI) issues.push("chamadas de IA do mês");
  if (isOverNDVI) issues.push("leituras NDVI do mês");
  if (issues.length === 0) return null;

  const blocking = isOverHectares || isOverUsers;

  return (
    <div className={`w-full px-4 py-2 flex items-center justify-between gap-3 text-sm ${blocking ? "bg-destructive/10 text-destructive border-b border-destructive/30" : "bg-amber-50 text-amber-900 border-b border-amber-200"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <strong>Limite excedido:</strong> {issues.join(", ")}.{" "}
          {blocking ? "Novas criações estão bloqueadas." : "Considere fazer upgrade."}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild size="sm" variant={blocking ? "destructive" : "default"}>
          <Link to="/app/billing">Ver planos</Link>
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setDismissed(true)} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
