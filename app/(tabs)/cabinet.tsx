import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Colors, Shadows, Radius } from "../../constants/Colors";
import { Button, EmptyState, FrequencyPicker, MealTimingPicker } from "../../components/ui";
import { analyzeMedicineImage } from "../../services/anthropic";
import { getAllMedicines, addMedicine, deleteMedicine } from "../../services/database";
import { Medicine } from "../../types";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

type ExpiryStatus = "ok" | "soon" | "expired";

function getExpiryStatus(expiryDate?: string): ExpiryStatus {
  if (!expiryDate) return "ok";
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays < 30) return "soon";
  return "ok";
}

const STATUS_CONFIG: Record<ExpiryStatus, { label: string; color: string; bg: string; barColor: string }> = {
  ok:      { label: "Normal",  color: Colors.primary,  bg: Colors.primaryLight, barColor: Colors.primary },
  soon:    { label: "Yakın",   color: Colors.accent,   bg: Colors.accentLight,  barColor: Colors.accent  },
  expired: { label: "Geçmiş", color: Colors.danger,   bg: Colors.dangerLight,  barColor: Colors.danger  },
};

function quantityFill(qty: number): number {
  if (qty <= 0) return 0;
  if (qty >= 60) return 1;
  return Math.min(1, qty / 60);
}

interface FormState {
  name?: string;
  dosage?: string;
  frequency?: string;
  mealTiming?: string;
  purpose?: string;
  sideEffects?: string;
  description?: string;
  expiryDate?: string;
  quantity?: number;
  imageUri?: string;
}

const CARD_GAP = 12;
const CARD_PADDING = 16;

function getCardWidth(screenWidth: number): number {
  const numCols = screenWidth > 900 ? 4 : screenWidth > 600 ? 3 : 2;
  return (screenWidth - CARD_PADDING * 2 - CARD_GAP * (numCols - 1)) / numCols;
}

export default function CabinetScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = getCardWidth(screenWidth);

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [form, setForm] = useState<FormState>({});

  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();

  useFocusEffect(
    useCallback(() => {
      loadMedicines();
    }, [])
  );

  useEffect(() => {
    if (openAdd === "1") {
      setForm({});
      setAiFilledFields(new Set());
      setShowModal(true);
    }
  }, [openAdd]);

  async function loadMedicines() {
    try {
      const list = await getAllMedicines();
      setMedicines(list);
    } catch (e) {
      console.error(e);
    }
  }

  async function pickAndAnalyze(fromCamera: boolean) {
    let result: ImagePicker.ImagePickerResult;

    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("İzin Gerekli", "Kamera erişimi için lütfen izin verin.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.85 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.85 });
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setForm((f) => ({ ...f, imageUri: asset.uri }));
      setAiFilledFields(new Set());
      setAnalyzing(true);
      try {
        let base64 = asset.base64 ?? null;
        if (!base64) base64 = await uriToBase64(asset.uri);

        if (base64) {
          const mimeType = asset.mimeType ?? detectMimeType(base64);
          const info = await analyzeMedicineImage(base64, mimeType);

          const filled = new Set<string>();
          const updates: Partial<FormState> = {};

          if (info.name) { updates.name = info.name; filled.add("name"); }
          if (info.dosage) { updates.dosage = info.dosage; filled.add("dosage"); }
          if (info.frequency) { updates.frequency = info.frequency; filled.add("frequency"); }
          if (info.purpose) { updates.purpose = info.purpose; filled.add("purpose"); }
          if (info.sideEffects) { updates.sideEffects = info.sideEffects; filled.add("sideEffects"); }
          if (info.instructions) {
            updates.description = info.instructions; filled.add("description");
            const mt = parseMealTiming(info.instructions);
            if (mt) { updates.mealTiming = mt; filled.add("mealTiming"); }
          }
          if (info.expiryDate && info.expiryDate !== "null") { updates.expiryDate = info.expiryDate; filled.add("expiryDate"); }

          setForm((f) => ({ ...f, ...updates }));
          setAiFilledFields(filled);
        } else {
          Alert.alert("Hata", "Fotoğraf okunamadı, tekrar deneyin.");
        }
      } catch (e: any) {
        Alert.alert("Analiz Hatası", String(e?.message ?? e ?? "Bilinmeyen hata"));
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function saveMedicine() {
    if (!form.name?.trim()) { Alert.alert("Eksik Bilgi", "İlaç adı gereklidir."); return; }
    setSaving(true);
    try {
      const medicine: Medicine = {
        id: Date.now().toString(),
        name: form.name!,
        description: form.description,
        purpose: form.purpose,
        sideEffects: form.sideEffects,
        dosage: form.dosage,
        frequency: form.frequency,
        mealTiming: form.mealTiming,
        expiryDate: form.expiryDate,
        quantity: form.quantity ?? 0,
        imageUri: form.imageUri,
        addedAt: new Date().toISOString(),
      };
      await addMedicine(medicine);
      await loadMedicines();
      setShowModal(false);
      setForm({});
      setAiFilledFields(new Set());
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "İlaç kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("İlaç Sil", "Bu ilacı dolabından silmek istiyor musun?", [
      { text: "İptal", style: "cancel" },
      { text: "Sil", style: "destructive", onPress: async () => {
        try {
          await deleteMedicine(id);
          await loadMedicines();
          setSelectedMedicine(null);
        } catch (e: any) {
          Alert.alert("Hata", e?.message ?? "İlaç silinemedi.");
        }
      }},
    ]);
  }

  function closeModal() {
    setShowModal(false);
    setForm({});
    setAiFilledFields(new Set());
  }

  const filtered = medicines.filter((m) =>
    search.trim() === "" || m.name.toLowerCase().includes(search.toLowerCase())
  );
  const expiredCount = medicines.filter((m) => getExpiryStatus(m.expiryDate) === "expired").length;
  const soonCount = medicines.filter((m) => getExpiryStatus(m.expiryDate) === "soon").length;
  const nearestSkt = medicines
    .filter((m) => m.expiryDate && getExpiryStatus(m.expiryDate) !== "expired")
    .sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""))[0]?.expiryDate ?? null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>İlaç Dolabım</Text>
            <Text style={styles.headerSubtitle}>
              {medicines.length} ilaç kayıtlı
              {expiredCount > 0 ? ` · ${expiredCount} süresi dolmuş` : ""}
              {soonCount > 0 ? ` · ${soonCount} yakında bitecek` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setForm({}); setAiFilledFields(new Set()); setShowModal(true); }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="add" size={18} color={Colors.textInverse} />
            <Text style={styles.addBtnText}>Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="İlaç ara..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <MaterialIcons name="close" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{medicines.length}</Text>
          <Text style={styles.statLabel}>Toplam İlaç</Text>
        </View>
        <View style={[styles.statBox, styles.statDivider]}>
          <Text style={[styles.statValue, expiredCount > 0 && { color: Colors.danger }]}>{expiredCount}</Text>
          <Text style={styles.statLabel}>Süresi Dolmuş</Text>
        </View>
        <View style={[styles.statBox, styles.statDivider]}>
          <Text style={[styles.statValue, soonCount > 0 && { color: Colors.accent }]}>{soonCount}</Text>
          <Text style={styles.statLabel}>Yakında Bitecek</Text>
        </View>
        <View style={[styles.statBox, styles.statDivider]}>
          <Text style={[styles.statValue, { fontSize: 13 }]}>{nearestSkt ?? "—"}</Text>
          <Text style={styles.statLabel}>En Yakın SKT</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<MaterialIcons name="medical-services" size={36} color={Colors.textMuted} />}
            title={search ? "Sonuç Bulunamadı" : "Dolabın Boş"}
            description={search ? `"${search}" ile eşleşen ilaç yok.` : "İlaç fotoğrafı çekerek AI ile otomatik doldurun veya manuel ekleyin."}
            action={search ? undefined : { label: "İlk İlacı Ekle", onPress: () => setShowModal(true) }}
          />
        ) : (
          <>
            {/* Card Grid */}
            <View style={styles.grid}>
              {filtered.map((med) => {
                const status = getExpiryStatus(med.expiryDate);
                const cfg = STATUS_CONFIG[status];
                const fill = quantityFill(med.quantity ?? 0);

                return (
                  <TouchableOpacity
                    key={med.id}
                    style={[styles.card, { width: cardWidth }]}
                    onPress={() => setSelectedMedicine(med)}
                    activeOpacity={0.88}
                  >
                    {/* Image area */}
                    <View style={styles.cardImg}>
                      {med.imageUri ? (
                        <Image source={{ uri: med.imageUri }} style={styles.cardImgFill} resizeMode="cover" />
                      ) : (
                        <View style={styles.cardImgPlaceholder}>
                          <MaterialIcons name="medication" size={32} color={Colors.primary} />
                        </View>
                      )}
                      {/* Status badge */}
                      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
                      </View>
                    </View>

                    {/* Content */}
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={2}>{med.name}</Text>
                      {(med.dosage || med.frequency) && (
                        <Text style={styles.cardMeta} numberOfLines={1}>
                          {[med.dosage, med.frequency].filter(Boolean).join(" · ")}
                        </Text>
                      )}

                      {/* Quantity */}
                      <View style={styles.qtySection}>
                        <View style={styles.qtyRow}>
                          <Text style={styles.qtyLabel}>Kalan</Text>
                          <Text style={[styles.qtyValue, { color: cfg.barColor }]}>
                            {med.quantity ? `${med.quantity} adet` : "—"}
                          </Text>
                        </View>
                        <View style={styles.progressBg}>
                          <View style={[styles.progressFill, { width: `${Math.round(fill * 100)}%`, backgroundColor: cfg.barColor }]} />
                        </View>
                      </View>

                      {/* Footer */}
                      <View style={styles.cardFooter}>
                        <Text style={styles.sktText}>
                          {med.expiryDate ? `SKT: ${med.expiryDate}` : "SKT: —"}
                        </Text>
                        <TouchableOpacity onPress={() => setSelectedMedicine(med)}>
                          <Text style={styles.detailLink}>Detay</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Detailed list table */}
            <View style={styles.tableSection}>
              <View style={styles.tableSectionHeader}>
                <Text style={styles.tableSectionTitle}>Detaylı Stok Listesi</Text>
              </View>
              {filtered.map((med) => {
                const status = getExpiryStatus(med.expiryDate);
                const cfg = STATUS_CONFIG[status];
                return (
                  <TouchableOpacity key={med.id + "_row"} style={styles.tableRow} onPress={() => setSelectedMedicine(med)} activeOpacity={0.7}>
                    <View style={[styles.tableIconWrap, { backgroundColor: cfg.bg }]}>
                      <MaterialIcons name="medication" size={20} color={cfg.color} />
                    </View>
                    <View style={styles.tableInfo}>
                      <Text style={styles.tableRowName} numberOfLines={1}>{med.name}</Text>
                      {med.dosage && <Text style={styles.tableRowMeta} numberOfLines={1}>{med.dosage}</Text>}
                    </View>
                    <View style={[styles.tableStatusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.tableStatusText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.tableSkt}>{med.expiryDate ?? "—"}</Text>
                    <MaterialIcons name="more-vert" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>İlaç Ekle</Text>
            <TouchableOpacity onPress={closeModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Photo picker */}
              <View style={styles.photoSection}>
                {form.imageUri ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: form.imageUri }} style={styles.photoPreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.changePhotoBtn} onPress={() => pickAndAnalyze(false)}>
                      <Ionicons name="camera-reverse" size={16} color={Colors.textInverse} />
                      <Text style={styles.changePhotoText}>Değiştir</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoPickerArea}>
                    <View style={styles.photoPickerIcon}>
                      <MaterialIcons name="photo-camera" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.photoPickerTitle}>İlaç Fotoğrafı Çek</Text>
                    <Text style={styles.photoPickerSubtitle}>AI tüm bilgileri otomatik dolduracak</Text>
                    <View style={styles.photoPickerBtns}>
                      <Button title="Kamera" onPress={() => pickAndAnalyze(true)} variant="primary" size="md" icon={<MaterialIcons name="photo-camera" size={16} color={Colors.textInverse} />} style={styles.photoBtn} />
                      <Button title="Galeri" onPress={() => pickAndAnalyze(false)} variant="outline" size="md" icon={<MaterialIcons name="photo-library" size={16} color={Colors.primary} />} style={styles.photoBtn} />
                    </View>
                  </View>
                )}
              </View>

              {/* Analyzing */}
              {analyzing && (
                <View style={styles.analyzingCard}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.analyzingTitle}>AI İlaç Analiz Ediyor</Text>
                  <Text style={styles.analyzingSubtitle}>İlaç adı, dozu, kullanım bilgileri ve yan etkiler otomatik doldurulacak...</Text>
                </View>
              )}

              {/* AI fill banner */}
              {!analyzing && aiFilledFields.size > 0 && (
                <View style={styles.aiFillBanner}>
                  <View style={styles.aiFillIconWrap}>
                    <Ionicons name="sparkles" size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.aiFillText}>AI {aiFilledFields.size} alan doldurdu. İstersen düzenleyebilirsin.</Text>
                </View>
              )}

              {/* Form */}
              <View style={styles.formSection}>
                <AiFormField label="İlaç Adı *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Örn: Parol 500mg Tablet" aiFilledFields={aiFilledFields} fieldKey="name" disabled={analyzing} />
                <AiFormField label="Doz" value={form.dosage} onChange={(v) => setForm((f) => ({ ...f, dosage: v }))} placeholder="Örn: Yetişkin 1-2 tablet" aiFilledFields={aiFilledFields} fieldKey="dosage" disabled={analyzing} />
                <FrequencyPicker value={form.frequency ?? ""} onChange={(v) => setForm((f) => ({ ...f, frequency: v }))} />
                <MealTimingPicker value={form.mealTiming ?? ""} onChange={(v) => setForm((f) => ({ ...f, mealTiming: v }))} />
                <AiFormField label="Ne İçin Kullanılır" value={form.purpose} onChange={(v) => setForm((f) => ({ ...f, purpose: v }))} placeholder="Hastalık ve belirtiler..." multiline aiFilledFields={aiFilledFields} fieldKey="purpose" disabled={analyzing} />
                <AiFormField label="Kullanım Talimatları" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Tok/aç karnına, su ile vs..." multiline aiFilledFields={aiFilledFields} fieldKey="description" disabled={analyzing} />
                <AiFormField label="Yan Etkiler" value={form.sideEffects} onChange={(v) => setForm((f) => ({ ...f, sideEffects: v }))} placeholder="Olası yan etkiler..." multiline aiFilledFields={aiFilledFields} fieldKey="sideEffects" disabled={analyzing} />
                <AiFormField label="Son Kullanma Tarihi" value={form.expiryDate} onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))} placeholder="YYYY-MM" aiFilledFields={aiFilledFields} fieldKey="expiryDate" disabled={analyzing} />
                <AiFormField label="Adet" value={form.quantity?.toString()} onChange={(v) => setForm((f) => ({ ...f, quantity: parseInt(v) || 0 }))} placeholder="0" keyboardType="numeric" aiFilledFields={aiFilledFields} fieldKey="quantity" disabled={analyzing} />
              </View>

              <Button title="Dolaba Ekle" onPress={saveMedicine} variant="primary" fullWidth loading={saving} disabled={analyzing} size="lg" style={{ marginTop: 8, marginBottom: 8 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selectedMedicine} animationType="slide" presentationStyle="pageSheet">
        {selectedMedicine && (
          <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedMedicine.name}</Text>
              <TouchableOpacity onPress={() => setSelectedMedicine(null)}>
                <MaterialIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {selectedMedicine.imageUri && (
                <Image source={{ uri: selectedMedicine.imageUri }} style={styles.detailImage} resizeMode="cover" />
              )}
              <DetailRow label="Doz" value={selectedMedicine.dosage} />
              <DetailRow label="Sıklık" value={selectedMedicine.frequency} />
              <DetailRow label="Kullanım Zamanı" value={mealTimingLabel(selectedMedicine.mealTiming)} />
              <DetailRow label="Ne İçin" value={selectedMedicine.purpose} />
              <DetailRow label="Kullanım Talimatları" value={selectedMedicine.description} />
              <DetailRow label="Yan Etkiler" value={selectedMedicine.sideEffects} warn />
              <DetailRow label="Son Kullanma Tarihi" value={selectedMedicine.expiryDate} />
              {selectedMedicine.quantity !== undefined && selectedMedicine.quantity > 0 && (
                <DetailRow label="Adet" value={`${selectedMedicine.quantity} adet`} />
              )}
              <Button title="İlacı Sil" onPress={() => handleDelete(selectedMedicine.id)} variant="danger" fullWidth style={{ marginTop: 24 }} icon={<MaterialIcons name="delete" size={16} color={Colors.textInverse} />} />
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function AiFormField({
  label, value, onChange, placeholder, multiline, keyboardType,
  aiFilledFields, fieldKey, disabled,
}: {
  label: string; value?: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any;
  aiFilledFields: Set<string>; fieldKey: string; disabled?: boolean;
}) {
  const isAiFilled = aiFilledFields.has(fieldKey);
  return (
    <View style={styles.formField}>
      <View style={styles.formLabelRow}>
        <Text style={styles.formLabel}>{label}</Text>
        {isAiFilled && (
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={10} color={Colors.primary} />
            <Text style={styles.aiBadgeText}>AI doldurdu</Text>
          </View>
        )}
      </View>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMulti, isAiFilled && styles.formInputAiFilled, disabled && styles.formInputDisabled]}
        value={value ?? ""}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
        editable={!disabled}
      />
    </View>
  );
}

function DetailRow({ label, value, warn }: { label: string; value?: string; warn?: boolean }) {
  if (!value) return null;
  return (
    <View style={[styles.detailRow, warn && styles.detailRowWarn]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, warn && styles.detailValueWarn]}>{value}</Text>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function detectMimeType(base64: string): string {
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("R0lGOD")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

async function uriToBase64(uri: string): Promise<string | null> {
  try {
    if (uri.startsWith("data:")) return uri.split(",")[1] ?? null;
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? null);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function parseMealTiming(text: string): "ac" | "tok" | "farketmez" | null {
  const lower = text.toLowerCase();
  if (lower.includes("aç karn") || lower.includes("ac karn") || lower.includes("yemekten önce")) return "ac";
  if (lower.includes("tok karn") || lower.includes("yemekle") || lower.includes("yemekten sonra") || lower.includes("yemeklerle")) return "tok";
  if (lower.includes("farketmez") || lower.includes("fark etmez")) return "farketmez";
  return null;
}

function mealTimingLabel(value?: string): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = { ac: "🌙 Aç Karnına", tok: "🍽️ Tok Karnına", farketmez: "✓ Farketmez" };
  return map[value] ?? value;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: Colors.textInverse },

  searchRow: { paddingHorizontal: 16 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  scroll: { flex: 1 },
  scrollContent: { padding: CARD_PADDING, paddingBottom: 40, gap: 20 },

  // Stats row
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: "center",
    fontWeight: "500",
  },

  // Card grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  cardImg: {
    height: 140,
    backgroundColor: Colors.surfaceAlt,
    position: "relative",
  },
  cardImgFill: { width: "100%", height: "100%" },
  cardImgPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryLight,
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },

  cardBody: { padding: 12, gap: 6 },
  cardName: { fontSize: 13, fontWeight: "700", color: Colors.text, lineHeight: 18 },
  cardMeta: { fontSize: 11, color: Colors.textSecondary },

  qtySection: { gap: 4, marginTop: 2 },
  qtyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qtyLabel: { fontSize: 11, color: Colors.textMuted },
  qtyValue: { fontSize: 12, fontWeight: "700" },
  progressBg: {
    height: 5,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: Radius.full },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  sktText: { fontSize: 10, color: Colors.textMuted },
  detailLink: { fontSize: 11, color: Colors.primary, fontWeight: "700" },

  // Table section
  tableSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    ...Shadows.sm,
  },
  tableSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableSectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.text },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tableIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tableInfo: { flex: 1, gap: 2 },
  tableRowName: { fontSize: 13, fontWeight: "600", color: Colors.text },
  tableRowMeta: { fontSize: 11, color: Colors.textMuted },
  tableStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tableStatusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  tableSkt: { fontSize: 11, color: Colors.textSecondary, minWidth: 56, textAlign: "right" },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text, flex: 1, marginRight: 12 },
  modalContent: { padding: 20, paddingBottom: 32, gap: 12 },

  photoSection: { marginBottom: 4 },
  photoPickerArea: {
    borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed",
    borderRadius: Radius.xl, padding: 28, alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
  },
  photoPickerIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  photoPickerTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  photoPickerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, textAlign: "center" },
  photoPickerBtns: { flexDirection: "row", gap: 10 },
  photoBtn: { flex: 1 },
  photoPreviewWrap: { position: "relative" },
  photoPreview: { width: "100%", height: 180, borderRadius: Radius.lg },
  changePhotoBtn: {
    position: "absolute", bottom: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
  },
  changePhotoText: { fontSize: 12, color: Colors.textInverse, fontWeight: "600" },

  analyzingCard: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    padding: 24, alignItems: "center",
    borderWidth: 1, borderColor: Colors.primary + "40", gap: 8,
  },
  analyzingTitle: { fontSize: 15, fontWeight: "700", color: Colors.primaryDark },
  analyzingSubtitle: { fontSize: 13, color: Colors.primaryDark, textAlign: "center", opacity: 0.8 },

  aiFillBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.secondaryLight, padding: 12,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.secondary + "30",
  },
  aiFillIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  aiFillText: { fontSize: 13, color: Colors.primaryDark, fontWeight: "500", flex: 1 },

  formSection: { gap: 12 },
  formField: { gap: 5 },
  formLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  formLabel: { fontSize: 13, fontWeight: "600", color: Colors.text },
  aiBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: Radius.full,
  },
  aiBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: "600" },
  formInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.background,
  },
  formInputMulti: { minHeight: 80, textAlignVertical: "top", paddingTop: 10 },
  formInputAiFilled: { borderColor: Colors.primary + "60", backgroundColor: Colors.primaryLight + "80" },
  formInputDisabled: { opacity: 0.6 },

  detailImage: { width: "100%", height: 180, borderRadius: Radius.lg, marginBottom: 8 },
  detailRow: { backgroundColor: Colors.surfaceAlt, padding: 12, borderRadius: Radius.md, gap: 4, marginBottom: 4 },
  detailRowWarn: { backgroundColor: Colors.warningLight },
  detailLabel: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  detailValueWarn: { color: Colors.accent },
});
