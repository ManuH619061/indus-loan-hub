-- Update the log_activity function to handle tables without direct user_id column
CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_action_type TEXT;
  v_entity_name TEXT;
  v_changes JSONB;
  v_record RECORD;
BEGIN
  -- Get the record to work with
  IF TG_OP = 'DELETE' THEN
    v_record := OLD;
    v_action_type := 'DELETE';
  ELSE
    v_record := NEW;
    v_action_type := CASE WHEN TG_OP = 'UPDATE' THEN 'UPDATE' ELSE 'CREATE' END;
  END IF;
  
  -- Try to get user_id - handle tables that don't have it directly
  BEGIN
    -- First try direct user_id column
    EXECUTE format('SELECT ($1).user_id') INTO v_user_id USING v_record;
  EXCEPTION WHEN undefined_column THEN
    -- If no user_id, try to get it from related loan
    IF TG_TABLE_NAME IN ('payments', 'amortization_rows', 'documents', 'charges', 'rate_changes') THEN
      BEGIN
        EXECUTE format('SELECT ($1).loan_id') INTO v_user_id USING v_record;
        IF v_user_id IS NOT NULL THEN
          SELECT user_id INTO v_user_id FROM public.loans WHERE id = v_user_id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
      END;
    END IF;
  END;
  
  -- If we still don't have a user_id, skip logging
  IF v_user_id IS NULL THEN
    RETURN v_record;
  END IF;

  -- Set entity name based on table
  IF TG_TABLE_NAME = 'loans' THEN
    v_entity_name := v_record.loan_name;
  ELSIF TG_TABLE_NAME = 'lenders' THEN
    v_entity_name := v_record.name;
  ELSIF TG_TABLE_NAME = 'transactions' OR TG_TABLE_NAME = 'bank_statement_entries' THEN
    v_entity_name := v_record.narration;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    v_entity_name := 'Payment ' || v_record.amount::text;
  ELSE
    v_entity_name := CASE WHEN TG_OP = 'DELETE' THEN 'Deleted' WHEN TG_OP = 'UPDATE' THEN 'Updated' ELSE 'Created' END;
  END IF;

  -- Set changes
  IF TG_OP = 'DELETE' THEN
    v_changes := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
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
    v_record.id,
    v_entity_name,
    v_changes
  );

  RETURN v_record;
END;
$function$;