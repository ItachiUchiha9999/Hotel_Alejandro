"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

const positionClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowClasses = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-neutral-900",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-neutral-900",
  left: "left-full top-1/2 -translate-y-1/2 border-l-neutral-900",
  right: "right-full top-1/2 -translate-y-1/2 border-r-neutral-900",
};

export function Tooltip({ content, children, position = "top", delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const childRef = useRef<HTMLElement | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const tooltipContent = (
    <div
      className={cn(
        "absolute z-[700] px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-lg shadow-lg",
        "whitespace-nowrap animate-fade-in",
        positionClasses[position]
      )}
      role="tooltip"
    >
      {content}
      <div
        className={cn(
          "absolute w-0 h-0 border-4 border-transparent",
          arrowClasses[position]
        )}
        aria-hidden="true"
      />
    </div>
  );

  // Wrap children in a span to attach events and ref
  const childWithRef = React.isValidElement(children) ? (
    <span
      ref={childRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
    </span>
  ) : null;

  return (
    <>
      {childWithRef}
      {isVisible && childRef.current && createPortal(tooltipContent, document.body)}
    </>
  );
}