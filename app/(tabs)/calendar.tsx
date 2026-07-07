import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Colors, Radius, Shadows } from "../../constants/Colors";
import {
  getAllActiveMedicines, getDosesForDateRange, markDoseTaken, skipDose,
} from "../../services/database";
import { ActiveMedicine, TakenDose } from "../../types";

const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_NAMES = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

// "Ben" hariç aile üyelerini birbirinden ayırt etmek için renk paleti — durum
// renkleriyle (yeşil=alındı, kırmızı=atlandı, teal=primary) çakışmayacak tonlar.
const MEMBER_COLORS = ["#8B5CF6", "#F59E0B", "#EC4899", "#3B82F6", "#F97316", "#6366F1", "#0EA5E9", "#D946EF"];

function getMemberColor(memberName: string | undefined, children: string[]): string {
  if (!memberName) return Colors.primary; // "Ben"
  const idx = children.indexOf(memberName);
  return MEMBER_COLORS[idx >= 0 ? idx % MEMBER_COLORS.length : 0]!;
}

interface CalDose {
  medicine: ActiveMedicine;
  time: string;
  taken: boolean;
  skipped: boolean;
  record?: TakenDose;
}
type CalData = Record<string, CalDose[]>;

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]!;
}

function isActiveOnDate(med: ActiveMedicine, date: string): boolean {
  if (med.startDate > date) return false;
  if (med.endDate && med.endDate < date) return false;
  return true;
}

export default function CalendarScreen() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  const today = toDateStr(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [calData, setCalData] = useState<CalData>({});
  const [activeMeds, setActiveMeds] = useState<ActiveMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string>("Tümü");
  const [customChildren, setCustomChildren] = useState<string[]>([]);
  const [hiddenChildren, setHiddenChildren] = useState<string[]>([]);

  useFocusEffect(useCallback(() => {
    loadMonth(viewDate);
    AsyncStorage.getItem("customChildren").then((v) => { if (v) setCustomChildren(JSON.parse(v)); });
    AsyncStorage.getItem("hiddenChildren").then((v) => { if (v) setHiddenChildren(JSON.parse(v)); });
  }, [viewDate]));

  async function loadMonth(base: Date) {
    setLoading(true);
    try {
      // Takvim modu ("Tümü"/"Ben"/çocuk adı) fark etmeksizin tüm ilaçları
      // çekip görüntülemeyi seçime göre aşağıda filtreliyoruz — mod
      // değiştirmek yeniden sorgu yapmaz.
      const meds = await getAllActiveMedicines();
      setActiveMeds(meds);
      const year = base.getFullYear();
      const month = base.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      // Load all taken doses for the month per medicine
      const dosesByMed: Record<string, TakenDose[]> = {};
      for (const med of meds) {
        dosesByMed[med.id] = await getDosesForDateRange(med.id, startDate, endDate);
      }

      // Build calendar data
      const data: CalData = {};
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dayDoses: CalDose[] = [];
        for (const med of meds) {
          if (!isActiveOnDate(med, dateStr)) continue;
          for (const time of med.reminderTimes) {
            const records = dosesByMed[med.id] ?? [];
            const record = records.find((r) => r.scheduledTime.includes(time) && r.scheduledTime.startsWith(dateStr));
            dayDoses.push({
              medicine: med,
              time,
              taken: !!record?.takenAt,
              skipped: !!record?.skipped,
              record,
            });
          }
        }
        dayDoses.sort((a, b) => a.time.localeCompare(b.time));
        if (dayDoses.length > 0) data[dateStr] = dayDoses;
      }
      setCalData(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleTake(dose: CalDose, date: string) {
    const key = `${dose.medicine.id}_${date}_${dose.time}`;
    setActionLoading(key);
    try {
      const scheduledTime = `${date}T${dose.time}`;
      await markDoseTaken(
        { id: `${dose.medicine.id}_${scheduledTime}`, scheduledTime, takenAt: new Date().toISOString() },
        dose.medicine.id
      );
      await loadMonth(viewDate);
    } finally { setActionLoading(null); }
  }

  async function handleSkip(dose: CalDose, date: string) {
    const key = `${dose.medicine.id}_${date}_${dose.time}_skip`;
    setActionLoading(key);
    try {
      const scheduledTime = `${date}T${dose.time}`;
      await skipDose({ id: `${dose.medicine.id}_${scheduledTime}`, scheduledTime }, dose.medicine.id);
      await loadMonth(viewDate);
    } finally { setActionLoading(null); }
  }

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToday() {
    setViewDate(new Date());
    setSelectedDate(today);
  }

  // Calendar grid
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday-first
  const totalCells = startPad + lastDay.getDate();
  const totalRows = Math.ceil(totalCells / 7);

  // Üye seçimi: "Tümü" = herkes karışık, "Ben" = sadece kendi ilaçların, yoksa çocuk adı
  const childNamesFromMeds = activeMeds.filter((m) => m.memberName).map((m) => m.memberName!);
  const allChildren = Array.from(new Set([...customChildren, ...childNamesFromMeds]))
    .filter((n) => !hiddenChildren.includes(n));
  const memberTabs = ["Tümü", "Ben", ...allChildren];

  function matchesSelectedMember(memberName: string | undefined): boolean {
    if (selectedMember === "Tümü") return true;
    if (selectedMember === "Ben") return !memberName;
    return memberName === selectedMember;
  }

  const visibleActiveMeds = activeMeds.filter((m) => matchesSelectedMember(m.memberName));
  const visibleCalData: CalData = {};
  for (const [date, doses] of Object.entries(calData)) {
    const filtered = doses.filter((d) => matchesSelectedMember(d.medicine.memberName));
    if (filtered.length > 0) visibleCalData[date] = filtered;
  }

  // Stats
  const monthDoses = Object.values(visibleCalData).flat();
  const pastDoses = monthDoses.filter((d) => {
    const dateEntry = Object.entries(visibleCalData).find(([, doses]) => doses.includes(d));
    return dateEntry && dateEntry[0] <= today;
  });
  const takenCount = pastDoses.filter((d) => d.taken).length;
  const skippedCount = pastDoses.filter((d) => d.skipped).length;
  const adherencePct = pastDoses.length > 0 ? Math.round((takenCount / pastDoses.length) * 100) : 0;

  const selectedDoses = visibleCalData[selectedDate] ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>İlaç Takvimi</Text>
          <Text style={styles.headerSub}>Aylık doz programı ve uyum takibi</Text>
        </View>
        <TouchableOpacity style={styles.todayBtn} onPress={goToday}>
          <MaterialIcons name="today" size={16} color={Colors.primary} />
          <Text style={styles.todayBtnText}>Bugün</Text>
        </TouchableOpacity>
      </View>

      {allChildren.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.memberRow}
          contentContainerStyle={styles.memberRowContent}
        >
          {memberTabs.map((name) => {
            const color = name === "Tümü" ? Colors.text : getMemberColor(name === "Ben" ? undefined : name, allChildren);
            const active = selectedMember === name;
            return (
              <TouchableOpacity
                key={name}
                style={[styles.memberTab, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => setSelectedMember(name)}
                activeOpacity={0.8}
              >
                {name !== "Tümü" && name !== "Ben" && (
                  <View style={[styles.memberDot, { backgroundColor: active ? Colors.textInverse : color }]} />
                )}
                <Text style={[styles.memberTabText, active && styles.memberTabTextActive]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.bentoRow, isWide && styles.bentoRowWide]}>

          {/* LEFT: Calendar + Stats */}
          <View style={[styles.calendarCol, isWide && styles.calendarColWide]}>

            {/* Month nav */}
            <View style={styles.calCard}>
              <View style={styles.monthNav}>
                <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
                  <MaterialIcons name="chevron-left" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                  {MONTH_NAMES[month]} {year}
                </Text>
                <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
                  <MaterialIcons name="chevron-right" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Day headers */}
              <View style={styles.dayNamesRow}>
                {DAY_NAMES.map((n) => (
                  <Text key={n} style={styles.dayName}>{n}</Text>
                ))}
              </View>

              {/* Grid */}
              {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
              ) : (
                <View style={styles.grid}>
                  {Array.from({ length: totalRows * 7 }).map((_, idx) => {
                    const dayNum = idx - startPad + 1;
                    if (dayNum < 1 || dayNum > lastDay.getDate()) {
                      return <View key={idx} style={styles.emptyCell} />;
                    }
                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const doses = visibleCalData[dateStr] ?? [];
                    const isToday = dateStr === today;
                    const isSelected = dateStr === selectedDate;
                    const isPast = dateStr < today;
                    const allTaken = doses.length > 0 && doses.every((d) => d.taken);
                    const hasMissed = isPast && doses.some((d) => !d.taken && !d.skipped);
                    const hasSkipped = doses.some((d) => d.skipped && !d.taken);

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                        ]}
                        onPress={() => setSelectedDate(dateStr)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.dayNumWrap, isToday && styles.dayNumToday]}>
                          <Text style={[styles.dayNum, isToday && styles.dayNumTodayText, dayNum < 1 && { color: Colors.textMuted }]}>
                            {dayNum}
                          </Text>
                        </View>

                        {doses.slice(0, 3).map((dose, i) => (
                          <View
                            key={i}
                            style={[
                              styles.doseChip,
                              dose.taken
                                ? styles.chipTaken
                                : hasMissed && !dose.taken && !dose.skipped
                                ? styles.chipMissed
                                : dose.skipped
                                ? styles.chipSkipped
                                : styles.chipScheduled,
                              selectedMember === "Tümü" && {
                                borderLeftWidth: 2,
                                borderLeftColor: getMemberColor(dose.medicine.memberName, allChildren),
                              },
                            ]}
                          >
                            <Text style={[
                              styles.doseChipText,
                              dose.taken ? styles.chipTakenText
                                : hasMissed && !dose.taken ? styles.chipMissedText
                                : dose.skipped ? styles.chipSkippedText
                                : styles.chipScheduledText,
                            ]} numberOfLines={1}>
                              {dose.taken ? "✓ " : hasMissed && !dose.taken && !dose.skipped ? "! " : ""}
                              {selectedMember === "Tümü" && dose.medicine.memberName ? `${dose.medicine.memberName}: ` : ""}
                              {dose.medicine.medicineName}
                            </Text>
                          </View>
                        ))}
                        {doses.length > 3 && (
                          <Text style={styles.moreChip}>+{doses.length - 3}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Aylık Uyum</Text>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, { color: Colors.primary }]}>{adherencePct}%</Text>
                  {adherencePct >= 80 && (
                    <MaterialIcons name="trending-up" size={14} color="#16a34a" style={{ marginBottom: 2 }} />
                  )}
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Aktif İlaç</Text>
                <Text style={styles.statValue}>{visibleActiveMeds.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Atlanan Doz</Text>
                <Text style={[styles.statValue, skippedCount > 0 && { color: Colors.danger }]}>
                  {skippedCount}
                </Text>
              </View>
            </View>
          </View>

          {/* RIGHT: Daily schedule */}
          <View style={[styles.rightCol, isWide && styles.rightColWide]}>
            <View style={styles.dayCard}>
              <View style={styles.dayCardHeader}>
                <Text style={styles.dayCardTitle}>Günlük Program</Text>
                <Text style={styles.dayCardDate}>
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("tr-TR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </Text>
              </View>

              {selectedDoses.length === 0 ? (
                <View style={styles.emptyDay}>
                  <MaterialIcons name="event-available" size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyDayText}>Bu gün için planlanmış doz yok</Text>
                </View>
              ) : (
                <View style={styles.doseList}>
                  {selectedDoses.map((dose, i) => {
                    const isPast = selectedDate < today || (selectedDate === today);
                    const isMissed = isPast && !dose.taken && !dose.skipped && selectedDate < today;
                    const takeKey = `${dose.medicine.id}_${selectedDate}_${dose.time}`;
                    const skipKey = `${dose.medicine.id}_${selectedDate}_${dose.time}_skip`;

                    return (
                      <View
                        key={i}
                        style={[
                          styles.doseItem,
                          dose.taken && styles.doseItemTaken,
                          isMissed && styles.doseItemMissed,
                        ]}
                      >
                        <View style={styles.doseItemTop}>
                          <View style={[
                            styles.doseIconWrap,
                            dose.taken
                              ? { backgroundColor: "#dcfce7" }
                              : isMissed
                              ? { backgroundColor: Colors.dangerLight }
                              : { backgroundColor: Colors.primaryLight },
                          ]}>
                            <MaterialIcons
                              name={dose.taken ? "check-circle" : isMissed ? "warning" : "medication"}
                              size={20}
                              color={dose.taken ? "#16a34a" : isMissed ? Colors.danger : Colors.primary}
                            />
                          </View>
                          <View style={styles.doseItemInfo}>
                            {selectedMember === "Tümü" && (
                              <View style={styles.doseItemMemberRow}>
                                <View style={[styles.memberDot, { backgroundColor: getMemberColor(dose.medicine.memberName, allChildren) }]} />
                                <Text style={styles.doseItemMemberText}>{dose.medicine.memberName ?? "Ben"}</Text>
                              </View>
                            )}
                            <Text style={[styles.doseItemName, dose.taken && styles.strikethrough]}>
                              {dose.medicine.medicineName}
                            </Text>
                            <Text style={styles.doseItemSub}>
                              {dose.medicine.dosage}
                              {dose.medicine.mealTiming ? ` · ${dose.medicine.mealTiming}` : ""}
                            </Text>
                          </View>
                          <View style={[
                            styles.timeBadge,
                            dose.taken
                              ? { backgroundColor: "#dcfce7" }
                              : isMissed
                              ? { backgroundColor: Colors.dangerLight }
                              : { backgroundColor: Colors.primaryLight },
                          ]}>
                            <Text style={[
                              styles.timeBadgeText,
                              { color: dose.taken ? "#16a34a" : isMissed ? Colors.danger : Colors.primary },
                            ]}>
                              {isMissed ? "Atlandı" : dose.taken ? "Alındı" : dose.time}
                            </Text>
                          </View>
                        </View>

                        {!dose.taken && !dose.skipped && (
                          <View style={styles.doseActions}>
                            <TouchableOpacity
                              style={styles.takeDoseBtn}
                              onPress={() => handleTake(dose, selectedDate)}
                              disabled={actionLoading === takeKey}
                              activeOpacity={0.8}
                            >
                              {actionLoading === takeKey
                                ? <ActivityIndicator size="small" color={Colors.textInverse} />
                                : <>
                                    <MaterialIcons name="check" size={14} color={Colors.textInverse} />
                                    <Text style={styles.takeDoseBtnText}>Aldım</Text>
                                  </>}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.skipDoseBtn}
                              onPress={() => handleSkip(dose, selectedDate)}
                              disabled={actionLoading === skipKey}
                            >
                              <Text style={styles.skipDoseBtnText}>Atla</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {dose.skipped && !dose.taken && (
                          <View style={styles.skippedNote}>
                            <MaterialIcons name="cancel" size={12} color={Colors.textMuted} />
                            <Text style={styles.skippedNoteText}>Bu doz atlandı</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Insight card */}
            <View style={styles.insightCard}>
              <View style={styles.insightGlow} />
              <View style={styles.insightContent}>
                <View style={styles.insightHeaderRow}>
                  <MaterialIcons name="auto-awesome" size={18} color="#89f5e7" />
                  <Text style={styles.insightTitle}>Uyum Özeti</Text>
                </View>
                <Text style={styles.insightBody}>
                  {adherencePct >= 90
                    ? `Harika! Bu ay %${adherencePct} uyum sağladınız. Böyle devam edin.`
                    : adherencePct >= 70
                    ? `Bu ay %${adherencePct} uyum sağlandı. Düzenli alım için hatırlatıcıları kontrol edin.`
                    : visibleActiveMeds.length === 0
                    ? "Henüz aktif ilaç eklenmedi. Takip sekmesinden ilaç ekleyebilirsiniz."
                    : `Bu ay %${adherencePct} uyum sağlandı. Daha düzenli olmaya çalışın.`}
                </Text>
                <View style={styles.insightStats}>
                  <View style={styles.insightStat}>
                    <Text style={styles.insightStatVal}>{takenCount}</Text>
                    <Text style={styles.insightStatLbl}>Alınan</Text>
                  </View>
                  <View style={styles.insightStatDivider} />
                  <View style={styles.insightStat}>
                    <Text style={styles.insightStatVal}>{skippedCount}</Text>
                    <Text style={styles.insightStatLbl}>Atlanan</Text>
                  </View>
                  <View style={styles.insightStatDivider} />
                  <View style={styles.insightStat}>
                    <Text style={styles.insightStatVal}>{visibleActiveMeds.length}</Text>
                    <Text style={styles.insightStatLbl}>Aktif İlaç</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  todayBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + "40",
  },
  todayBtnText: { fontSize: 13, fontWeight: "700", color: Colors.primary },

  memberRow: { flexGrow: 0, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberRowContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  memberTab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  memberDot: { width: 8, height: 8, borderRadius: 4 },
  memberTabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  memberTabTextActive: { color: Colors.textInverse },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },

  bentoRow: { gap: 16 },
  bentoRowWide: { flexDirection: "row", alignItems: "flex-start" },

  calendarCol: { gap: 16 },
  calendarColWide: { flex: 3 },

  // Calendar card
  calCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
    ...Shadows.sm,
  },
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: Radius.md,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surfaceAlt,
  },
  monthTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },

  dayNamesRow: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceAlt,
    paddingVertical: 8,
  },
  dayName: {
    flex: 1, textAlign: "center",
    fontSize: 11, fontWeight: "700", color: Colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.5,
  },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  emptyCell: {
    width: "14.285714%", minHeight: 100,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceAlt + "50",
  },
  dayCell: {
    width: "14.285714%", minHeight: 100, padding: 4,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.borderLight,
    gap: 3,
  },
  dayCellSelected: {
    backgroundColor: Colors.primaryLight + "80",
  },
  dayNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
  dayNumToday: { backgroundColor: Colors.primary },
  dayNum: { fontSize: 12, fontWeight: "700", color: Colors.text },
  dayNumTodayText: { color: Colors.textInverse },

  doseChip: {
    borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2,
  },
  chipTaken: { backgroundColor: "#dcfce7" },
  chipMissed: { backgroundColor: Colors.dangerLight },
  chipSkipped: { backgroundColor: Colors.surfaceAlt },
  chipScheduled: { backgroundColor: Colors.primaryLight },
  doseChipText: { fontSize: 9, fontWeight: "700" },
  chipTakenText: { color: "#16a34a" },
  chipMissedText: { color: Colors.danger },
  chipSkippedText: { color: Colors.textMuted },
  chipScheduledText: { color: Colors.primary },
  moreChip: { fontSize: 9, color: Colors.textMuted, fontWeight: "600" },

  // Stats row
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 14, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  statValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  statValue: { fontSize: 24, fontWeight: "800", color: Colors.text },

  // Right column
  rightCol: { gap: 16 },
  rightColWide: { flex: 2 },

  dayCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  dayCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dayCardTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  dayCardDate: { fontSize: 12, color: Colors.textMuted },

  emptyDay: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyDayText: { fontSize: 14, color: Colors.textSecondary },

  doseList: { padding: 12, gap: 10 },
  doseItem: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg,
    padding: 12, borderWidth: 1, borderColor: Colors.borderLight,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    gap: 10,
  },
  doseItemTaken: { opacity: 0.65, borderLeftColor: "#16a34a" },
  doseItemMissed: { borderLeftColor: Colors.danger, backgroundColor: Colors.dangerLight + "30" },
  doseItemTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  doseIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  doseItemInfo: { flex: 1 },
  doseItemMemberRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  doseItemMemberText: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
  doseItemName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  strikethrough: { textDecorationLine: "line-through", color: Colors.textMuted },
  doseItemSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  timeBadge: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.full,
  },
  timeBadgeText: { fontSize: 11, fontWeight: "700" },

  doseActions: { flexDirection: "row", gap: 8 },
  takeDoseBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: Colors.primary, paddingVertical: 9, borderRadius: Radius.md,
  },
  takeDoseBtnText: { fontSize: 13, fontWeight: "700", color: Colors.textInverse },
  skipDoseBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  skipDoseBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  skippedNote: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  skippedNoteText: { fontSize: 12, color: Colors.textMuted },

  // Insight card
  insightCard: {
    backgroundColor: Colors.primaryDark, borderRadius: Radius.xl,
    padding: 20, overflow: "hidden", position: "relative",
  },
  insightGlow: {
    position: "absolute", top: -20, right: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary, opacity: 0.5,
  },
  insightContent: { gap: 12 },
  insightHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  insightTitle: { fontSize: 14, fontWeight: "700", color: Colors.textInverse },
  insightBody: { fontSize: 13, color: "#cde8e3", lineHeight: 19 },
  insightStats: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: Radius.lg, padding: 12,
    borderWidth: 1, borderColor: Colors.primary + "50",
  },
  insightStat: { flex: 1, alignItems: "center" },
  insightStatVal: { fontSize: 20, fontWeight: "800", color: Colors.textInverse },
  insightStatLbl: { fontSize: 11, color: "#89f5e7", marginTop: 2 },
  insightStatDivider: { width: 1, height: 32, backgroundColor: Colors.primary + "60" },
});
