-- Previene doble acreditación de milestones de racha aunque dos requests
-- simultáneos pasen el check de count = 0. La constraint garantiza
-- idempotencia a nivel DB, no solo a nivel aplicación.
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_txns_streak_milestone
  ON point_transactions (
    user_id,
    (context->>'streak'),
    (context->>'date')
  )
  WHERE source = 'streak_milestone';
