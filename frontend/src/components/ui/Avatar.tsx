"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  shape?: "circle" | "square";
  status?: "online" | "offline" | "busy" | "away";
}

const sizeClasses = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-base",
  lg: "w-12 h-12 text-lg",
  xl: "w-16 h-16 text-xl",
  "2xl": "w-24 h-24 text-2xl",
};

const statusSizeClasses = {
  xs: "w-1.5 h-1.5",
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
  xl: "w-4 h-4",
  "2xl": "w-5 h-5",
};

const statusColors = {
  online: "bg-success-500",
  offline: "bg-neutral-400",
  busy: "bg-danger-500",
  away: "bg-warning-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    "bg-gold-400",
    "bg-success-500",
    "bg-info-500",
    "bg-warning-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  shape = "circle",
  status,
  className,
  ...props
}: AvatarProps) {
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-lg";
  const sizeClass = sizeClasses[size];
  const statusSizeClass = statusSizeClasses[size];

  const hasImage = src && src.trim() !== "";

  return (
    <div className={cn("relative inline-flex shrink-0", className)} {...props}>
      {hasImage ? (
        <img
          src={src}
          alt={alt || name || "Avatar"}
          className={cn(sizeClass, shapeClass, "object-cover")}
        />
      ) : name ? (
        <div
          className={cn(sizeClass, shapeClass, "flex items-center justify-center font-medium text-white", getColorFromName(name))}
          aria-label={name}
        >
          {getInitials(name)}
        </div>
      ) : (
        <div className={cn(sizeClass, shapeClass, "flex items-center justify-center bg-neutral-200 text-neutral-500")} aria-hidden="true">
          <User className="w-1/2 h-1/2" />
        </div>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 border-2 border-white",
            shape === "circle" ? "rounded-full" : "rounded",
            statusColors[status],
            statusSizeClass
          )}
          aria-label={`Estado: ${status}`}
        />
      )}
    </div>
  );
}

// Avatar Group
interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  className?: string;
}

export function AvatarGroup({ children, max = 5, className }: AvatarGroupProps) {
  const childArray = React.Children.toArray(children);
  const visibleChildren = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  return (
    <div className={cn("flex -space-x-2", className)} role="group" aria-label="Avatares de grupo">
      {visibleChildren.map((child, index) =>
        React.cloneElement(child as React.ReactElement<any>, {
          className: cn((child as React.ReactElement<any>).props.className, "ring-2 ring-white"),
          style: { zIndex: childArray.length - index },
        })
      )}
      {remainingCount > 0 && (
        <div className={cn(sizeClasses.md, "flex items-center justify-center bg-neutral-100 text-neutral-600 font-medium rounded-full ring-2 ring-white")}>
          +{remainingCount}
        </div>
      )}
    </div>
  );
}