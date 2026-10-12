# Mağaza Listeleme Materyalleri — İlaç Asistanı

Bu dosya, App Store Connect ve Google Play Console'da uygulama kaydı oluşturulurken
kopyala-yapıştır kullanılacak taslak metinleri içerir. Hesaplar (Apple Developer /
Google Play Console) onaylanınca doğrudan buradan doldurulabilir.

Gizlilik politikası URL'i (her iki mağaza için de zorunlu alan):
`https://recete-ilac-asistan.vercel.app/privacy-policy`

---

## 1. Uygulama Kimliği

| Alan | Değer |
|---|---|
| Uygulama adı | İlaç Asistanı |
| Bundle ID (iOS) | com.muratefegokdeniz.receteilacasistan |
| Package name (Android) | com.muratefegokdeniz.receteilacasistan |
| Kategori (birincil) | Tıp / Sağlık ve Fitness (Medical / Health & Fitness) |
| Kategori (ikincil, opsiyonel) | Verimlilik (Productivity) |
| Destek e-postası | muratefegokdeniz@gmail.com |
| Destek URL | https://recete-ilac-asistan.vercel.app |

---

## 2. Play Store — Kısa Açıklama (max 80 karakter)

```
Reçete tara, ilaç hatırlatıcı kur, aileni akıllı ilaç takibiyle koru.
```
(69 karakter)

## 3. App Store — Alt Başlık / Subtitle (max 30 karakter)

```
Akıllı İlaç Takip Asistanı
```
(26 karakter)

## 4. App Store — Tanıtım Metni / Promotional Text (max 170 karakter, incelemesiz güncellenebilir)

```
Reçeteni fotoğrafla, ilaçlarını AI ile analiz et, doz hatırlatıcılarını kur ve
tüm aileni tek ekrandan takip et.
```

---

## 5. Uzun Açıklama (her iki mağaza — max 4000 karakter)

```
İlaç Asistanı, reçetelerinizi ve ilaçlarınızı tek bir yerden akıllıca yönetmenizi
sağlayan bir sağlık takip uygulamasıdır.

✓ REÇETE TARAMA
Reçetenizin fotoğrafını çekin, yapay zeka ilaç isimlerini, dozlarını ve kullanım
sıklığını sizin için otomatik olarak okusun.

✓ İLAÇ DOLABI
Evinizdeki ilaçları dijital bir dolapta takip edin; stoğu azalan veya son
kullanma tarihi yaklaşan ilaçlar için uyarı alın.

✓ GÜNLÜK İLAÇ PROGRAMI VE HATIRLATICILAR
Sabah, öğle, akşam dozlarınızı kaçırmayın. Uygulama size doğru saatte bildirim
gönderir, "Aldım" diyerek takibinizi tek dokunuşla güncelleyin.

✓ AİLE PAYLAŞIMI
Eşinizin, çocuklarınızın veya bakımını üstlendiğiniz yakınlarınızın ilaç
takibini aynı hesaptan yönetin. Çocuk profilleri kendi basit arayüzünden
dozlarını işaretleyebilir.

✓ İLAÇ ASİSTANI (AI SOHBET)
İlaç etkileşimleri, yan etkiler, kullanım zamanlaması ve beslenme ile ilişkisi
hakkında sorularınızı yapay zeka destekli asistana sorun.

✓ TAKVİM GÖRÜNÜMÜ
Geçmiş ve gelecek doz programınızı takvim üzerinden inceleyin.

Not: İlaç Asistanı genel bilgilendirme ve hatırlatma amaçlıdır, tıbbi tavsiye
yerine geçmez. Tedavi kararları için lütfen doktorunuza veya eczacınıza
danışın.
```

---

## 6. App Store — Anahtar Kelimeler (max 100 karakter, virgülle ayrılmış, boşluksuz)

```
ilaç,reçete,hatırlatıcı,doz,eczane,aile,sağlık,ilaç takip,tedavi,alarm,ilaç dolabı
```

---

## 7. İçerik / Yaş Derecelendirmesi — Taslak Cevaplar

### Google Play — İçerik Derecelendirme Anketi
| Soru | Cevap |
|---|---|
| Şiddet içeriği | Yok |
| Cinsel içerik | Yok |
| Küfür | Yok |
| Kontrollü madde referansı (uyuşturucu/alkol) | Yok — yalnızca reçeteli/OTC ilaç bilgisi, kötüye kullanım teşviki yok |
| Kullanıcı üretimi içerik paylaşımı (herkese açık) | Yok — veriler yalnızca hesap sahibi ve eklediği aile üyeleriyle sınırlı |
| Uygulama içi satın alma | Yok (v1'de tüm özellikler ücretsiz; üyelik/IAP altyapısı kodda hazır ama devre dışı, ilerideki bir güncellemede etkinleştirilecek) |
| Reklam | Yok |
| Konum paylaşımı | Yok |
| Beklenen sonuç | Genellikle "Everyone" / 3+ (sağlık bilgisi barındırdığı için Play bazen "Herkes" içinde ek not düşebilir) |

### App Store — Yaş Derecelendirmesi
| Soru | Cevap |
|---|---|
| Tıbbi/Tedavi Bilgisi (Medical/Treatment Information) | Sık değil/Hafif (Infrequent/Mild) — genel bilgi ve hatırlatma, teşhis/tedavi iddiası yok |
| Şiddet, cinsel içerik, küfür, kumar | Yok |
| Kullanıcı tarafından oluşturulan içerik / sohbet | Yok (AI asistan tek yönlü, kullanıcılar birbirleriyle etkileşime girmiyor) |
| Beklenen sonuç | 12+ (Medical/Treatment Information seçeneği nedeniyle; Apple'ın güncel anketi nihai puanı otomatik hesaplar) |

> Not: Apple inceleme notlarına (App Review Information → Notes) şu açıklamayı eklemek
> faydalı olur: *"Bu uygulama tıbbi teşhis veya tedavi önerisi sunmaz; yalnızca
> kullanıcının kendi girdiği/fotoğrafladığı reçete ve ilaç bilgilerini
> düzenlemesine ve hatırlatma almasına yardımcı olur."*

---

## 8. Veri Güvenliği Formu Taslağı

### Google Play — Data Safety
| Veri türü | Toplanıyor mu? | Paylaşılıyor mu? | Amaç |
|---|---|---|---|
| E-posta adresi | Evet | Hayır | Hesap oluşturma / kimlik doğrulama |
| Sağlık bilgileri (ilaç adı, doz, program) | Evet | Evet (Anthropic — yalnızca AI analizi için) | Uygulama işlevselliği |
| Fotoğraflar (reçete/ilaç görseli) | Evet | Evet (Anthropic — yalnızca AI analizi için) | Uygulama işlevselliği |
| Kullanıcı kimlikleri | Evet | Hayır | Hesap yönetimi |
| Konum, finansal bilgi, kişi listesi | Hayır | — | — |
| Veri şifreleme (aktarımda) | Evet | | |
| Kullanıcı veri silme talebi imkânı | Evet | | |

### Apple — App Privacy (Nutrition Label)
| Kategori | Toplanıyor mu? | Kullanıcıyla ilişkilendirilir mi? | Takip (tracking) amaçlı mı? |
|---|---|---|---|
| İletişim Bilgisi (e-posta) | Evet | Evet | Hayır |
| Sağlık ve Fitness (ilaç/reçete verisi) | Evet | Evet | Hayır |
| Kullanıcı İçeriği (fotoğraflar) | Evet | Evet | Hayır |
| Tanımlayıcılar (User ID) | Evet | Evet | Hayır |
| Kullanım Verisi / Reklam Verisi | Hayır | — | — |

Üçüncü taraf işlemciler (her iki formda da beyan edilmeli): **Supabase** (barındırma/veritabanı),
**Anthropic Claude** (yalnızca reçete/ilaç fotoğrafı analizi için).

---

## 9. Ekran Görüntüleri — YAPILACAK (kasıtlı olarak beklemede bırakıldı)

`screenshots/` klasöründeki mevcut görüntüler **4 Mayıs 2026** tarihli, yani:
- Tutorial/tab bar düzeltmeleri, AI-fotoğraf modu, üyelik kademeleri gibi sonraki
  değişiklikleri yansıtmıyor (bkz. git log — Ağustos'ta çok sayıda ilgili commit var).
- Gerçek kullanıcı adınızı ("Murat Efe Gökdeniz") içeriyor — herkese açık mağaza
  görselinde kişisel adınızın görünmesini istemeyebilirsiniz.
- Çözünürlükleri (780×1688) hiçbir mağazanın güncel zorunlu ölçüsüyle tam örtüşmüyor
  (App Store için hedef: 1290×2796 — 6.7"; Play için min 320px, tavsiye 1080×1920+).

Bu yüzden ekran görüntülerini, gönderim zamanı geldiğinde güncel uygulama hâliyle ve
tercihen nötr/demo bir hesap adıyla yeniden almanızı öneririm. İstediğinizde
simulator/emulator ya da web build üzerinden Playwright ile otomatik, doğru
çözünürlükte bir set çıkarabilirim — tek yapmanız gereken haber vermek.

---

## 10. App Store — App Review Information → Notes

> App Store Connect → uygulama sürümü → **App Review Information** bölümüne yapıştırılacak.
> "Sign-in required" işaretlenip demo hesap bilgileri ayrıca **Sign-In Information**
> alanlarına girilecek. Demo hesap içinde örnek reçete, ilaç ve bir çocuk profili olmalı.

```
Thank you for reviewing İlaç Asistanı (Medicine Assistant).

DEMO ACCOUNT
Email: <demo hesap e-postası>
Password: <demo hesap şifresi>
The account already contains sample prescriptions, medicines in the cabinet,
active reminders and a child profile so every feature can be reviewed.

WHAT THE APP DOES
A personal medicine organizer (Turkish UI): users photograph a prescription or a
medicine box, review the extracted medicine list, keep a home medicine cabinet with
expiry dates, and get local reminder notifications. The app does NOT diagnose,
prescribe or recommend treatment. All features are free; there are no in-app
purchases or subscriptions in this version.

AI / THIRD-PARTY DATA SHARING (Guideline 5.1.2(i))
Prescription reading, medicine-photo analysis and the chat assistant use Anthropic
Claude via our own server (the API key never ships in the app). Before any data is
sent, the app shows a one-time consent screen ("Yapay Zeka ile Veri Paylaşımı")
listing exactly what is shared (photos, medicine details, chat messages). If the
user declines, AI features stay off and everything else works with manual entry.
Consent can be changed any time in Profile > "Yapay Zeka İzni". Anthropic does not
use this data for model training.

MEDICAL SAFETY (Guideline 1.4.1)
Every AI result shows a warning that it may be inaccurate and must be checked
against the prescription/box or confirmed with a doctor or pharmacist. The chat
screen states it is not medical advice. Terms of Use include a medical disclaimer.

ACCOUNT DELETION (Guideline 5.1.1(v))
Profile > "Hesabımı Sil" permanently deletes the account and all associated data
(records and uploaded photos) on our server.

FAMILY / CHILD DEVICE LINKING
A parent can add child profiles to their own account. Optionally a child can view
their own reminders on a separate device via "Çocuk musun? Aileme bağlı gir" on the
login screen. For this one-time link request, the parent's email and password are
entered on the child's device to verify the parent's identity; the password is sent
over HTTPS to our server only to verify it, is never stored, and is never returned
to the child's device. The link stays pending until the parent explicitly approves
it from their own device (Profile > pending requests), and the parent can revoke it
by deleting the child profile. The child device never receives the parent's
session or credentials.

PERMISSIONS
Camera / Photo Library: only to capture or pick prescription and medicine photos.
Notifications: local medicine reminders. No location, contacts, tracking or ads.

Privacy Policy: https://recete-ilac-asistan.vercel.app/privacy-policy
Terms of Use:   https://recete-ilac-asistan.vercel.app/terms
Contact: muratefegokdeniz@gmail.com
```
