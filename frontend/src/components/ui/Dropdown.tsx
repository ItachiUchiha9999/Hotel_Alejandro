"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownItem {
  label?: string;
  value?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
}

export function Dropdown({ trigger, items, onSelect, placeholder, disabled = false, align = "left" }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyles, setDropdownStyles] = useState<React.CSSProperties>({});

  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 200; // min-w-[200px]
      const viewportWidth = window.innerWidth;

      let left: number;
      if (align === "right") {
        left = rect.right - dropdownWidth;
        // Ensure dropdown doesn't go off-screen
        if (left < 8) left = 8;
      } else {
        left = rect.left;
        // Ensure dropdown doesn't go off-screen
        if (left + dropdownWidth > viewportWidth - 8) {
          left = viewportWidth - dropdownWidth - 8;
        }
      }

      setDropdownStyles({
        position: "fixed",
        top: rect.bottom + 4, // mt-1 = 4px
        left,
        zIndex: 600,
        minWidth: "200px",
      });
    }
  }, [align]);

  const handleTriggerClick = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => {
        const next = !prev;
        if (next) {
          // Update position after opening (next frame)
          requestAnimationFrame(updateDropdownPosition);
        }
        return next;
      });
    }
  }, [disabled, updateDropdownPosition]);

  const handleItemClick = useCallback((item: DropdownItem) => {
    if (!item.disabled && !item.divider && item.value !== undefined) {
      onSelect(item.value);
      setIsOpen(false);
    }
  }, [onSelect]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  }, []);

  // Click outside handler - checks both wrapper (trigger) and dropdown (portal)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideWrapper = wrapperRef.current && !wrapperRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideWrapper && isOutsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update position on scroll/resize when open
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener("scroll", updateDropdownPosition, true);
      window.addEventListener("resize", updateDropdownPosition);
      return () => {
        window.removeEventListener("scroll", updateDropdownPosition, true);
        window.removeEventListener("resize", updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Helper to attach ref and handlers to trigger
  const enhancedTrigger = React.isValidElement(trigger)
    ? React.cloneElement(trigger as React.ReactElement<any>, {
        ref: buttonRef,
        onClick: handleTriggerClick,
        "aria-haspopup": "listbox",
        "aria-expanded": isOpen,
        disabled,
      })
    : (
        <button
          ref={buttonRef}
          onClick={handleTriggerClick}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 hover:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-gold-400 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {placeholder || "Seleccionar"}
          <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
        </button>
      );

  return (
    <div ref={wrapperRef} className="relative inline-block">
      {enhancedTrigger}

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyles}
          className={cn(
            "bg-white rounded-lg shadow-lg border border-neutral-200 py-1",
            "animate-fade-in"
          )}
          role="listbox"
          onKeyDown={handleKeyDown}
        >
          {items.map((item, index) => (
            item.divider ? (
              <div key={index} className="h-px bg-neutral-200 my-1" role="separator" />
            ) : (
              <button
                key={item.value}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                role="option"
                aria-selected={false}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                  "focus:outline-none focus:bg-neutral-100",
                  item.disabled && "opacity-50 cursor-not-allowed text-neutral-400",
                  item.danger && "text-danger-600 hover:bg-danger-50",
                  !item.disabled && !item.danger && "text-neutral-700 hover:bg-neutral-100"
                )}
              >
                {item.icon && <span className="w-4 h-4 flex-shrink-0" aria-hidden="true">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </button>
            )
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}