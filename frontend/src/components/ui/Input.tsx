"use client";

import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  // Backward compatibility
  invalido?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, disabled, required, invalido, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    // Support backward compatibility: invalido is alias for error
    const hasError = error || invalido;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
            {required && <span className="text-danger-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div
              className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={hasError ? "true" : "false"}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              "w-full rounded-lg border bg-white text-neutral-900 placeholder-neutral-400",
              "transition-colors duration-200",
              "focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent",
              "disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed",
              "read-only:bg-neutral-50",
              leftIcon ? "pl-10" : "pl-4",
              rightIcon ? "pr-10" : "pr-4",
              "py-2.5",
              hasError
                ? "border-danger-500 focus:ring-danger-500/20"
                : "border-neutral-300 hover:border-neutral-400",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div
              className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400"
              aria-hidden="true"
            >
              {rightIcon}
            </div>
          )}
        </div>
        {hasError && (
          <p id={`${inputId}-error`} className="mt-1.5 text-sm text-danger-600" role="alert">
            {error || "Campo inválido"}
          </p>
        )}
        {hint && !hasError && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// Textarea Component
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  // Backward compatibility
  invalido?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, disabled, required, invalido, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    // Support backward compatibility: invalido is alias for error
    const hasError = error || invalido;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
            {required && <span className="text-danger-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          required={required}
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={hasError ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          className={cn(
            "w-full rounded-lg border bg-white text-neutral-900 placeholder-neutral-400",
            "transition-colors duration-200 resize-y min-h-[80px]",
            "focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent",
            "disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed",
            "read-only:bg-neutral-50",
            "p-4",
            hasError
              ? "border-danger-500 focus:ring-danger-500/20"
              : "border-neutral-300 hover:border-neutral-400",
            className
          )}
          {...props}
        />
        {hasError && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-sm text-danger-600" role="alert">
            {error || "Campo inválido"}
          </p>
        )}
        {hint && !hasError && (
          <p id={`${textareaId}-hint`} className="mt-1.5 text-sm text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export { Input, Textarea };