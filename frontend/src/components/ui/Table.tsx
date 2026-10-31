"use client";

import React, { forwardRef, HTMLAttributes, TableHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Table Container with horizontal scroll
interface TableContainerProps extends HTMLAttributes<HTMLDivElement> {}

const TableContainer = forwardRef<HTMLDivElement, TableContainerProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("overflow-x-auto rounded-lg border border-neutral-200", className)}
      {...props}
    >
      <table className="w-full caption-bottom text-sm" role="grid">
        {children}
      </table>
    </div>
  )
);
TableContainer.displayName = "TableContainer";

// Table Header
interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, children, ...props }, ref) => {
    // Check if children already contain TableRow components
    // If so, don't wrap in <tr> (new API usage)
    // Otherwise, wrap in <tr> (backward compatibility with THead/TH)
    const hasTableRow = React.Children.toArray(children).some(
      (child) => React.isValidElement(child) && child.type === TableRow
    );

    return (
      <thead ref={ref} className={cn("[&_tr]:border-b border-neutral-200", className)} {...props}>
        {hasTableRow ? children : <tr>{children}</tr>}
      </thead>
    );
  }
);
TableHeader.displayName = "TableHeader";

// Table Body
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
);
TableBody.displayName = "TableBody";

// Table Footer
interface TableFooterProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("bg-neutral-50 [&_tr]:border-t border-neutral-200", className)} {...props} />
  )
);
TableFooter.displayName = "TableFooter";

// Table Row
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
  selected?: boolean;
  clickable?: boolean;
}

const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, hover = true, selected = false, clickable = false, children, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-neutral-100 transition-colors",
        hover && "hover:bg-neutral-50",
        selected && "bg-gold-50",
        clickable && "cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
);
TableRow.displayName = "TableRow";

// Table Head Cell
interface TableHeadProps extends HTMLAttributes<HTMLTableCellElement> {
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  onSort?: () => void;
}

const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, width, align = "left", sortable = false, onSort, children, ...props }, ref) => (
    <th
      ref={ref}
      scope="col"
      style={{ width }}
      className={cn(
        "px-4 py-3 text-left font-medium text-neutral-500 uppercase tracking-wider text-xs",
        align === "center" && "text-center",
        align === "right" && "text-right",
        sortable && "cursor-pointer select-none hover:text-neutral-700",
        className
      )}
      onClick={onSort}
      {...props}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortable && (
          <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </div>
    </th>
  )
);
TableHead.displayName = "TableHead";

// Table Cell
interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  nowrap?: boolean;
  colSpan?: number;
}

const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align = "left", nowrap = false, children, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-4 py-3 text-neutral-900",
        align === "center" && "text-center",
        align === "right" && "text-right",
        nowrap && "whitespace-nowrap",
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
);
TableCell.displayName = "TableCell";

// Table Caption
interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {}

const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("px-4 py-3 text-sm text-neutral-500", className)} {...props} />
  )
);
TableCaption.displayName = "TableCaption";

// Skeleton Row for loading state
interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-neutral-100">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 bg-neutral-200 rounded animate-pulse w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export {
  TableContainer,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};