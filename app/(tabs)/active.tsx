import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Image, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Colors, Radius, Shadows } from "../../constants/Colors";
import { Button, EmptyState, FrequencyPicker, MealTimingPicker, ConfirmModal, TimePickerField, DatePickerField } from "../../components/ui";
import {
  getAllActiveMedicines, addActiveMedicine, deleteActiveMedicine,
  markDoseTaken, skipDose, getTodayDoses, getAllMedicines,
} from "../../services/database";
import { ActiveMedicine, TakenDose, Medicine } from "../../types";
import { FREQUENCY_OPTIONS } from "../../constants/MedicineOptions";
import { requestPermissions, scheduleDailyReminder, cancelReminders } from "../../services/notifications";
import { getSkipAdvice } from "../../services/anthropic";

type AddMode = "manual" | "cabinet";
interface DueReminder { medicineId: string; medicineName: string; time: string; }

const SKIP_REASONS = [
  "Unutmuştum", "Yan etki yaşadım", "İlaç yanımda değildi",
  "Hastayım / Midem kötü", "Doktor değişiklik önerdi", "Diğer",
];

export default function ActiveScreen() {
  const { width } = useWindowDimensions();
  const isWide = width > 720;

  const [medicines, setMedicines] = useState<ActiveMedicine[]>([]);
  const [todayDoseMap, setTodayDoseMap] = useState<Record<string, TakenDose[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("manual");
  const [cabinetMedicines, setCabinetMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [dueReminders, setDueReminders] = useState<DueReminder[]>([]);
  const medicinesRef = useRef<ActiveMedicine[]>([]);
  const doseMapRef = useRef<Record<string, TakenDose[]>>({});
  const dismissedRef = useRef<Set<string>>(new Set());

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [skipModal, setSkipModal] = useState<{ medicineId: string; medicineName: string; scheduledTime: string } | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipCustom, setSkipCustom] = useState("");
  const [skipReasonError, setSkipReasonError] = useState<string | null>(null);
  const [skipAdvice, setSkipAdvice] = useState<string | null>(null);
  const [skipLoading, setSkipLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("Ben");
  const [customChildren, setCustomChildren] = useState<string[]>([]);
  const [newChildName, setNewChildName] = useState("");
  const [showAddChild, setShowAddChild] = useState(false);
  const [form, setForm] = useState({
    medicineName: "", dosage: "", frequency: FREQUENCY_OPTIONS[0],
    mealTiming: "", startDate: new Date().toISOString().split("T")[0],
    endDate: "", reminderTimes: ["08:00"], notes: "", fromCabinetId: "",
    memberName: "",
  });
  const [addError, setAddError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    loadData().then(() => checkDueReminders(medicinesRef.current, doseMapRef.current));
    requestPermissions();
    const interval = setInterval(() => checkDueReminders(medicinesRef.current, doseMapRef.current), 30_000);
    return () => clearInterval(interval);
  }, []));

  async function loadData() {
    try {
      const list = await getAllActiveMedicines();
      setMedicines(list);
      medicinesRef.current = list;
      const doseMap: Record<string, TakenDose[]> = {};
      for (const med of list) doseMap[med.id] = await getTodayDoses(med.id);
      setTodayDoseMap(doseMap);
      doseMapRef.current = doseMap;
    } catch (e) { console.error(e); }
  }

  function checkDueReminders(medList: ActiveMedicine[], doseMap: Record<string, TakenDose[]>) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split("T")[0];
    const due: DueReminder[] = [];
    for (const med of medList) {
      for (const time of med.reminderTimes) {
        const [h, m] = time.split(":").map(Number);
        const diff = Math.abs(currentMinutes - ((h ?? 0) * 60 + (m ?? 0)));
        if (diff > 30) continue;
        if (dismissedRef.current.has(`${med.id}_${time}`)) continue;
        const doses = doseMap[med.id] ?? [];
        if (!doses.some((d) => d.scheduledTime.startsWith(today) && d.scheduledTime.includes(time))) {
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
    const freq = med.frequency ?? FREQUENCY_OPTIONS[0]!;
    setForm((f) => ({
      ...f,
      medicineName: med.name,
      dosage: med.dosage ?? "",
      frequency: freq,
      mealTiming: med.mealTiming ?? f.mealTiming,
      fromCabinetId: med.id,
      reminderTimes: calcReminderTimes(f.reminderTimes[0] ?? "08:00", freq),
    }));
    setAddMode("manual");
  }

  async function handleAdd() {
    setAddError(null);
    if (!form.medicineName.trim()) { setAddError("İlaç adı gereklidir."); return; }
    const validTimes = form.reminderTimes.map((t) => t.trim()).filter((t) => /^\d{2}:\d{2}$/.test(t));
    if (validTimes.length === 0) { setAddError("En az bir geçerli saat girin (SS:DD)."); return; }
    setLoading(true);
    try {
      const notifIds: string[] = [];
      for (const t of validTimes) {
        try { const id = await scheduleDailyReminder(form.medicineName, t); if (id) notifIds.push(id); } catch {}
      }
      const med: ActiveMedicine = {
        id: Date.now().toString(), medicineId: form.fromCabinetId, medicineName: form.medicineName,
        dosage: form.dosage || "Belirtilmedi", frequency: form.frequency,
        mealTiming: form.mealTiming || undefined, startDate: form.startDate,
        endDate: form.endDate || undefined, reminderTimes: validTimes,
        notificationIds: notifIds.length > 0 ? notifIds : undefined,
        notes: form.notes || undefined, takenDoses: [],
        memberName: form.memberName || undefined,
      };
      await addActiveMedicine(med);
      await loadData();
      setShowModal(false);
      resetForm();
    } catch (e: any) {
      setAddError(e?.message ?? "İlaç eklenemedi. Lütfen tekrar deneyin.");
    } finally { setLoading(false); }
  }

  function handleDelete(id: string) {
    setDeleteConfirmId(id);
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const med = medicines.find((m) => m.id === deleteConfirmId);
      if (med?.notificationIds) await cancelReminders(med.notificationIds);
      await deleteActiveMedicine(deleteConfirmId);
      setDeleteConfirmId(null);
      await loadData();
    } catch (e: any) {
      setDeleteError(e?.message ?? "İlaç silinemedi. Lütfen tekrar deneyin.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleTakeDose(activeMedicineId: string, scheduledTime: string) {
    const time = scheduledTime.split("T")[1]?.slice(0, 5) ?? "";
    dismissedRef.current.add(`${activeMedicineId}_${time}`);
    setDueReminders((prev) => prev.filter((r) => !(r.medicineId === activeMedicineId && scheduledTime.includes(r.time))));
    try {
      await markDoseTaken({ id: `${activeMedicineId}_${scheduledTime}`, scheduledTime, takenAt: new Date().toISOString() }, activeMedicineId);
      await loadData();
    } catch (e: any) { console.error("Doz kaydedilemedi:", e); }
  }

  function handleSkipDose(activeMedicineId: string, scheduledTime: string) {
    const med = medicinesRef.current.find((m) => m.id === activeMedicineId);
    const time = scheduledTime.split("T")[1]?.slice(0, 5) ?? scheduledTime;
    dismissedRef.current.add(`${activeMedicineId}_${time}`);
    setDueReminders((prev) => prev.filter((r) => !(r.medicineId === activeMedicineId && r.time === time)));
    setSkipReason(""); setSkipCustom(""); setSkipAdvice(null); setSkipReasonError(null);
    setSkipModal({ medicineId: activeMedicineId, medicineName: med?.medicineName ?? "İlaç", scheduledTime });
  }

  async function confirmSkip() {
    if (!skipModal) return;
    const reason = skipReason === "Diğer" ? skipCustom : skipReason;
    if (!reason.trim()) { setSkipReasonError("Lütfen bir neden seçin."); return; }
    setSkipReasonError(null);
    try {
      await skipDose({ id: `${skipModal.medicineId}_${skipModal.scheduledTime}`, scheduledTime: skipModal.scheduledTime }, skipModal.medicineId);
      loadData();
    } catch (e: any) { console.error("Doz atlanamadı:", e); }
    setSkipLoading(true); setSkipAdvice(null);
    try { setSkipAdvice(await getSkipAdvice(skipModal.medicineName, reason)); }
    catch { setSkipAdvice("Şu an öneri alınamadı."); }
    finally { setSkipLoading(false); }
  }

  function resetForm() {
    setForm({ medicineName: "", dosage: "", frequency: FREQUENCY_OPTIONS[0], mealTiming: "", startDate: new Date().toISOString().split("T")[0], endDate: "", reminderTimes: ["08:00"], notes: "", fromCabinetId: "", memberName: selectedMember === "Ben" ? "" : selectedMember });
    setAddError(null);
  }

  const today = new Date().toISOString().split("T")[0];

  // İlaçlardan gelen + manuel eklenen çocuk isimleri (tekrarsız)
  const childNamesFromMeds = medicines.filter((m) => m.memberName).map((m) => m.memberName!);
  const allChildren = Array.from(new Set([...customChildren, ...childNamesFromMeds]));
  const members = ["Ben", ...allChildren];

  // Seçili üyeye göre filtrele
  const filteredMedicines = medicines.filter((m) =>
    selectedMember === "Ben" ? !m.memberName : m.memberName === selectedMember
  );

  const totalDoses = filteredMedicines.reduce((s, m) => s + m.reminderTimes.length, 0);
  const takenToday = filteredMedicines
    .map((m) => todayDoseMap[m.id] ?? [])
    .flat()
    .filter((d) => d.takenAt).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>İlaç Takip</Text>
          <Text style={styles.headerSubtitle}>Bugün, {formatDate(new Date())}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openModal} activeOpacity={0.85}>
          <MaterialIcons name="add" size={18} color={Colors.textInverse} />
          <Text style={styles.addBtnText}>Ekle</Text>
        </TouchableOpacity>
      </View>

      {/* Üye sekme çubuğu */}
      <View style={styles.memberBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberBarScroll} contentContainerStyle={styles.memberBarContent}>
        {members.map((name) => (
          <TouchableOpacity
            key={name}
            style={[styles.memberTab, selectedMember === name && styles.memberTabActive]}
            onPress={() => setSelectedMember(name)}
            activeOpacity={0.75}
          >
            <Text style={[styles.memberTabText, selectedMember === name && styles.memberTabTextActive]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
        {/* Çocuk ekle butonu */}
        {showAddChild ? (
          <View style={styles.addChildRow}>
            <TextInput
              style={styles.addChildInput}
              value={newChildName}
              onChangeText={setNewChildName}
              placeholder="Çocuk adı..."
              placeholderTextColor={Colors.textMuted}
              autoFocus
              maxLength={20}
            />
            <TouchableOpacity
              style={styles.addChildConfirm}
              onPress={() => {
                const name = newChildName.trim();
                if (name) {
                  if (!members.includes(name)) {
                    setCustomChildren((prev) => [...prev, name]);
                  }
                  setSelectedMember(name);
                }
                setNewChildName("");
                setShowAddChild(false);
              }}
            >
              <MaterialIcons name="check" size={16} color={Colors.textInverse} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowAddChild(false); setNewChildName(""); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addChildBtn} onPress={() => setShowAddChild(true)} activeOpacity={0.75}>
            <MaterialIcons name="add" size={16} color={Colors.primary} />
            <Text style={styles.addChildBtnText}>Çocuk Ekle</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      </View>

      {/* Progress strip */}
      {filteredMedicines.length > 0 && (
        <View style={styles.progressStrip}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressLabel}>
              {selectedMember === "Ben" ? "Bugünkü ilerleme" : `${selectedMember} - Bugünkü ilerleme`}
            </Text>
            <Text style={styles.progressCount}>{takenToday}/{totalDoses} doz</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: totalDoses > 0 ? `${Math.round((takenToday / totalDoses) * 100)}%` : "0%" }]} />
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Due reminder banners */}
        {dueReminders.map((r) => (
          <View key={`${r.medicineId}_${r.time}`} style={styles.dueBanner}>
            <View style={styles.dueBannerLeft}>
              <View style={styles.dueBannerIconWrap}>
                <MaterialIcons name="alarm" size={20} color={Colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dueBannerTitle}>İlacını aldın mı?</Text>
                <Text style={styles.dueBannerName}>{r.medicineName} · {r.time}</Text>
              </View>
            </View>
            <View style={styles.dueBannerActions}>
              <TouchableOpacity style={styles.takeBtnInline} onPress={() => handleTakeDose(r.medicineId, `${today}T${r.time}`)}>
                <MaterialIcons name="check" size={14} color={Colors.primary} />
                <Text style={styles.takeBtnInlineText}>Aldım</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSkipDose(r.medicineId, `${today}T${r.time}`)}>
                <Text style={styles.skipBtnText}>Atla</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filteredMedicines.length === 0 ? (
          <EmptyState
            icon={<MaterialIcons name="alarm" size={36} color={Colors.textMuted} />}
            title={selectedMember === "Ben" ? "Aktif İlaç Yok" : `${selectedMember} için İlaç Yok`}
            description={selectedMember === "Ben" ? "Düzenli kullandığın ilaçları ekleyerek doz takibi yapabilirsin." : `${selectedMember} için ilaç eklemek için "Ekle" butonuna bas.`}
            action={{ label: "İlaç Ekle", onPress: openModal }}
          />
        ) : (
          <>
            {filteredMedicines.map((med) => (
              <ActiveMedicineCard
                key={med.id}
                medicine={med}
                todayDoses={todayDoseMap[med.id] ?? []}
                onTake={(time) => handleTakeDose(med.id, `${today}T${time}`)}
                onSkip={(time) => handleSkipDose(med.id, `${today}T${time}`)}
                onDelete={() => handleDelete(med.id)}
              />
            ))}

            {/* Insight card */}
            <View style={styles.insightCard}>
              <View style={styles.insightLeft}>
                <View style={styles.insightIconWrap}>
                  <MaterialIcons name="auto-awesome" size={24} color={Colors.textInverse} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insightTitle}>İlaç Etkileşim Kontrolü</Text>
                  <Text style={styles.insightBody}>
                    Sisteme eklediğin her ilaç, mevcut reçetelerinle etkileşim açısından AI tarafından analiz edilir.
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Aktif İlaç Ekle</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Mode switcher */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity style={[styles.modeTab, addMode === "manual" && styles.modeTabActive]} onPress={() => setAddMode("manual")}>
              <MaterialIcons name="edit" size={16} color={addMode === "manual" ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.modeTabText, addMode === "manual" && styles.modeTabTextActive]}>Manuel Gir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeTab, addMode === "cabinet" && styles.modeTabActive]} onPress={() => setAddMode("cabinet")}>
              <MaterialIcons name="medical-services" size={16} color={addMode === "cabinet" ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.modeTabText, addMode === "cabinet" && styles.modeTabTextActive]}>İlaç Dolabımdan Seç</Text>
              {cabinetMedicines.length > 0 && (
                <View style={styles.modeBadge}><Text style={styles.modeBadgeText}>{cabinetMedicines.length}</Text></View>
              )}
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            {addMode === "cabinet" ? (
              <CabinetPicker medicines={cabinetMedicines} onSelect={selectFromCabinet} />
            ) : (
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

                {/* Üye seçici */}
                <View style={styles.memberPickerSection}>
                  <Text style={styles.memberPickerLabel}>Bu kimin için?</Text>
                  <View style={styles.memberPickerRow}>
                    {members.map((name) => (
                      <TouchableOpacity
                        key={name}
                        style={[styles.memberPickerChip, form.memberName === (name === "Ben" ? "" : name) && styles.memberPickerChipActive]}
                        onPress={() => setForm((f) => ({ ...f, memberName: name === "Ben" ? "" : name }))}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.memberPickerChipText, form.memberName === (name === "Ben" ? "" : name) && styles.memberPickerChipTextActive]}>
                          {name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {form.fromCabinetId ? (
                  <View style={styles.fromCabinetBanner}>
                    <MaterialIcons name="check-circle" size={18} color={Colors.primary} />
                    <Text style={styles.fromCabinetText}>
                      Dolabından seçildi: <Text style={styles.fromCabinetName}>{form.medicineName}</Text>
                    </Text>
                    <TouchableOpacity onPress={() => setForm((f) => ({ ...f, fromCabinetId: "", medicineName: "", dosage: "" }))}>
                      <MaterialIcons name="cancel" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Bento: two-col on wide */}
                <View style={[styles.formBento, isWide && styles.formBentoWide]}>
                  {/* Left panel */}
                  <View style={[styles.bentoPanelLeft, isWide && styles.bentoPanelLeftWide]}>
                    <View style={styles.bentoSection}>
                      <View style={styles.bentoSectionHeader}>
                        <MaterialIcons name="edit-note" size={18} color={Colors.primary} />
                        <Text style={styles.bentoSectionTitle}>İlaç Bilgileri</Text>
                      </View>
                      <FormField label="İlaç Adı *" value={form.medicineName} onChange={(v) => setForm((f) => ({ ...f, medicineName: v, fromCabinetId: "" }))} placeholder="Örn: Parol 500mg" />
                      <FormField label="Doz" value={form.dosage} onChange={(v) => setForm((f) => ({ ...f, dosage: v }))} placeholder="Örn: 1 tablet" />
                      <FrequencyPicker value={form.frequency} onChange={(v) => setForm((f) => ({ ...f, frequency: v }))} />
                      <MealTimingPicker value={form.mealTiming} onChange={(v) => setForm((f) => ({ ...f, mealTiming: v }))} />
                    </View>
                  </View>

                  {/* Right panel */}
                  <View style={[styles.bentoPanelRight, isWide && styles.bentoPanelRightWide]}>
                    <View style={styles.bentoSection}>
                      <View style={styles.bentoSectionHeader}>
                        <MaterialIcons name="notifications-active" size={18} color={Colors.primary} />
                        <Text style={styles.bentoSectionTitle}>Hatırlatıcı & Tarih</Text>
                      </View>
                      <View>
                        <View style={styles.reminderHeader}>
                          <Text style={styles.formLabel}>Hatırlatma Saatleri</Text>
                        </View>
                        {form.reminderTimes.map((t, idx) => (
                          <View key={idx} style={styles.timePickerRow}>
                            <View style={{ flex: 1 }}>
                              <TimePickerField
                                value={t}
                                onChange={(v) => {
                                  const updated = [...form.reminderTimes];
                                  updated[idx] = v;
                                  setForm((f) => ({ ...f, reminderTimes: updated }));
                                }}
                              />
                            </View>
                            {form.reminderTimes.length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  const updated = form.reminderTimes.filter((_, i) => i !== idx);
                                  setForm((f) => ({ ...f, reminderTimes: updated }));
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={{ paddingTop: 2 }}
                              >
                                <MaterialIcons name="remove-circle-outline" size={26} color={Colors.danger} />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.addTimeBtn}
                          onPress={() => setForm((f) => ({ ...f, reminderTimes: [...f.reminderTimes, "08:00"] }))}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="add-circle-outline" size={16} color={Colors.primary} />
                          <Text style={styles.addTimeBtnText}>Saat Ekle</Text>
                        </TouchableOpacity>
                      </View>
                      <DatePickerField label="Başlangıç Tarihi" value={form.startDate} onChange={(v) => setForm((f) => ({ ...f, startDate: v }))} />
                      <DatePickerField label="Bitiş Tarihi (opsiyonel)" value={form.endDate} onChange={(v) => setForm((f) => ({ ...f, endDate: v }))} placeholder="Tarih seç (opsiyonel)" />
                      <FormField label="Notlar" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Aç karnına al gibi notlar..." multiline />
                    </View>
                  </View>
                </View>

                {addError && (
                  <View style={styles.addErrorBox}>
                    <MaterialIcons name="error-outline" size={16} color={Colors.danger} />
                    <Text style={styles.addErrorText}>{addError}</Text>
                  </View>
                )}
                <Button title="Aktif İlaçlara Ekle" onPress={handleAdd} variant="primary" fullWidth loading={loading} size="lg" style={{ marginTop: 4 }} />
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Skip Modal */}
      <Modal visible={!!skipModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Neden Atladın?</Text>
              {skipModal && <Text style={styles.skipMedName}>{skipModal.medicineName}</Text>}
            </View>
            <TouchableOpacity onPress={() => setSkipModal(null)}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {!skipAdvice ? (
              <>
                <View style={styles.reasonGrid}>
                  {SKIP_REASONS.map((r) => (
                    <TouchableOpacity key={r} style={[styles.reasonChip, skipReason === r && styles.reasonChipActive]} onPress={() => setSkipReason(r)}>
                      <Text style={[styles.reasonChipText, skipReason === r && styles.reasonChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {skipReason === "Diğer" && (
                  <TextInput style={styles.formInput} value={skipCustom} onChangeText={setSkipCustom} placeholder="Nedeninizi yazın..." placeholderTextColor={Colors.textMuted} multiline />
                )}
                {skipReasonError && (
                  <View style={styles.addErrorBox}>
                    <MaterialIcons name="error-outline" size={16} color={Colors.danger} />
                    <Text style={styles.addErrorText}>{skipReasonError}</Text>
                  </View>
                )}
                <Button title={skipLoading ? "AI Öneri Hazırlanıyor..." : "Devam Et"} onPress={confirmSkip} variant="primary" fullWidth loading={skipLoading} disabled={!skipReason} size="lg" style={{ marginTop: 8 }} />
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
                <Button title="Tamam" onPress={() => setSkipModal(null)} variant="primary" fullWidth size="lg" style={{ marginTop: 16 }} />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ConfirmModal
        visible={!!deleteConfirmId}
        title="İlacı Kaldır"
        message={deleteError ?? "Bu ilacı aktif ilaçlardan kaldırmak istiyor musun?"}
        confirmLabel="Kaldır"
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteConfirmId(null); setDeleteError(null); }}
        loading={deleting}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CabinetPicker({ medicines, onSelect }: { medicines: Medicine[]; onSelect: (med: Medicine) => void }) {
  if (medicines.length === 0) {
    return (
      <View style={styles.cabinetEmpty}>
        <View style={styles.cabinetEmptyIcon}><MaterialIcons name="medical-services" size={36} color={Colors.textMuted} /></View>
        <Text style={styles.cabinetEmptyTitle}>Dolabın Boş</Text>
        <Text style={styles.cabinetEmptyDesc}>Önce İlaç Dolabım sekmesine gidip ilaçlarını ekle.</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.cabinetList} showsVerticalScrollIndicator={false}>
      <Text style={styles.cabinetHint}>Seçmek istediğin ilaca dokun</Text>
      {medicines.map((med) => (
        <TouchableOpacity key={med.id} style={styles.cabinetItem} onPress={() => onSelect(med)} activeOpacity={0.7}>
          {med.imageUri ? (
            <Image source={{ uri: med.imageUri }} style={styles.cabinetThumb} />
          ) : (
            <View style={[styles.cabinetThumb, styles.cabinetThumbPlaceholder]}>
              <MaterialIcons name="medication" size={20} color={Colors.primary} />
            </View>
          )}
          <View style={styles.cabinetItemInfo}>
            <Text style={styles.cabinetItemName}>{med.name}</Text>
            {med.dosage && <Text style={styles.cabinetItemDosage}>{med.dosage}</Text>}
          </View>
          <MaterialIcons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ActiveMedicineCard({ medicine, todayDoses, onTake, onSkip, onDelete }: {
  medicine: ActiveMedicine; todayDoses: TakenDose[];
  onTake: (time: string) => void; onSkip: (time: string) => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const takenCount = todayDoses.filter((d) => d.takenAt).length;
  const total = medicine.reminderTimes.length;

  return (
    <View style={styles.medCard}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded((e) => !e)} style={styles.medHeader}>
        <View style={styles.medIconWrap}>
          <MaterialIcons name="medication" size={22} color={Colors.primary} />
        </View>
        <View style={styles.medInfo}>
          <Text style={styles.medName}>{medicine.medicineName}</Text>
          <Text style={styles.medDosage}>
            {medicine.dosage} · {medicine.frequency}
            {medicine.mealTiming ? ` · ${mealTimingShort(medicine.mealTiming)}` : ""}
          </Text>
        </View>
        <View style={styles.medRight}>
          <View style={styles.medProgressWrap}>
            <Text style={styles.medProgressText}>{takenCount}/{total}</Text>
          </View>
          <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={20} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.divider} />
          {medicine.reminderTimes.map((time) => {
            const dose = todayDoses.find((d) => d.scheduledTime.includes(time));
            const taken = dose?.takenAt;
            const skipped = dose?.skipped;
            return (
              <View key={time} style={styles.doseRow}>
                <View style={styles.doseTimeWrap}>
                  <MaterialIcons name="schedule" size={14} color={Colors.textMuted} />
                  <Text style={styles.doseTime}>{time}</Text>
                </View>
                {taken ? (
                  <View style={styles.doseTakenBadge}>
                    <MaterialIcons name="check-circle" size={14} color={Colors.primary} />
                    <Text style={styles.doseTakenText}>Alındı</Text>
                  </View>
                ) : skipped ? (
                  <View style={styles.doseSkippedBadge}>
                    <MaterialIcons name="cancel" size={14} color={Colors.textMuted} />
                    <Text style={styles.doseSkippedText}>Atlandı</Text>
                  </View>
                ) : (
                  <View style={styles.doseActions}>
                    <Button title="Aldım" onPress={() => onTake(time)} variant="primary" size="sm" />
                    <Button title="Atla" onPress={() => onSkip(time)} variant="outline" size="sm" />
                  </View>
                )}
              </View>
            );
          })}
          {medicine.notes && (
            <View style={styles.noteBox}>
              <MaterialIcons name="info-outline" size={14} color={Colors.primary} />
              <Text style={styles.noteText}>{medicine.notes}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Başlangıç: {medicine.startDate}{medicine.endDate ? ` · Bitiş: ${medicine.endDate}` : ""}
            </Text>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
            <MaterialIcons name="delete-outline" size={16} color={Colors.danger} />
            <Text style={styles.deleteBtnText}>Aktif Listeden Kaldır</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function FormField({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMulti]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={Colors.textMuted} multiline={multiline} numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function calcReminderTimes(firstTime: string, frequency: string): string[] {
  const intervalMap: Record<string, number> = { "Günde 1 kez": 0, "Günde 2 kez": 12, "Günde 3 kez": 8, "Her 8 saatte bir": 8, "Her 12 saatte bir": 12, "Gerektiğinde": 0 };
  const countMap: Record<string, number> = { "Günde 1 kez": 1, "Günde 2 kez": 2, "Günde 3 kez": 3, "Her 8 saatte bir": 3, "Her 12 saatte bir": 2, "Gerektiğinde": 1 };
  const interval = intervalMap[frequency] ?? 0;
  const count = countMap[frequency] ?? 1;
  if (count === 1 || interval === 0) return [firstTime];
  const [h, m] = firstTime.split(":").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const totalMin = (h ?? 8) * 60 + (m ?? 0) + i * interval * 60;
    return `${String(Math.floor(totalMin / 60) % 24).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}

function mealTimingShort(value: string): string {
  const map: Record<string, string> = { ac: "🌙 Aç", tok: "🍽️ Tok", farketmez: "✓ Farketmez" };
  return map[value] ?? value;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full,
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: Colors.textInverse },

  memberBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    height: 52,
    overflow: "hidden",
  },
  memberBarScroll: {
    flex: 1,
    height: 52,
  },
  memberBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
    height: 52,
  },
  memberTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  memberTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  memberTabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  memberTabTextActive: { color: Colors.textInverse },

  addChildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary + "60",
    backgroundColor: Colors.primaryLight,
  },
  addChildBtnText: { fontSize: 12, fontWeight: "600", color: Colors.primary },
  addChildRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addChildInput: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    color: Colors.text,
    backgroundColor: Colors.surface,
    minWidth: 110,
  },
  addChildConfirm: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  memberPickerSection: { gap: 8 },
  memberPickerLabel: { fontSize: 13, fontWeight: "600", color: Colors.text },
  memberPickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberPickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  memberPickerChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  memberPickerChipText: { fontSize: 13, fontWeight: "500", color: Colors.textSecondary },
  memberPickerChipTextActive: { color: Colors.primary, fontWeight: "700" },

  progressStrip: {
    backgroundColor: Colors.surface, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8,
  },
  progressInfo: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: "500" },
  progressCount: { fontSize: 12, color: Colors.primary, fontWeight: "700" },
  progressBarBg: { height: 6, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: Radius.full },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  dueBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 14,
    gap: 12, borderRadius: Radius.xl, ...Shadows.md,
  },
  dueBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  dueBannerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  dueBannerTitle: { fontSize: 13, fontWeight: "700", color: Colors.textInverse },
  dueBannerName: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  dueBannerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  takeBtnInline: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.textInverse, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
  },
  takeBtnInlineText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  skipBtnText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)" },

  // Medicine card
  medCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm, overflow: "hidden",
  },
  medHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  medIconWrap: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  medInfo: { flex: 1 },
  medName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  medDosage: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  medRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  medProgressWrap: {
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  medProgressText: { fontSize: 11, fontWeight: "700", color: Colors.primary },

  expandedContent: { paddingHorizontal: 16, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },

  doseRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  doseTimeWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  doseTime: { fontSize: 14, fontWeight: "600", color: Colors.text },
  doseActions: { flexDirection: "row", gap: 6 },
  doseTakenBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  doseTakenText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  doseSkippedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
  },
  doseSkippedText: { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },

  noteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: Colors.primaryLight, padding: 10, borderRadius: Radius.sm, marginTop: 8,
  },
  noteText: { fontSize: 13, color: Colors.primaryDark, flex: 1 },
  metaRow: { marginTop: 8 },
  metaText: { fontSize: 12, color: Colors.textMuted },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: Colors.danger + "40",
    backgroundColor: Colors.dangerLight, paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: Radius.md, marginTop: 12, justifyContent: "center",
  },
  deleteBtnText: { fontSize: 13, color: Colors.danger, fontWeight: "600" },

  // Insight card
  insightCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 20, ...Shadows.md,
  },
  insightLeft: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  insightIconWrap: {
    width: 48, height: 48, borderRadius: Radius.lg,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  insightTitle: { fontSize: 15, fontWeight: "700", color: Colors.textInverse, marginBottom: 4 },
  insightBody: { fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 19 },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  modalContent: { padding: 20, gap: 16, paddingBottom: 40 },

  modeSwitcher: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, padding: 4,
  },
  modeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: Radius.md },
  modeTabActive: { backgroundColor: Colors.surface, shadowColor: Colors.text, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  modeTabText: { fontSize: 13, fontWeight: "500", color: Colors.textMuted },
  modeTabTextActive: { color: Colors.primary, fontWeight: "700" },
  modeBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  modeBadgeText: { fontSize: 10, color: Colors.textInverse, fontWeight: "700" },

  // Bento form layout
  formBento: { gap: 16 },
  formBentoWide: { flexDirection: "row", alignItems: "flex-start" },
  bentoPanelLeft: {},
  bentoPanelLeftWide: { flex: 1 },
  bentoPanelRight: {},
  bentoPanelRightWide: { flex: 1 },
  bentoSection: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12,
  },
  bentoSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  bentoSectionTitle: { fontSize: 15, fontWeight: "700", color: Colors.text },

  fromCabinetBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primaryLight, padding: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary + "30",
  },
  fromCabinetText: { flex: 1, fontSize: 13, color: Colors.primaryDark },
  fromCabinetName: { fontWeight: "700" },

  cabinetList: { padding: 16, gap: 10, paddingBottom: 32 },
  cabinetHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },
  cabinetItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  cabinetThumb: { width: 52, height: 52, borderRadius: 10 },
  cabinetThumbPlaceholder: { backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  cabinetItemInfo: { flex: 1 },
  cabinetItemName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  cabinetItemDosage: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  cabinetEmpty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  cabinetEmptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  cabinetEmptyTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  cabinetEmptyDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },

  skipMedName: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  reasonChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  reasonChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  reasonChipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "500" },
  reasonChipTextActive: { color: Colors.primary, fontWeight: "700" },

  adviceContainer: { gap: 12 },
  adviceHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  adviceIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  adviceTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  adviceText: { fontSize: 15, color: Colors.text, lineHeight: 24, backgroundColor: Colors.surfaceAlt, padding: 16, borderRadius: Radius.lg },

  reminderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  addTimeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: Colors.primaryLight, paddingVertical: 10, borderRadius: Radius.md,
    marginTop: 8, borderWidth: 1, borderColor: Colors.primary + "40",
  },
  addTimeBtnText: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  timePickerRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
  },

  addErrorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.danger + "40",
  },
  addErrorText: { flex: 1, fontSize: 13, color: Colors.danger, fontWeight: "500" },

  formField: { gap: 6 },
  formLabel: { fontSize: 13, fontWeight: "600", color: Colors.text },
  formInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface },
  formInputMulti: { height: 80, textAlignVertical: "top", paddingTop: 10 },
});
