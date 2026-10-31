"use client";

import React, { forwardRef, ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-gold-400 text-neutral-900 hover:bg-gold-500 active:bg-gold-600 shadow-sm",
        secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 border border-neutral-200",
        outline: "border-2 border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100",
        ghost: "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200",
        danger: "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 shadow-sm",
        success: "bg-success-500 text-white hover:bg-success-600 active:bg-success-700 shadow-sm",
      },
      size: {
        xs: "h-7 px-2.5 text-xs",
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-8 text-lg",
        icon: "h-9 w-9 p-0", // square icon-only button
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

// Map old Spanish prop names to new ones
const variantMap: Record<string, string> = {
  primario: "primary",
  secundario: "secondary",
  contorno: "outline",
  fantasma: "ghost",
  peligro: "danger",
  exito: "success",
};

const sizeMap: Record<string, string> = {
  pequenio: "xs",
  pequeno: "sm",
  mediano: "md",
  grande: "lg",
  extragrande: "xl",
  icono: "icon",
  icon: "icon",
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  cargando?: boolean; // backward compatibility
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  // Backward compatibility props
  variante?: keyof typeof variantMap;
  tamano?: keyof typeof sizeMap;
  anchoCompleto?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, cargando, leftIcon, rightIcon, disabled, children, variante, tamano, anchoCompleto, ...props }, ref) => {
    // Support old Spanish prop names
    const resolvedVariant = ((variante && variantMap[variante]) || variant) as ButtonProps["variant"];
    const resolvedSize = ((tamano && sizeMap[tamano]) || size) as ButtonProps["size"];
    const resolvedFullWidth = anchoCompleto ?? fullWidth;
    const resolvedLoading = loading ?? cargando;

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize, fullWidth: resolvedFullWidth, className }))}
        disabled={disabled || resolvedLoading}
        aria-busy={resolvedLoading}
        {...props}
      >
        {resolvedLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };