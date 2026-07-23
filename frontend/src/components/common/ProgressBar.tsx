import { cn } from "@/lib/cn";

interface ProgressBarProps {
  value: number;
  className?: string;
  tone?: "default" | "success" | "error";
}

const toneClasses: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  default: "bg-blue-600 dark:bg-blue-500",
  success: "bg-emerald-600 dark:bg-emerald-500",
  error: "bg-red-600 dark:bg-red-500",
};

export function ProgressBar({ value, className, tone = "default" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-200 ease-out", toneClasses[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
