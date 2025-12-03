import { ReactNode } from "react";
import { Table } from "lucide-react";

interface ChatStyledTableProps {
  children: ReactNode;
  title?: string;
}

export function ChatStyledTable({ children, title }: ChatStyledTableProps) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border shadow-md bg-card">
      {title && (
        <div className="px-4 py-2.5 bg-muted/60 border-b border-border flex items-center gap-2">
          <Table className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}
