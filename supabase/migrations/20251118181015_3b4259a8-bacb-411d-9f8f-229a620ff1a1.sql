-- Create activity_logs table for audit trail
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE')),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
ON public.activity_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_activity_logs_user_created ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Function to log activity
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_action_type TEXT;
  v_entity_name TEXT;
  v_changes JSONB;
BEGIN
  -- Get user_id from the record
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_action_type := 'DELETE';
    v_entity_name := COALESCE(OLD.loan_name, OLD.name, OLD.narration, 'Deleted');
    v_changes := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;
    v_action_type := 'UPDATE';
    v_entity_name := COALESCE(NEW.loan_name, NEW.name, NEW.narration, 'Updated');
    v_changes := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSE
    v_user_id := NEW.user_id;
    v_action_type := 'CREATE';
    v_entity_name := COALESCE(NEW.loan_name, NEW.name, NEW.narration, 'Created');
    v_changes := to_jsonb(NEW);
  END IF;

  -- Insert activity log
  INSERT INTO public.activity_logs (
    user_id,
    action_type,
    entity_type,
    entity_id,
    entity_name,
    changes
  ) VALUES (
    v_user_id,
    v_action_type,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_entity_name,
    v_changes
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for all relevant tables
CREATE TRIGGER log_loans_activity
AFTER INSERT OR UPDATE OR DELETE ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_payments_activity
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_lenders_activity
AFTER INSERT OR UPDATE OR DELETE ON public.lenders
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_transactions_activity
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_monthly_budgets_activity
AFTER INSERT OR UPDATE OR DELETE ON public.monthly_budgets
FOR EACH ROW EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_bank_accounts_activity
AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.log_activity();