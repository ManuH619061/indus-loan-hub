-- Enable real-time for goals table
ALTER TABLE public.goals REPLICA IDENTITY FULL;

-- Add goals to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;