-- Create bank_accounts table to manage multiple bank accounts and credit cards
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'BANK', -- BANK, CREDIT_CARD
  account_number_masked TEXT NOT NULL, -- e.g., ****1234
  account_number_full TEXT, -- encrypted full number (optional)
  ifsc_code TEXT,
  branch TEXT,
  book_balance NUMERIC NOT NULL DEFAULT 0,
  statement_balance NUMERIC,
  last_reconciled_at TIMESTAMP WITH TIME ZONE,
  last_imported_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon_url TEXT, -- bank logo
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank_statement_entries table for raw imported transactions
CREATE TABLE public.bank_statement_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  import_id UUID REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  value_date DATE,
  narration TEXT NOT NULL,
  reference TEXT, -- UTR/Cheque/Ref number
  debit NUMERIC,
  credit NUMERIC,
  balance NUMERIC,
  status TEXT NOT NULL DEFAULT 'UNMATCHED', -- UNMATCHED, MATCHED, EXCLUDED, MANUALLY_ADDED
  matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  category TEXT,
  subcategory TEXT,
  is_transfer BOOLEAN DEFAULT false,
  is_emi BOOLEAN DEFAULT false,
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank_rules table for automation
CREATE TABLE public.bank_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE CASCADE, -- null = applies to all accounts
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  condition_type TEXT NOT NULL, -- CONTAINS, STARTS_WITH, ENDS_WITH, EQUALS, REGEX, AMOUNT_EQUALS, AMOUNT_GREATER, AMOUNT_LESS
  condition_field TEXT NOT NULL, -- NARRATION, REFERENCE, DEBIT, CREDIT
  condition_value TEXT NOT NULL,
  action_type TEXT NOT NULL, -- CATEGORIZE, MARK_EMI, MARK_TRANSFER, ASSIGN_LOAN, EXCLUDE, MARK_INCOME, MARK_EXPENSE
  action_category TEXT,
  action_subcategory TEXT,
  action_loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reconciliation_matches table to track matching history
CREATE TABLE public.reconciliation_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  bank_entry_id UUID NOT NULL REFERENCES public.bank_statement_entries(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL, -- AUTO, MANUAL, RULE_BASED
  match_confidence NUMERIC, -- 0-100 for auto matches
  matched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  matched_by UUID, -- user who matched manually
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_accounts
CREATE POLICY "Users can manage own bank accounts"
  ON public.bank_accounts
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for bank_statement_entries
CREATE POLICY "Users can manage own bank entries"
  ON public.bank_statement_entries
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for bank_rules
CREATE POLICY "Users can manage own bank rules"
  ON public.bank_rules
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for reconciliation_matches
CREATE POLICY "Users can manage own reconciliation matches"
  ON public.reconciliation_matches
  FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_bank_statement_entries_bank_account ON public.bank_statement_entries(bank_account_id);
CREATE INDEX idx_bank_statement_entries_status ON public.bank_statement_entries(status);
CREATE INDEX idx_bank_statement_entries_date ON public.bank_statement_entries(transaction_date);
CREATE INDEX idx_bank_rules_active ON public.bank_rules(is_active, priority);
CREATE INDEX idx_reconciliation_matches_bank_entry ON public.reconciliation_matches(bank_entry_id);

-- Triggers for updated_at
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_statement_entries_updated_at
  BEFORE UPDATE ON public.bank_statement_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_rules_updated_at
  BEFORE UPDATE ON public.bank_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();