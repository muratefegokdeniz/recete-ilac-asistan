import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors, Radius, Shadows } from "../constants/Colors";
import { TUTORIAL_STEPS, useTutorial } from "../context/TutorialContext";

export function TutorialOverlay() {
  const router = useRouter();
  const { active, stepIndex, currentStep, highlightRect, next, stop } = useTutorial();

  useEffect(() => {
    if (!active || !currentStep) return;
    // Bir önceki navigasyonun (ör. onboarding'den home'a replace) oturması için
    // kısa bir gecikme — hemen ardından push/replace çağırmak bazı cihazlarda
    // sekme değişmeden yutuluyordu.
    const t = setTimeout(() => {
      router.replace(currentStep.route as any);
    }, 80);
    return () => clearTimeout(t);
  }, [active, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !currentStep) return null;
  // Bu adımın anlatımını ilgili ekran kendi içinde gösteriyor (ör. reçete
  // analizi örneği modalın içinde) — burada ayrıca kart/karartma gösterme.
  if (currentStep.hostRendered) return null;

  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={stop}>
      <View style={styles.scrim} pointerEvents="box-none">
        {highlightRect && (
          <View
            pointerEvents="none"
            style={[
              styles.highlightRing,
              {
                left: highlightRect.x - 8,
                top: highlightRect.y - 8,
                width: highlightRect.width + 16,
                height: highlightRect.height + 16,
              },
            ]}
          />
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.stepNum}>Adım {stepIndex + 1} / {TUTORIAL_STEPS.length}</Text>
            <TouchableOpacity onPress={stop} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{currentStep.title}</Text>
          <Text style={styles.body}>{currentStep.body}</Text>

          <View style={styles.progressRow}>
            {TUTORIAL_STEPS.map((_, i) => (
              <View key={i} style={[styles.progressDot, i === stepIndex && styles.progressDotActive]} />
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={stop} style={styles.skipBtn}>
              <Text style={styles.skipText}>Turu Atla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={next} style={styles.nextBtn} activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>{isLast ? "Bitir" : "İleri"}</Text>
              {!isLast && <MaterialIcons name="arrow-forward" size={16} color={Colors.textInverse} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(13,31,30,0.4)",
  },
  highlightRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: Colors.primaryLight,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Platform.OS === "web" ? 24 : 100,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    ...Shadows.lg,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  stepNum: { fontSize: 11, fontWeight: "700", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 19, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  body: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  progressRow: { flexDirection: "row", gap: 6, marginTop: 16, marginBottom: 4 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight },
  progressDotActive: { backgroundColor: Colors.primary },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12 },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 8 },
  skipText: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },
  nextBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.full,
  },
  nextBtnText: { fontSize: 14, fontWeight: "700", color: Colors.textInverse },
});
