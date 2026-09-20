import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-sm border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-paper hover:bg-signal hover:border-signal hover:text-white",
        outline: "border-rule bg-sheet text-ink hover:border-ink",
        ghost: "border-transparent bg-transparent text-muted hover:text-ink",
        destructive: "border-hot bg-hot text-white hover:opacity-90",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-6 px-2 text-[10px]",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
