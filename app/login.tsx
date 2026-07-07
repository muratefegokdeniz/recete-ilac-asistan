import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors, Radius } from "../constants/Colors";
import { useAuth } from "../context/AuthContext";
import { getProfile, saveProfile, UserProfile } from "../services/database";

const GENDER_OPTIONS = ["Erkek", "Kadın", "Belirtmek istemiyorum"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-", "Bilmiyorum"];

const ONBOARDING_STEPS = [
  { title: "Merhaba! Adınız nedir?", subtitle: "Sizi tanımak için adınızı öğrenmek istiyoruz.", icon: "person-circle-outline" as const },
  { title: "Yaşınız ve cinsiyetiniz?", subtitle: "Daha iyi öneriler için bu bilgilere ihtiyacımız var.", icon: "calendar-outline" as const },
  { title: "Fiziksel bilgileriniz", subtitle: "İlaç dozajı hesaplamalarında yardımcı olabilir.", icon: "body-outline" as const },
  { title: "Sağlık geçmişiniz", subtitle: "Alerjiler ve kronik hastalıklar için uyarı alabilirsiniz.", icon: "medkit-outline" as const },
];

type ScreenMode = "login" | "register" | "onboarding";

export default function LoginScreen() {
  const { signIn, signUp, session } = useAuth();
  const router = useRouter();

  // Auth state
  const [mode, setMode] = useState<ScreenMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Onboarding state
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<UserProfile>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setErrorMsg(null);
    if (!email.trim() || !password.trim()) {
      setErrorMsg("E-posta ve şifre gereklidir.");
      return;
    }
    setLoading(true);

    if (mode === "login") {
      const error = await signIn(email.trim(), password);
      setLoading(false);
      if (error) {
        setErrorMsg(translateError(error));
      } else {
        router.replace("/(tabs)/home");
      }
    } else {
      const error = await signUp(email.trim(), password);
      setLoading(false);
      if (error) {
        setErrorMsg(translateError(error));
      } else {
        setStep(0);
        setDraft({});
        setSaveError(null);
        setMode("onboarding");
      }
    }
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  function canProceed() {
    if (step === 0) return !!draft.fullName?.trim();
    return true;
  }

  async function handleOnboardingNext() {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      await finishOnboarding();
    }
  }

  async function handleOnboardingSkip() {
    if (step === ONBOARDING_STEPS.length - 1) {
      await finishOnboarding();
    } else {
      setStep((s) => s + 1);
    }
  }

  async function finishOnboarding() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile(draft);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setSaveError(e?.message ?? "Kaydedilemedi. Lütfen tekrar deneyin.");
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (mode === "onboarding") {
    const currentStep = ONBOARDING_STEPS[step]!;
    const isLast = step === ONBOARDING_STEPS.length - 1;

    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"] as any}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {ONBOARDING_STEPS.map((_, i) => (
            <View key={i} style={[
              styles.progressSeg,
              i < step && styles.progressDone,
              i === step && styles.progressCurrent,
            ]} />
          ))}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.obContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.obIconWrap}>
              <Ionicons name={currentStep.icon} size={52} color={Colors.primary} />
            </View>
            <Text style={styles.obStepNum}>Adım {step + 1} / {ONBOARDING_STEPS.length}</Text>
            <Text style={styles.obTitle}>{currentStep.title}</Text>
            <Text style={styles.obSubtitle}>{currentStep.subtitle}</Text>

            {/* Step 0: Ad Soyad */}
            {step === 0 && (
              <View style={styles.obFields}>
                <Text style={styles.obLabel}>Ad Soyad</Text>
                <TextInput
                  style={styles.obInput}
                  value={draft.fullName ?? ""}
                  onChangeText={(v) => setDraft((d) => ({ ...d, fullName: v }))}
                  placeholder="Örn: Murat Efe Gökdeniz"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus autoCapitalize="words"
                />
              </View>
            )}

            {/* Step 1: Yaş + Cinsiyet */}
            {step === 1 && (
              <View style={styles.obFields}>
                <Text style={styles.obLabel}>Yaşınız</Text>
                <TextInput
                  style={[styles.obInput, { maxWidth: 160 }]}
                  value={draft.age?.toString() ?? ""}
                  onChangeText={(v) => setDraft((d) => ({ ...d, age: parseInt(v) || undefined }))}
                  placeholder="Örn: 25"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric" maxLength={3}
                />
                <Text style={[styles.obLabel, { marginTop: 20 }]}>Cinsiyet</Text>
                <View style={styles.chipRow}>
                  {GENDER_OPTIONS.map((g) => (
                    <TouchableOpacity key={g} style={[styles.chip, draft.gender === g && styles.chipActive]} onPress={() => setDraft((d) => ({ ...d, gender: g }))}>
                      <Text style={[styles.chipText, draft.gender === g && styles.chipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 2: Boy + Kilo + Kan Grubu */}
            {step === 2 && (
              <View style={styles.obFields}>
                <View style={styles.rowFields}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.obLabel}>Boy (cm)</Text>
                    <TextInput style={styles.obInput} value={draft.height?.toString() ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, height: parseInt(v) || undefined }))} placeholder="170" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={3} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.obLabel}>Kilo (kg)</Text>
                    <TextInput style={styles.obInput} value={draft.weight?.toString() ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, weight: parseInt(v) || undefined }))} placeholder="70" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={3} />
                  </View>
                </View>
                <Text style={[styles.obLabel, { marginTop: 20 }]}>Kan Grubu</Text>
                <View style={styles.chipRow}>
                  {BLOOD_TYPES.map((b) => (
                    <TouchableOpacity key={b} style={[styles.chip, draft.bloodType === b && styles.chipActive]} onPress={() => setDraft((d) => ({ ...d, bloodType: b }))}>
                      <Text style={[styles.chipText, draft.bloodType === b && styles.chipTextActive]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 3: Alerjiler + Kronik */}
            {step === 3 && (
              <View style={styles.obFields}>
                <Text style={styles.obLabel}>Alerjileriniz</Text>
                <TextInput style={[styles.obInput, styles.obInputMulti]} value={draft.allergies ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, allergies: v }))} placeholder="Örn: Penisilin, aspirin..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
                <Text style={[styles.obLabel, { marginTop: 20 }]}>Kronik Hastalıklar</Text>
                <TextInput style={[styles.obInput, styles.obInputMulti]} value={draft.chronicConditions ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, chronicConditions: v }))} placeholder="Örn: Diyabet, hipertansiyon..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
              </View>
            )}

            {saveError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{saveError}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.obFooter}>
          {step >= 2 && (
            <TouchableOpacity onPress={handleOnboardingSkip} style={styles.skipBtn} disabled={saving}>
              <Text style={styles.skipText}>Atla</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleOnboardingNext}
            disabled={!canProceed() || saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="white" size="small" /> : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.nextBtnText}>{isLast ? "Tamamla" : "Devam Et"}</Text>
                {!isLast && <Ionicons name="arrow-forward" size={18} color="white" />}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Login / Register form ─────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.inner}>
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Ionicons name="medkit" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>İlaç Asistanı</Text>
          <Text style={styles.appSub}>Reçete & ilaç takip uygulaması</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Şifre</Text>
            <View style={styles.passWrap}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.passToggle}>
                <Ionicons name={showPass ? "eye-off" : "eye"} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.btnText}>
                {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode(mode === "login" ? "register" : "login"); setErrorMsg(null); }} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "E-posta veya şifre hatalı.";
  if (msg.includes("Email not confirmed")) return "E-postanı doğrulamadan giriş yapamazsın.";
  if (msg.includes("User already registered")) return "Bu e-posta zaten kayıtlı.";
  if (msg.includes("Password should be")) return "Şifre en az 6 karakter olmalı.";
  return msg;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, justifyContent: "center", padding: 24 },

  logoArea: { alignItems: "center", marginBottom: 32 },
  logoCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  appName: { fontSize: 26, fontWeight: "800", color: Colors.text },
  appSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: Colors.text, marginBottom: 20 },

  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: Colors.text, backgroundColor: Colors.background },
  passWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.background, paddingLeft: 14 },
  passToggle: { padding: 11 },

  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "white", fontSize: 16, fontWeight: "700" },

  switchBtn: { alignItems: "center", marginTop: 16 },
  switchText: { fontSize: 14, color: Colors.primary, fontWeight: "500" },

  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FEF2F2", borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: "#FECACA", marginBottom: 12 },
  errorText: { flex: 1, fontSize: 13, color: "#DC2626", lineHeight: 18 },

  // Onboarding
  progressRow: { flexDirection: "row", paddingHorizontal: 24, paddingTop: 16, gap: 6 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight ?? Colors.border },
  progressDone: { backgroundColor: Colors.primary + "60" },
  progressCurrent: { backgroundColor: Colors.primary },

  obContent: { padding: 24, paddingTop: 28, paddingBottom: 16 },
  obIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center" },
  obStepNum: { fontSize: 12, fontWeight: "700", color: Colors.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  obTitle: { fontSize: 22, fontWeight: "800", color: Colors.text, marginBottom: 8, lineHeight: 28 },
  obSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 28 },

  obFields: { gap: 0 },
  obLabel: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 8 },
  obInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: Colors.text, backgroundColor: Colors.surface },
  obInputMulti: { minHeight: 80, paddingTop: 12, textAlignVertical: "top" },

  rowFields: { flexDirection: "row", gap: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" },
  chipTextActive: { color: Colors.primary, fontWeight: "700" },

  obFooter: { flexDirection: "row", paddingHorizontal: 24, paddingBottom: 8, gap: 12, alignItems: "center" },
  skipBtn: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  skipText: { fontSize: 15, color: Colors.textSecondary, fontWeight: "600" },
  nextBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 15, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 16, fontWeight: "700", color: "white" },
});
