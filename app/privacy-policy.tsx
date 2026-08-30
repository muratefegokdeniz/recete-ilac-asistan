import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/Colors";

const LAST_UPDATED = "30 Ağustos 2026";

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Gizlilik Politikası</Text>
        <Text style={styles.updated}>Son güncelleme: {LAST_UPDATED}</Text>

        <Text style={styles.paragraph}>
          İlaç Asistanı ("Uygulama"), reçete ve ilaç takibini kolaylaştırmak amacıyla
          geliştirilmiştir. Bu metin, uygulamayı kullanırken hangi verilerin toplandığını,
          nasıl kullanıldığını ve haklarınızı açıklar.
        </Text>

        <Text style={styles.heading}>1. Topladığımız Veriler</Text>
        <Text style={styles.paragraph}>
          • Hesap bilgileri: e-posta adresi ve kimlik doğrulama bilgileri.{"\n"}
          • Sağlık ile ilgili veriler: girdiğiniz veya fotoğrafını çektiğiniz reçete ve ilaç
          bilgileri (ilaç adı, doz, kullanım sıklığı).{"\n"}
          • Fotoğraflar: reçete/ilaç kutusu taraması için kamera veya galeriden seçtiğiniz
          görseller.{"\n"}
          • Aile/çocuk profili verileri: aile üyelerinin adı ve ilaç takip bilgileri (yalnızca
          hesabı oluşturan kullanıcı tarafından eklenir).{"\n"}
          • Bildirim tercihleri: ilaç hatırlatmaları için ayarladığınız saatler.
        </Text>

        <Text style={styles.heading}>2. Verilerin Kullanım Amacı</Text>
        <Text style={styles.paragraph}>
          Verileriniz yalnızca; reçete fotoğraflarınızın yapay zeka ile okunması, ilaç
          hatırlatmalarının zamanında gönderilmesi, aile üyeleri arasında ilaç takibinin
          paylaşılması ve hesabınızın güvenliğinin sağlanması amacıyla işlenir. Verileriniz
          reklam amacıyla kullanılmaz veya üçüncü taraflara satılmaz.
        </Text>

        <Text style={styles.heading}>3. Üçüncü Taraf Hizmet Sağlayıcılar</Text>
        <Text style={styles.paragraph}>
          • Supabase: hesap verileriniz, ilaç kayıtlarınız ve yüklediğiniz fotoğraflar
          güvenli şekilde bu altyapıda saklanır.{"\n"}
          • Anthropic (Claude): reçete/ilaç fotoğraflarınız, yalnızca ilaç bilgisini
          okuyup size sunmak amacıyla analiz için bu servise iletilir; bu veriler
          Anthropic tarafından model eğitimi için kullanılmaz.{"\n"}
          Bu sağlayıcılarla veri paylaşımı yalnızca uygulamanın çalışması için gerekli
          ölçüde yapılır.
        </Text>

        <Text style={styles.heading}>4. Veri Güvenliği ve Saklama</Text>
        <Text style={styles.paragraph}>
          Verileriniz şifreli bağlantılar üzerinden iletilir ve erişim yalnızca kimlik
          doğrulaması yapılmış hesabınız üzerinden mümkündür. Verileriniz, hesabınız aktif
          olduğu sürece saklanır; hesabınızı sildiğinizde ilişkili verileriniz de silinir.
        </Text>

        <Text style={styles.heading}>5. Çocuk Hesapları</Text>
        <Text style={styles.paragraph}>
          Aile modülü kapsamında oluşturulan çocuk profilleri, yalnızca ebeveyn/veli
          hesabı tarafından yönetilir. Çocuk profilleri bağımsız olarak kişisel veri
          toplamaz veya paylaşmaz; tüm veriler ana hesap sahibinin kontrolündedir.
        </Text>

        <Text style={styles.heading}>6. Haklarınız</Text>
        <Text style={styles.paragraph}>
          Verilerinize erişme, düzeltme, silme veya işlenmesine itiraz etme hakkına
          sahipsiniz. Bu taleplerinizi aşağıdaki iletişim adresi üzerinden bize
          iletebilirsiniz.
        </Text>

        <Text style={styles.heading}>7. İletişim</Text>
        <Text style={styles.paragraph}>
          Gizlilik politikamızla ilgili sorularınız için: muratefegokdeniz@gmail.com
        </Text>

        <Text style={styles.paragraph}>
          Bu politika, uygulamanın yeni özellikler kazanmasıyla güncellenebilir; önemli
          değişiklikler uygulama içinde bildirilecektir.
        </Text>
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
