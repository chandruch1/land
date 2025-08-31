import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-button hover:shadow-glow hover:-translate-y-0.5",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-subtle hover:shadow-card",
        outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50 transition-colors",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-subtle hover:shadow-card",
        ghost: "hover:bg-accent hover:text-accent-foreground transition-colors",
        link: "text-primary underline-offset-4 hover:underline transition-colors",
        // Professional Web3 Variants
        primary: "gradient-primary text-primary-foreground hover:shadow-button transition-all duration-300 font-semibold hover:-translate-y-0.5",
        web3: "bg-emerald text-emerald-dark hover:bg-emerald-light shadow-button hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300 font-semibold",
        gold: "bg-gold text-gold-dark hover:bg-gold-light shadow-button hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300 font-semibold",
        connect: "gradient-secondary text-primary-foreground hover:shadow-button hover:-translate-y-0.5 transition-all duration-300 font-bold text-base",
        admin: "bg-cyan text-cyan-dark hover:bg-cyan-light shadow-button hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300 font-semibold border border-cyan-light",
        // New Professional Variants
        professional: "bg-card text-foreground border border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary/50 shadow-subtle hover:shadow-card hover:-translate-y-0.5 transition-all duration-200",
        subtle: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground shadow-subtle hover:shadow-card transition-all duration-200",
        success: "bg-emerald text-emerald-dark hover:bg-emerald-light shadow-button hover:shadow-glow hover:-translate-y-0.5 transition-all duration-200",
        warning: "bg-gold text-gold-dark hover:bg-gold-light shadow-button hover:shadow-glow hover:-translate-y-0.5 transition-all duration-200",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-base",
        xl: "h-12 rounded-lg px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };