-- Fix the log_activity trigger to handle tables with different column names
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
BEGIN
  -- Get user_id from the record
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_action_type := 'DELETE';
    -- Use dynamic column access based on table
    IF TG_TABLE_NAME = 'loans' THEN
      v_entity_name := OLD.loan_name;
    ELSIF TG_TABLE_NAME = 'lenders' THEN
      v_entity_name := OLD.name;
    ELSIF TG_TABLE_NAME = 'transactions' OR TG_TABLE_NAME = 'bank_statement_entries' THEN
      v_entity_name := OLD.narration;
    ELSE
      v_entity_name := 'Deleted';
    END IF;
    v_changes := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;
    v_action_type := 'UPDATE';
    IF TG_TABLE_NAME = 'loans' THEN
      v_entity_name := NEW.loan_name;
    ELSIF TG_TABLE_NAME = 'lenders' THEN
      v_entity_name := NEW.name;
    ELSIF TG_TABLE_NAME = 'transactions' OR TG_TABLE_NAME = 'bank_statement_entries' THEN
      v_entity_name := NEW.narration;
    ELSE
      v_entity_name := 'Updated';
    END IF;
    v_changes := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSE
    v_user_id := NEW.user_id;
    v_action_type := 'CREATE';
    IF TG_TABLE_NAME = 'loans' THEN
      v_entity_name := NEW.loan_name;
    ELSIF TG_TABLE_NAME = 'lenders' THEN
      v_entity_name := NEW.name;
    ELSIF TG_TABLE_NAME = 'transactions' OR TG_TABLE_NAME = 'bank_statement_entries' THEN
      v_entity_name := NEW.narration;
    ELSE
      v_entity_name := 'Created';
    END IF;
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
$function$;