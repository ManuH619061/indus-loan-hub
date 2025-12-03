-- Create recurring expenses table
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  group_id UUID REFERENCES public.expense_groups(id) ON DELETE SET NULL,
  subgroup_id UUID REFERENCES public.expense_subgroups(id) ON DELETE SET NULL,
  paid_from TEXT NOT NULL DEFAULT 'Cash',
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, weekly, yearly
  day_of_month INTEGER, -- for monthly: 1-31
  day_of_week INTEGER, -- for weekly: 0-6 (Sunday-Saturday)
  month_of_year INTEGER, -- for yearly: 1-12
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage own recurring expenses"
ON public.recurring_expenses
FOR ALL
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_recurring_expenses_updated_at
BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for querying active recurring expenses
CREATE INDEX idx_recurring_expenses_user_active ON public.recurring_expenses(user_id, is_active);
CREATE INDEX idx_recurring_expenses_last_generated ON public.recurring_expenses(last_generated_date);