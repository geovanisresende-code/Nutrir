import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary/12 text-primary border border-primary/20",
        secondary:   "bg-muted text-muted-foreground border border-border/60",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20",
        outline:     "border border-border text-foreground bg-transparent",
        success:     "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.22)]",
        warning:     "bg-[hsl(var(--warning)/0.12)] text-[hsl(38_60%_28%)] border border-[hsl(var(--warning)/0.22)]",
        info:        "bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))] border border-[hsl(var(--info)/0.2)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
