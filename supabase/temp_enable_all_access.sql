-- GEÇİCİ: Herkese Premium + Aile erişimini aç (2026-09-08)
-- Amaç: APK testi/demo sırasında ödeme sistemi olmadan tüm kullanıcıların
-- tüm özellikleri (AI + aile bağlama) kullanabilmesi.
-- Supabase Dashboard > SQL Editor'de çalıştır.

-- 1) lock_membership_tier_columns trigger'ını profiles tablosunda geçici kapat
--    (adını bilmeden, o fonksiyona bağlı trigger'ı otomatik bulup kapatıyor)
DO $$
DECLARE trg record;
BEGIN
  FOR trg IN
    SELECT t.tgname FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE p.proname = 'lock_membership_tier_columns'
      AND t.tgrelid = 'public.profiles'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DISABLE TRIGGER %I', trg.tgname);
  END LOOP;
END $$;

-- 2) Var olan tüm kullanıcılara erişimi aç
UPDATE public.profiles SET has_ai_access = true, has_family_access = true;

-- 3) Yeni kayıt olacaklar da otomatik açık gelsin
ALTER TABLE public.profiles ALTER COLUMN has_ai_access SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN has_family_access SET DEFAULT true;

-- 4) Trigger'ı tekrar aç (self-elevation açığı kapalı kalsın, kullanıcılar
--    bu alanları kendi başına client'tan değiştiremesin)
DO $$
DECLARE trg record;
BEGIN
  FOR trg IN
    SELECT t.tgname FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE p.proname = 'lock_membership_tier_columns'
      AND t.tgrelid = 'public.profiles'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.profiles ENABLE TRIGGER %I', trg.tgname);
  END LOOP;
END $$;


-- ─── GERİ ALMAK İSTERSEN (ödeme sistemi hazır olduğunda) ───────────────────
-- Sadece varsayılanı kapat, mevcut kullanıcıları DOKUNMA (aksi halde test
-- ettiğin gerçek premium kullanıcıları da sıfırlarsın):
--
-- ALTER TABLE public.profiles ALTER COLUMN has_ai_access SET DEFAULT false;
-- ALTER TABLE public.profiles ALTER COLUMN has_family_access SET DEFAULT false;
--
-- Var olan hesapları da false'a çekmek istersen önce gerçekten ödeme yapan
-- kullanıcıların id listesini çıkar, onları hariç tutarak UPDATE at.
