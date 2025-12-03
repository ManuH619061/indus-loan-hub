import { ReactNode, Children, isValidElement, cloneElement } from "react";
import { Table, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";

interface ChatStyledTableProps {
  children: ReactNode;
  title?: string;
}

// Status badge component
export function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  
  if (lower.includes("paid") || lower.includes("safe") || lower.includes("good") || lower.includes("low")) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-medium">
        {status}
      </Badge>
    );
  }
  
  if (lower.includes("overdue") || lower.includes("high") || lower.includes("risk") || lower.includes("critical")) {
    return (
      <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs font-medium">
        {status}
      </Badge>
    );
  }
  
  if (lower.includes("pending") || lower.includes("due") || lower.includes("medium") || lower.includes("warning") || lower.includes("caution")) {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-medium">
        {status}
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary" className="text-xs font-medium">
      {status}
    </Badge>
  );
}

// Mobile card view for a single row
function MobileRowCard({ headers, cells }: { headers: string[]; cells: ReactNode[] }) {
  return (
    <Card className="p-4 bg-card/50 border-border/50">
      <div className="space-y-3">
        {headers.map((header, idx) => {
          const cellContent = cells[idx];
          return (
            <div key={idx} className="flex justify-between items-start gap-4">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
                {header}
              </span>
              <span className="text-sm text-right font-medium">
                {cellContent}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function ChatStyledTable({ children, title }: ChatStyledTableProps) {
  const isMobile = useIsMobile();
  
  // Extract headers and rows from children
  let headers: string[] = [];
  let rows: ReactNode[][] = [];
  
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    
    // Handle thead
    if (child.type === 'thead' || (child.props as any)?.className?.includes('thead')) {
      Children.forEach((child.props as any).children, (tr) => {
        if (isValidElement(tr)) {
          Children.forEach((tr.props as any).children, (th) => {
            if (isValidElement(th)) {
              const text = getTextContent((th.props as any).children);
              headers.push(text);
            }
          });
        }
      });
    }
    
    // Handle tbody
    if (child.type === 'tbody' || (child.props as any)?.className?.includes('tbody')) {
      Children.forEach((child.props as any).children, (tr) => {
        if (isValidElement(tr)) {
          const row: ReactNode[] = [];
          Children.forEach((tr.props as any).children, (td) => {
            if (isValidElement(td)) {
              row.push((td.props as any).children);
            }
          });
          if (row.length > 0) rows.push(row);
        }
      });
    }
  });
  
  // Mobile card view
  if (isMobile && headers.length > 0 && rows.length > 0) {
    return (
      <div className="my-4 space-y-3">
        {title && (
          <div className="flex items-center gap-2 mb-3">
            <Table className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
        )}
        {rows.map((row, idx) => (
          <MobileRowCard key={idx} headers={headers} cells={row} />
        ))}
      </div>
    );
  }

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

// Helper to extract text content
function getTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getTextContent).join('');
  }
  if (isValidElement(node) && (node.props as any).children) {
    return getTextContent((node.props as any).children);
  }
  return '';
}
