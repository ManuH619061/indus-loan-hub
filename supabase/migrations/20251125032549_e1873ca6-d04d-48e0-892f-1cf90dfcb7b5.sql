-- Create storage bucket for lender logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lender-logos', 'lender-logos', true);

-- Allow authenticated users to upload their own lender logos
CREATE POLICY "Users can upload lender logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lender-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update their own lender logos
CREATE POLICY "Users can update own lender logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lender-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own lender logos
CREATE POLICY "Users can delete own lender logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lender-logos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to view lender logos
CREATE POLICY "Public access to lender logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'lender-logos');