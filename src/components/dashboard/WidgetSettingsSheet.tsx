import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, EyeOff, RotateCcw, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetConfig } from "@/hooks/useDashboardWidgets";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WidgetSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgets: WidgetConfig[];
  onToggle: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onReset: () => void;
}

function SortableWidgetItem({ 
  widget, 
  onToggle 
}: { 
  widget: WidgetConfig; 
  onToggle: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-muted/50 rounded-lg",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          !widget.visible && "text-muted-foreground"
        )}>
          {widget.title}
        </p>
      </div>
      
      <Switch
        checked={widget.visible}
        onCheckedChange={() => onToggle(widget.id)}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}

export function WidgetSettingsSheet({
  open,
  onOpenChange,
  widgets,
  onToggle,
  onReorder,
  onShowAll,
  onHideAll,
  onReset,
}: WidgetSettingsSheetProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
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

  const visibleCount = widgets.filter(w => w.visible).length;
  const hiddenCount = widgets.length - visibleCount;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Customize Dashboard</SheetTitle>
          <SheetDescription>
            Drag to reorder widgets and toggle their visibility
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between py-4 border-b">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{visibleCount}</span> visible
            {hiddenCount > 0 && (
              <>, <span className="font-medium text-foreground">{hiddenCount}</span> hidden</>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onShowAll}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              All
            </Button>
            <Button variant="outline" size="sm" onClick={onHideAll}>
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              None
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-280px)] py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={widgets.map(w => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {widgets.map((widget) => (
                  <SortableWidgetItem
                    key={widget.id}
                    widget={widget}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </ScrollArea>

        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={onReset} className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
