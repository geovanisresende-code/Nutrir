import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary/10 text-primary border border-primary/20",
        secondary:   "bg-muted text-muted-foreground border border-border/60",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
        outline:     "border border-border text-foreground bg-transparent",
        success:     "bg-[hsl(142_60%_38%/0.1)] text-[hsl(142,60%,28%)] border border-[hsl(142_60%_38%/0.2)]",
        warning:     "bg-[hsl(38_92%_50%/0.12)] text-[hsl(30,60%,28%)] border border-[hsl(38_92%_50%/0.2)]",
        info:        "bg-[hsl(200_80%_45%/0.1)] text-[hsl(200,80%,35%)] border border-[hsl(200_80%_45%/0.2)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
