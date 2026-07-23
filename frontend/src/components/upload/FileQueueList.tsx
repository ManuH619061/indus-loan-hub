import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FileQueueRow } from "@/components/upload/FileQueueRow";
import type { QueueItem } from "@/types/invoice";

interface FileQueueListProps {
  items: QueueItem[];
  onRetry: (queueId: string) => void;
  onRemove: (queueId: string) => void;
  onPreview: (item: QueueItem) => void;
}

export function FileQueueList({ items, onRetry, onRemove, onPreview }: FileQueueListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 8,
  });

  return (
    <div
      ref={parentRef}
      className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.queueId}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <FileQueueRow item={item} onRetry={onRetry} onRemove={onRemove} onPreview={onPreview} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
