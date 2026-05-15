import logoSrc from "@/assets/1.png";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "mark";
  className?: string;
  showSubtitle?: boolean;
  subtitleClassName?: string;
}

/**
 * Logo oficial NUTRIR — letras 3D verde esmeralda + broto dourado/prata.
 * Use sempre este componente para manter a marca consistente em UI, PDFs e exports.
 */
export const Logo = ({ variant = "full", className, showSubtitle = false, subtitleClassName }: LogoProps) => (
  <div className={cn("inline-flex flex-col items-start gap-1", className)}>
    <img
      src={logoSrc}
      alt="Nutrir AgTech"
      className={cn("object-contain select-none", variant === "mark" ? "h-9 w-9" : "h-10 w-auto")}
      loading="lazy"
      draggable={false}
    />
    {showSubtitle && (
      <span className={cn("text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold", subtitleClassName)}>
        Nutrição com Inteligência Regenerativa
      </span>
    )}
  </div>
);

export { logoSrc };
