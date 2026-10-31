"use client";

import React, { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextType {
  toast: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: "bg-success-50 border-success-200 text-success-800",
  error: "bg-danger-50 border-danger-200 text-danger-800",
  warning: "bg-warning-50 border-warning-200 text-warning-800",
  info: "bg-info-50 border-info-200 text-info-800",
};

const toastIconStyles = {
  success: "text-success-500",
  error: "text-danger-500",
  warning: "text-warning-500",
  info: "text-info-500",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = toastIcons[toast.type];
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 200);
      }, toast.duration ?? 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border shadow-lg min-w-[320px] max-w-md animate-slide-in",
        toastStyles[toast.type],
        isExiting && "animate-fade-out translate-x-full opacity-0"
      )}
      role="alert"
      aria-live="polite"
    >
      <div className={cn("flex-shrink-0 mt-0.5", toastIconStyles[toast.type])}>
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-neutral-900">{toast.title}</p>
        {toast.message && <p className="mt-1 text-sm text-neutral-600">{toast.message}</p>}
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
            className="mt-2 text-sm font-medium underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-neutral-200 transition-colors text-neutral-400 hover:text-neutral-600"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Alias for backward compatibility
export const ToasterComponent = ToastProvider;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (newToast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...newToast, id }]);
    return id;
  };

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[800] flex flex-col gap-2 pointer-events-none" role="region" aria-label="Notificaciones">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}