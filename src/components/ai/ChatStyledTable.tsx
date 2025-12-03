import { ReactNode } from "react";
import { Table } from "lucide-react";

interface ChatStyledTableProps {
  children: ReactNode;
  title?: string;
}

export function ChatStyledTable({ children, title }: ChatStyledTableProps) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border shadow-sm bg-card">
      {title && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
          <Table className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}
