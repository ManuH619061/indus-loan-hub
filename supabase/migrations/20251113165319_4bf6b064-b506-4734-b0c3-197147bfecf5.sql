-- Add new payment method values to payment_source enum
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'UPI_PHONEPE';
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'UPI_GPAY';
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'UPI_PAYTM';
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'APP_NAVI';
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'ACH';