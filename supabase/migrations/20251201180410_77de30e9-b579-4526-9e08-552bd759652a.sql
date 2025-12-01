-- Create expense categories and groups tables
CREATE TABLE IF NOT EXISTS public.expense_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  color text DEFAULT '#6366f1',
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_subgroups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  color text,
  display_order integer DEFAULT 0,
  requires_location boolean DEFAULT false,
  requires_travel_mode boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create monthly expenses table
CREATE TABLE IF NOT EXISTS public.monthly_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  description text NOT NULL,
  group_id uuid REFERENCES public.expense_groups(id) ON DELETE SET NULL,
  subgroup_id uuid REFERENCES public.expense_subgroups(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  paid_from text NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  from_location text,
  to_location text,
  travel_mode text,
  tags text[],
  notes text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create income sources table for recurring income tracking
CREATE TABLE IF NOT EXISTS public.income_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('Monthly', 'One-time', 'Quarterly', 'Yearly')),
  start_month date NOT NULL,
  end_month date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create savings goals table
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  target_date date NOT NULL,
  current_amount numeric DEFAULT 0,
  monthly_contribution numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create salary increment settings table
CREATE TABLE IF NOT EXISTS public.salary_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_salary numeric NOT NULL,
  increment_month integer NOT NULL CHECK (increment_month BETWEEN 1 AND 12),
  increment_type text NOT NULL CHECK (increment_type IN ('percentage', 'amount')),
  increment_value numeric NOT NULL,
  last_increment_year integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.expense_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_subgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage own expense groups"
  ON public.expense_groups
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own expense subgroups"
  ON public.expense_subgroups
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own monthly expenses"
  ON public.monthly_expenses
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own income sources"
  ON public.income_sources
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own savings goals"
  ON public.savings_goals
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own salary settings"
  ON public.salary_settings
  FOR ALL
  USING (auth.uid() = user_id);

-- Insert default expense groups and subgroups
INSERT INTO public.expense_groups (user_id, name, icon, color, display_order) 
SELECT 
  id as user_id,
  'Travel & Transport' as name,
  '🚗' as icon,
  '#3b82f6' as color,
  1 as display_order
FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_groups (user_id, name, icon, color, display_order) 
SELECT 
  id as user_id,
  'Food & Dining' as name,
  '🍽️' as icon,
  '#10b981' as color,
  2 as display_order
FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_groups (user_id, name, icon, color, display_order) 
SELECT 
  id as user_id,
  'Shopping' as name,
  '🛍️' as icon,
  '#8b5cf6' as color,
  3 as display_order
FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.expense_groups (user_id, name, icon, color, display_order) 
SELECT 
  id as user_id,
  'Entertainment' as name,
  '🎬' as icon,
  '#f59e0b' as color,
  4 as display_order
FROM auth.users
ON CONFLICT DO NOTHING;