"use client";

import React, { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined" | "elevated" | "ghost";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  // Backward compatibility
  titulo?: string;
  descripcion?: string;
  accion?: React.ReactNode;
  children?: React.ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", padding = "md", hover = false, titulo, descripcion, accion, children, ...props }, ref) => {
    const baseStyles = "rounded-xl transition-all duration-200";

    const variants = {
      default: "bg-white border border-neutral-200",
      outlined: "bg-white border-2 border-neutral-200",
      elevated: "bg-white border border-neutral-200 shadow-lg",
      ghost: "bg-transparent border-none",
    };

    const paddings = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    };

    const hoverStyles = hover
      ? "hover:shadow-md hover:border-neutral-300 hover:-translate-y-0.5 cursor-pointer"
      : "";

    // If using old API (titulo/descripcion), render header automatically
    const hasOldApi = titulo || descripcion || accion;

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], paddings[padding], hoverStyles, className)}
        {...props}
      >
        {hasOldApi && (
          <div className="mb-4">
            {titulo && (
              <h3 className="text-xl font-semibold text-neutral-900">{titulo}</h3>
            )}
            {descripcion && (
              <p className="mt-1 text-sm text-neutral-500">{descripcion}</p>
            )}
            {accion && (
              <div className="mt-4">{accion}</div>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// Card Header
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mb-4", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

// Card Title
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-xl font-semibold text-neutral-900", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

// Card Description
interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("mt-1 text-sm text-neutral-500", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

// Card Content
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

// Card Footer
interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mt-4 pt-4 border-t border-neutral-100 flex items-center gap-3", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };