"use client";

import React, { forwardRef, LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-sm font-medium text-neutral-700 mb-1.5", className)}
      {...props}
    >
      {children}
    </label>
  )
);
Label.displayName = "Label";