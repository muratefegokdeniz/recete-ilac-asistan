import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius } from "../constants/Colors";
import { MEMBER_COLORS } from "../constants/MemberColors";
import { Button } from "./ui";
import { FamilyMember } from "../types";

const GENDER_OPTIONS = ["Erkek", "Kız", "Belirtmek istemiyorum"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-", "Bilmiyorum"];

type Draft = Omit<FamilyMember, "id">;

const EMPTY_DRAFT: Draft = { name: "", color: MEMBER_COLORS[0]! };

export function ChildProfileModal({
  visible,
  mode,
  initial,
  onSave,
  onDelete,
  onCancel,
}: {
  visible: boolean;
  mode: "create" | "edit";
  initial?: FamilyMember;
  onSave: (member: Draft) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(initial ? { ...initial } : { ...EMPTY_DRAFT, color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)]! });
      setError(null);
    }
  }, [visible, initial]);

  async function handleSave() {
    if (!draft.name.trim()) {
      setError("İsim gereklidir.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
    } catch (e: any) {
      setError(e?.message ?? "Kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{mode === "create" ? "Çocuk Ekle" : "Çocuk Profili"}</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Field label="İsim" icon="person-outline">
              <TextInput
                style={styles.input}
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                placeholder="Örn: Ahmet"
                placeholderTextColor={Colors.textMuted}
                autoFocus={mode === "create"}
                maxLength={20}
              />
            </Field>

            <Field label="Renk" icon="color-palette-outline">
              <View style={styles.colorRow}>
                {MEMBER_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatch, { backgroundColor: c }, draft.color === c && styles.colorSwatchActive]}
                    onPress={() => setDraft((d) => ({ ...d, color: c }))}
                    activeOpacity={0.8}
                  >
                    {draft.color === c && <Ionicons name="checkmark" size={16} color="white" />}
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <Field label="Yaş" icon="calendar-outline">
              <TextInput
                style={[styles.input, { maxWidth: 160 }]}
                value={draft.age?.toString() ?? ""}
                onChangeText={(v) => setDraft((d) => ({ ...d, age: parseInt(v) || undefined }))}
                placeholder="Örn: 7"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                maxLength={3}
              />
            </Field>

            <Field label="Cinsiyet" icon="male-female-outline">
              <View style={styles.chipRow}>
                {GENDER_OPTIONS.map((g) => (
                  <TouchableOpacity key={g} style={[styles.chip, draft.gender === g && styles.chipActive]} onPress={() => setDraft((d) => ({ ...d, gender: g }))}>
                    <Text style={[styles.chipText, draft.gender === g && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <View style={styles.rowFields}>
              <View style={{ flex: 1 }}>
                <Field label="Boy (cm)" icon="resize-outline">
                  <TextInput style={styles.input} value={draft.height?.toString() ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, height: parseInt(v) || undefined }))} placeholder="120" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={3} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Kilo (kg)" icon="barbell-outline">
                  <TextInput style={styles.input} value={draft.weight?.toString() ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, weight: parseInt(v) || undefined }))} placeholder="25" placeholderTextColor={Colors.textMuted} keyboardType="numeric" maxLength={3} />
                </Field>
              </View>
            </View>

            <Field label="Kan Grubu" icon="water-outline">
              <View style={styles.chipRow}>
                {BLOOD_TYPES.map((b) => (
                  <TouchableOpacity key={b} style={[styles.chip, draft.bloodType === b && styles.chipActive]} onPress={() => setDraft((d) => ({ ...d, bloodType: b }))}>
                    <Text style={[styles.chipText, draft.bloodType === b && styles.chipTextActive]}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>

            <Field label="Kronik Hastalıklar" icon="medkit-outline">
              <TextInput style={[styles.input, styles.inputMulti]} value={draft.chronicConditions ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, chronicConditions: v }))} placeholder="Varsa yaz..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
            </Field>

            <Field label="Alerjiler" icon="warning-outline">
              <TextInput style={[styles.input, styles.inputMulti]} value={draft.allergies ?? ""} onChangeText={(v) => setDraft((d) => ({ ...d, allergies: v }))} placeholder="Varsa yaz..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
            </Field>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button title={mode === "create" ? "Ekle" : "Kaydet"} onPress={handleSave} variant="primary" fullWidth loading={saving} size="lg" />

            {mode === "edit" && onDelete && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting} activeOpacity={0.8}>
                {deleting ? <ActivityIndicator size="small" color={Colors.danger} /> : (
                  <>
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    <Text style={styles.deleteBtnText}>Profili Sil</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  content: { padding: 20, gap: 4, paddingBottom: 40 },

  field: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldLabel: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  fieldLabelText: { fontSize: 12, fontWeight: "600", color: Colors.textMuted },

  rowFields: { flexDirection: "row", gap: 12 },

  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top", paddingTop: 8 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  chipTextActive: { color: Colors.primary, fontWeight: "700" },

  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  colorSwatchActive: { borderColor: Colors.text },

  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.md,
    padding: 12, borderWidth: 1, borderColor: Colors.danger + "30", marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.danger, lineHeight: 18 },

  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: Radius.md, marginTop: 12,
    borderWidth: 1.5, borderColor: Colors.danger + "40", backgroundColor: Colors.dangerLight,
  },
  deleteBtnText: { fontSize: 15, color: Colors.danger, fontWeight: "600" },
});
