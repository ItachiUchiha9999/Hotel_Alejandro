"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface AccordionItem {
  value: string;
  title: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultValue?: string | string[];
  onChange?: (value: string | string[]) => void;
  className?: string;
}

function normalizeDefaultValue(defaultValue?: string | string[], allowMultiple = false): string[] {
  if (defaultValue === undefined) return [];
  if (allowMultiple) {
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  }
  return Array.isArray(defaultValue) ? (defaultValue.length > 0 ? [defaultValue[0]] : []) : [defaultValue];
}

export function Accordion({ items, allowMultiple = false, defaultValue, onChange, className }: AccordionProps) {
  const [openValues, setOpenValues] = useState<string[]>(() => normalizeDefaultValue(defaultValue, allowMultiple));

  const toggle = (value: string) => {
    setOpenValues((prev) => {
      let next: string[];
      if (allowMultiple) {
        next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      } else {
        next = prev.includes(value) ? [] : [value];
      }
      onChange?.(allowMultiple ? next : next[0]);
      return next;
    });
  };

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item) => (
        <AccordionItemComponent
          key={item.value}
          item={item}
          isOpen={openValues.includes(item.value)}
          onToggle={() => toggle(item.value)}
          allowMultiple={allowMultiple}
        />
      ))}
    </div>
  );
}

function AccordionItemComponent({ item, isOpen, onToggle, allowMultiple }: {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
  allowMultiple: boolean;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        disabled={item.disabled}
        className={cn(
          "w-full px-4 py-3.5 text-left flex items-center justify-between gap-4",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2",
          "hover:bg-neutral-50 transition-colors",
          item.disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${item.value}`}
      >
        <span className="font-medium text-neutral-900">{item.title}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-neutral-400 flex-shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id={`accordion-content-${item.value}`}
        role="region"
        aria-label={item.title}
        className={cn("overflow-hidden transition-all duration-200", !isOpen && "max-h-0 opacity-0")}
      >
        <div className="px-4 pb-4 pt-0 border-t border-neutral-100 animate-fade-in">
          {item.content}
        </div>
      </div>
    </div>
  );
}