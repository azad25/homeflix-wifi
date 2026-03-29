-- Add soft delete column to media table
ALTER TABLE media ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Add soft delete column to series table
ALTER TABLE series ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Create index for better query performance
CREATE INDEX idx_media_deleted_at ON media(deleted_at);
CREATE INDEX idx_series_deleted_at ON series(deleted_at);
