-- v1 VARSAYILANI: Herkese Premium + Aile erişimini aç (ilk uygulandığı tarih: 2026-09-08)
--
-- Bu GEÇİCİ bir test/demo hack'i DEĞİL — bilinçli bir ürün kararı: ödeme
-- sistemi (RevenueCat/IAP) kurulup gerçek abonelik modeline geçilene kadar
-- uygulama tamamen ücretsiz sunuluyor (bkz. [[payment_infra_decision_2026_08]]).
-- Bu kararın bir bitiş tarihi yok — "uygulama tutarsa" ödeme sistemine
-- geçilecek, o zamana kadar bu varsayılan geçerli kalacak.
--
-- Bu script Supabase Dashboard > SQL Editor'de BİR KEZ çalıştırıldı; dosya
-- burada canlı DB'nin şu anki durumunun kaydı olarak duruyor. Dosyayı silmek
-- veritabanındaki durumu DEĞİŞTİRMEZ — sadece bu kaydı kaybettirir.
--
-- Aşağıdaki 1-4 numaralı adımlar trigger'ı SADECE bu script çalışırken,
-- toplu UPDATE'in geçebilmesi için anlık kapatıp hemen tekrar açıyor —
-- script bittiğinde self-elevation koruması ([[security_review_findings]]
-- #2) kalıcı olarak yerinde duruyor, açık bir güvenlik boşluğu bırakmıyor.
--
-- Gerçek ödeme sistemi kurulduğunda: en alttaki "GERİ ALMAK İSTERSEN"
-- bölümünü kullan.

-- 1) lock_membership_tier_columns trigger'ını profiles tablosunda anlık kapat
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

-- 4) Trigger'ı hemen tekrar aç (self-elevation açığı kapalı kalsın, kullanıcılar
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
