import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/*
  Inputs formatados pra BRL e Litros — padrão brasileiro:
   - BRL:    R$ 1.234,56     (separador de milhar . e decimal ,)
   - Litros: 1.234,56        (mesma lógica, sufixo "L")

  Ambos auto-completam 2 casas decimais ao perder foco, sem o "0,00" chato
  enquanto vazio. value é number (a casa decimal é convertida pra/de string).
*/

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null | undefined;
  onChange: (v: number) => void;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  allowZero?: boolean;
};

// ── Formatters ──────────────────────────────────────────────────────────────
function fmt(v: number, decimals: number): string {
  if (!isFinite(v)) return "";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function parse(str: string): number {
  if (!str) return NaN;
  // Remove tudo que não é dígito, vírgula ou ponto
  const cleaned = str.replace(/[^\d,.-]/g, "");
  // Padrão br: vírgula é decimal, ponto é milhar — remove pontos e troca vírgula por ponto
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return n;
}

// ── Componente genérico ────────────────────────────────────────────────────
function NumericInputBase({
  value, onChange, decimals = 2, prefix, suffix, allowZero = false, className, ...rest
}: NumericInputProps) {
  // texto local pra permitir digitação livre sem reformatar a cada tecla
  const [text, setText] = React.useState(() =>
    value != null && (allowZero || value > 0) ? fmt(value, decimals) : ""
  );
  const [focused, setFocused] = React.useState(false);

  // Sincroniza se o valor externo mudar (e não estiver com foco)
  React.useEffect(() => {
    if (focused) return;
    setText(value != null && (allowZero || value > 0) ? fmt(value, decimals) : "");
  }, [value, decimals, focused, allowZero]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const n = parse(raw);
    if (!isNaN(n)) onChange(n);
    else if (raw === "") onChange(0);
  };

  const handleBlur = () => {
    setFocused(false);
    const n = parse(text);
    if (isFinite(n) && !isNaN(n)) {
      const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
      onChange(rounded);
      setText(allowZero || rounded > 0 ? fmt(rounded, decimals) : "");
    } else {
      setText("");
    }
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <Input
        {...rest}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        className={cn(
          prefix && "pl-9",
          suffix && "pr-9",
          className
        )}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── Variantes ──────────────────────────────────────────────────────────────
export function InputBRL(props: Omit<NumericInputProps, "prefix" | "decimals">) {
  return <NumericInputBase {...props} prefix="R$" decimals={2} />;
}

export function InputLitros(props: Omit<NumericInputProps, "suffix" | "decimals">) {
  return <NumericInputBase {...props} suffix="L" decimals={2} />;
}

export function InputHectares(props: Omit<NumericInputProps, "suffix" | "decimals">) {
  return <NumericInputBase {...props} suffix="ha" decimals={2} />;
}

export function InputKg(props: Omit<NumericInputProps, "suffix" | "decimals">) {
  return <NumericInputBase {...props} suffix="kg" decimals={2} />;
}

export function InputPercent(props: Omit<NumericInputProps, "suffix" | "decimals">) {
  return <NumericInputBase {...props} suffix="%" decimals={2} />;
}

export const InputNumeric = NumericInputBase;
