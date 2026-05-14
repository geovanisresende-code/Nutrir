import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium",
    "rounded-[calc(var(--radius)-1px)]",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[0_1px_2px_hsl(152_62%_12%/0.3),inset_0_1px_0_hsl(0_0%_100%/0.07)]",
          "hover:brightness-110 active:brightness-95 active:scale-[0.985]",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "shadow-[0_1px_2px_hsl(0_78%_20%/0.2)]",
          "hover:bg-destructive/90 active:scale-[0.985]",
        ].join(" "),
        outline: [
          "border border-border bg-background text-foreground",
          "shadow-soft",
          "hover:bg-muted/60 active:scale-[0.985]",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground border border-border/50",
          "hover:bg-secondary/70 active:scale-[0.985]",
        ].join(" "),
        ghost: "text-foreground hover:bg-muted/70 active:scale-[0.985]",
        link:  "text-primary underline-offset-4 hover:underline p-0 h-auto shadow-none",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 px-3 text-[13px]",
        lg:      "h-10 px-6 text-[15px]",
        xl:      "h-11 px-8 text-base",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
