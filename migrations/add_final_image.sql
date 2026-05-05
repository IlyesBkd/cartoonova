-- Add final image fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_image_sent_at TIMESTAMPTZ;
