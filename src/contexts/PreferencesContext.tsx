import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserPreferences {
  layout_mode: string;
  default_home_tab: string;
  sidebar_behavior: string;
  default_date_range: string;
  accent_color: string;
  font_size: string;
  density: string;
  show_tooltips: boolean;
  compact_mode: boolean;
  default_bank_account_emi: string | null;
  default_bank_account_expense: string | null;
  default_emi_calendar_view: string;
  default_brs_date_range: string;
  currency_symbol: string;
  number_format: string;
  language: string;
  start_of_month: number;
}

const defaultPreferences: UserPreferences = {
  layout_mode: 'auto',
  default_home_tab: '/dashboard',
  sidebar_behavior: 'auto',
  default_date_range: 'current_month',
  accent_color: 'blue',
  font_size: 'medium',
  density: 'comfortable',
  show_tooltips: true,
  compact_mode: false,
  default_bank_account_emi: null,
  default_bank_account_expense: null,
  default_emi_calendar_view: 'month',
  default_brs_date_range: 'current_month',
  currency_symbol: '₹',
  number_format: 'indian',
  language: 'en',
  start_of_month: 1,
};

interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  refetch: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(defaultPreferences);
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setPreferences({
          layout_mode: data.layout_mode || 'auto',
          default_home_tab: data.default_home_tab || '/dashboard',
          sidebar_behavior: data.sidebar_behavior || 'auto',
          default_date_range: data.default_date_range || 'current_month',
          accent_color: data.accent_color || 'blue',
          font_size: data.font_size || 'medium',
          density: data.density || 'comfortable',
          show_tooltips: data.show_tooltips ?? true,
          compact_mode: data.compact_mode ?? false,
          default_bank_account_emi: data.default_bank_account_emi,
          default_bank_account_expense: data.default_bank_account_expense,
          default_emi_calendar_view: data.default_emi_calendar_view || 'month',
          default_brs_date_range: data.default_brs_date_range || 'current_month',
          currency_symbol: data.currency_symbol || '₹',
          number_format: data.number_format || 'indian',
          language: data.language || 'en',
          start_of_month: data.start_of_month || 1,
        });
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Apply CSS variables for theming
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply font size
    const fontSizeMap: Record<string, string> = {
      small: '13px',
      medium: '14px',
      large: '16px',
    };
    root.style.setProperty('--base-font-size', fontSizeMap[preferences.font_size] || '14px');
    document.body.style.fontSize = fontSizeMap[preferences.font_size] || '14px';

    // Apply density
    const densityClass = preferences.density === 'compact' ? 'density-compact' : 'density-comfortable';
    document.body.classList.remove('density-compact', 'density-comfortable');
    document.body.classList.add(densityClass);

    // Apply accent color
    const accentColors: Record<string, { primary: string; ring: string; primaryForeground: string }> = {
      blue: { primary: '216 92% 53%', ring: '216 92% 53%', primaryForeground: '0 0% 100%' },
      indigo: { primary: '234 89% 63%', ring: '234 89% 63%', primaryForeground: '0 0% 100%' },
      purple: { primary: '262 83% 58%', ring: '262 83% 58%', primaryForeground: '0 0% 100%' },
      pink: { primary: '330 81% 60%', ring: '330 81% 60%', primaryForeground: '0 0% 100%' },
      red: { primary: '0 84% 60%', ring: '0 84% 60%', primaryForeground: '0 0% 100%' },
      orange: { primary: '25 95% 53%', ring: '25 95% 53%', primaryForeground: '0 0% 100%' },
      amber: { primary: '38 92% 50%', ring: '38 92% 50%', primaryForeground: '0 0% 0%' },
      green: { primary: '142 71% 45%', ring: '142 71% 45%', primaryForeground: '0 0% 100%' },
      teal: { primary: '177 55% 50%', ring: '177 55% 50%', primaryForeground: '0 0% 100%' },
      cyan: { primary: '189 94% 43%', ring: '189 94% 43%', primaryForeground: '0 0% 100%' },
    };
    
    const accent = accentColors[preferences.accent_color] || accentColors.blue;
    root.style.setProperty('--primary', accent.primary);
    root.style.setProperty('--ring', accent.ring);
    root.style.setProperty('--primary-foreground', accent.primaryForeground);

  }, [preferences.font_size, preferences.density, preferences.accent_color]);

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return;
    
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);

    try {
      await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          ...newPrefs,
        } as any, { onConflict: 'user_id' });
    } catch (error) {
      console.error("Error saving preferences:", error);
    }
  };

  return (
    <PreferencesContext.Provider value={{ preferences, loading, updatePreferences, refetch: fetchPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
