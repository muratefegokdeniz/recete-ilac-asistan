import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Colors, Radius } from "../../constants/Colors";
import { Card, Button, EmptyState, FrequencyPicker, MealTimingPicker } from "../../components/ui";
import {
  getAllActiveMedicines,
  addActiveMedicine,
  deleteActiveMedicine,
  markDoseTaken,
  skipDose,
  getTodayDoses,
  getAllMedicines,
} from "../../services/database";
import { ActiveMedicine, TakenDose, Medicine } from "../../types";
import { FREQUENCY_OPTIONS } from "../../constants/MedicineOptions";
import { requestPermissions, scheduleDailyReminder, cancelReminders } from "../../services/notifications";
import { getSkipAdvice } from "../../services/anthropic";

type AddMode = "manual" | "cabinet";

interface DueReminder { medicineId: string; medicineName: string; time: string; }

const SKIP_REASONS = [
  "Unutmuştum",
  "Yan etki yaşadım",
  "İlaç yanımda değildi",
  "Hastayım / Midem kötü",
  "Doktor değişiklik önerdi",
  "Diğer",
];

export default function ActiveScreen() {
  const [medicines, setMedicines] = useState<ActiveMedicine[]>([]);
  const [todayDoseMap, setTodayDoseMap] = useState<Record<string, TakenDose[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("manual");
  const [cabinetMedicines, setCabinetMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const medicinesRef = useRef<ActiveMedicine[]>([]);
  const doseMapRef = useRef<Record<string, TakenDose[]>>({});
  const dismissedRef = useRef<Set<string>>(new Set()); // "medicineId_time" formatında

  const [skipModal, setSkipModal] = useState<{ medicineId: string; medicineName: string; scheduledTime: string } | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipCustom, setSkipCustom] = useState("");
  const [skipAdvice, setSkipAdvice] = useState<string | null>(null);
  const [skipLoading, setSkipLoading] = useState(false);
  const [form, setForm] = useState({
    medicineName: "",
    dosage: "",
    frequency: FREQUENCY_OPTIONS[0],
    mealTiming: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    reminderTime: "08:00",
    notes: "",
    fromCabinetId: "",
  });

  useFocusEffect(
    useCallback(() => {
      loadData().then(() => {
        checkDueReminders(medicinesRef.current, doseMapRef.current);
      });
      requestPermissions();
      const interval = setInterval(() => {
        checkDueReminders(medicinesRef.current, doseMapRef.current);
      }, 30_000);
      return () => clearInterval(interval);
    }, [])
  );

  async function loadData() {
    try {
      const list = await getAllActiveMedicines();
      setMedicines(list);
      medicinesRef.current = list;
      const doseMap: Record<string, TakenDose[]> = {};
      for (const med of list) {
        doseMap[med.id] = await getTodayDoses(med.id);
      }
      setTodayDoseMap(doseMap);
      doseMapRef.current = doseMap;
    } catch (e) {
      console.error(e);
    }
  }

  function checkDueReminders(
    medList: ActiveMedicine[],
    doseMap: Record<string, TakenDose[]>
  ) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split("T")[0];
    const due: DueReminder[] = [];

    for (const med of medList) {
      for (const time of med.reminderTimes) {
        const [h, m] = time.split(":").map(Number);
        const reminderMinutes = (h ?? 0) * 60 + (m ?? 0);
        const diff = Math.abs(currentMinutes - reminderMinutes);
        if (diff > 30) continue;

        // Kullanıcı bu oturumda zaten aksiyona aldıysa gösterme
        if (dismissedRef.current.has(`${med.id}_${time}`)) continue;

        const doses = doseMap[med.id] ?? [];
        const alreadyActed = doses.some(
          (d) => d.scheduledTime.startsWith(today) && d.scheduledTime.includes(time)
        );
        if (!alreadyActed) {
          due.push({ medicineId: med.id, medicineName: med.medicineName, time });
        }
      }
    }
    setDueReminders(due);
  }

  async function openModal() {
    const cabinet = await getAllMedicines();
    setCabinetMedicines(cabinet);
    setShowModal(true);
    setAddMode("manual");
    resetForm();
  }

  function selectFromCabinet(med: Medicine) {
    setForm((f) => ({
      ...f,
      medicineName: med.name,
      dosage: med.dosage ?? "",
      frequency: med.frequency ?? f.frequency,
      mealTiming: med.mealTiming ?? f.mealTiming,
      fromCabinetId: med.id,
    }));
    setAddMode("manual");
  }

  async function handleAdd() {
    if (!form.medicineName.trim()) {
      Alert.alert("Eksik Bilgi", "İlaç adı gereklidir.");
      return;
    }
    setLoading(true);
    try {
      const reminderTimes = calcReminderTimes(form.reminderTime, form.frequency);

      // Her saat için bildirim zamanla
      const notifIds: string[] = [];
      for (const t of reminderTimes) {
        try {
          const id = await scheduleDailyReminder(form.medicineName, t);
          if (id) notifIds.push(id);
        } catch {}
      }

      const med: ActiveMedicine = {
        id: Date.now().toString(),
        medicineId: form.fromCabinetId,
        medicineName: form.medicineName,
        dosage: form.dosage || "Belirtilmedi",
        frequency: form.frequency,
        mealTiming: form.mealTiming || undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        reminderTimes,
        notificationIds: notifIds.length > 0 ? notifIds : undefined,
        notes: form.notes || undefined,
        takenDoses: [],
      };
      await addActiveMedicine(med);
      await loadData();
      setShowModal(false);
      resetForm();
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "İlaç eklenemedi.");
      console.error("handleAdd hatası:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("İlacı Kaldır", "Aktif ilaçlardan kaldırmak istiyor musun?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: async () => {
          const med = medicines.find((m) => m.id === id);
          if (med?.notificationIds) await cancelReminders(med.notificationIds);
          await deleteActiveMedicine(id);
          await loadData();
        },
      },
    ]);
  }

  async function handleTakeDose(activeMedicineId: string, scheduledTime: string) {
    // Banner'ı anında kaldır ve dismiss'e ekle
    const time = scheduledTime.split("T")[1]?.slice(0, 5) ?? "";
    dismissedRef.current.add(`${activeMedicineId}_${time}`);
    setDueReminders((prev) => prev.filter(
      (r) => !(r.medicineId === activeMedicineId && scheduledTime.includes(r.time))
    ));
    try {
      const dose: TakenDose = {
        id: `${activeMedicineId}_${scheduledTime}`,
        scheduledTime,
        takenAt: new Date().toISOString(),
      };
      await markDoseTaken(dose, activeMedicineId);
      await loadData();
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "Kaydedilemedi.");
    }
  }

  function handleSkipDose(activeMedicineId: string, scheduledTime: string) {
    const med = medicinesRef.current.find((m) => m.id === activeMedicineId);
    // Dismiss banner immediately so it doesn't reappear if modal is closed
    const time = scheduledTime.split("T")[1]?.slice(0, 5) ?? scheduledTime;
    dismissedRef.current.add(`${activeMedicineId}_${time}`);
    setDueReminders((prev) => prev.filter(
      (r) => !(r.medicineId === activeMedicineId && r.time === time)
    ));
    setSkipReason("");
    setSkipCustom("");
    setSkipAdvice(null);
    setSkipModal({
      medicineId: activeMedicineId,
      medicineName: med?.medicineName ?? "İlaç",
      scheduledTime,
    });
  }

  async function confirmSkip() {
    if (!skipModal) return;
    const reason = skipReason === "Diğer" ? skipCustom : skipReason;
    if (!reason.trim()) { Alert.alert("Lütfen bir neden seç."); return; }

    // Banner'ı anında kaldır ve dismiss'e ekle
    const time = skipModal.scheduledTime.split("T")[1]?.slice(0, 5) ?? "";
    dismissedRef.current.add(`${skipModal.medicineId}_${time}`);
    setDueReminders((prev) => prev.filter(
      (r) => !(r.medicineId === skipModal.medicineId && skipModal.scheduledTime.includes(r.time))
    ));

    // Doza kaydet (banner zaten dismiss edildi, loadData checkDueReminders çağırmaz)
    try {
      const dose: TakenDose = { id: `${skipModal.medicineId}_${skipModal.scheduledTime}`, scheduledTime: skipModal.scheduledTime };
      await skipDose(dose, skipModal.medicineId);
      loadData();
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "Kaydedilemedi.");
    }

    // AI önerisi al
    setSkipLoading(true);
    setSkipAdvice(null);
    try {
      const advice = await getSkipAdvice(skipModal.medicineName, reason);
      setSkipAdvice(advice);
    } catch {
      setSkipAdvice("Şu an öneri alınamadı.");
    } finally {
      setSkipLoading(false);
    }
  }

  function resetForm() {
    setForm({
      medicineName: "",
      dosage: "",
      frequency: FREQUENCY_OPTIONS[0],
      mealTiming: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      reminderTime: "08:00",
      notes: "",
      fromCabinetId: "",
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Aktif İlaçlar</Text>
          <Text style={styles.headerSubtitle}>Bugün, {formatDate(new Date())}</Text>
        </View>
        <Button
          title="Ekle"
          onPress={openModal}
          variant="primary"
          size="sm"
          icon={<Ionicons name="add" size={16} color="white" />}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {dueReminders.map((r) => (
          <View key={`${r.medicineId}_${r.time}`} style={styles.dueBanner}>
            <View style={styles.dueBannerLeft}>
              <Ionicons name="alarm" size={20} color={Colors.textInverse} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dueBannerTitle}>İlacını aldın mı?</Text>
                <Text style={styles.dueBannerName}>{r.medicineName} · {r.time}</Text>
              </View>
            </View>
            <View style={styles.dueBannerActions}>
              <Button
                title="Aldım"
                onPress={() => handleTakeDose(r.medicineId, `${today}T${r.time}`)}
                variant="secondary"
                size="sm"
                icon={<Ionicons name="checkmark" size={14} color={Colors.secondary} />}
              />
              <Button
                title="Atla"
                onPress={() => handleSkipDose(r.medicineId, `${today}T${r.time}`)}
                variant="ghost"
                size="sm"
                textStyle={{ color: Colors.textInverse }}
              />
            </View>
          </View>
        ))}
        {medicines.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="alarm-outline" size={36} color={Colors.textMuted} />}
            title="Aktif İlaç Yok"
            description="Düzenli kullandığın ilaçları ekleyerek doz takibi yapabilirsin."
            action={{ label: "İlaç Ekle", onPress: openModal }}
          />
        ) : (
          medicines.map((med) => {
            const todayDoses = todayDoseMap[med.id] ?? [];
            return (
              <ActiveMedicineCard
                key={med.id}
                medicine={med}
                todayDoses={todayDoses}
                onTake={(time) => handleTakeDose(med.id, `${today}T${time}`)}
                onSkip={(time) => handleSkipDose(med.id, `${today}T${time}`)}
                onDelete={() => handleDelete(med.id)}
              />
            );
          })
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Aktif İlaç Ekle</Text>
            <TouchableOpacity
              onPress={() => { setShowModal(false); resetForm(); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Mode switcher */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeTab, addMode === "manual" && styles.modeTabActive]}
              onPress={() => setAddMode("manual")}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={addMode === "manual" ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.modeTabText, addMode === "manual" && styles.modeTabTextActive]}>
                Manuel Gir
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, addMode === "cabinet" && styles.modeTabActive]}
              onPress={() => setAddMode("cabinet")}
            >
              <Ionicons
                name="medical-outline"
                size={16}
                color={addMode === "cabinet" ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.modeTabText, addMode === "cabinet" && styles.modeTabTextActive]}>
                İlaç Dolabımdan Seç
              </Text>
              {cabinetMedicines.length > 0 && (
                <View style={styles.modeBadge}>
                  <Text style={styles.modeBadgeText}>{cabinetMedicines.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            {addMode === "cabinet" ? (
              <CabinetPicker
                medicines={cabinetMedicines}
                onSelect={selectFromCabinet}
              />
            ) : (
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Selected from cabinet banner */}
                {form.fromCabinetId ? (
                  <View style={styles.fromCabinetBanner}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.secondary} />
                    <Text style={styles.fromCabinetText}>
                      Dolabından seçildi: <Text style={styles.fromCabinetName}>{form.medicineName}</Text>
                    </Text>
                    <TouchableOpacity
                      onPress={() => setForm((f) => ({ ...f, fromCabinetId: "", medicineName: "", dosage: "" }))}
                    >
                      <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <FormField
                  label="İlaç Adı *"
                  value={form.medicineName}
                  onChange={(v) => setForm((f) => ({ ...f, medicineName: v, fromCabinetId: "" }))}
                  placeholder="Örn: Parol 500mg"
                />
                <FormField
                  label="Doz"
                  value={form.dosage}
                  onChange={(v) => setForm((f) => ({ ...f, dosage: v }))}
                  placeholder="Örn: 1 tablet"
                />

                <FrequencyPicker
                  value={form.frequency}
                  onChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
                />
                <MealTimingPicker
                  value={form.mealTiming}
                  onChange={(v) => setForm((f) => ({ ...f, mealTiming: v }))}
                />

                <FormField
                  label="İlk Hatırlatma Saati"
                  value={form.reminderTime}
                  onChange={(v) => setForm((f) => ({ ...f, reminderTime: v }))}
                  placeholder="08:00"
                />
                {(() => {
                  const times = calcReminderTimes(form.reminderTime, form.frequency);
                  if (times.length <= 1) return null;
                  return (
                    <View style={styles.timesPreview}>
                      <Ionicons name="alarm-outline" size={14} color={Colors.primary} />
                      <Text style={styles.timesPreviewText}>
                        Otomatik saatler: {times.join(" · ")}
                      </Text>
                    </View>
                  );
                })()}
                <FormField
                  label="Başlangıç Tarihi"
                  value={form.startDate}
                  onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                  placeholder="YYYY-MM-DD"
                />
                <FormField
                  label="Bitiş Tarihi (opsiyonel)"
                  value={form.endDate}
                  onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                  placeholder="YYYY-MM-DD"
                />
                <FormField
                  label="Notlar"
                  value={form.notes}
                  onChange={(v) => setForm((f) => ({ ...f, notes: v }))}
                  placeholder="Aç karnına al gibi notlar..."
                  multiline
                />

                <Button
                  title="Aktif İlaçlara Ekle"
                  onPress={handleAdd}
                  variant="primary"
                  fullWidth
                  loading={loading}
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Skip Reason Modal */}
      <Modal visible={!!skipModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Neden Atladın?</Text>
              {skipModal && <Text style={styles.skipMedName}>{skipModal.medicineName}</Text>}
            </View>
            <TouchableOpacity onPress={() => setSkipModal(null)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {!skipAdvice ? (
              <>
                <View style={styles.reasonGrid}>
                  {SKIP_REASONS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.reasonChip, skipReason === r && styles.reasonChipActive]}
                      onPress={() => setSkipReason(r)}
                    >
                      <Text style={[styles.reasonChipText, skipReason === r && styles.reasonChipTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {skipReason === "Diğer" && (
                  <TextInput
                    style={styles.formInput}
                    value={skipCustom}
                    onChangeText={setSkipCustom}
                    placeholder="Nedeninizi yazın..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                )}

                <Button
                  title={skipLoading ? "AI Öneri Hazırlanıyor..." : "Devam Et"}
                  onPress={confirmSkip}
                  variant="primary"
                  fullWidth
                  loading={skipLoading}
                  disabled={!skipReason}
                  size="lg"
                  style={{ marginTop: 8 }}
                />
              </>
            ) : (
              <View style={styles.adviceContainer}>
                <View style={styles.adviceHeader}>
                  <View style={styles.adviceIconWrap}>
                    <Ionicons name="sparkles" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.adviceTitle}>AI Önerisi</Text>
                </View>
                <Text style={styles.adviceText}>{skipAdvice}</Text>
                <Button
                  title="Tamam"
                  onPress={() => setSkipModal(null)}
                  variant="primary"
                  fullWidth
                  size="lg"
                  style={{ marginTop: 16 }}
                />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function CabinetPicker({
  medicines,
  onSelect,
}: {
  medicines: Medicine[];
  onSelect: (med: Medicine) => void;
}) {
  if (medicines.length === 0) {
    return (
      <View style={styles.cabinetEmpty}>
        <View style={styles.cabinetEmptyIcon}>
          <Ionicons name="medical-outline" size={36} color={Colors.textMuted} />
        </View>
        <Text style={styles.cabinetEmptyTitle}>Dolabın Boş</Text>
        <Text style={styles.cabinetEmptyDesc}>
          Önce İlaç Dolabım sekmesine gidip ilaçlarını ekle.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.cabinetList} showsVerticalScrollIndicator={false}>
      <Text style={styles.cabinetHint}>Seçmek istediğin ilaca dokun</Text>
      {medicines.map((med) => (
        <TouchableOpacity
          key={med.id}
          style={styles.cabinetItem}
          onPress={() => onSelect(med)}
          activeOpacity={0.7}
        >
          {med.imageUri ? (
            <Image source={{ uri: med.imageUri }} style={styles.cabinetThumb} />
          ) : (
            <View style={[styles.cabinetThumb, styles.cabinetThumbPlaceholder]}>
              <Ionicons name="medical" size={20} color={Colors.primary} />
            </View>
          )}
          <View style={styles.cabinetItemInfo}>
            <Text style={styles.cabinetItemName}>{med.name}</Text>
            {med.dosage && (
              <Text style={styles.cabinetItemDosage}>{med.dosage}</Text>
            )}
            {med.purpose && (
              <Text style={styles.cabinetItemPurpose} numberOfLines={1}>
                {med.purpose}
              </Text>
            )}
          </View>
          <View style={styles.cabinetSelectBtn}>
            <Ionicons name="add-circle" size={28} color={Colors.primary} />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ActiveMedicineCard({
  medicine, todayDoses, onTake, onSkip, onDelete,
}: {
  medicine: ActiveMedicine;
  todayDoses: TakenDose[];
  onTake: (time: string) => void;
  onSkip: (time: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={styles.medCard}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded((e) => !e)}
        style={styles.medHeader}
      >
        <View style={styles.medIconWrap}>
          <Ionicons name="medical" size={20} color={Colors.primary} />
        </View>
        <View style={styles.medInfo}>
          <Text style={styles.medName}>{medicine.medicineName}</Text>
          <Text style={styles.medDosage}>
            {medicine.dosage} · {medicine.frequency}
            {medicine.mealTiming ? ` · ${mealTimingShort(medicine.mealTiming)}` : ""}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.divider} />

          {medicine.reminderTimes.map((time) => {
            const dose = todayDoses.find((d) => d.scheduledTime.includes(time));
            const taken = dose && dose.takenAt;
            const skipped = dose && dose.skipped;

            return (
              <View key={time} style={styles.doseRow}>
                <View style={styles.doseTimeWrap}>
                  <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.doseTime}>{time}</Text>
                </View>

                {taken ? (
                  <View style={styles.doseTakenBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.secondary} />
                    <Text style={styles.doseTakenText}>Alındı</Text>
                  </View>
                ) : skipped ? (
                  <View style={styles.doseSkippedBadge}>
                    <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
                    <Text style={styles.doseSkippedText}>Atlandı</Text>
                  </View>
                ) : (
                  <View style={styles.doseActions}>
                    <Button title="Aldım" onPress={() => onTake(time)} variant="secondary" size="sm" />
                    <Button title="Atla" onPress={() => onSkip(time)} variant="ghost" size="sm" />
                  </View>
                )}
              </View>
            );
          })}

          {medicine.notes && (
            <View style={styles.noteBox}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.primary} />
              <Text style={styles.noteText}>{medicine.notes}</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Başlangıç: {medicine.startDate}
              {medicine.endDate ? ` · Bitiş: ${medicine.endDate}` : ""}
            </Text>
          </View>

          <Button
            title="Aktif Listeden Kaldır"
            onPress={onDelete}
            variant="outline"
            size="sm"
            fullWidth
            style={{ marginTop: 8, borderColor: Colors.danger }}
            textStyle={{ color: Colors.danger }}
          />
        </View>
      )}
    </Card>
  );
}

function FormField({
  label, value, onChange, placeholder, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

function calcReminderTimes(firstTime: string, frequency: string): string[] {
  const intervalMap: Record<string, number> = {
    "Günde 1 kez": 0,
    "Günde 2 kez": 12,
    "Günde 3 kez": 8,
    "Her 8 saatte bir": 8,
    "Her 12 saatte bir": 12,
    "Gerektiğinde": 0,
  };
  const interval = intervalMap[frequency] ?? 0;
  const countMap: Record<string, number> = {
    "Günde 1 kez": 1, "Günde 2 kez": 2, "Günde 3 kez": 3,
    "Her 8 saatte bir": 3, "Her 12 saatte bir": 2, "Gerektiğinde": 1,
  };
  const count = countMap[frequency] ?? 1;
  if (count === 1 || interval === 0) return [firstTime];

  const [h, m] = firstTime.split(":").map(Number);
  const times: string[] = [];
  for (let i = 0; i < count; i++) {
    const totalMin = (h ?? 8) * 60 + (m ?? 0) + i * interval * 60;
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    times.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return times;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}

function mealTimingShort(value: string): string {
  const map: Record<string, string> = { ac: "🌙 Aç", tok: "🍽️ Tok", farketmez: "✓ Farketmez" };
  return map[value] ?? value;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },

  dueBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14,
    gap: 12, borderRadius: Radius.lg,
  },
  dueBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dueBannerTitle: { fontSize: 13, fontWeight: "700", color: Colors.textInverse },
  dueBannerName: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  dueBannerActions: { flexDirection: "row", gap: 8, alignItems: "center" },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  modalContent: { padding: 20, gap: 12, paddingBottom: 32 },

  // Mode switcher
  modeSwitcher: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  modeTabActive: {
    backgroundColor: Colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modeTabText: { fontSize: 13, fontWeight: "500", color: Colors.textMuted },
  modeTabTextActive: { color: Colors.primary, fontWeight: "700" },
  modeBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  modeBadgeText: { fontSize: 10, color: Colors.textInverse, fontWeight: "700" },

  // From cabinet banner
  fromCabinetBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.secondaryLight,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.secondary + "30",
  },
  fromCabinetText: { flex: 1, fontSize: 13, color: Colors.primaryDark },
  fromCabinetName: { fontWeight: "700" },

  // Cabinet picker
  cabinetList: { padding: 16, gap: 10, paddingBottom: 32 },
  cabinetHint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  cabinetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cabinetThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  cabinetThumbPlaceholder: {
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  cabinetItemInfo: { flex: 1 },
  cabinetItemName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  cabinetItemDosage: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cabinetItemPurpose: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  cabinetSelectBtn: { padding: 4 },
  cabinetEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  cabinetEmptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  cabinetEmptyTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  cabinetEmptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Active medicine card
  medCard: { padding: 14 },
  medHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  medIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  medInfo: { flex: 1 },
  medName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  medDosage: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  expandedContent: { marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },

  doseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  doseTimeWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  doseTime: { fontSize: 14, fontWeight: "600", color: Colors.text },
  doseActions: { flexDirection: "row", gap: 6 },
  doseTakenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  doseTakenText: { fontSize: 12, color: Colors.secondary, fontWeight: "600" },
  doseSkippedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  doseSkippedText: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },

  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    padding: 10,
    borderRadius: Radius.sm,
    marginTop: 8,
  },
  noteText: { fontSize: 13, color: Colors.primaryDark, flex: 1 },

  metaRow: { marginTop: 8 },
  metaText: { fontSize: 12, color: Colors.textMuted },

  skipMedName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  reasonChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  reasonChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reasonChipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" },
  reasonChipTextActive: { color: Colors.primary, fontWeight: "700" },

  adviceContainer: { gap: 12 },
  adviceHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  adviceIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  adviceTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  adviceText: {
    fontSize: 15, color: Colors.text, lineHeight: 24,
    backgroundColor: Colors.surfaceAlt, padding: 16, borderRadius: Radius.lg,
  },

  timesPreview: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primaryLight, padding: 10, borderRadius: Radius.md,
  },
  timesPreviewText: { fontSize: 13, color: Colors.primary, fontWeight: "500" },

  // Form
  formField: { gap: 6 },
  formLabel: { fontSize: 13, fontWeight: "600", color: Colors.text },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  formInputMulti: { height: 80, textAlignVertical: "top", paddingTop: 10 },

});
