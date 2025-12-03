-- Extend profiles table with additional fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS fixed_bills numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS savings_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_profile text DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS login_method text DEFAULT 'email';

-- Create user_preferences table for display, appearance, and defaults
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- Display settings
  layout_mode text DEFAULT 'auto',
  default_home_tab text DEFAULT '/dashboard',
  sidebar_behavior text DEFAULT 'auto',
  default_date_range text DEFAULT 'current_month',
  -- Appearance settings
  accent_color text DEFAULT 'blue',
  font_size text DEFAULT 'medium',
  density text DEFAULT 'comfortable',
  show_tooltips boolean DEFAULT true,
  compact_mode boolean DEFAULT false,
  -- Default settings
  default_bank_account_emi uuid,
  default_bank_account_expense uuid,
  default_emi_calendar_view text DEFAULT 'month',
  default_brs_date_range text DEFAULT 'current_month',
  currency_symbol text DEFAULT '₹',
  number_format text DEFAULT 'indian',
  language text DEFAULT 'en',
  start_of_month integer DEFAULT 1,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- EMI & Loan alerts
  email_emi_reminder boolean DEFAULT true,
  email_emi_reminder_days integer DEFAULT 3,
  inapp_emi_due_week boolean DEFAULT true,
  -- Bank & Cash alerts
  low_balance_alert boolean DEFAULT false,
  low_balance_threshold numeric DEFAULT 10000,
  -- Budget alerts
  budget_overspend_alert boolean DEFAULT true,
  budget_overspend_percent integer DEFAULT 100,
  -- AI reports
  monthly_ai_summary boolean DEFAULT false,
  inapp_ai_summary boolean DEFAULT true,
  -- General
  payment_confirmations boolean DEFAULT true,
  high_utilisation_alerts boolean DEFAULT true,
  reminders_time text DEFAULT '09:00',
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_settings
CREATE POLICY "Users can view own notification settings" ON public.notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings" ON public.notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings" ON public.notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create ai_settings table
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  explanation_style text DEFAULT 'balanced',
  detail_level text DEFAULT 'medium',
  show_tables boolean DEFAULT true,
  show_charts boolean DEFAULT true,
  enable_chat_history boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_settings
CREATE POLICY "Users can view own ai settings" ON public.ai_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai settings" ON public.ai_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai settings" ON public.ai_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();