# 14 Temmuz Sprint Planı — Reçete & İlaç Asistanı

## Context

Yatırım görüşmesinde kararlaştırılan değişikliklerin 14 Temmuz'a (bugünden 7 gün) kadar
uygulanması gerekiyor. Kod tabanını incelerken **acil bir güvenlik açığı** bulundu:
`EXPO_PUBLIC_ANTHROPIC_API_KEY` önekiyle Claude API key'i mobil uygulamanın içine
gömülüyor — herkes decompile ederek key'i çıkarabilir. Bu hem maliyet/limit sorununun
olası kaynağı hem de yatırımcıya gösterilecek bir üründe olmaması gereken bir açık;
bu yüzden plan bu düzeltmeyle başlıyor.

Ayrıca kod tabanında şu an şunlar zaten var / kısmen başlamış durumda:
- `active.tsx`'te aile üyesi (`memberName`) etiketleme sistemi zaten çalışıyor (sekmeler,
  ekleme, silme) — ama bu gerçek bir "hesap" değil, sadece `active_medicines` tablosunda
  bir string etiket.
- `login.tsx`'te commit edilmemiş değişiklikler zaten kayıt sonrası profil doldurma
  akışını (adım adım wizard) inline olarak inşa ediyor — bu, `app/onboarding.tsx`
  (untracked) ile neredeyse birebir aynı, iki paralel implementasyon var.
- `calendar.tsx`, `getAllActiveMedicines()`'i üye filtresi olmadan çekiyor — yani şu an
  aile üyelerinin ilaçları da takvime karışıyor. "Çocuk ilaçları görünsün ama takvime
  eklenmesin" isteği bunun düzeltilmesini gerektiriyor.
- Ödeme/abonelik altyapısı hiç yok (Stripe/RevenueCat yok).

Kullanıcıyla netleşen mimari kararlar:
- **Backend:** Supabase Edge Functions (yeni sunucu/hosting kurulmayacak).
- **Çocuk girişi:** Ayrı Supabase Auth hesabı YOK. Çocuk giriş ekranında annesinin
  email+şifresini girer → bu sadece "aile doğrulama" için arka planda kontrol edilir
  (anneye ait gerçek oturum AÇILMAZ) → bekleyen bir istek olarak anne tarafında birikir
  → anne uygulamayı açtığında onaylar/reddeder → onaylanınca çocuğun cihazında kalıcı,
  kısıtlı bir "çocuk profili" oturumu açılır (sadece kendi ilaçları + aşı kartı; ödeme/
  ayarlar ekranları hiç gösterilmez).
- **Ödeme:** Bu sprintte sadece altyapı (`is_premium`, çocuk hesapları otomatik muaf).
  Gerçek RevenueCat/App Store IAP entegrasyonu App Store çıkışı öncesi ayrı bir iş.

**Yatırım için gereken para hesaplaması** (geliştirme + App Store çıkışı + reklam
maliyetleri ve gerekçeleri) kod işi değil — bu, planın sonunda ayrı bir finansal doküman
olarak ele alınacak, teknik sprint'in parçası değil.

---

## İş 0 — API Key'i Backend'e Taşı (öncelik: en yüksek, güvenlik) ✅ tamamlandı, canlıda doğrulandı

**Neden önce bu:** Diğer her şey bu API'nin üzerine inşa edilecek; ayrıca mevcut sızıntı
acil.

- Supabase projesinde yeni bir Edge Function: `supabase/functions/claude-proxy/index.ts`
  — `ANTHROPIC_API_KEY`'i Supabase secret olarak alır (`supabase secrets set`), gelen
  isteği (system prompt + messages + model + max_tokens) olduğu gibi Anthropic'e iletir,
  cevabı döner. İstek, Supabase Auth JWT'siyle doğrulanmış kullanıcıdan gelmeli
  (platform varsayılan JWT doğrulaması, anonim istekler reddedilir).
- `services/anthropic.ts`: doğrudan `Anthropic` client'ı kaldırıldı, yerine
  `callClaude()` yardımcı fonksiyonu `supabase.functions.invoke("claude-proxy", ...)`
  çağırıyor. Fonksiyon imzaları/dönüş tipleri değişmedi.
- `.env.local`'dan `EXPO_PUBLIC_ANTHROPIC_API_KEY` satırı silindi.
- **Kalan adım (kullanıcı tarafında):** Anthropic Console'da eski key rotate edilip,
  yeni key `supabase secrets set ANTHROPIC_API_KEY=...` ile ayarlanmalı ve
  `supabase functions deploy claude-proxy` ile fonksiyon deploy edilmeli.

## İş 1 — Kayıt Sırasında Profil Doldurma (zaten başlamış, bitir)

- `login.tsx`'teki commit edilmemiş inline onboarding akışı tamamlanıp finalize edilir.
- `app/onboarding.tsx` **silinir** (duplicate) — `_layout.tsx`'teki `/onboarding` route
  referansı ve oraya yönlendiren redirect mantığı da kaldırılır, çünkü profil doldurma
  artık `signUp` sonrası `login.tsx` içinde senkron olarak oluyor, ayrı bir ekrana
  yönlendirmeye gerek kalmıyor.
- `_layout.tsx`'teki `hasProfile` kontrolü, artık sadece "profili olmayan eski
  kullanıcılar" (migration senaryosu) için bir fallback olarak kalır.

## İş 2 — Takvimde Aile Üyesi Görünümü ✅ tamamlandı (revize edildi)

İlk versiyonda çocuk ilaçları takvimden tamamen çıkarılmıştı, ama kullanıcı hem
karışık hem tekil görünüm istedi. Son hâli: `calendar.tsx`'e "Tümü / Ben / <çocuk adı>"
üye sekmeleri eklendi. "Tümü" modunda herkesin ilaçları birlikte görünür, her aile
üyesi ayrı bir renkle (sol kenarlık + isim etiketi) ayırt edilir; "Ben" veya bir
çocuk seçilince sadece o kişinin ilaçları filtrelenir. Renk ataması `getMemberColor()`
ile çocuk listesindeki sıraya göre sabit bir paletten yapılıyor.

## İş 3 — Aşı Kartı (Aşı Takibi)

- Yeni tablo `child_vaccines` (Supabase): `id, user_id (ebeveyn), child_name, vaccine_name,
  recommended_age, due_date, completed_at (nullable), notification_id`. Standart aşı
  takvimi (Sağlık Bakanlığı listesi) sabit bir referans listesi olarak koda gömülür
  (`constants/VaccineSchedule.ts`), her çocuk eklendiğinde bu liste otomatik satırlara
  dönüştürülür.
- `services/database.supabase.ts`'e `getChildVaccines(childName)`,
  `markVaccineDone(id)`, `getAllChildVaccines()` eklenir — mevcut `rowToX` /
  CRUD paternleri (ör. `getAllActiveMedicines`, `markDoseTaken`) birebir takip edilir.
- Yeni ekran `app/(tabs)/vaccines.tsx` (veya `active.tsx`'teki üye sekmesi paternini
  paylaşan bir alt-sekme): çocuk başına aşı listesi, tik kutuları, vade tarihi
  yaklaşınca bildirim.
- Bildirimler: `services/notifications.ts`'teki `scheduleDailyReminder` paterni referans
  alınır ama aşı tarihleri tekrar eden değil tek seferlik olduğu için
  `Notifications.SchedulableTriggerInputTypes.DATE` tetikleyicisiyle yeni bir
  `scheduleVaccineReminder(childName, vaccineName, dueDate)` fonksiyonu eklenir.
- Ebeveyn kendi çocuklarının aşı kartını görebilir (zaten `active.tsx`'teki
  `selectedMember` mantığıyla aynı üye listesi kullanılır).

## İş 4 — Çocuk Girişi (Aile Bağlantılı, Onaylı)

Yeni tablolar:
- `family_link_requests`: `id, parent_user_id, child_display_name, device_id, status
  ('pending'|'approved'|'denied'), created_at`.
- `child_profiles`: `id, parent_user_id, display_name, device_id, created_at` — onaylanan
  bağlantılar burada kalıcılaşır.

Akış:
1. Login ekranında yeni bir mod: "Aileme bağlı gir". Çocuk annesinin email+şifresini
   girer.
2. Bu bilgi **doğrudan `supabase.auth.signInWithPassword` ile oturum açmak için
   kullanılmaz.** Bunun yerine yeni bir Edge Function (`family-link-request`) email+
   şifreyi Supabase Admin API ile doğrular (oturum döndürmeden, sadece "doğru mu"
   kontrolü), doğruysa `family_link_requests`'e `status: pending` bir satır ekler.
3. Anne uygulamayı açtığında (`home.tsx` veya global bir banner/modal) kendi
   `parent_user_id`'sine ait `pending` istekleri görür, onaylar/reddeder.
4. Onaylanınca `child_profiles`'a satır eklenir, çocuğun cihazına (AsyncStorage/SecureStore)
   `child_profile_id` + `parent_user_id` kalıcı olarak yazılır — bir daha şifre
   girmesi gerekmez.
5. Uygulama açılışında (`AuthContext` veya yeni bir `ChildSessionContext`) önce normal
   Supabase session kontrol edilir, yoksa cihazda kayıtlı `child_profile_id` var mı
   bakılır; varsa "çocuk modu" aktif olur.
6. Çocuk modunda: `_layout.tsx`'teki tab yapısı kısıtlanır — sadece kendi ilaçları
   (aktif ilaçlar filtrelenmiş `memberName === display_name`) ve aşı kartı görünür;
   `profile.tsx`, ödeme/ayarlar ekranlarına route bloklanır.
7. RLS (Row Level Security) tarafı: `active_medicines`/`child_vaccines` sorguları normal
   `user_id = parent_user_id` ile çalışır (çocuk zaten ebeveynin verisine bakıyor),
   sadece client tarafında hangi `memberName`'e izin verildiği filtrelenir — gerçek
   yetki sınırı Edge Function/RLS seviyesinde, sadece UI'da değil, uygulanmalı.

## İş 5 — Ödeme Altyapısı (sadece altyapı, gerçek ödeme yok)

- `profiles` tablosuna `is_premium boolean default false` eklenir.
- Basit bir `hasAccess(profile, childProfile)` yardımcı fonksiyonu: ebeveyn hesabı için
  `is_premium` kontrolü yapılır; çocuk profili için otomatik `true` döner (ayrı
  hesap/ödeme olmadığı için zaten ebeveyn üzerinden erişiyor).
- Şimdilik `is_premium` UI'da bir ayar/test flag'i olarak elle değiştirilebilir
  (gerçek satın alma ekranı yok). RevenueCat/App Store IAP entegrasyonu bu sprint'e
  dahil değil — App Store çıkışı öncesi ayrı iş olarak planlanacak.

---

## Doğrulama

- İş 0: `chat.tsx`'ten bir mesaj gönderip Claude cevabının Edge Function üzerinden
  geldiğini, `.env.local`'da artık key olmadan uygulamanın çalıştığını doğrula.
- İş 1: Yeni bir hesapla kayıt olup profil formunun kayıt akışının parçası olduğunu,
  `/onboarding` route'una hiç düşülmediğini doğrula.
- İş 2: Bir çocuğa ilaç ekleyip takvimde görünmediğini, `active.tsx`'te üye sekmesinde
  hâlâ göründüğünü doğrula.
- İş 3: Bir çocuk için aşı kartının otomatik oluştuğunu, tik atınca işaretlendiğini,
  vade tarihi bildiriminin zamanlandığını (cihazda) doğrula.
- İş 4: Çocuk cihazından anne bilgileriyle istek gönder → anne hesabından onayla →
  çocuk cihazının kısıtlı moda geçtiğini, ödeme/ayar ekranlarının gizlendiğini doğrula.
- İş 5: `is_premium=false` bir ebeveyn hesabıyla erişim kısıtlamasının (varsa) tetiklendiğini,
  bağlı çocuk profilinin bundan etkilenmediğini doğrula.
