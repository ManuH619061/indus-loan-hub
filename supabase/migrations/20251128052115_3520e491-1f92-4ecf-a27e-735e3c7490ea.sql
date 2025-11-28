-- Enable real-time for amortization_rows table
ALTER TABLE public.amortization_rows REPLICA IDENTITY FULL;

-- Add amortization_rows to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.amortization_rows;