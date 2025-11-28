-- Enable real-time for loans table
ALTER TABLE public.loans REPLICA IDENTITY FULL;

-- Add loans to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.loans;