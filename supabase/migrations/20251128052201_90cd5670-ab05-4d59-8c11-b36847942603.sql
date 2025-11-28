-- Enable real-time for payments table
ALTER TABLE public.payments REPLICA IDENTITY FULL;

-- Add payments to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;