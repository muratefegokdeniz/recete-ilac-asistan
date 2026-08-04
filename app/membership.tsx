import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors, Radius, Shadows } from "../constants/Colors";
import { useAuth } from "../context/AuthContext";
import { hasAiAccess, hasFamilyAccess } from "../services/database";

interface TierDef {
  key: string;
  label: string;
  badge?: string;
  hasAi: boolean;
  hasFamily: boolean;
  tagline: string;
  includesLabel?: string;
  features: string[];
}

const TIERS: TierDef[] = [
  {
    key: "standart",
    label: "Standart",
    hasAi: false,
    hasFamily: false,
    tagline: "Kredi kartı gerekmez",
    features: [
      "İlaç dolabı ve SKT takibi",
      "Reçeteleri manuel kaydet",
      "Doz hatırlatma bildirimleri",
      "Takvim görünümü",
    ],
  },
  {
    key: "aile",
    label: "Aile",
    hasAi: false,
    hasFamily: true,
    tagline: "Çocuğunun takibini de yönetmek isteyenler için",
    includesLabel: "Standart'taki her şey, artı:",
    features: [
      "Çocuk/aile hesabı bağlama",
      "Çocuğun ilaç ve aşı takibini yönetme",
      "Çocuk doz atlarsa bildirim al",
    ],
  },
  {
    key: "premium",
    label: "Premium",
    badge: "EN POPÜLER",
    hasAi: true,
    hasFamily: false,
    tagline: "AI ile zaman kazanmak isteyenler için",
    includesLabel: "Standart'taki her şey, artı:",
    features: [
      "Reçete fotoğrafını AI ile otomatik analiz",
      "İlaç kutusu fotoğrafından AI ile form doldurma",
      "AI sohbet asistanı",
      "Doz atlarken AI tavsiyesi",
    ],
  },
  {
    key: "premium_aile",
    label: "Premium + Aile",
    badge: "TÜM ÖZELLİKLER",
    hasAi: true,
    hasFamily: true,
    tagline: "Tüm özellikler tek pakette",
    includesLabel: "Premium'daki her şey, artı:",
    features: [
      "Çocuk/aile hesabı bağlama",
      "Çocuğun ilaç ve aşı takibini yönetme",
      "Çocuk doz atlarsa bildirim al",
    ],
  },
];

export default function MembershipScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const currentAi = hasAiAccess(profile);
  const currentFamily = hasFamilyAccess(profile);

  function handleUpgrade(tier: TierDef) {
    Alert.alert("Çok Yakında", `${tier.label} üyeliğine yükseltme özelliği çok yakında burada olacak.`);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Üyelikler</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {TIERS.map((tier) => {
          const isCurrent = tier.hasAi === currentAi && tier.hasFamily === currentFamily;
          return (
            <View key={tier.key} style={[styles.card, isCurrent && styles.cardActive]}>
              {tier.badge && !isCurrent && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tier.badge}</Text>
                </View>
              )}
              {isCurrent && (
                <View style={[styles.badge, styles.badgeCurrent]}>
                  <Text style={styles.badgeText}>MEVCUT PLANINIZ</Text>
                </View>
              )}

              <Text style={styles.tierLabel}>{tier.label}</Text>
              <Text style={styles.tierTagline}>{tier.tagline}</Text>

              <Text style={styles.price}>Fiyat: Çok yakında</Text>

              {tier.includesLabel && <Text style={styles.includesLabel}>{tier.includesLabel}</Text>}
              <View style={styles.featureList}>
                {tier.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {isCurrent ? (
                <View style={styles.currentBtn}>
                  <Text style={styles.currentBtnText}>Mevcut Plan</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.upgradeBtn} onPress={() => handleUpgrade(tier)} activeOpacity={0.85}>
                  <Text style={styles.upgradeBtnText}>Yükseltme</Text>
                  <MaterialIcons name="arrow-forward" size={16} color={Colors.textInverse} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  content: { padding: 16, gap: 16, paddingBottom: 40 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 20,
    ...Shadows.sm,
  },
  cardActive: {
    borderColor: Colors.primary,
    ...Shadows.md,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeCurrent: { backgroundColor: Colors.primary },
  badgeText: { fontSize: 11, fontWeight: "700", color: Colors.primaryDark },

  tierLabel: { fontSize: 22, fontWeight: "800", color: Colors.text },
  tierTagline: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  price: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary, marginTop: 14 },

  includesLabel: { fontSize: 13, fontWeight: "700", color: Colors.text, marginTop: 18, marginBottom: 8 },
  featureList: { gap: 8, marginTop: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13.5, color: Colors.textSecondary, flex: 1 },

  currentBtn: {
    marginTop: 20,
    borderRadius: Radius.full,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
  },
  currentBtnText: { fontSize: 14, fontWeight: "700", color: Colors.textMuted },
  upgradeBtn: {
    marginTop: 20,
    flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    borderRadius: Radius.full,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
  },
  upgradeBtnText: { fontSize: 14, fontWeight: "700", color: Colors.textInverse },
});
