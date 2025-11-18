import * as React from "react";
import { cn } from "@/lib/utils";
import { ChartContainer } from "@/components/ui/chart";
import { ResponsiveContainer } from "recharts";

interface ResponsiveChartProps {
  children: React.ReactElement;
  config: Record<string, { label: string; color: string }>;
  className?: string;
  height?: number | string;
  minHeight?: number | string;
}

/**
 * ResponsiveChart - A mobile-optimized wrapper for charts
 * 
 * Features:
 * - Horizontal scrolling on mobile for charts wider than screen
 * - Responsive height based on screen size
 * - Touch-friendly interaction
 * - Maintains aspect ratio
 */
export function ResponsiveChart({
  children,
  config,
  className,
  height = 300,
  minHeight = 250,
}: ResponsiveChartProps) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto overflow-y-hidden",
        "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      <div className="min-w-[320px] sm:min-w-full">
        <ChartContainer
          config={config}
          className={cn(
            "w-full",
            typeof height === "number" ? `h-[${height}px]` : "",
            typeof minHeight === "number" ? `min-h-[${minHeight}px]` : ""
          )}
          style={{
            height: typeof height === "number" ? `${height}px` : height,
            minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}

interface ResponsiveChartLegacyProps {
  children: React.ReactElement;
  className?: string;
  height?: number | string;
  minHeight?: number | string;
}

/**
 * ResponsiveChartLegacy - For charts not using ChartContainer
 * (e.g., direct ResponsiveContainer usage)
 */
export function ResponsiveChartLegacy({
  children,
  className,
  height = 300,
  minHeight = 250,
}: ResponsiveChartLegacyProps) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto overflow-y-hidden",
        "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      <div 
        className="min-w-[320px] sm:min-w-full"
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
