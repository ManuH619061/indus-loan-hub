import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Page title displayed at the top */
  title?: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Right-side actions (buttons, etc.) */
  actions?: ReactNode;
  /** Full width without max-width constraint */
  fullWidth?: boolean;
}

export function PageContainer({
  children,
  className,
  title,
  subtitle,
  actions,
  fullWidth = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "p-4 md:p-6 lg:p-8",
        !fullWidth && "max-w-[1440px] mx-auto",
        className
      )}
    >
      {/* Page Header */}
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <div>
            {title && (
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}

      {/* Page Content */}
      {children}
    </div>
  );
}

/** 
 * Section component for grouping related content within a page
 */
interface PageSectionProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageSection({
  children,
  className,
  title,
  subtitle,
  actions,
}: PageSectionProps) {
  return (
    <section className={cn("mb-6 md:mb-8", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            {title && (
              <h2 className="text-lg md:text-xl font-semibold text-foreground">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Grid layout for cards - responsive columns
 */
interface CardGridProps {
  children: ReactNode;
  className?: string;
  /** Number of columns on different breakpoints */
  cols?: {
    default?: 1 | 2 | 3 | 4;
    sm?: 1 | 2 | 3 | 4;
    md?: 1 | 2 | 3 | 4;
    lg?: 1 | 2 | 3 | 4;
    xl?: 1 | 2 | 3 | 4;
  };
}

const colsMap = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function CardGrid({
  children,
  className,
  cols = { default: 1, sm: 2, lg: 3, xl: 4 },
}: CardGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 md:gap-6",
        cols.default && colsMap[cols.default],
        cols.sm && `sm:${colsMap[cols.sm]}`,
        cols.md && `md:${colsMap[cols.md]}`,
        cols.lg && `lg:${colsMap[cols.lg]}`,
        cols.xl && `xl:${colsMap[cols.xl]}`,
        className
      )}
    >
      {children}
    </div>
  );
}
