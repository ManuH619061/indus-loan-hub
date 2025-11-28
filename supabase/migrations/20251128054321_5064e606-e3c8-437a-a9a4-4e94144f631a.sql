-- Enable REPLICA IDENTITY FULL for amortization_rows to capture full row data
ALTER TABLE public.amortization_rows REPLICA IDENTITY FULL;

-- Add amortization_rows to the supabase_realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'amortization_rows'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.amortization_rows;
  END IF;
END $$;

-- Also add payments table to realtime for payment updates
ALTER TABLE public.payments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;