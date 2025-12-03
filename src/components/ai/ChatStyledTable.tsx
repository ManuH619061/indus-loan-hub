import { ReactNode } from "react";

interface ChatStyledTableProps {
  children: ReactNode;
}

export function ChatStyledTable({ children }: ChatStyledTableProps) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          {children}
        </table>
      </div>
    </div>
  );
}
