import { cn } from "@/lib/cn";
import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/**
 * Tabla de datos estándar. Se usa así:
 *
 * <Table>
 *   <THead><TH>Nombre</TH><TH>Estado</TH></THead>
 *   <TBody>
 *     <TR><TD>Depósito central</TD><TD><Badge/></TD></TR>
 *   </TBody>
 * </Table>
 */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className={cn("w-full min-w-[36rem] border-collapse text-sm", className)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-bone/50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      scope="col"
      className={cn(
        "px-6 py-3 align-middle text-left text-xs font-semibold uppercase tracking-wide text-carbon/60",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-bone/40">{children}</tr>;
}

export function TD({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} className={cn("px-6 py-3 align-middle text-carbon/90", className)}>
      {children}
    </td>
  );
}