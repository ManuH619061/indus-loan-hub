-- Add monthly_income field to profiles table for EMI burden calculation
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_income numeric DEFAULT 0;