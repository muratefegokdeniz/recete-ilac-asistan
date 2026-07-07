import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Colors, Radius, Shadows } from "../../constants/Colors";
import { Button, EmptyState, DatePickerField } from "../../components/ui";
import {
  getAllActiveMedicines, getChildVaccines, createVaccineCardForChild,
  setVaccineCompleted, setVaccineNotificationId, getFamilyMembers,
} from "../../services/database";
import { scheduleVaccineReminder } from "../../services/notifications";
import { ChildVaccine, FamilyMember } from "../../types";
import { fallbackMemberColor } from "../../constants/MemberColors";

export default function VaccinesScreen() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [hiddenChildren, setHiddenChildren] = useState<string[]>([]);
  const [childNamesFromMeds, setChildNamesFromMeds] = useState<string[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [vaccines, setVaccines] = useState<ChildVaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBirthDateModal, setShowBirthDateModal] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const familyMemberNames = familyMembers.map((m) => m.name);
  const allChildren = Array.from(new Set([...familyMemberNames, ...childNamesFromMeds]))
    .filter((n) => !hiddenChildren.includes(n));

  function colorFor(name: string): string {
    return familyMembers.find((m) => m.name === name)?.color ?? fallbackMemberColor(name, allChildren);
  }

  useFocusEffect(useCallback(() => {
    loadChildren();
  }, []));

  async function loadChildren() {
    setLoading(true);
    try {
      const [members, hidden, meds] = await Promise.all([
        getFamilyMembers(),
        AsyncStorage.getItem("hiddenChildren"),
        getAllActiveMedicines(),
      ]);
      const hiddenList: string[] = hidden ? JSON.parse(hidden) : [];
      const fromMeds = meds.filter((m) => m.memberName).map((m) => m.memberName!);
      setFamilyMembers(members);
      setHiddenChildren(hiddenList);
      setChildNamesFromMeds(fromMeds);

      const memberNames = members.map((m) => m.name);
      const children = Array.from(new Set([...memberNames, ...fromMeds])).filter((n) => !hiddenList.includes(n));
      const next = selectedChild && children.includes(selectedChild) ? selectedChild : (children[0] ?? null);
      setSelectedChild(next);
      if (next) await loadVaccines(next);
      else setVaccines([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadVaccines(childName: string) {
    const list = await getChildVaccines(childName);
    setVaccines(list);
  }

  async function selectChild(name: string) {
    setSelectedChild(name);
    setLoading(true);
    try {
      await loadVaccines(name);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCard() {
    if (!selectedChild || !birthDate) {
      setCreateError("Doğum tarihi gereklidir.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createVaccineCardForChild(selectedChild, birthDate);
      await loadVaccines(selectedChild);
      setShowBirthDateModal(false);
      setBirthDate("");
    } catch (e: any) {
      setCreateError(e?.message ?? "Aşı kartı oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(vaccine: ChildVaccine) {
    if (!selectedChild) return;
    setTogglingId(vaccine.id);
    try {
      const nowCompleted = !vaccine.completedAt;
      await setVaccineCompleted(vaccine.id, nowCompleted);

      if (nowCompleted && vaccine.notificationId) {
        // Aşı tamamlandı, bekleyen bildirime gerek yok — kayıttan temizle.
        await setVaccineNotificationId(vaccine.id, null);
      } else if (!nowCompleted) {
        const notifId = await scheduleVaccineReminder(selectedChild, vaccine.vaccineName, vaccine.dueDate);
        if (notifId) await setVaccineNotificationId(vaccine.id, notifId);
      }
      await loadVaccines(selectedChild);
    } finally {
      setTogglingId(null);
    }
  }

  const today = new Date().toISOString().split("T")[0]!;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aşı Kartı</Text>
      </View>

      {allChildren.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="body-outline" size={40} color={Colors.textMuted} />}
          title="Henüz Çocuk Eklenmemiş"
          description={`Aşı kartı oluşturmak için önce "Takip" ekranından bir aile üyesi ekle.`}
        />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {allChildren.map((name) => {
              const color = colorFor(name);
              const active = selectedChild === name;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.memberTab, active && { backgroundColor: color, borderColor: color }]}
                  onPress={() => selectChild(name)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.memberDot, { backgroundColor: active ? Colors.textInverse : color }]} />
                  <Text style={[styles.memberTabText, active && styles.memberTabTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.centerFill}><ActivityIndicator color={Colors.primary} /></View>
          ) : vaccines.length === 0 ? (
            <EmptyState
              icon={<MaterialIcons name="vaccines" size={40} color={Colors.textMuted} />}
              title={`${selectedChild} için Aşı Kartı Yok`}
              description="Standart aşı takvimini oluşturmak için doğum tarihini gir."
              action={{ label: "Aşı Kartı Oluştur", onPress: () => setShowBirthDateModal(true) }}
            />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {vaccines.map((v) => {
                const overdue = !v.completedAt && v.dueDate < today;
                return (
                  <View key={v.id} style={styles.vaccineCard}>
                    <TouchableOpacity
                      style={[styles.checkbox, v.completedAt && styles.checkboxDone]}
                      onPress={() => handleToggle(v)}
                      disabled={togglingId === v.id}
                      activeOpacity={0.75}
                    >
                      {togglingId === v.id ? (
                        <ActivityIndicator size="small" color={v.completedAt ? "white" : Colors.primary} />
                      ) : v.completedAt ? (
                        <Ionicons name="checkmark" size={18} color="white" />
                      ) : null}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vaccineName}>{v.vaccineName}</Text>
                      <Text style={styles.vaccineAge}>{v.recommendedAge}</Text>
                      <Text style={[styles.vaccineDue, overdue && styles.vaccineDueOverdue]}>
                        {v.completedAt ? "Tamamlandı" : overdue ? `Vadesi geçti · ${v.dueDate}` : `Vade: ${v.dueDate}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      <Modal visible={showBirthDateModal} transparent animationType="fade" onRequestClose={() => setShowBirthDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedChild} için Doğum Tarihi</Text>
            <DatePickerField label="Doğum Tarihi" value={birthDate} onChange={setBirthDate} placeholder="Doğum tarihini seç" />
            {createError && <Text style={styles.errorText}>{createError}</Text>}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBirthDateModal(false)} disabled={creating}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <Button title="Oluştur" onPress={handleCreateCard} loading={creating} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text },

  memberRow: { flexGrow: 0, marginBottom: 8 },
  memberTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  memberDot: { width: 8, height: 8, borderRadius: 4 },
  memberTabText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  memberTabTextActive: { color: Colors.textInverse },

  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },

  vaccineCard: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vaccineName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  vaccineAge: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  vaccineDue: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  vaccineDueOverdue: { color: "#DC2626", fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 20, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  errorText: { fontSize: 13, color: "#DC2626" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalCancelBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: Colors.textSecondary },
});
