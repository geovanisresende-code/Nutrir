import { Input } from "@/components/ui/input";
import { AlertTriangle, ShieldAlert, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const LIMITE_DESCONTO_MAX = 15;
export const LIMITE_DESCONTO_AUTORIZADO = 5;
export const LIMITE_DESCONTO_APROVACAO = 12;

export type NivelDesconto = "ok" | "atencao" | "alerta" | "bloqueado";

export function nivelDesconto(pct: number): NivelDesconto {
  if (pct > LIMITE_DESCONTO_MAX) return "bloqueado";
  if (pct > LIMITE_DESCONTO_APROVACAO) return "alerta";
  if (pct > LIMITE_DESCONTO_AUTORIZADO) return "atencao";
  return "ok";
}

export function descontoBloqueado(pct: number): boolean {
  return nivelDesconto(pct) === "bloqueado";
}

interface Props {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  className?: string;
}

/**
 * Input de desconto (%) com semáforo:
 *  - até 5%   → verde (autorizado)
 *  - 5–12%   → amarelo (atenção)
 *  - 12–15% → vermelho (precisa aprovação do gerente)
 *  - >15%    → bloqueado (não permite digitar)
 */
export function DescontoInput({ value, onChange, label = "Desconto (%)", className }: Props) {
  const nivel = nivelDesconto(value);

  const cor =
    nivel === "ok" ? "border-[#d4a843]/60 focus-visible:ring-[#d4a843]" :
    nivel === "atencao" ? "border-yellow-500/70 focus-visible:ring-yellow-500" :
    nivel === "alerta" ? "border-red-500/70 focus-visible:ring-red-500" :
    "border-red-700 focus-visible:ring-red-700";

  const handle = (raw: string) => {
    const n = parseFloat(raw.replace(",", ".")) || 0;
    // bloqueia digitação acima do limite máximo
    if (n > LIMITE_DESCONTO_MAX) {
      onChange(LIMITE_DESCONTO_MAX);
      return;
    }
    if (n < 0) { onChange(0); return; }
    onChange(n);
  };

  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Input
          type="number"
          step="0.1"
          min={0}
          max={LIMITE_DESCONTO_MAX}
          inputMode="decimal"
          value={value}
          onChange={(e) => handle(e.target.value)}
          className={cn("pr-9", cor)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
      <DescontoMensagem pct={value} />
    </div>
  );
}

export function DescontoMensagem({ pct }: { pct: number }) {
  const n = nivelDesconto(pct);
  if (n === "ok") {
    return (
      <p className="text-[11px] flex items-center gap-1 text-[#b08826] dark:text-[#d4a843]">
        <Check className="h-3 w-3" /> Desconto autorizado (até {LIMITE_DESCONTO_AUTORIZADO}%).
      </p>
    );
  }
  if (n === "atencao") {
    return (
      <p className="text-[11px] flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
        <AlertTriangle className="h-3 w-3" /> Acima de {LIMITE_DESCONTO_AUTORIZADO}% — atenção.
      </p>
    );
  }
  if (n === "alerta") {
    return (
      <p className="text-[11px] flex items-center gap-1 text-red-600 dark:text-red-400">
        <ShieldAlert className="h-3 w-3" /> Acima de {LIMITE_DESCONTO_APROVACAO}% — exige aprovação do gerente.
      </p>
    );
  }
  return (
    <p className="text-[11px] flex items-center gap-1 text-red-700 dark:text-red-400 font-medium">
      <ShieldAlert className="h-3 w-3" /> Desconto máximo permitido: {LIMITE_DESCONTO_MAX}%.
    </p>
  );
}
