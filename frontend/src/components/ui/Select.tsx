"use client";

import React, { forwardRef, SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  placeholder?: string;
  // Backward compatibility: allow children (old API)
  children?: ReactNode;
  // Backward compatibility
  invalido?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, children, id, disabled, required, invalido, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    // Support backward compatibility: invalido is alias for error
    const hasError = error || invalido;

    // Support both old API (children) and new API (options prop)
    const selectOptions = options || (children ? React.Children.toArray(children).filter(React.isValidElement).map(child => {
      const opt = child as React.ReactElement<any>;
      return {
        value: opt.props.value,
        label: opt.props.children || opt.props.value,
        disabled: opt.props.disabled,
      };
    }) : []);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
            {required && <span className="text-danger-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-invalid={hasError ? "true" : "false"}
            aria-describedby={hasError ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
            className={cn(
              "w-full rounded-lg border bg-white text-neutral-900",
              "transition-colors duration-200 appearance-none",
              "focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent",
              "disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed",
              "py-2.5 pl-4 pr-10",
              hasError
                ? "border-danger-500 focus:ring-danger-500/20"
                : "border-neutral-300 hover:border-neutral-400",
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {selectOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-400" aria-hidden="true">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {hasError && (
          <p id={`${selectId}-error`} className="mt-1.5 text-sm text-danger-600" role="alert">
            {error || "Campo inválido"}
          </p>
        )}
        {hint && !hasError && (
          <p id={`${selectId}-hint`} className="mt-1.5 text-sm text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select, type SelectOption };