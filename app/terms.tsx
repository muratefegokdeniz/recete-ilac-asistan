import React from "react";
import { Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/Colors";
import { LegalBackButton } from "../components/LegalBackButton";

const LAST_UPDATED = "12 Ekim 2026";

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <LegalBackButton />
        <Text style={styles.title}>Kullanım Şartları</Text>
        <Text style={styles.updated}>Son güncelleme: {LAST_UPDATED}</Text>

        <Text style={styles.paragraph}>
          İlaç Asistanı'nı ("Uygulama") kullanarak aşağıdaki şartları kabul etmiş olursunuz.
        </Text>

        <Text style={styles.heading}>1. Tıbbi Sorumluluk Reddi</Text>
        <Text style={styles.paragraph}>
          Uygulama bir tıbbi cihaz değildir; teşhis koymaz, tedavi önermez ve doktor veya
          eczacı tavsiyesinin yerini tutmaz. Uygulamadaki bilgiler yalnızca genel bilgilendirme
          ve kişisel takip amaçlıdır. İlaç kullanımınızla ilgili tüm kararlar için doktorunuza
          veya eczacınıza danışın. Acil bir durumda 112'yi arayın.
        </Text>

        <Text style={styles.heading}>2. Yapay Zeka Özellikleri</Text>
        <Text style={styles.paragraph}>
          Reçete okuma, ilaç fotoğrafı analizi ve Asistan sohbeti yapay zeka ile çalışır ve
          hatalı veya eksik sonuç üretebilir (ör. ilaç adını, dozu veya kullanım sıklığını
          yanlış okuyabilir). Yapay zekanın ürettiği her bilgiyi kullanmadan önce reçetenizle,
          ilaç kutusuyla veya prospektüsle karşılaştırarak kontrol etmek sizin
          sorumluluğunuzdadır.
        </Text>

        <Text style={styles.heading}>3. Hatırlatmalar</Text>
        <Text style={styles.paragraph}>
          İlaç hatırlatmaları cihazınızın bildirim sistemine bağlıdır; bildirim izinleri,
          pil tasarrufu modları veya cihaz ayarları nedeniyle gecikebilir ya da hiç
          gösterilmeyebilir. Hatırlatmalar ilaç takibiniz için tek güvenceniz olmamalıdır.
        </Text>

        <Text style={styles.heading}>4. Hesap ve Aile Profilleri</Text>
        <Text style={styles.paragraph}>
          Hesabınızın ve şifrenizin güvenliğinden siz sorumlusunuz. Aile/çocuk profillerine
          eklediğiniz bilgilerin doğruluğundan ve çocuk profillerinin yönetiminden hesap
          sahibi olarak siz sorumlusunuz. Hesabınızı istediğiniz zaman Profil &gt; Hesabımı
          Sil ile kalıcı olarak silebilirsiniz.
        </Text>

        <Text style={styles.heading}>5. Kabul Edilebilir Kullanım</Text>
        <Text style={styles.paragraph}>
          Uygulamayı yasalara aykırı amaçlarla, başkalarına ait verileri izinsiz yüklemek
          için veya hizmetin çalışmasını bozacak şekilde kullanamazsınız.
        </Text>

        <Text style={styles.heading}>6. Sorumluluğun Sınırlandırılması</Text>
        <Text style={styles.paragraph}>
          Uygulama "olduğu gibi" sunulur. Yürürlükteki hukukun izin verdiği ölçüde, uygulamanın
          kullanımından veya kullanılamamasından doğan doğrudan ya da dolaylı zararlardan
          sorumluluk kabul edilmez.
        </Text>

        <Text style={styles.heading}>7. Değişiklikler</Text>
        <Text style={styles.paragraph}>
          Bu şartlar güncellenebilir; önemli değişiklikler uygulama içinde bildirilir.
          Kişisel verilerinizin nasıl işlendiği Gizlilik Politikası'nda açıklanmıştır.
        </Text>

        <Text style={styles.heading}>8. İletişim</Text>
        <Text style={styles.paragraph}>Sorularınız için: muratefegokdeniz@gmail.com</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  updated: { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  heading: { fontSize: 16, fontWeight: "700", color: Colors.text, marginTop: 16, marginBottom: 6 },
  paragraph: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
});
