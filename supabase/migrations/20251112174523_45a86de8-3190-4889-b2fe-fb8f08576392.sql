-- Add new fields to lenders table
ALTER TABLE public.lenders 
ADD COLUMN app_display_name TEXT,
ADD COLUMN requires_sanction_letter BOOLEAN DEFAULT true,
ADD COLUMN requires_noc_on_close BOOLEAN DEFAULT true;

-- Add new fields to documents table
ALTER TABLE public.documents 
ADD COLUMN doc_type TEXT,
ADD COLUMN valid_from DATE,
ADD COLUMN valid_to DATE,
ADD COLUMN reminder_days_before INTEGER DEFAULT 7,
ADD COLUMN noc_date DATE,
ADD COLUMN received_via TEXT,
ADD COLUMN notes TEXT;

-- Add check constraint for doc_type
ALTER TABLE public.documents 
ADD CONSTRAINT documents_doc_type_check 
CHECK (doc_type IN ('SANCTION_LETTER', 'NOC', 'STATEMENT', 'SCHEDULE', 'AGREEMENT', 'KFS_KYC', 'OTHER'));

-- Add check constraint for received_via
ALTER TABLE public.documents 
ADD CONSTRAINT documents_received_via_check 
CHECK (received_via IN ('Email', 'Physical', 'Courier', NULL));

-- Add index for doc_type lookups
CREATE INDEX idx_documents_doc_type ON public.documents(doc_type);
CREATE INDEX idx_documents_valid_to ON public.documents(valid_to) WHERE valid_to IS NOT NULL;