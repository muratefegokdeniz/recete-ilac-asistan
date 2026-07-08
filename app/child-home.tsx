import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Colors, Radius, Shadows } from "../constants/Colors";
import { ConfirmModal, EmptyState } from "../components/ui";
import {
  getChildSession, clearChildSession, fetchChildState, markChildDose, markChildVaccine, ChildSession,
} from "../services/childAuth";
import { requestPermissions, scheduleDailyReminder } from "../services/notifications";
import { ActiveMedicine, ChildVaccine } from "../types";

const SCHEDULED_KEY = "childScheduledNotifs";

export default function ChildHomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<ChildSession | null>(null);
  const [medicines, setMedicines] = useState<ActiveMedicine[]>([]);
  const [vaccines, setVaccines] = useState<ChildVaccine[]>([]);
  const [takenDoses, setTakenDoses] = useState<{ active_medicine_id: string; scheduled_time: string; taken_at: string | null; skipped: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function load() {
    setLoading(true);
    try {
      const s = await getChildSession();
      if (!s) {
        router.replace("/login");
        return;
      }
      setSession(s);
      const state = await fetchChildState(s);
      setMedicines(state.medicines);
      setVaccines(state.vaccines);
      setTakenDoses(state.takenDoses);
      await ensureNotificationsScheduled(state.medicines);
    } catch (e) {
      console.error("[child-home] yüklenemedi:", e);
    } finally {
      setLoading(false);
    }
  }

  async function ensureNotificationsScheduled(meds: ActiveMedicine[]) {
    const ok = await requestPermissions();
    if (!ok) return;
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    const scheduled: string[] = raw ? JSON.parse(raw) : [];
    const scheduledSet = new Set(scheduled);
    let changed = false;
    for (const med of meds) {
      for (const time of med.reminderTimes) {
        const key = `${med.id}_${time}`;
        if (scheduledSet.has(key)) continue;
        await scheduleDailyReminder(med.medicineName, time);
        scheduledSet.add(key);
        changed = true;
      }
    }
    if (changed) await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(Array.from(scheduledSet)));
  }

  function todayDoseFor(medicineId: string, time: string) {
    const today = new Date().toISOString().split("T")[0];
    return takenDoses.find((d) => d.active_medicine_id === medicineId && d.scheduled_time.startsWith(`${today}T${time}`));
  }

  async function handleTake(med: ActiveMedicine, time: string) {
    if (!session) return;
    const key = `${med.id}_${time}_take`;
    setActionLoading(key);
    try {
      const scheduledTime = `${new Date().toISOString().split("T")[0]}T${time}`;
      await markChildDose(session, med.id, scheduledTime, { taken: true });
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSkip(med: ActiveMedicine, time: string) {
    if (!session) return;
    const key = `${med.id}_${time}_skip`;
    setActionLoading(key);
    try {
      const scheduledTime = `${new Date().toISOString().split("T")[0]}T${time}`;
      await markChildDose(session, med.id, scheduledTime, { skipped: true });
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleVaccine(vaccine: ChildVaccine) {
    if (!session) return;
    setActionLoading(`vac_${vaccine.id}`);
    try {
      await markChildVaccine(session, vaccine.id, !vaccine.completedAt);
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSignOut() {
    await clearChildSession();
    router.replace("/login");
  }

  if (loading && !session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerFill}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const today = new Date().toISOString().split("T")[0]!;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Merhaba, {session?.displayName}!</Text>
          <Text style={styles.headerSub}>İlaçların ve aşı kartın</Text>
        </View>
        <TouchableOpacity onPress={() => setShowSignOutConfirm(true)} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>İlaçların</Text>
        {medicines.length === 0 ? (
          <EmptyState
            icon={<MaterialIcons name="medication" size={36} color={Colors.textMuted} />}
            title="Henüz İlaç Yok"
            description="Ailen ilaç eklediğinde burada görünecek."
          />
        ) : (
          medicines.map((med) => (
            <View key={med.id} style={styles.card}>
              <Text style={styles.medName}>{med.medicineName}</Text>
              <Text style={styles.medSub}>{med.dosage}{med.mealTiming ? ` · ${med.mealTiming}` : ""}</Text>
              <View style={styles.timesRow}>
                {med.reminderTimes.map((time) => {
                  const dose = todayDoseFor(med.id, time);
                  const taken = !!dose?.taken_at;
                  const skipped = !!dose?.skipped && !taken;
                  return (
                    <View key={time} style={styles.timeChip}>
                      <Text style={styles.timeChipText}>{time}</Text>
                      {taken ? (
                        <Text style={styles.doneText}>✓ Alındı</Text>
                      ) : skipped ? (
                        <Text style={styles.skippedText}>Atlandı</Text>
                      ) : (
                        <View style={styles.doseActions}>
                          <TouchableOpacity
                            style={styles.takeBtn}
                            onPress={() => handleTake(med, time)}
                            disabled={actionLoading === `${med.id}_${time}_take`}
                          >
                            {actionLoading === `${med.id}_${time}_take`
                              ? <ActivityIndicator size="small" color="white" />
                              : <Text style={styles.takeBtnText}>Aldım</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={() => handleSkip(med, time)}
                            disabled={actionLoading === `${med.id}_${time}_skip`}
                          >
                            <Text style={styles.skipBtnText}>Atla</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Aşı Kartın</Text>
        {vaccines.length === 0 ? (
          <EmptyState
            icon={<MaterialIcons name="vaccines" size={36} color={Colors.textMuted} />}
            title="Aşı Kartı Yok"
            description="Ailen henüz aşı kartını oluşturmadı."
          />
        ) : (
          vaccines.map((v) => {
            const overdue = !v.completedAt && v.dueDate < today;
            return (
              <TouchableOpacity
                key={v.id}
                style={styles.vaccineCard}
                onPress={() => handleToggleVaccine(v)}
                disabled={actionLoading === `vac_${v.id}`}
                activeOpacity={0.75}
              >
                <View style={[styles.checkbox, v.completedAt && styles.checkboxDone]}>
                  {actionLoading === `vac_${v.id}` ? (
                    <ActivityIndicator size="small" color={v.completedAt ? "white" : Colors.primary} />
                  ) : v.completedAt ? (
                    <Ionicons name="checkmark" size={16} color="white" />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vaccineName}>{v.vaccineName}</Text>
                  <Text style={[styles.vaccineDue, overdue && styles.vaccineDueOverdue]}>
                    {v.completedAt ? "Tamamlandı" : overdue ? `Vadesi geçti · ${v.dueDate}` : `Vade: ${v.dueDate}`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <ConfirmModal
        visible={showSignOutConfirm}
        title="Çıkış Yap"
        message="Bu cihazdan çıkmak istiyor musun? Tekrar girmek için annenin/babanın yeniden onaylaması gerekir."
        confirmLabel="Çıkış Yap"
        onConfirm={() => { setShowSignOutConfirm(false); handleSignOut(); }}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: Colors.text },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  signOutBtn: { padding: 8 },

  content: { padding: 20, gap: 12, paddingBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm, gap: 8,
  },
  medName: { fontSize: 16, fontWeight: "700", color: Colors.text },
  medSub: { fontSize: 13, color: Colors.textSecondary },
  timesRow: { gap: 8, marginTop: 4 },
  timeChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
  },
  timeChipText: { fontSize: 14, fontWeight: "700", color: Colors.text },
  doneText: { fontSize: 13, color: "#16a34a", fontWeight: "600" },
  skippedText: { fontSize: 13, color: Colors.textMuted },
  doseActions: { flexDirection: "row", gap: 8 },
  takeBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.md },
  takeBtnText: { fontSize: 13, fontWeight: "700", color: "white" },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  skipBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },

  vaccineCard: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vaccineName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  vaccineDue: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  vaccineDueOverdue: { color: Colors.danger, fontWeight: "700" },
});
