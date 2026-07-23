import { AlertTriangle, CheckCircle2, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import type { QueueItemStatus } from "@/types/invoice";

const config: Record<QueueItemStatus, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  queued: {
    label: "Queued",
    classes: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    icon: Clock,
  },
  uploading: {
    label: "Uploading",
    classes: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    icon: Loader2,
  },
  success: {
    label: "Uploaded",
    classes: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  error: {
    label: "Error",
    classes: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    icon: AlertTriangle,
  },
};

export function StatusBadge({ status }: { status: QueueItemStatus }) {
  const { label, classes, icon: Icon } = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", classes)}>
      <Icon className={cn("h-3.5 w-3.5", status === "uploading" && "animate-spin")} />
      {label}
    </span>
  );
}
