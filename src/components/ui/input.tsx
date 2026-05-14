import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full px-3 py-2 text-sm",
        "rounded-[calc(var(--radius)-1px)]",
        "border border-input bg-background text-foreground",
        "placeholder:text-muted-foreground/55",
        "shadow-soft",
        "transition-colors duration-150",
        "hover:border-ring/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/30",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
