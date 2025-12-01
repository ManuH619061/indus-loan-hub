-- Add receipt_url column to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for users to upload their own payment receipts
CREATE POLICY "Users can upload payment receipts" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'payment-receipts' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for users to view their payment receipts
CREATE POLICY "Users can view their payment receipts" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'payment-receipts' 
  AND auth.uid() IS NOT NULL
);

-- Create policy for users to delete their payment receipts
CREATE POLICY "Users can delete their payment receipts" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'payment-receipts' 
  AND auth.uid() IS NOT NULL
);