import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius } from "../constants/Colors";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit() {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!email.trim() || !password.trim()) {
      setErrorMsg("E-posta ve şifre gereklidir.");
      return;
    }
    setLoading(true);
    const error = mode === "login"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setLoading(false);

    if (error) {
      setErrorMsg(translateError(error));
    } else if (mode === "register") {
      setSuccessMsg("Hesap oluşturuldu! E-postanı doğrula, ardından giriş yapabilirsin.");
      setMode("login");
    }
  }

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

          {successMsg && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.successText}>{successMsg}</Text>
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

          <TouchableOpacity onPress={() => { setMode(mode === "login" ? "register" : "login"); setErrorMsg(null); setSuccessMsg(null); }} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              {mode === "login"
                ? "Hesabın yok mu? Kayıt ol"
                : "Zaten hesabın var mı? Giriş yap"}
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
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  appName: { fontSize: 26, fontWeight: "800", color: Colors.text },
  appSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 24,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: { fontSize: 20, fontWeight: "700", color: Colors.text, marginBottom: 20 },

  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.background,
  },
  passWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.background, paddingLeft: 14,
  },
  passToggle: { padding: 11 },

  btn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: "center", marginTop: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "white", fontSize: 16, fontWeight: "700" },

  switchBtn: { alignItems: "center", marginTop: 16 },
  switchText: { fontSize: 14, color: Colors.primary, fontWeight: "500" },

  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: Radius.md, padding: 12,
    borderWidth: 1, borderColor: "#FECACA", marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: "#DC2626", lineHeight: 18 },

  successBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#F0FDF4", borderRadius: Radius.md, padding: 12,
    borderWidth: 1, borderColor: "#BBF7D0", marginBottom: 12,
  },
  successText: { flex: 1, fontSize: 13, color: "#059669", lineHeight: 18 },
});
