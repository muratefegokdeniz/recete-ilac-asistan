import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Colors, Radius, Shadows } from "../../constants/Colors";
import {
  getAllActiveMedicines,
  getAllMedicines,
  getAllPrescriptions,
  getTodayDoses,
  getDosesForDate,
  markDoseTaken,
} from "../../services/database";
import { ActiveMedicine, Medicine, SavedPrescription, TakenDose } from "../../types";
import { useAuth } from "../../context/AuthContext";

type TimeSlot = "morning" | "afternoon" | "evening";

interface ScheduleItem {
  medicine: ActiveMedicine;
  time: string;
  slot: TimeSlot;
  doses: TakenDose[];
}

const SLOT_CONFIG: Record<TimeSlot, { label: string; sublabel: string; icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }> = {
  morning: { label: "Sabah", sublabel: "06:00 – 12:00", icon: "wb-sunny", color: "#00685f", bg: "#e0f5f2" },
  afternoon: { label: "Öğle", sublabel: "12:00 – 18:00", icon: "sunny", color: "#576065", bg: "#dbe4ea" },
  evening: { label: "Akşam / Gece", sublabel: "18:00 – 24:00", icon: "nights-stay", color: "#924628", bg: "#ffdcc8" },
};

function getSlot(time: string): TimeSlot {
  const h = parseInt(time.split(":")[0] ?? "8", 10);
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function today(): string {
  return new Date().toISOString().split("T")[0]!;
}

function formatTurkishDate(): string {
  return new Date().toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 900;

  const [activeMeds, setActiveMeds] = useState<ActiveMedicine[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptions, setPrescriptions] = useState<SavedPrescription[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ label: string; pct: number; taken: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [ams, meds, prescs] = await Promise.all([
        getAllActiveMedicines(),
        getAllMedicines(),
        getAllPrescriptions(),
      ]);
      setActiveMeds(ams);
      setMedicines(meds);
      setPrescriptions(prescs);

      // Build schedule items for today
      const items: ScheduleItem[] = [];
      for (const am of ams) {
        const doses = await getTodayDoses(am.id);
        for (const t of am.reminderTimes) {
          items.push({ medicine: am, time: t, slot: getSlot(t), doses });
        }
      }
      items.sort((a, b) => a.time.localeCompare(b.time));
      setScheduleItems(items);

      // Build weekly adherence data (last 7 days)
      const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
      const weekly: { label: string; pct: number; taken: number; total: number }[] = [];
      for (let d = 6; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().split("T")[0]!;
        const label = d === 0 ? "Bug" : DAY_LABELS[date.getDay() === 0 ? 6 : date.getDay() - 1]!;
        let totalDoses = 0;
        let takenDoses = 0;
        for (const am of ams) {
          const dayDoses = await getDosesForDate(am.id, dateStr);
          totalDoses += am.reminderTimes.length;
          takenDoses += dayDoses.filter((dose) => dose.takenAt != null && !dose.skipped).length;
        }
        weekly.push({
          label,
          pct: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
          taken: takenDoses,
          total: totalDoses,
        });
      }
      setWeeklyData(weekly);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(item: ScheduleItem) {
    const key = `${item.medicine.id}_${item.time}`;
    setConfirmingId(key);
    try {
      const dose: TakenDose = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        scheduledTime: item.time,
        takenAt: new Date().toISOString(),
      };
      await markDoseTaken(dose, item.medicine.id);
      await loadAll();
    } finally {
      setConfirmingId(null);
    }
  }

  function isDoseTaken(item: ScheduleItem): boolean {
    return item.doses.some(
      (d) => d.scheduledTime === item.time && d.takenAt != null && !d.skipped
    );
  }

  // Stats
  const todayTotal = scheduleItems.length;
  const todayTaken = scheduleItems.filter(isDoseTaken).length;
  const todayPct = todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 0;

  const expiringMeds = medicines.filter((m) => {
    if (!m.expiryDate) return false;
    const exp = new Date(m.expiryDate);
    const now = new Date();
    const days = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  });

  const lastPresc = prescriptions[0] ?? null;

  // Group schedule by slot
  const slots: TimeSlot[] = ["morning", "afternoon", "evening"];
  const grouped: Record<TimeSlot, ScheduleItem[]> = {
    morning: scheduleItems.filter((i) => i.slot === "morning"),
    afternoon: scheduleItems.filter((i) => i.slot === "afternoon"),
    evening: scheduleItems.filter((i) => i.slot === "evening"),
  };

  const userEmail = user?.email ?? "";
  const userName = userEmail.split("@")[0] ?? "Kullanıcı";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greetingText()}, {userName}</Text>
          <Text style={styles.headerDate}>{formatTurkishDate()}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push("/(tabs)/" as any)}
          >
            <MaterialIcons name="document-scanner" size={16} color={Colors.primary} />
            <Text style={styles.headerBtnText}>Reçete Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, styles.headerBtnPrimary]}
            onPress={() => router.push("/(tabs)/cabinet" as any)}
          >
            <MaterialIcons name="add" size={16} color={Colors.textInverse} />
            <Text style={[styles.headerBtnText, { color: Colors.textInverse }]}>İlaç Ekle</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Row */}
        <View style={[styles.statsRow, isWide && styles.statsRowWide]}>
          <StatCard
            icon="check-circle"
            iconColor="#00685f"
            iconBg="#e0f5f2"
            label="Bugünkü Dozlar"
            value={`${todayTaken} / ${todayTotal}`}
            sub={todayTotal > 0 ? `%${todayPct} tamamlandı` : "Planlanmış doz yok"}
          />
          <StatCard
            icon="medical-services"
            iconColor="#576065"
            iconBg="#dbe4ea"
            label="Aktif İlaç"
            value={String(activeMeds.length)}
            sub="Takip ediliyor"
          />
          <StatCard
            icon="local-pharmacy"
            iconColor="#924628"
            iconBg="#ffdcc8"
            label="Dolap"
            value={String(medicines.length)}
            sub={expiringMeds.length > 0 ? `${expiringMeds.length} yakında bitiyor` : "Hepsi güncel"}
            subColor={expiringMeds.length > 0 ? Colors.danger : undefined}
          />
          <StatCard
            icon="receipt-long"
            iconColor="#00685f"
            iconBg="#e0f5f2"
            label="Reçete"
            value={String(prescriptions.length)}
            sub="Kayıtlı reçete"
          />
        </View>

        {/* Main bento area */}
        <View style={[styles.bentoRow, isWide && styles.bentoRowWide]}>
          {/* Daily Schedule */}
          <View style={[styles.scheduleCard, isWide && styles.scheduleCardWide]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <MaterialIcons name="schedule" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>Günlük İlaç Programı</Text>
              </View>
              <Text style={styles.cardDateLabel}>
                {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 32 }} />
            ) : scheduleItems.length === 0 ? (
              <View style={styles.emptySchedule}>
                <MaterialIcons name="alarm-off" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyScheduleText}>Bugün planlanmış doz yok</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/active" as any)}>
                  <Text style={styles.emptyScheduleLink}>Aktif ilaç ekle →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.timeline}>
                {slots.map((slot) => {
                  const items = grouped[slot];
                  if (items.length === 0) return null;
                  const cfg = SLOT_CONFIG[slot];
                  return (
                    <View key={slot} style={styles.slotGroup}>
                      {/* Slot header */}
                      <View style={styles.slotHeader}>
                        <View style={[styles.slotDot, { backgroundColor: cfg.bg }]}>
                          <MaterialIcons name={cfg.icon} size={14} color={cfg.color} />
                        </View>
                        <View style={styles.timelineLine} />
                        <Text style={[styles.slotLabel, { color: cfg.color }]}>{cfg.label}</Text>
                        <Text style={styles.slotSublabel}>{cfg.sublabel}</Text>
                      </View>
                      {/* Items */}
                      {items.map((item, idx) => {
                        const taken = isDoseTaken(item);
                        const key = `${item.medicine.id}_${item.time}`;
                        const confirming = confirmingId === key;
                        return (
                          <View
                            key={idx}
                            style={[
                              styles.scheduleItem,
                              taken && styles.scheduleItemTaken,
                            ]}
                          >
                            <View style={[styles.medIconWrap, { backgroundColor: cfg.bg }]}>
                              <MaterialIcons name="medication" size={18} color={cfg.color} />
                            </View>
                            <View style={styles.scheduleItemInfo}>
                              <Text style={[styles.scheduleItemName, taken && styles.scheduleItemNameTaken]}>
                                {item.medicine.medicineName}
                              </Text>
                              <Text style={styles.scheduleItemSub}>
                                {item.medicine.dosage}
                                {item.medicine.notes ? ` · ${item.medicine.notes}` : ""}
                              </Text>
                            </View>
                            <View style={styles.scheduleItemRight}>
                              <Text style={[styles.scheduleItemTime, taken && { color: Colors.textMuted }]}>
                                {item.time}
                              </Text>
                              {taken ? (
                                <View style={styles.takenBadge}>
                                  <MaterialIcons name="check" size={14} color="#16a34a" />
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.confirmBtn}
                                  onPress={() => handleConfirm(item)}
                                  disabled={confirming}
                                  activeOpacity={0.8}
                                >
                                  {confirming
                                    ? <ActivityIndicator size="small" color={Colors.textInverse} />
                                    : <Text style={styles.confirmBtnText}>Onayla</Text>}
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Right column */}
          <View style={[styles.rightColumn, isWide && styles.rightColumnWide]}>
            {/* AI Analysis Card */}
            <View style={styles.aiCard}>
              <View style={styles.aiCardGlow} />
              <View style={styles.aiCardContent}>
                <View style={styles.aiCardHeader}>
                  <MaterialIcons name="auto-awesome" size={18} color="#89f5e7" />
                  <Text style={styles.aiCardTitle}>Yapay Zeka Reçete Analizi</Text>
                </View>
                {lastPresc ? (
                  <>
                    <Text style={styles.aiCardBody}>
                      Son reçetenizde{" "}
                      <Text style={styles.aiCardBold}>{lastPresc.analysis.medicines.length} ilaç</Text>{" "}
                      tespit edildi.
                      {lastPresc.analysis.doctorName
                        ? ` Dr. ${lastPresc.analysis.doctorName} tarafından düzenlendi.`
                        : ""}
                    </Text>
                    <View style={styles.aiScoreBox}>
                      <View>
                        <Text style={styles.aiScoreLabel}>Son Reçete</Text>
                        <Text style={styles.aiScoreValue}>
                          {new Date(lastPresc.savedAt).toLocaleDateString("tr-TR", {
                            day: "numeric", month: "short",
                          })}
                        </Text>
                      </View>
                      <MaterialIcons name="verified" size={28} color="#6bd8cb" />
                    </View>
                  </>
                ) : (
                  <Text style={styles.aiCardBody}>
                    Henüz reçete yüklenmedi. Reçetenizi ekleyerek AI analizinden yararlanın.
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.aiCardBtn}
                  onPress={() => router.push("/(tabs)/" as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.aiCardBtnText}>Reçete Ekle →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Cabinet Summary */}
            <View style={styles.cabinetCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <MaterialIcons name="medical-services" size={20} color={Colors.primary} />
                  <Text style={styles.cardTitle}>İlaç Dolabı</Text>
                </View>
              </View>

              {medicines.length === 0 ? (
                <Text style={styles.cabinetEmpty}>Dolabınızda ilaç yok.</Text>
              ) : (
                <View style={styles.cabinetList}>
                  {medicines.slice(0, 4).map((m, i) => {
                    const isLow = (m.quantity ?? 0) <= 3;
                    const isExpiringSoon = (() => {
                      if (!m.expiryDate) return false;
                      const days = (new Date(m.expiryDate).getTime() - Date.now()) / 86400000;
                      return days <= 30;
                    })();
                    return (
                      <View key={m.id} style={styles.cabinetItem}>
                        <View style={styles.cabinetItemLeft}>
                          <View style={[
                            styles.cabinetDot,
                            { backgroundColor: isLow || isExpiringSoon ? Colors.danger : "#16a34a" },
                          ]} />
                          <Text style={styles.cabinetItemName} numberOfLines={1}>{m.name}</Text>
                        </View>
                        {isLow ? (
                          <View style={styles.cabinetBadgeDanger}>
                            <Text style={styles.cabinetBadgeDangerText}>Az ({m.quantity ?? 0})</Text>
                          </View>
                        ) : isExpiringSoon ? (
                          <Text style={styles.cabinetSkt}>
                            SKT: {m.expiryDate?.substring(0, 7)}
                          </Text>
                        ) : (
                          <Text style={styles.cabinetOk}>
                            {m.quantity != null ? `${m.quantity} adet` : "Yeterli"}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                  {medicines.length > 4 && (
                    <Text style={styles.cabinetMore}>+{medicines.length - 4} ilaç daha</Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.cabinetManageBtn}
                onPress={() => router.push("/(tabs)/cabinet" as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.cabinetManageBtnText}>Envanteri Yönet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Weekly Adherence Chart */}
        {weeklyData.length > 0 && activeMeds.length > 0 && (
          <WeeklyChart data={weeklyData} />
        )}

        {/* Progress Banner */}
        {todayTotal > 0 && (
          <View style={styles.progressBanner}>
            <View style={styles.progressBannerLeft}>
              <MaterialIcons name="insights" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.progressBannerTitle}>Günlük İlerleme</Text>
                <Text style={styles.progressBannerSub}>{todayTaken}/{todayTotal} doz tamamlandı</Text>
              </View>
            </View>
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${todayPct}%` as any }]} />
              </View>
              <Text style={styles.progressPct}>%{todayPct}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon, iconColor, iconBg, label, value, sub, subColor,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={[statStyles.sub, subColor ? { color: subColor } : null]}>{sub}</Text>
    </View>
  );
}

function WeeklyChart({ data }: { data: { label: string; pct: number; taken: number; total: number }[] }) {
  const [tooltip, setTooltip] = useState<number | null>(null);
  const BAR_HEIGHT = 120;

  const avgPct = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length)
    : 0;

  return (
    <View style={chartStyles.card}>
      <View style={chartStyles.header}>
        <View style={chartStyles.titleRow}>
          <MaterialIcons name="bar-chart" size={20} color={Colors.primary} />
          <Text style={chartStyles.title}>Haftalık Uyum</Text>
        </View>
        <View style={chartStyles.avgBadge}>
          <Text style={chartStyles.avgText}>Ort. %{avgPct}</Text>
        </View>
      </View>

      <View style={chartStyles.chartArea}>
        {data.map((day, i) => {
          const isToday = i === data.length - 1;
          const barH = Math.max(4, Math.round((day.pct / 100) * BAR_HEIGHT));
          const barColor = day.pct >= 80
            ? Colors.primary
            : day.pct >= 50
            ? Colors.warning
            : day.total === 0
            ? Colors.border
            : Colors.danger;
          const showTip = tooltip === i;

          return (
            <TouchableOpacity
              key={i}
              style={chartStyles.barCol}
              onPress={() => setTooltip(showTip ? null : i)}
              activeOpacity={0.8}
            >
              {showTip && (
                <View style={chartStyles.tooltip}>
                  <Text style={chartStyles.tooltipText}>
                    {day.total === 0 ? "Doz yok" : `${day.taken}/${day.total} doz`}
                  </Text>
                  <Text style={chartStyles.tooltipPct}>%{day.pct}</Text>
                </View>
              )}
              <View style={[chartStyles.barBg, { height: BAR_HEIGHT }]}>
                <View
                  style={[
                    chartStyles.barFill,
                    { height: barH, backgroundColor: barColor },
                    isToday && chartStyles.barToday,
                  ]}
                />
              </View>
              <Text style={[chartStyles.barLabel, isToday && chartStyles.barLabelToday]}>
                {day.label}
              </Text>
              <Text style={chartStyles.barPct}>%{day.pct}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={chartStyles.legend}>
        {[
          { color: Colors.primary, label: "≥80% İyi" },
          { color: Colors.warning, label: "50–79% Orta" },
          { color: Colors.danger, label: "<50% Düşük" },
        ].map((l) => (
          <View key={l.label} style={chartStyles.legendItem}>
            <View style={[chartStyles.legendDot, { backgroundColor: l.color }]} />
            <Text style={chartStyles.legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "700", color: Colors.text },
  avgBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  avgText: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 4,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  barBg: {
    width: "100%",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: Radius.sm,
  },
  barToday: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  barLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "500" },
  barLabelToday: { color: Colors.primary, fontWeight: "700" },
  barPct: { fontSize: 10, color: Colors.textSecondary },
  tooltip: {
    position: "absolute",
    top: -52,
    backgroundColor: Colors.text,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
    alignItems: "center",
    minWidth: 64,
  },
  tooltipText: { fontSize: 11, color: Colors.textInverse },
  tooltipPct: { fontSize: 13, fontWeight: "800", color: "#89f5e7" },
  legend: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: Colors.textMuted },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 120,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  label: { fontSize: 11, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 22, fontWeight: "800", color: Colors.text, marginTop: 2 },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});

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
    flexWrap: "wrap",
    gap: 10,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 22, fontWeight: "800", color: Colors.text },
  headerDate: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  headerBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
  scrollContentWide: { padding: 24, gap: 20 },

  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  statsRowWide: { flexWrap: "nowrap", gap: 16 },

  bentoRow: { gap: 16 },
  bentoRowWide: { flexDirection: "row", alignItems: "flex-start" },

  // Schedule card
  scheduleCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  scheduleCardWide: { flex: 3 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  cardDateLabel: { fontSize: 12, color: Colors.textMuted },

  emptySchedule: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyScheduleText: { fontSize: 14, color: Colors.textSecondary },
  emptyScheduleLink: { fontSize: 13, color: Colors.primary, fontWeight: "600" },

  timeline: { gap: 20 },
  slotGroup: { gap: 8 },
  slotHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  slotDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  timelineLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  slotLabel: { fontSize: 13, fontWeight: "700" },
  slotSublabel: { fontSize: 11, color: Colors.textMuted },

  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scheduleItemTaken: {
    opacity: 0.6,
  },
  medIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  scheduleItemInfo: { flex: 1 },
  scheduleItemName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  scheduleItemNameTaken: { textDecorationLine: "line-through", color: Colors.textMuted },
  scheduleItemSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  scheduleItemRight: { alignItems: "flex-end", gap: 6 },
  scheduleItemTime: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  takenBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#dcfce7",
    alignItems: "center", justifyContent: "center",
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    minWidth: 60,
    alignItems: "center",
  },
  confirmBtnText: { fontSize: 12, fontWeight: "700", color: Colors.textInverse },

  // Right column
  rightColumn: { gap: 16 },
  rightColumnWide: { flex: 2 },

  // AI card
  aiCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.xl,
    padding: 20,
    overflow: "hidden",
    position: "relative",
  },
  aiCardGlow: {
    position: "absolute",
    top: -20, right: -20,
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    opacity: 0.4,
  },
  aiCardContent: { gap: 12 },
  aiCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiCardTitle: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  aiCardBody: { fontSize: 13, color: "#cde8e3", lineHeight: 19 },
  aiCardBold: { fontWeight: "700", color: "#ffffff" },
  aiScoreBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: Radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "60",
  },
  aiScoreLabel: { fontSize: 10, color: "#89f5e7", textTransform: "uppercase", letterSpacing: 0.5 },
  aiScoreValue: { fontSize: 16, fontWeight: "800", color: "#ffffff", marginTop: 2 },
  aiCardBtn: {
    borderWidth: 1,
    borderColor: Colors.primary + "80",
    borderRadius: Radius.lg,
    paddingVertical: 8,
    alignItems: "center",
  },
  aiCardBtnText: { fontSize: 13, fontWeight: "700", color: "#89f5e7" },

  // Cabinet card
  cabinetCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cabinetEmpty: { fontSize: 13, color: Colors.textSecondary, paddingVertical: 8 },
  cabinetList: { gap: 12 },
  cabinetItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cabinetItemLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cabinetDot: { width: 8, height: 8, borderRadius: 4 },
  cabinetItemName: { fontSize: 14, color: Colors.text, flex: 1 },
  cabinetBadgeDanger: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  cabinetBadgeDangerText: { fontSize: 11, fontWeight: "600", color: Colors.danger },
  cabinetSkt: { fontSize: 12, color: Colors.textMuted },
  cabinetOk: { fontSize: 12, color: Colors.textMuted },
  cabinetMore: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  cabinetManageBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    alignItems: "center",
  },
  cabinetManageBtnText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  // Progress banner
  progressBanner: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
    flexWrap: "wrap",
    ...Shadows.sm,
  },
  progressBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressBannerTitle: { fontSize: 14, fontWeight: "700", color: Colors.text },
  progressBannerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  progressBarWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 120 },
  progressBarBg: {
    flex: 1, height: 8, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full, overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: Radius.full },
  progressPct: { fontSize: 13, fontWeight: "700", color: Colors.primary, minWidth: 36, textAlign: "right" },
});
