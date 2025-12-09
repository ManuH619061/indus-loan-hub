import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface DraggableWidgetProps {
  id: string;
  children: React.ReactNode;
  isEditMode?: boolean;
  onHide?: () => void;
  className?: string;
}

export function DraggableWidget({ 
  id, 
  children, 
  isEditMode = false, 
  onHide,
  className 
}: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-90 shadow-2xl",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
    >
      {isEditMode && (
        <div className="absolute -top-2 -right-2 z-10 flex gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7 rounded-full shadow-md bg-background border"
            onClick={onHide}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 -top-3 z-10",
            "px-3 py-1 rounded-full bg-primary/10 border border-primary/20",
            "cursor-grab active:cursor-grabbing",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "flex items-center gap-1 text-xs text-primary font-medium"
          )}
        >
          <GripVertical className="h-3 w-3" />
          Drag
        </div>
      )}
      
      <div className={cn(
        isEditMode && "ring-2 ring-primary/20 ring-dashed rounded-lg",
        isDragging && "ring-primary"
      )}>
        {children}
      </div>
    </motion.div>
  );
}
