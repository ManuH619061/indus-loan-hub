-- First drop existing storage policies for lender-logos bucket
DROP POLICY IF EXISTS "Users can upload lender logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update lender logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete lender logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view lender logos" ON storage.objects;

-- Create proper policies that allow uploads to user folders

-- Allow authenticated users to upload to their own folder (user_id/filename)
CREATE POLICY "Users can upload to own folder in lender-logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lender-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update files in their folder
CREATE POLICY "Users can update own files in lender-logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lender-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'lender-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete files in their folder
CREATE POLICY "Users can delete own files in lender-logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lender-logos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (bucket is already public)
CREATE POLICY "Public read access for lender-logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'lender-logos');