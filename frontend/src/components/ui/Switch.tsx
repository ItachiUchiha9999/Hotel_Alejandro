"use client";

import React, { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex items-start gap-3">
        <div className="relative flex items-center">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            disabled={disabled}
            className={cn(
              "peer h-5 w-5 appearance-none rounded-full border-2 transition-all duration-200",
              "bg-neutral-200 border-neutral-300",
              "checked:bg-gold-500 checked:border-gold-500",
              "checked:after:translate-x-full",
              "after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:bg-white after:rounded-full after:shadow-sm after:transition-transform after:duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              className
            )}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="pt-1">
            {label && (
              <label htmlFor={switchId} className="text-sm font-medium text-neutral-900">
                {label}
              </label>
            )}
            {description && (
              <p className="text-sm text-neutral-500">{description}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);
Switch.displayName = "Switch";