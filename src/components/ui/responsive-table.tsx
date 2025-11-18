import * as React from "react";
import { cn } from "@/lib/utils";
import { Table } from "@/components/ui/table";

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: number | string;
}

/**
 * ResponsiveTable - A mobile-optimized wrapper for tables
 * 
 * Features:
 * - Horizontal scrolling on mobile for wide tables
 * - Sticky header support
 * - Touch-friendly scrolling
 * - Shadow indicators for scroll state
 */
export function ResponsiveTable({
  children,
  className,
  minWidth = 600,
}: ResponsiveTableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = React.useState(false);
  const [showRightShadow, setShowRightShadow] = React.useState(false);

  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftShadow(scrollLeft > 0);
    setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    // Initial check
    handleScroll();

    // Add scroll listener
    scrollElement.addEventListener("scroll", handleScroll);
    
    // Add resize observer to check on size changes
    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(scrollElement);

    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [handleScroll]);

  return (
    <div className="relative">
      {/* Left shadow indicator */}
      {showLeftShadow && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      )}
      
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className={cn(
          "w-full overflow-x-auto overflow-y-visible",
          "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
          "rounded-md border",
          className
        )}
      >
        <div
          className="inline-block min-w-full align-middle"
          style={{
            minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth,
          }}
        >
          <Table>{children}</Table>
        </div>
      </div>

      {/* Right shadow indicator */}
      {showRightShadow && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      )}
    </div>
  );
}

/**
 * ResponsiveTableSimple - Simplified version without shadow indicators
 * Use this for better performance when shadows aren't needed
 */
export function ResponsiveTableSimple({
  children,
  className,
  minWidth = 600,
}: ResponsiveTableProps) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto overflow-y-visible",
        "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        "rounded-md border",
        className
      )}
    >
      <div
        className="inline-block min-w-full align-middle"
        style={{
          minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth,
        }}
      >
        <Table>{children}</Table>
      </div>
    </div>
  );
}
