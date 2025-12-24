ALTER TABLE handoffs ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_handoffs_is_archived ON handoffs(is_archived);

DROP POLICY IF EXISTS "Users can update handoffs" ON handoffs;
CREATE POLICY "Users can update handoffs" ON handoffs
  FOR UPDATE USING (true);
