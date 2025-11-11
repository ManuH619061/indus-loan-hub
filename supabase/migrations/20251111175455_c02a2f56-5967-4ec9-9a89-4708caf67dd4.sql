-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for enums
CREATE TYPE loan_type AS ENUM ('PERSONAL', 'CREDIT_CARD_CONVERSION', 'CONSUMER_DURABLE', 'EDUCATION', 'VEHICLE', 'HOME_TOPUP', 'OTHER');
CREATE TYPE loan_status AS ENUM ('ACTIVE', 'CLOSED', 'DEFAULTED');
CREATE TYPE rate_type AS ENUM ('REDUCING', 'FLAT');
CREATE TYPE compounding_type AS ENUM ('MONTHLY', 'DAILY', 'QUARTERLY', 'ANNUAL');
CREATE TYPE lender_type AS ENUM ('BANK', 'NBFC', 'CARD', 'FRIEND', 'OTHER');
CREATE TYPE payment_type AS ENUM ('EMI', 'FULL_PREPAY', 'PART_PREPAY', 'LATE_FEE', 'OTHER_FEE', 'REFUND', 'REVERSAL');
CREATE TYPE payment_source AS ENUM ('UPI', 'NETBANKING', 'CASH', 'CARD', 'ACH', 'OTHER');
CREATE TYPE charge_type AS ENUM ('PROCESSING', 'LATE_FEE', 'PENAL_INTEREST', 'FORECLOSURE', 'INSURANCE', 'OTHERS');
CREATE TYPE recast_mode AS ENUM ('REDUCE_TENURE', 'REDUCE_EMI');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  currency TEXT DEFAULT 'INR',
  timezone TEXT DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Lenders table
CREATE TABLE public.lenders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type lender_type NOT NULL DEFAULT 'BANK',
  contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lenders_user_id ON public.lenders(user_id);

ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lenders" ON public.lenders
  FOR ALL USING (auth.uid() = user_id);

-- Penalty rules table
CREATE TABLE public.penalty_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  late_fee_flat NUMERIC(10, 2) DEFAULT 0,
  late_fee_percent NUMERIC(5, 2) DEFAULT 0,
  grace_days INTEGER DEFAULT 0,
  penal_interest_pa NUMERIC(5, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_penalty_rules_user_id ON public.penalty_rules(user_id);

ALTER TABLE public.penalty_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own penalty rules" ON public.penalty_rules
  FOR ALL USING (auth.uid() = user_id);

-- Loans table
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lender_id UUID REFERENCES public.lenders(id) ON DELETE SET NULL,
  loan_name TEXT NOT NULL,
  loan_type loan_type NOT NULL DEFAULT 'PERSONAL',
  principal_amount NUMERIC(12, 2) NOT NULL,
  disbursed_on DATE NOT NULL,
  tenure_months INTEGER NOT NULL,
  interest_rate_apy NUMERIC(6, 3) NOT NULL,
  rate_type rate_type NOT NULL DEFAULT 'REDUCING',
  compounding compounding_type NOT NULL DEFAULT 'MONTHLY',
  emi_amount NUMERIC(10, 2),
  billing_day INTEGER CHECK (billing_day BETWEEN 1 AND 31),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  processing_fee NUMERIC(10, 2) DEFAULT 0,
  insurance_fee NUMERIC(10, 2) DEFAULT 0,
  gst_on_fees NUMERIC(10, 2) DEFAULT 0,
  other_upfront_costs NUMERIC(10, 2) DEFAULT 0,
  status loan_status NOT NULL DEFAULT 'ACTIVE',
  closure_date DATE,
  penalty_rule_id UUID REFERENCES public.penalty_rules(id) ON DELETE SET NULL,
  auto_debit BOOLEAN DEFAULT FALSE,
  autopay_bank TEXT,
  mandate_ref TEXT,
  remarks TEXT,
  recast_mode recast_mode DEFAULT 'REDUCE_TENURE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_lender_id ON public.loans(lender_id);
CREATE INDEX idx_loans_status ON public.loans(status);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own loans" ON public.loans
  FOR ALL USING (auth.uid() = user_id);

-- Rate changes table
CREATE TABLE public.rate_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  new_interest_rate_apy NUMERIC(6, 3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_changes_loan_id ON public.rate_changes(loan_id);
CREATE INDEX idx_rate_changes_effective_from ON public.rate_changes(effective_from);

ALTER TABLE public.rate_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage rate changes for own loans" ON public.rate_changes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.loans 
      WHERE loans.id = rate_changes.loan_id 
      AND loans.user_id = auth.uid()
    )
  );

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  paid_on DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_type payment_type NOT NULL DEFAULT 'EMI',
  source payment_source NOT NULL DEFAULT 'UPI',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_loan_id ON public.payments(loan_id);
CREATE INDEX idx_payments_paid_on ON public.payments(paid_on);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payments for own loans" ON public.payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.loans 
      WHERE loans.id = payments.loan_id 
      AND loans.user_id = auth.uid()
    )
  );

-- Charges table
CREATE TABLE public.charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  charge_on DATE NOT NULL,
  charge_type charge_type NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_charges_loan_id ON public.charges(loan_id);
CREATE INDEX idx_charges_charge_on ON public.charges(charge_on);

ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage charges for own loans" ON public.charges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.loans 
      WHERE loans.id = charges.loan_id 
      AND loans.user_id = auth.uid()
    )
  );

-- Amortization rows table
CREATE TABLE public.amortization_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  period_no INTEGER NOT NULL,
  period_start DATE NOT NULL,
  due_on DATE NOT NULL,
  opening_principal NUMERIC(12, 2) NOT NULL,
  scheduled_emi NUMERIC(10, 2) NOT NULL,
  interest_component NUMERIC(10, 2) NOT NULL,
  principal_component NUMERIC(10, 2) NOT NULL,
  extra_payment NUMERIC(10, 2) DEFAULT 0,
  closing_principal NUMERIC(12, 2) NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_amortization_loan_id ON public.amortization_rows(loan_id);
CREATE INDEX idx_amortization_due_on ON public.amortization_rows(due_on);
CREATE INDEX idx_amortization_loan_period ON public.amortization_rows(loan_id, period_no);

ALTER TABLE public.amortization_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage amortization for own loans" ON public.amortization_rows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.loans 
      WHERE loans.id = amortization_rows.loan_id 
      AND loans.user_id = auth.uid()
    )
  );

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  added_on TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_loan_id ON public.documents(loan_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage documents for own loans" ON public.documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.loans 
      WHERE loans.id = documents.loan_id 
      AND loans.user_id = auth.uid()
    )
  );

-- Tags table
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_tags_user_id ON public.tags(user_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id);

-- Loan tags junction table
CREATE TABLE public.loan_tags (
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (loan_id, tag_id)
);

CREATE INDEX idx_loan_tags_loan_id ON public.loan_tags(loan_id);
CREATE INDEX idx_loan_tags_tag_id ON public.loan_tags(tag_id);

ALTER TABLE public.loan_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tags for own loans" ON public.loan_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.loans 
      WHERE loans.id = loan_tags.loan_id 
      AND loans.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lenders_updated_at
  BEFORE UPDATE ON public.lenders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_penalty_rules_updated_at
  BEFORE UPDATE ON public.penalty_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();