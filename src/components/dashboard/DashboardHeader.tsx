import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings2, Download, Eye, EyeOff, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  description?: string;
  isEditMode: boolean;
  hiddenCount: number;
  onEditModeToggle: () => void;
  onSettingsOpen: () => void;
  onExport?: () => void;
}

export function DashboardHeader({
  title,
  description,
  isEditMode,
  hiddenCount,
  onEditModeToggle,
  onSettingsOpen,
  onExport,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {hiddenCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <EyeOff className="h-3 w-3" />
            {hiddenCount} hidden
          </Badge>
        )}
        
        <Button
          variant={isEditMode ? "default" : "outline"}
          size="sm"
          onClick={onEditModeToggle}
          className={cn(
            "transition-all",
            isEditMode && "bg-primary text-primary-foreground"
          )}
        >
          {isEditMode ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Done
            </>
          ) : (
            <>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </>
          )}
        </Button>
        
        <Button variant="outline" size="sm" onClick={onSettingsOpen}>
          <Settings2 className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Customize</span>
        </Button>
        
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Export</span>
          </Button>
        )}
      </div>
    </div>
  );
}
