ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS app_palette TEXT NOT NULL DEFAULT 'classic';

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_app_palette_check;
ALTER TABLE "user" ADD CONSTRAINT user_app_palette_check
  CHECK (app_palette IN ('classic', 'signal', 'terminal'));
