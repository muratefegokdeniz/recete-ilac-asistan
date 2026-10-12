import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors, Radius } from "../constants/Colors";
import { Button } from "./ui";
import { getAiConsent, setAiConsent, onAiConsentChange } from "../services/aiConsent";

// Giriş yapmış kullanıcıya AI'ı ilk kullanmadan önce bir kez gösterilen izin
// ekranı. RN <Modal> değil, mutlak konumlu bir View: iOS açık bir Modal varken
// yanına ikinci bir Modal sunmuyor, ayrıca bu ekran sekmelere girer girmez,
// henüz hiçbir modal açık değilken çıkıyor.
export function AiConsentGate({ active }: { active: boolean }) {
  const router = useRouter();
  const [needsAnswer, setNeedsAnswer] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!active) { setNeedsAnswer(false); return; }
    let cancelled = false;
    const check = () => getAiConsent().then((c) => { if (!cancelled) setNeedsAnswer(c === null); });
    check();
    const unsubscribe = onAiConsentChange(check);
    return () => { cancelled = true; unsubscribe(); };
  }, [active]);

  if (!active || !needsAnswer) return null;

  async function answer(granted: boolean) {
    setSaving(true);
    try {
      await setAiConsent(granted ? "granted" : "denied");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="auto-awesome" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Yapay Zeka ile Veri Paylaşımı</Text>
          <Text style={styles.paragraph}>
            Reçete okuma, ilaç fotoğrafı analizi ve Asistan sohbeti, üçüncü taraf bir yapay
            zeka hizmeti olan <Text style={styles.bold}>Anthropic (Claude)</Text> tarafından
            sağlanır. Bu özellikleri kullandığında şu veriler Anthropic'e gönderilir:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Çektiğin veya seçtiğin reçete ve ilaç fotoğrafları</Text>
            <Text style={styles.listItem}>• İlaç adları, dozlar ve reçete bilgileri</Text>
            <Text style={styles.listItem}>• Asistana yazdığın mesajlar</Text>
          </View>
          <Text style={styles.paragraph}>
            Bu veriler yalnızca isteğini yanıtlamak için kullanılır, reklam için kullanılmaz ve
            Anthropic tarafından model eğitiminde kullanılmaz. İznini istediğin zaman
            Profil &gt; Yapay Zeka İzni bölümünden değiştirebilirsin.
          </Text>
          <Text style={styles.paragraph}>
            İzin vermezsen ilaç dolabı, hatırlatmalar ve takvim gibi diğer özellikler
            çalışmaya devam eder; ilaç bilgilerini elle girebilirsin.
          </Text>
          <TouchableOpacity onPress={() => router.push("/privacy-policy")}>
            <Text style={styles.link}>Gizlilik Politikası'nı oku</Text>
          </TouchableOpacity>
        </ScrollView>
        <View style={styles.actions}>
          <Button title="İzin Ver" onPress={() => answer(true)} variant="primary" size="lg" fullWidth loading={saving} />
          <Button title="Şimdi Değil" onPress={() => answer(false)} variant="ghost" size="lg" fullWidth disabled={saving} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.background, zIndex: 1000, elevation: 1000 },
  safe: { flex: 1 },
  content: { padding: 24, paddingTop: 32 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text, textAlign: "center", marginBottom: 16 },
  paragraph: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 12 },
  bold: { fontWeight: "700", color: Colors.text },
  list: { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: 14, marginBottom: 12, gap: 6 },
  listItem: { fontSize: 14, lineHeight: 20, color: Colors.text },
  link: { fontSize: 14, color: Colors.primary, fontWeight: "700", marginTop: 4 },
  actions: { paddingHorizontal: 24, paddingBottom: 12, gap: 8 },
});
