import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../constants/Colors";

// Yasal sayfalar hem uygulama içinden açılıyor hem de web'de doğrudan URL ile
// (mağaza gizlilik linki) — geri gidilecek bir sayfa yoksa buton gizlenir.
export function LegalBackButton() {
  const router = useRouter();
  if (!router.canGoBack()) return null;
  return (
    <TouchableOpacity onPress={() => router.back()} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="chevron-back" size={20} color={Colors.primary} />
      <Text style={styles.text}>Geri</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 12, marginLeft: -4 },
  text: { fontSize: 15, color: Colors.primary, fontWeight: "600" },
});
