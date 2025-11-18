-- Create transactions table for imported bank statements
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  import_id UUID,
  transaction_date DATE NOT NULL,
  value_date DATE,
  narration TEXT NOT NULL,
  reference TEXT,
  debit NUMERIC,
  credit NUMERIC,
  balance NUMERIC,
  account_name TEXT,
  account_type TEXT,
  bank_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Expense',
  subcategory TEXT,
  loan_id UUID,
  is_transfer BOOLEAN DEFAULT false,
  is_emi BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank_statement_imports table to track import history
CREATE TABLE public.bank_statement_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  total_rows INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions
CREATE POLICY "Users can manage own transactions"
ON public.transactions
FOR ALL
USING (auth.uid() = user_id);

-- Create policies for bank_statement_imports
CREATE POLICY "Users can manage own imports"
ON public.bank_statement_imports
FOR ALL
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_category ON public.transactions(user_id, category);
CREATE INDEX idx_transactions_loan ON public.transactions(loan_id) WHERE loan_id IS NOT NULL;
CREATE INDEX idx_transactions_bank ON public.transactions(user_id, bank_type);

-- Add foreign key constraint for loan_id
ALTER TABLE public.transactions
ADD CONSTRAINT transactions_loan_id_fkey 
FOREIGN KEY (loan_id) 
REFERENCES public.loans(id) 
ON DELETE SET NULL;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();