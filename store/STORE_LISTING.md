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
