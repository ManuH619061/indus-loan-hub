import { useEffect, useCallback, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface UseKeyboardShortcutsOptions {
  onOpenSearch: () => void;
  onOpenQuickActions: () => void;
  onOpenNotifications: () => void;
  onOpenShortcutsHelp: () => void;
}

export function useKeyboardShortcuts({
  onOpenSearch,
  onOpenQuickActions,
  onOpenNotifications,
  onOpenShortcutsHelp,
}: UseKeyboardShortcutsOptions) {
  const navigate = useNavigate();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const pendingKeyTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // Handle single key shortcuts
    if (!pendingKey) {
      switch (e.key) {
        case "/":
          e.preventDefault();
          onOpenSearch();
          break;
        case "q":
          e.preventDefault();
          onOpenQuickActions();
          break;
        case "n":
          e.preventDefault();
          onOpenNotifications();
          break;
        case "?":
          e.preventDefault();
          onOpenShortcutsHelp();
          break;
        case "g":
          e.preventDefault();
          setPendingKey("g");
          // Clear pending key after timeout
          if (pendingKeyTimeout.current) {
            clearTimeout(pendingKeyTimeout.current);
          }
          pendingKeyTimeout.current = setTimeout(() => {
            setPendingKey(null);
          }, 1000);
          break;
      }
    } else if (pendingKey === "g") {
      // Handle "g + <key>" combinations
      e.preventDefault();
      setPendingKey(null);
      if (pendingKeyTimeout.current) {
        clearTimeout(pendingKeyTimeout.current);
      }

      switch (e.key) {
        case "d":
          navigate("/dashboard");
          break;
        case "l":
          navigate("/loans");
          break;
        case "b":
          navigate("/banking");
          break;
        case "e":
          navigate("/budget/monthly-expenses");
          break;
        case "p":
          navigate("/budget-planner");
          break;
        case "c":
          navigate("/emi-calendar");
          break;
        case "s":
          navigate("/settings");
          break;
        case "a":
          navigate("/ai-advisor");
          break;
        case "i":
          navigate("/insights");
          break;
      }
    }
  }, [navigate, onOpenSearch, onOpenQuickActions, onOpenNotifications, onOpenShortcutsHelp, pendingKey]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (pendingKeyTimeout.current) {
        clearTimeout(pendingKeyTimeout.current);
      }
    };
  }, [handleKeyDown]);

  return { pendingKey };
}
