import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Colors, Radius } from "../../constants/Colors";
import { Button, ConfirmModal } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { getProfile, saveProfile, UserProfile } from "../../services/database";

const GENDER_OPTIONS = ["Erkek", "Kadın", "Belirtmek istemiyorum"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-", "Bilmiyorum"];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({});
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState<UserProfile>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getProfile().then((p) => { if (p) setProfile(p); }).catch(() => {});
    }, [])
  );

  function openEdit() {
    setDraft({ ...profile });
    setSaveError(null);
    setShowEdit(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile(draft);
      setProfile(draft);
      setShowEdit(false);
    } catch (e: any) {
      console.error("saveProfile hatası:", e);
      setSaveError(e?.message ?? "Kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    setShowSignOutConfirm(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profilim</Text>
        <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.editBtnText}>Yeni Bilgiler Kaydet</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.fullName ? profile.fullName.charAt(0).toUpperCase() : "?"}
            </Text>
          </View>
          <Text style={styles.name}>{profile.fullName || "İsim girilmedi"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Kişisel Bilgiler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          <InfoRow icon="person-outline" label="Ad Soyad" value={profile.fullName} />
          <InfoRow icon="calendar-outline" label="Yaş" value={profile.age ? `${profile.age} yaş` : undefined} />
          <InfoRow icon="male-female-outline" label="Cinsiyet" value={profile.gender} />
        </View>

        {/* Fiziksel Bilgiler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fiziksel Bilgiler</Text>
          <View style={styles.rowInfo}>
            <View style={{ flex: 1 }}>
              <InfoRow icon="resize-outline" label="Boy" value={profile.height ? `${profile.height} cm` : undefined} />
            </View>
            <View style={styles.rowDivider} />
            <View style={{ flex: 1 }}>
              <InfoRow icon="barbell-outline" label="Kilo" value={profile.weight ? `${profile.weight} kg` : undefined} />
            </View>
          </View>
          <InfoRow icon="water-outline" label="Kan Grubu" value={profile.bloodType} />
        </View>

        {/* Sağlık Bilgileri */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sağlık Bilgileri</Text>
          <InfoRow icon="medkit-outline" label="Kronik Hastalıklar" value={profile.chronicConditions} multiline />
          <InfoRow icon="warning-outline" label="Alerjiler" value={profile.allergies} multiline />
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Bilgilerimi Güncelle</Text>
            <View style={{ width: 24 }} />
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>

                <Field label="Ad Soyad" icon="person-outline">
                  <TextInput style={styles.input} value={draft.fullName ?? ""} onChangeText={(v) => setDraft(f => ({ ...f, fullName: v }))} placeholder="Adınızı girin" placeholderTextColor={Colors.textMuted} />
                </Field>

                <Field label="Yaş" icon="calendar-outline">
                  <TextInput style={styles.input} value={draft.age?.toString() ?? ""} onChangeText={(v) => setDraft(f => ({ ...f, age: parseInt(v) || undefined }))} placeholder="Yaşınız" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={3} />
                </Field>

                <Field label="Cinsiyet" icon="male-female-outline">
                  <View style={styles.chipRow}>
                    {GENDER_OPTIONS.map((g) => (
                      <TouchableOpacity key={g} style={[styles.chip, draft.gender === g && styles.chipActive]} onPress={() => setDraft(f => ({ ...f, gender: g }))}>
                        <Text style={[styles.chipText, draft.gender === g && styles.chipTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Fiziksel Bilgiler</Text>

                <View style={styles.rowFields}>
                  <View style={{ flex: 1 }}>
                    <Field label="Boy (cm)" icon="resize-outline">
                      <TextInput style={styles.input} value={draft.height?.toString() ?? ""} onChangeText={(v) => setDraft(f => ({ ...f, height: parseInt(v) || undefined }))} placeholder="170" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={3} />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Kilo (kg)" icon="barbell-outline">
                      <TextInput style={styles.input} value={draft.weight?.toString() ?? ""} onChangeText={(v) => setDraft(f => ({ ...f, weight: parseInt(v) || undefined }))} placeholder="70" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={3} />
                    </Field>
                  </View>
                </View>

                <Field label="Kan Grubu" icon="water-outline">
                  <View style={styles.chipRow}>
                    {BLOOD_TYPES.map((b) => (
                      <TouchableOpacity key={b} style={[styles.chip, draft.bloodType === b && styles.chipActive]} onPress={() => setDraft(f => ({ ...f, bloodType: b }))}>
                        <Text style={[styles.chipText, draft.bloodType === b && styles.chipTextActive]}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Field>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sağlık Bilgileri</Text>

                <Field label="Kronik Hastalıklar" icon="medkit-outline">
                  <TextInput style={[styles.input, styles.inputMulti]} value={draft.chronicConditions ?? ""} onChangeText={(v) => setDraft(f => ({ ...f, chronicConditions: v }))} placeholder="Diyabet, hipertansiyon..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
                </Field>

                <Field label="Alerjiler" icon="warning-outline">
                  <TextInput style={[styles.input, styles.inputMulti]} value={draft.allergies ?? ""} onChangeText={(v) => setDraft(f => ({ ...f, allergies: v }))} placeholder="Penisilin, aspirin..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
                </Field>
              </View>

              {saveError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{saveError}</Text>
                </View>
              )}
              <Button title="Kaydet" onPress={handleSave} variant="primary" fullWidth loading={saving} size="lg" />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <ConfirmModal
        visible={showSignOutConfirm}
        title="Çıkış Yap"
        message="Hesabından çıkmak istiyor musun?"
        confirmLabel="Çıkış Yap"
        onConfirm={() => { setShowSignOutConfirm(false); signOut(); }}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, multiline }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | number;
  multiline?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelRow}>
        <Ionicons name={icon} size={14} color={Colors.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, !value && styles.infoEmpty]} numberOfLines={multiline ? 0 : 1}>
        {value || "Girilmedi"}
      </Text>
    </View>
  );
}

function Field({ label, icon, children }: { label: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabel}>
        <Ionicons name={icon} size={14} color={Colors.textMuted} />
        <Text style={styles.fieldLabelText}>{label}</Text>
      </View>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.full, backgroundColor: Colors.primaryLight,
  },
  editBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  content: { padding: 20, gap: 16, paddingBottom: 40 },

  avatarSection: { alignItems: "center", paddingVertical: 12, gap: 6 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 36, fontWeight: "800", color: Colors.primary },
  name: { fontSize: 20, fontWeight: "700", color: Colors.text },
  email: { fontSize: 13, color: Colors.textSecondary },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: 16, gap: 0,
    shadowColor: Colors.text, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },

  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  infoLabel: { fontSize: 11, fontWeight: "600", color: Colors.textMuted },
  infoValue: { fontSize: 15, color: Colors.text, fontWeight: "500" },
  infoEmpty: { color: Colors.textMuted, fontStyle: "italic" },

  rowInfo: { flexDirection: "row", alignItems: "flex-start" },
  rowDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 8, alignSelf: "stretch" },

  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.danger + "40",
    backgroundColor: Colors.dangerLight,
  },
  signOutText: { fontSize: 15, color: Colors.danger, fontWeight: "600" },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  modalContent: { padding: 20, gap: 16, paddingBottom: 40 },

  field: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldLabel: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  fieldLabelText: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },

  rowFields: { flexDirection: "row", gap: 12 },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.background,
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top", paddingTop: 8 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  chipTextActive: { color: Colors.primary, fontWeight: "700" },

  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.md,
    padding: 12, borderWidth: 1, borderColor: Colors.danger + "30",
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.danger, lineHeight: 18 },
});
