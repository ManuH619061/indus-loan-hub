import { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { WidgetConfig } from "@/hooks/useDashboardWidgets";
import { DraggableWidget } from "./DraggableWidget";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardGridProps {
  widgets: WidgetConfig[];
  isEditMode: boolean;
  onReorder: (activeId: string, overId: string) => void;
  onHideWidget: (id: string) => void;
  renderWidget: (widgetId: string) => ReactNode;
  className?: string;
  gridClassName?: string;
}

export function DashboardGrid({
  widgets,
  isEditMode,
  onReorder,
  onHideWidget,
  renderWidget,
  className,
  gridClassName,
}: DashboardGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  };

  const visibleWidgets = widgets.filter(w => w.visible);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visibleWidgets.map(w => w.id)}
        strategy={rectSortingStrategy}
      >
        <div className={cn("space-y-6", className)}>
          <AnimatePresence mode="popLayout">
            {visibleWidgets.map((widget) => (
              <DraggableWidget
                key={widget.id}
                id={widget.id}
                isEditMode={isEditMode}
                onHide={() => onHideWidget(widget.id)}
                className={gridClassName}
              >
                {renderWidget(widget.id)}
              </DraggableWidget>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}
