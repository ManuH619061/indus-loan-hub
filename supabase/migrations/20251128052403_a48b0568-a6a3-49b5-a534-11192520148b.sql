-- Enable real-time for lenders table
ALTER TABLE public.lenders REPLICA IDENTITY FULL;

-- Add lenders to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.lenders;