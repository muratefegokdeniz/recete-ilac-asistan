import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors, Radius, Shadows } from "../constants/Colors";
import { TUTORIAL_STEPS, useTutorial } from "../context/TutorialContext";

export function TutorialOverlay() {
  const router = useRouter();
  const { active, stepIndex, currentStep, highlightRect, next, stop } = useTutorial();
  // Turda art arda birden fazla adım aynı route'ta kalabiliyor (ör. bir
  // ekranın kendi içinde gösterdiği hostRendered mock adımlar). Route zaten
  // aynıysa tekrar router.replace çağırmak o ekranı yeniden mount edip
  // (ör. açık bir Modal'ın local state'ini sıfırlayıp) turu ortasında
  // kapatıyordu — bu yüzden sadece route gerçekten değiştiğinde naviagate ediyoruz.
  const lastRouteRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) lastRouteRef.current = null;
  }, [active]);

  useEffect(() => {
    if (!active || !currentStep) return;
    if (lastRouteRef.current === currentStep.route) return;
    // Bir önceki navigasyonun (ör. onboarding'den home'a replace) oturması için
    // kısa bir gecikme — hemen ardından push/replace çağırmak bazı cihazlarda
    // sekme değişmeden yutuluyordu.
    const t = setTimeout(() => {
      lastRouteRef.current = currentStep.route;
      router.replace(currentStep.route as any);
    }, 80);
    return () => clearTimeout(t);
  }, [active, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active || !currentStep) return null;
  // Bu adımın anlatımını ilgili ekran kendi içinde gösteriyor (ör. reçete
  // analizi örneği modalın içinde) — burada ayrıca kart/karartma gösterme.
  if (currentStep.hostRendered) return null;

  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;
  // Bu adımlarda ilerleme, kartın "İleri" butonuyla değil, işaretlenen
  // butona (targetId) dokunulmasıyla gerçekleşir — o dokunuş ilgili ekranda
  // hem asıl aksiyonu (ör. tarayıcıyı açma) hem de tutorial.next()'i tetikler.
  // Kartın kendi "İleri" butonu burada gösterilirse aksiyon hiç yaşanmadan
  // adım ilerler ve bir sonraki (hostRendered) adım hiçbir şey göstermez —
  // tur birden bitmiş gibi görünür.
  const requiresTargetTap = !!currentStep.targetId && !isLast;

  // RN'in <Modal>'ı transparan/box-none olsa da native tarafta altındaki
  // ekrana dokunuşların geçmesini engelliyor (ayrı bir native pencere) —
  // bu yüzden vurgulanan "+" gibi gerçek butonlara asla dokunulamıyordu.
  // Modal yerine, zaten _layout.tsx'te Stack'in üstünde kardeş olarak
  // render edilen mutlak konumlu bir View kullanıyoruz; böylece scrim
  // dışındaki dokunuşlar alttaki gerçek ekrana native olarak geçebiliyor.
  return (
    <View style={styles.root} pointerEvents="box-none">
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
          {requiresTargetTap && (
            <Text style={styles.hint}>Devam etmek için yukarıda işaretli butona dokun.</Text>
          )}

          <View style={styles.progressRow}>
            {TUTORIAL_STEPS.map((_, i) => (
              <View key={i} style={[styles.progressDot, i === stepIndex && styles.progressDotActive]} />
            ))}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={stop} style={styles.skipBtn}>
              <Text style={styles.skipText}>Turu Atla</Text>
            </TouchableOpacity>
            {!requiresTargetTap && (
              <TouchableOpacity onPress={next} style={styles.nextBtn} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>{isLast ? "Bitir" : "İleri"}</Text>
                {!isLast && <MaterialIcons name="arrow-forward" size={16} color={Colors.textInverse} />}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
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
  hint: { fontSize: 12.5, color: Colors.primary, fontWeight: "600", marginTop: 8 },
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
