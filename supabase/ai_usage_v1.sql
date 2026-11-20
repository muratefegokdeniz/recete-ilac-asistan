-- AI kullanım kaydı ve günlük limit (claude-proxy Edge Function kullanıyor)
--
-- Supabase Dashboard > SQL Editor'de BİR KEZ çalıştır. claude-proxy'nin yeni
-- sürümünü deploy etmeden ÖNCE çalıştırılmalı; tablo yoksa fonksiyon 503 döner.
--
-- Kullanıcı yalnızca kendi satırlarını görebilir ve ekleyebilir. Güncelleme ve
-- silme izni yok, böylece kimse kendi sayacını sıfırlayamaz.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx
  ON public.ai_usage (user_id, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_select_own" ON public.ai_usage;
CREATE POLICY "ai_usage_select_own" ON public.ai_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_usage_insert_own" ON public.ai_usage;
CREATE POLICY "ai_usage_insert_own" ON public.ai_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- İsteğe bağlı: 30 günden eski kayıtları temizlemek için (pg_cron varsa)
-- SELECT cron.schedule('ai_usage_cleanup', '0 3 * * *',
--   $$DELETE FROM public.ai_usage WHERE created_at < now() - interval '30 days'$$);
