import { useState, useEffect, useCallback } from "react";

export interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

interface UseDashboardWidgetsProps {
  dashboardId: string;
  defaultWidgets: Omit<WidgetConfig, "order" | "visible">[];
}

const STORAGE_KEY_PREFIX = "dashboard_widgets_";

export function useDashboardWidgets({ dashboardId, defaultWidgets }: UseDashboardWidgetsProps) {
  const storageKey = `${STORAGE_KEY_PREFIX}${dashboardId}`;
  
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    // Try to load from localStorage
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as WidgetConfig[];
        // Merge with defaults to handle new widgets
        const storedIds = new Set(parsed.map(w => w.id));
        const newWidgets = defaultWidgets
          .filter(w => !storedIds.has(w.id))
          .map((w, idx) => ({
            ...w,
            visible: true,
            order: parsed.length + idx,
          }));
        return [...parsed, ...newWidgets];
      } catch {
        // Fall through to default
      }
    }
    
    // Initialize from defaults
    return defaultWidgets.map((w, idx) => ({
      ...w,
      visible: true,
      order: idx,
    }));
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(widgets));
  }, [widgets, storageKey]);

  const reorderWidgets = useCallback((activeId: string, overId: string) => {
    setWidgets(prev => {
      const oldIndex = prev.findIndex(w => w.id === activeId);
      const newIndex = prev.findIndex(w => w.id === overId);
      
      if (oldIndex === -1 || newIndex === -1) return prev;
      
      const newWidgets = [...prev];
      const [removed] = newWidgets.splice(oldIndex, 1);
      newWidgets.splice(newIndex, 0, removed);
      
      // Update order values
      return newWidgets.map((w, idx) => ({ ...w, order: idx }));
    });
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      )
    );
  }, []);

  const setWidgetVisibility = useCallback((widgetId: string, visible: boolean) => {
    setWidgets(prev =>
      prev.map(w =>
        w.id === widgetId ? { ...w, visible } : w
      )
    );
  }, []);

  const showAll = useCallback(() => {
    setWidgets(prev => prev.map(w => ({ ...w, visible: true })));
  }, []);

  const hideAll = useCallback(() => {
    setWidgets(prev => prev.map(w => ({ ...w, visible: false })));
  }, []);

  const resetToDefault = useCallback(() => {
    const defaultConfig = defaultWidgets.map((w, idx) => ({
      ...w,
      visible: true,
      order: idx,
    }));
    setWidgets(defaultConfig);
  }, [defaultWidgets]);

  const sortedWidgets = [...widgets].sort((a, b) => a.order - b.order);
  const visibleWidgets = sortedWidgets.filter(w => w.visible);
  const hiddenCount = widgets.filter(w => !w.visible).length;

  return {
    widgets: sortedWidgets,
    visibleWidgets,
    hiddenCount,
    reorderWidgets,
    toggleWidget,
    setWidgetVisibility,
    showAll,
    hideAll,
    resetToDefault,
  };
}
