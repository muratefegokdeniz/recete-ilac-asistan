// Sürüm bazlı özellik anahtarları.
//
// MEMBERSHIP_ENABLED: v1 App Store sürümünde üyelik sistemi kapalı — herkes
// tüm özellikleri (AI + Aile) ücretsiz deneyebilsin diye. Kod silinmedi:
// gerçek ödeme (RevenueCat/IAP) eklendiğinde bunu true yapmak yeterli;
// hasAiAccess/hasFamilyAccess tekrar profildeki alanlara bakar, kilit
// ekranları ve /membership sayfası geri gelir.
// Not: sunucu tarafı (claude-proxy, aile RLS) hâlâ DB'deki
// has_ai_access/has_family_access'e bakıyor — bkz. free_access_v1_default.sql.
export const MEMBERSHIP_ENABLED = false;
