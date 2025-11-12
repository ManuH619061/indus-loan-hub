-- Add logo and payment fields to existing tables

-- Add logo and UPI fields to lenders
ALTER TABLE lenders 
ADD COLUMN logo_url TEXT,
ADD COLUMN upi_vpa TEXT,
ADD COLUMN app_link TEXT,
ADD COLUMN website TEXT;

-- Add logo and payment preference to loans
ALTER TABLE loans
ADD COLUMN logo_url TEXT,
ADD COLUMN preferred_method TEXT;

-- Add detailed payment tracking fields to payments
ALTER TABLE payments
ADD COLUMN method TEXT,
ADD COLUMN gateway_app TEXT,
ADD COLUMN upi_vpa TEXT,
ADD COLUMN upi_txn_id TEXT,
ADD COLUMN external_ref TEXT,
ADD COLUMN suggestion_used TEXT;

-- Add indexes for performance
CREATE INDEX idx_lenders_name ON lenders(name);
CREATE INDEX idx_payments_loan_paid ON payments(loan_id, paid_on);
CREATE INDEX idx_payments_method ON payments(method);

-- Add check constraint for payment methods
ALTER TABLE payments
ADD CONSTRAINT check_payment_method
CHECK (method IS NULL OR method IN (
  'UPI_PHONEPE', 'UPI_GPAY', 'UPI_PAYTM', 'APP_NAVI', 
  'NETBANKING', 'CARD', 'CASH', 'ACH', 'NACH'
));

-- Add check constraint for suggestion types
ALTER TABLE payments
ADD CONSTRAINT check_suggestion_used
CHECK (suggestion_used IS NULL OR suggestion_used IN (
  'DUE_TODAY', 'CATCH_UP', 'ROUND_UP', 'PREPAY_10', 'FULL_CLOSE', 'MANUAL'
));