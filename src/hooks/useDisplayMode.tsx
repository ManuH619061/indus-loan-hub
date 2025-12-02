import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DisplayMode = "auto" | "mobile" | "desktop";

export function useDisplayMode() {
  const { user } = useAuth();
  const [displayMode, setDisplayMode] = useState<DisplayMode>("auto");
  const [loading, setLoading] = useState(true);

  // Load display mode from database or localStorage
  useEffect(() => {
    const loadDisplayMode = async () => {
      if (user) {
        // Try to load from profile
        const { data } = await supabase
          .from("profiles")
          .select("display_mode")
          .eq("id", user.id)
          .single();
        
        if (data?.display_mode) {
          setDisplayMode(data.display_mode as DisplayMode);
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem("display-mode");
          if (stored && ["auto", "mobile", "desktop"].includes(stored)) {
            setDisplayMode(stored as DisplayMode);
          }
        }
      } else {
        // Not logged in, use localStorage
        const stored = localStorage.getItem("display-mode");
        if (stored && ["auto", "mobile", "desktop"].includes(stored)) {
          setDisplayMode(stored as DisplayMode);
        }
      }
      setLoading(false);
    };

    loadDisplayMode();
  }, [user]);

  // Save display mode to database and localStorage
  const saveDisplayMode = async (mode: DisplayMode) => {
    setDisplayMode(mode);
    localStorage.setItem("display-mode", mode);

    if (user) {
      await supabase
        .from("profiles")
        .update({ display_mode: mode })
        .eq("id", user.id);
    }
  };

  // Determine if mobile layout should be shown
  const isMobileLayout = () => {
    if (displayMode === "mobile") return true;
    if (displayMode === "desktop") return false;
    // Auto mode: use screen width
    return window.innerWidth < 768;
  };

  return {
    displayMode,
    setDisplayMode: saveDisplayMode,
    isMobileLayout: isMobileLayout(),
    loading,
  };
}
