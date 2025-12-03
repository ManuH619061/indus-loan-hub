import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  timezone: string | null;
  monthly_income: number;
  fixed_bills: number;
  savings_target: number;
  risk_profile: string;
  currency: string | null;
  display_mode: string | null;
  login_method: string | null;
}

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

export interface NotificationSettings {
  email_emi_reminder: boolean;
  email_emi_reminder_days: number;
  inapp_emi_due_week: boolean;
  low_balance_alert: boolean;
  low_balance_threshold: number;
  budget_overspend_alert: boolean;
  budget_overspend_percent: number;
  monthly_ai_summary: boolean;
  inapp_ai_summary: boolean;
  payment_confirmations: boolean;
  high_utilisation_alerts: boolean;
  reminders_time: string;
}

export interface AISettings {
  explanation_style: string;
  detail_level: string;
  show_tables: boolean;
  show_charts: boolean;
  enable_chat_history: boolean;
}

const defaultProfile: Omit<UserProfile, 'id' | 'email'> = {
  name: null,
  avatar_url: null,
  phone: null,
  city: null,
  timezone: 'Asia/Kolkata',
  monthly_income: 0,
  fixed_bills: 0,
  savings_target: 0,
  risk_profile: 'balanced',
  currency: 'INR',
  display_mode: 'auto',
  login_method: 'email',
};

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

const defaultNotifications: NotificationSettings = {
  email_emi_reminder: true,
  email_emi_reminder_days: 3,
  inapp_emi_due_week: true,
  low_balance_alert: false,
  low_balance_threshold: 10000,
  budget_overspend_alert: true,
  budget_overspend_percent: 100,
  monthly_ai_summary: false,
  inapp_ai_summary: true,
  payment_confirmations: true,
  high_utilisation_alerts: true,
  reminders_time: '09:00',
};

const defaultAISettings: AISettings = {
  explanation_style: 'balanced',
  detail_level: 'medium',
  show_tables: true,
  show_charts: true,
  enable_chat_history: true,
};

export function useUserSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);
  const [aiSettings, setAISettings] = useState<AISettings>(defaultAISettings);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile({
          id: profileData.id,
          name: profileData.name,
          email: profileData.email,
          avatar_url: (profileData as any).avatar_url || null,
          phone: (profileData as any).phone || null,
          city: (profileData as any).city || null,
          timezone: profileData.timezone,
          monthly_income: profileData.monthly_income || 0,
          fixed_bills: (profileData as any).fixed_bills || 0,
          savings_target: (profileData as any).savings_target || 0,
          risk_profile: (profileData as any).risk_profile || 'balanced',
          currency: profileData.currency,
          display_mode: profileData.display_mode,
          login_method: (profileData as any).login_method || 'email',
        });
      }

      // Fetch preferences
      const { data: prefsData } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (prefsData) {
        setPreferences({
          layout_mode: prefsData.layout_mode || 'auto',
          default_home_tab: prefsData.default_home_tab || '/dashboard',
          sidebar_behavior: prefsData.sidebar_behavior || 'auto',
          default_date_range: prefsData.default_date_range || 'current_month',
          accent_color: prefsData.accent_color || 'blue',
          font_size: prefsData.font_size || 'medium',
          density: prefsData.density || 'comfortable',
          show_tooltips: prefsData.show_tooltips ?? true,
          compact_mode: prefsData.compact_mode ?? false,
          default_bank_account_emi: prefsData.default_bank_account_emi,
          default_bank_account_expense: prefsData.default_bank_account_expense,
          default_emi_calendar_view: prefsData.default_emi_calendar_view || 'month',
          default_brs_date_range: prefsData.default_brs_date_range || 'current_month',
          currency_symbol: prefsData.currency_symbol || '₹',
          number_format: prefsData.number_format || 'indian',
          language: prefsData.language || 'en',
          start_of_month: prefsData.start_of_month || 1,
        });
      }

      // Fetch notification settings
      const { data: notifData } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (notifData) {
        setNotifications({
          email_emi_reminder: notifData.email_emi_reminder ?? true,
          email_emi_reminder_days: notifData.email_emi_reminder_days || 3,
          inapp_emi_due_week: notifData.inapp_emi_due_week ?? true,
          low_balance_alert: notifData.low_balance_alert ?? false,
          low_balance_threshold: notifData.low_balance_threshold || 10000,
          budget_overspend_alert: notifData.budget_overspend_alert ?? true,
          budget_overspend_percent: notifData.budget_overspend_percent || 100,
          monthly_ai_summary: notifData.monthly_ai_summary ?? false,
          inapp_ai_summary: notifData.inapp_ai_summary ?? true,
          payment_confirmations: notifData.payment_confirmations ?? true,
          high_utilisation_alerts: notifData.high_utilisation_alerts ?? true,
          reminders_time: notifData.reminders_time || '09:00',
        });
      }

      // Fetch AI settings
      const { data: aiData } = await supabase
        .from("ai_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (aiData) {
        setAISettings({
          explanation_style: aiData.explanation_style || 'balanced',
          detail_level: aiData.detail_level || 'medium',
          show_tables: aiData.show_tables ?? true,
          show_charts: aiData.show_charts ?? true,
          enable_chat_history: aiData.enable_chat_history ?? true,
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user, fetchSettings]);

  const saveProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates as any)
        .eq("id", user.id);

      if (error) throw error;
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      toast.success("Profile saved");
      return true;
    } catch (error) {
      toast.error("Failed to save profile");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return false;
    setSaving(true);
    try {
      // Upsert preferences
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          ...preferences,
          ...updates,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;
      setPreferences(prev => ({ ...prev, ...updates }));
      toast.success("Preferences saved");
      return true;
    } catch (error) {
      toast.error("Failed to save preferences");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async (updates: Partial<NotificationSettings>) => {
    if (!user) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_settings")
        .upsert({
          user_id: user.id,
          ...notifications,
          ...updates,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;
      setNotifications(prev => ({ ...prev, ...updates }));
      toast.success("Notification settings saved");
      return true;
    } catch (error) {
      toast.error("Failed to save notification settings");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAISettings = async (updates: Partial<AISettings>) => {
    if (!user) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ai_settings")
        .upsert({
          user_id: user.id,
          ...aiSettings,
          ...updates,
        } as any, { onConflict: 'user_id' });

      if (error) throw error;
      setAISettings(prev => ({ ...prev, ...updates }));
      toast.success("AI settings saved");
      return true;
    } catch (error) {
      toast.error("Failed to save AI settings");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
    profile,
    preferences,
    notifications,
    aiSettings,
    setProfile,
    setPreferences,
    setNotifications,
    setAISettings,
    saveProfile,
    savePreferences,
    saveNotifications,
    saveAISettings,
    refetch: fetchSettings,
  };
}
