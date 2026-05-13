import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useState } from "react";

export const OnboardingBanner = () => {
  const { completed, loading, hasFarm, hasField } = useOnboarding();
  const [dismissed, setDismissed] = useState(false);

  if (loading || completed || dismissed) return null;
  if (hasFarm && hasField) return null; // hide if user clearly already started

  return (
    <div className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-md bg-primary/15 text-primary shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">Complete a configuração inicial</p>
            <p className="text-xs text-muted-foreground truncate">Cadastre sua primeira fazenda e talhão para liberar todos os módulos.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm">
            <Link to="/app/onboarding">Continuar <ArrowRight className="w-3 h-3 ml-1" /></Link>
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setDismissed(true)} aria-label="Fechar">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
