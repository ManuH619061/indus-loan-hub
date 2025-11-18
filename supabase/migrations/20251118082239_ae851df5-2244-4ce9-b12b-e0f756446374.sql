-- Create monthly_budgets table for detailed budget tracking
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: YYYY-MM
  
  -- Income categories
  salary NUMERIC DEFAULT 0,
  side_income NUMERIC DEFAULT 0,
  other_income NUMERIC DEFAULT 0,
  
  -- Fixed expenses
  rent NUMERIC DEFAULT 0,
  food NUMERIC DEFAULT 0,
  transport NUMERIC DEFAULT 0,
  utilities NUMERIC DEFAULT 0,
  school NUMERIC DEFAULT 0,
  subscriptions NUMERIC DEFAULT 0,
  insurance NUMERIC DEFAULT 0,
  
  -- Variable/Lifestyle expenses
  eating_out NUMERIC DEFAULT 0,
  shopping NUMERIC DEFAULT 0,
  travel NUMERIC DEFAULT 0,
  other_variable NUMERIC DEFAULT 0,
  
  -- Savings and investments
  savings_investments NUMERIC DEFAULT 0,
  
  -- Category limits (for progress tracking)
  food_limit NUMERIC DEFAULT 0,
  eating_out_limit NUMERIC DEFAULT 0,
  shopping_limit NUMERIC DEFAULT 0,
  travel_limit NUMERIC DEFAULT 0,
  
  -- Strategy settings
  strategy TEXT DEFAULT 'normal', -- 'normal', 'aggressive', 'safe'
  extra_emi_amount NUMERIC DEFAULT 0,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, month_year)
);

-- Enable RLS
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own budgets"
  ON public.monthly_budgets
  FOR ALL
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_monthly_budgets_user_month ON public.monthly_budgets(user_id, month_year);

-- Trigger to update updated_at
CREATE TRIGGER update_monthly_budgets_updated_at
  BEFORE UPDATE ON public.monthly_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();