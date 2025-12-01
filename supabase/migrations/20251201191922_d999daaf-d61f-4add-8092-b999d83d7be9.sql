-- Add display_mode column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_mode TEXT DEFAULT 'auto' CHECK (display_mode IN ('auto', 'mobile', 'desktop'));

-- Add comment to the column
COMMENT ON COLUMN profiles.display_mode IS 'User preference for layout mode: auto (device-based), mobile (single-column touch UI), or desktop (sidebar multi-column)';