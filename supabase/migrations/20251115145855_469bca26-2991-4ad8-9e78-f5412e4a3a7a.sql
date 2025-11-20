-- Create storage bucket for loan documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('loan-documents', 'loan-documents', false);

-- RLS policies for loan documents storage
CREATE POLICY "Users can upload their own loan documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'loan-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own loan documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'loan-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own loan documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'loan-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);