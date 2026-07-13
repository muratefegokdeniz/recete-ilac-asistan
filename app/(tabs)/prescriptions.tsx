import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Colors, Radius, Shadows } from "../../constants/Colors";
import { Card, Button, Badge, SectionHeader, EmptyState, ConfirmModal, TimePickerField } from "../../components/ui";
import { analyzePrescription, analyzePrescriptionText, getMedicineInfoByName } from "../../services/anthropic";
import { getAllPrescriptions, savePrescription, deletePrescription, addActiveMedicine } from "../../services/database";
import { uploadUserImage, getSignedImageUrl, deleteUserImage } from "../../services/storage";
import { SavedPrescription, PrescriptionAnalysis, PrescriptionMedicine, ActiveMedicine } from "../../types";
import { useTutorial } from "../../context/TutorialContext";

const SAMPLE_TUTORIAL_MEDICINE: PrescriptionMedicine = {
  name: "Amoksisilin 500mg Kapsül",
  dosage: "1 kapsül",
  frequency: "Günde 3 kez",
  duration: "7 gün",
  instructions: "Aç karnına, bol suyla",
  purpose: "Bakteriyel enfeksiyonları tedavi etmek için kullanılır.",
  sideEffects: "Mide bulantısı, ishal görülebilir.",
};

const AVATAR_COLORS = ["#00685f", "#008378", "#0a9186", "#2eada3", "#49bcb2", "#6fccc3", "#924628"];

export default function PrescriptionScreen() {
  const [prescriptions, setPrescriptions] = useState<SavedPrescription[]>([]);
  const [selected, setSelected] = useState<SavedPrescription | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [medImages, setMedImages] = useState<Record<string, string | null>>({});
  const [prescImageUrls, setPrescImageUrls] = useState<Record<string, string | null>>({});

  const [addingToActive, setAddingToActive] = useState(false);
  const [addedToActive, setAddedToActive] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<PrescriptionAnalysis | null>(null);
  const [medicineTimings, setMedicineTimings] = useState<{ name: string; frequency: string; firstTime: string }[]>([]);

  const [correctingMed, setCorrectingMed] = useState<{ prescId: string; medIdx: number } | null>(null);
  const [correctName, setCorrectName] = useState("");
  const [correctLoading, setCorrectLoading] = useState(false);

  // Scanner state
  const [scannerTab, setScannerTab] = useState<"photo" | "manual">("photo");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [analysis, setAnalysis] = useState<PrescriptionAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual entry state
  const [manualDoctor, setManualDoctor] = useState("");
  const [manualPatient, setManualPatient] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualMeds, setManualMeds] = useState("");

  const { openScanner: openScannerParam } = useLocalSearchParams<{ openScanner?: string }>();
  const tutorial = useTutorial();
  const addBtnRef = useRef<View>(null);
  const isTutorialAnalysisStep = tutorial.active && tutorial.currentStep?.id === "prescriptions-analysis";

  useFocusEffect(
    useCallback(() => {
      loadPrescriptions();
    }, [])
  );

  useEffect(() => {
    if (!(tutorial.active && tutorial.currentStep?.targetId === "prescriptionsAdd")) return;
    const t = setTimeout(() => {
      addBtnRef.current?.measureInWindow((x, y, width, height) => {
        tutorial.reportHighlightTarget("prescriptionsAdd", { x, y, width, height });
      });
    }, 150);
    return () => clearTimeout(t);
  }, [tutorial.active, tutorial.stepIndex]);

  useEffect(() => {
    if (openScannerParam === "1") {
      openScanner();
    }
  }, [openScannerParam]);

  async function loadPrescriptions() {
    const list = await getAllPrescriptions();
    setPrescriptions(list);
    // İmzalı URL'lerin süresi doluyor — her odaklanmada tazeden üretiyoruz.
    const withPhoto = list.filter((p) => p.imageUri);
    if (withPhoto.length === 0) return;
    const entries = await Promise.all(
      withPhoto.map(async (p) => [p.id, await getSignedImageUrl(p.imageUri!)] as const)
    );
    setPrescImageUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }

  function openScanner() {
    setImageUri(null);
    setAnalysis(null);
    setErrorMsg(null);
    setAddedToActive(false);
    setScannerTab("photo");
    setManualDoctor("");
    setManualPatient("");
    setManualDate("");
    setManualMeds("");
    setShowScanner(true);
    if (tutorial.active && tutorial.currentStep?.id === "prescriptions-intro") {
      tutorial.next();
    }
  }

  async function handleManualAnalyze() {
    if (!manualMeds.trim()) {
      Alert.alert("Eksik Bilgi", "En az ilaç adlarını yazmalısınız.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setAnalysis(null);
    try {
      const lines: string[] = [];
      if (manualDoctor.trim()) lines.push(`Doktor: ${manualDoctor.trim()}`);
      if (manualPatient.trim()) lines.push(`Hasta: ${manualPatient.trim()}`);
      if (manualDate.trim()) lines.push(`Tarih: ${manualDate.trim()}`);
      lines.push(`\nİlaçlar:\n${manualMeds.trim()}`);
      const result = await analyzePrescriptionText(lines.join("\n"));
      setAnalysis(result);
      const saved: SavedPrescription = {
        id: Date.now().toString(),
        analysis: result,
        savedAt: new Date().toISOString(),
      };
      await savePrescription(saved);
      await loadPrescriptions();
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Analiz sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  function openTimeModal(a: PrescriptionAnalysis) {
    setPendingAnalysis(a);
    setMedicineTimings(
      a.medicines.map((m) => ({
        name: m.name,
        frequency: m.frequency ?? "Günde 1 kez",
        firstTime: "08:00",
      }))
    );
    setShowTimeModal(true);
  }

  async function confirmAddToActive() {
    if (!pendingAnalysis) return;
    setAddingToActive(true);
    try {
      for (let i = 0; i < pendingAnalysis.medicines.length; i++) {
        const med = pendingAnalysis.medicines[i];
        const timing = medicineTimings[i];
        const reminderTimes = calcReminderTimes(timing.firstTime, timing.frequency);
        const active: ActiveMedicine = {
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
          medicineId: "",
          medicineName: med.name,
          dosage: med.dosage ?? "Belirtilmedi",
          frequency: timing.frequency,
          startDate: new Date().toISOString().split("T")[0],
          reminderTimes,
          notes: med.instructions ?? undefined,
          takenDoses: [],
        };
        await addActiveMedicine(active);
      }
      setAddedToActive(true);
      setShowTimeModal(false);
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "Eklenemedi.");
    } finally {
      setAddingToActive(false);
    }
  }

  async function pickImage(fromCamera: boolean) {
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
      setImageUri(asset.uri);
      setAnalysis(null);
      setErrorMsg(null);

      let base64 = asset.base64 ?? null;
      if (!base64) base64 = await uriToBase64(asset.uri);

      if (base64) {
        const mimeType = asset.mimeType ?? detectMimeType(base64);
        analyzeImage(base64, mimeType, asset.uri);
      } else {
        setErrorMsg("Fotoğraf okunamadı. Lütfen tekrar deneyin.");
      }
    }
  }

  async function analyzeImage(base64: string, mimeType: string, uri: string) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await analyzePrescription(base64, mimeType);
      setAnalysis(result);

      // Fotoğrafı kalıcı depolamaya (Supabase Storage) yükle — cihazın geçici
      // dosya yolu bir süre sonra geçersiz kaldığı için doğrudan onu kaydetmiyoruz.
      let storedImagePath: string | undefined;
      try {
        storedImagePath = await uploadUserImage(uri, "prescriptions");
      } catch (uploadErr) {
        console.warn("Reçete fotoğrafı depolanamadı, sadece analiz kaydediliyor:", uploadErr);
      }

      // Otomatik kaydet
      const saved: SavedPrescription = {
        id: Date.now().toString(),
        imageUri: storedImagePath,
        analysis: result,
        savedAt: new Date().toISOString(),
      };
      await savePrescription(saved);
      await loadPrescriptions();
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Reçete analiz edilirken bir hata oluştu.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    setDeleteConfirmId(id);
  }

  async function confirmDelete() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const toDelete = prescriptions.find((p) => p.id === deleteConfirmId);
      await deletePrescription(deleteConfirmId);
      if (toDelete?.imageUri) deleteUserImage(toDelete.imageUri).catch(() => {});
      setDeleteConfirmId(null);
      setSelected(null);
      await loadPrescriptions();
    } catch (e: any) {
      setDeleteConfirmId(null);
      Alert.alert("Hata", e?.message ?? "Reçete silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  async function correctMedicineName() {
    if (!correctingMed || !correctName.trim()) return;
    setCorrectLoading(true);
    try {
      const newInfo = await getMedicineInfoByName(correctName.trim());
      setPrescriptions((prev) =>
        prev.map((p) => {
          if (p.id !== correctingMed.prescId) return p;
          const updatedMeds = p.analysis.medicines.map((m, idx) =>
            idx === correctingMed.medIdx ? { ...m, ...newInfo, name: newInfo.name || correctName.trim() } : m
          );
          const updated = { ...p, analysis: { ...p.analysis, medicines: updatedMeds } };
          savePrescription(updated);
          return updated;
        })
      );
      setCorrectingMed(null);
      setCorrectName("");
    } catch {
      Alert.alert("Hata", "İlaç bilgisi alınamadı.");
    } finally {
      setCorrectLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Reçetelerim</Text>
          <Text style={styles.headerSubtitle}>{prescriptions.length} reçete kayıtlı</Text>
        </View>
        <View ref={addBtnRef} collapsable={false}>
          <Button
            title="Ekle"
            onPress={openScanner}
            variant="primary"
            size="sm"
            icon={<Ionicons name="camera" size={16} color="white" />}
          />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {prescriptions.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="document-text-outline" size={36} color={Colors.textMuted} />}
            title="Henüz Reçete Yok"
            description="Reçetenizi fotoğraflayın, AI ilaçları analiz etsin."
            action={{ label: "Reçete Ekle", onPress: openScanner }}
          />
        ) : (
          prescriptions.map((p) => {
            const isExpanded = expandedId === p.id;
            return (
              <Card key={p.id} style={styles.prescCard} onPress={() => setSelected(p)}>
                <View style={styles.prescRow}>
                  {prescImageUrls[p.id] ? (
                    <Image source={{ uri: prescImageUrls[p.id]! }} style={styles.prescThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.prescThumb, styles.prescThumbPlaceholder]}>
                      <Ionicons name="document-text" size={24} color={Colors.primary} />
                    </View>
                  )}
                  <View style={styles.prescInfo}>
                    <Text style={styles.prescDate}>{formatDate(p.savedAt)}</Text>
                    {p.analysis.doctorName && (
                      <Text style={styles.prescDoctor}>Dr. {p.analysis.doctorName}</Text>
                    )}
                    <Text style={styles.prescMedCount}>
                      {p.analysis.medicines.length} ilaç
                    </Text>
                    <View style={styles.prescMedNames}>
                      {p.analysis.medicines.slice(0, 3).map((m, i) => (
                        <View key={i} style={styles.medNameChip}>
                          <Text style={styles.medNameChipText}>{m.name}</Text>
                        </View>
                      ))}
                      {p.analysis.medicines.length > 3 && (
                        <Text style={styles.moreText}>+{p.analysis.medicines.length - 3} daha</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!isExpanded) {
                        p.analysis.medicines.forEach((m) => {
                          if (!(m.name in medImages)) {
                            fetchMedicineImage(m.name).then((url) =>
                              setMedImages((prev) => ({ ...prev, [m.name]: url }))
                            );
                          }
                        });
                      }
                      setExpandedId(isExpanded ? null : p.id);
                    }}
                    style={styles.expandBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={Colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                {isExpanded && (
                  <View style={styles.expandedMeds}>
                    {p.analysis.medicines.map((m, i) => (
                      <View key={i} style={styles.expandedMedRow}>
                        {medImages[m.name] ? (
                          <Image source={{ uri: medImages[m.name]! }} style={styles.expandedMedAvatar} resizeMode="cover" />
                        ) : (
                          <View style={[styles.expandedMedAvatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] + "22", alignItems: "center", justifyContent: "center" }]}>
                            <Text style={[styles.expandedMedAvatarText, { color: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                              {m.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.expandedMedInfo}>
                          {correctingMed?.prescId === p.id && correctingMed?.medIdx === i ? (
                            <View style={styles.correctRow}>
                              <TextInput
                                style={styles.correctInput}
                                value={correctName}
                                onChangeText={setCorrectName}
                                placeholder="Doğru ilaç adı..."
                                placeholderTextColor={Colors.textMuted}
                                autoFocus
                              />
                              <TouchableOpacity
                                onPress={correctMedicineName}
                                disabled={correctLoading}
                                style={styles.correctConfirmBtn}
                              >
                                {correctLoading
                                  ? <ActivityIndicator size="small" color={Colors.textInverse} />
                                  : <Text style={styles.correctConfirmText}>Onayla</Text>}
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => { setCorrectingMed(null); setCorrectName(""); }}
                                style={styles.correctCancelBtn}
                              >
                                <Text style={styles.correctCancelText}>İptal</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={styles.expandedMedNameRow}>
                              <Text style={styles.expandedMedName}>{m.name}</Text>
                              <TouchableOpacity
                                onPress={() => { setCorrectingMed({ prescId: p.id, medIdx: i }); setCorrectName(m.name); }}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                <Text style={styles.correctLink}>Düzelt?</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          <View style={styles.expandedMedMeta}>
                            {m.dosage && <Text style={styles.expandedMedDetail}>{m.dosage}</Text>}
                            {m.frequency && <Text style={styles.expandedMedDetail}>{m.frequency}</Text>}
                            {m.duration && <Text style={styles.expandedMedDetail}>{m.duration}</Text>}
                          </View>
                          {m.instructions && (
                            <View style={styles.expandedInstructionRow}>
                              <Ionicons name="restaurant-outline" size={13} color={Colors.secondary} />
                              <Text style={styles.expandedMedInstruction}>{m.instructions}</Text>
                            </View>
                          )}
                          {m.sideEffects && (
                            <View style={styles.expandedSideEffect}>
                              <Ionicons name="warning-outline" size={13} color={Colors.warning} />
                              <Text style={styles.expandedSideEffectText}>{m.sideEffects}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Scanner Modal */}
      <Modal visible={showScanner} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reçete Ekle</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {isTutorialAnalysisStep && (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.tutorialIntroCard}>
                <Ionicons name="sparkles" size={22} color={Colors.primary} />
                <Text style={styles.tutorialIntroTitle}>AI Reçete Analizi</Text>
                <Text style={styles.tutorialIntroBody}>
                  Reçeteni fotoğrafladığında ya da elle girdiğinde, yapay zeka ilaç adını, dozunu, kullanım sıklığını, kullanım şeklini ve yan etkilerini otomatik olarak çıkarır. Örnek bir sonuç şöyle görünür:
                </Text>
              </View>
              <MedicineCard med={SAMPLE_TUTORIAL_MEDICINE} />
              <TouchableOpacity
                style={styles.tutorialContinueBtn}
                onPress={() => { tutorial.next(); setShowScanner(false); }}
                activeOpacity={0.85}
              >
                <Text style={styles.tutorialContinueBtnText}>Devam Et</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Tab switcher */}
          {!analysis && !isTutorialAnalysisStep && (
            <View style={styles.scannerTabBar}>
              <TouchableOpacity
                style={[styles.scannerTab, scannerTab === "photo" && styles.scannerTabActive]}
                onPress={() => { setScannerTab("photo"); setAnalysis(null); setErrorMsg(null); setImageUri(null); }}
              >
                <Ionicons name="camera" size={16} color={scannerTab === "photo" ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.scannerTabText, scannerTab === "photo" && styles.scannerTabTextActive]}>
                  Fotoğraf
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scannerTab, scannerTab === "manual" && styles.scannerTabActive]}
                onPress={() => { setScannerTab("manual"); setAnalysis(null); setErrorMsg(null); setImageUri(null); }}
              >
                <Ionicons name="create" size={16} color={scannerTab === "manual" ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.scannerTabText, scannerTab === "manual" && styles.scannerTabTextActive]}>
                  Manuel Giriş
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!isTutorialAnalysisStep && (
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── PHOTO TAB ── */}
            {scannerTab === "photo" && (
              <>
                {!imageUri ? (
                  <View style={styles.uploadArea}>
                    <View style={styles.uploadIconCircle}>
                      <Ionicons name="camera" size={40} color={Colors.primary} />
                    </View>
                    <Text style={styles.uploadTitle}>Reçetenizi Ekleyin</Text>
                    <Text style={styles.uploadDescription}>
                      Reçetenizi fotoğraflayın veya galeriden seçin. AI tüm ilaçları otomatik analiz edecek.
                    </Text>
                    <View style={styles.uploadButtons}>
                      <Button title="Fotoğraf Çek" onPress={() => pickImage(true)} variant="primary"
                        icon={<Ionicons name="camera" size={16} color="white" />} size="lg" style={{ width: "100%" }} />
                      <Button title="Galeriden Seç" onPress={() => pickImage(false)} variant="outline"
                        icon={<Ionicons name="images" size={16} color={Colors.primary} />} size="lg" style={{ width: "100%" }} />
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
                      {!loading && !analysis && (
                        <TouchableOpacity style={styles.changePhoto} onPress={() => { setImageUri(null); setErrorMsg(null); }}>
                          <Ionicons name="close-circle" size={28} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {loading && (
                      <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.loadingText}>Reçete analiz ediliyor...</Text>
                        <Text style={styles.loadingSubtext}>Bu birkaç saniye sürebilir</Text>
                      </View>
                    )}
                    {errorMsg && !loading && (
                      <View style={styles.errorCard}>
                        <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                      </View>
                    )}
                    {analysis && !loading && <AnalysisResult analysis={analysis} onClose={() => setShowScanner(false)} addedToActive={addedToActive} onAddToActive={() => openTimeModal(analysis)} />}
                  </View>
                )}
              </>
            )}

            {/* ── MANUAL TAB ── */}
            {scannerTab === "manual" && !analysis && (
              <View style={styles.manualForm}>
                <View style={styles.manualInfoBox}>
                  <Ionicons name="information-circle" size={16} color={Colors.primary} />
                  <Text style={styles.manualInfoText}>
                    İlaç adlarını yazın, AI doz, kullanım ve yan etki bilgilerini otomatik tamamlayacak.
                  </Text>
                </View>

                <View style={styles.manualRow}>
                  <View style={styles.manualField}>
                    <Text style={styles.manualLabel}>Doktor Adı</Text>
                    <TextInput style={styles.manualInput} value={manualDoctor} onChangeText={setManualDoctor}
                      placeholder="Dr. Ahmet Yılmaz" placeholderTextColor={Colors.textMuted} />
                  </View>
                  <View style={styles.manualField}>
                    <Text style={styles.manualLabel}>Hasta Adı</Text>
                    <TextInput style={styles.manualInput} value={manualPatient} onChangeText={setManualPatient}
                      placeholder="Ad Soyad" placeholderTextColor={Colors.textMuted} />
                  </View>
                </View>

                <View style={styles.manualField}>
                  <Text style={styles.manualLabel}>Reçete Tarihi</Text>
                  <TextInput style={styles.manualInput} value={manualDate} onChangeText={setManualDate}
                    placeholder="26.04.2025" placeholderTextColor={Colors.textMuted} />
                </View>

                <View style={styles.manualField}>
                  <Text style={styles.manualLabel}>İlaçlar *</Text>
                  <Text style={styles.manualHint}>
                    Her satıra bir ilaç yazın. Doz ve süre bilgisi ekleyebilirsiniz.
                  </Text>
                  <TextInput
                    style={styles.manualMedsInput}
                    value={manualMeds}
                    onChangeText={setManualMeds}
                    placeholder={"Amoksisilin 500mg, günde 3 kez, 7 gün\nParol 500mg\nVitamin D3 1000 IU"}
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </View>

                {errorMsg && (
                  <View style={styles.errorCard}>
                    <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.analyzeBtn, loading && { opacity: 0.6 }]}
                  onPress={handleManualAnalyze}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator size="small" color={Colors.textInverse} />
                      <Text style={styles.analyzeBtnText}>AI Analiz Ediyor...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color={Colors.textInverse} />
                      <Text style={styles.analyzeBtnText}>AI ile Analiz Et</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Shared analysis result (manual tab after analysis) */}
            {scannerTab === "manual" && analysis && !loading && (
              <AnalysisResult analysis={analysis} onClose={() => setShowScanner(false)} addedToActive={addedToActive} onAddToActive={() => openTimeModal(analysis)} />
            )}

          </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimeModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Hatırlatma Saatlerini Gir</Text>
            <TouchableOpacity onPress={() => setShowTimeModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.timeModalDesc}>
              Her ilaç için ilk alım saatini gir. Diğer saatler sıklığa göre otomatik hesaplanacak.
            </Text>
            {medicineTimings.map((mt, i) => {
              const times = calcReminderTimes(mt.firstTime, mt.frequency);
              return (
                <View key={i} style={styles.timingRow}>
                  <View style={styles.timingMedInfo}>
                    <Text style={styles.timingMedName} numberOfLines={1}>{mt.name}</Text>
                    <Text style={styles.timingFreq}>{mt.frequency}</Text>
                  </View>
                  <View style={styles.timingInputWrap}>
                    <TimePickerField
                      value={mt.firstTime}
                      onChange={(v) => setMedicineTimings((prev) =>
                        prev.map((x, j) => j === i ? { ...x, firstTime: v } : x)
                      )}
                    />
                  </View>
                  {times.length > 1 && (
                    <View style={styles.timingPreview}>
                      <Ionicons name="alarm-outline" size={12} color={Colors.primary} />
                      <Text style={styles.timingPreviewText}>{times.join(" · ")}</Text>
                    </View>
                  )}
                </View>
              );
            })}
            <TouchableOpacity
              style={[styles.addToActiveBtn, addingToActive && { opacity: 0.6 }]}
              onPress={confirmAddToActive}
              disabled={addingToActive}
              activeOpacity={0.8}
            >
              {addingToActive
                ? <ActivityIndicator size="small" color={Colors.textInverse} />
                : <Ionicons name="checkmark-circle" size={18} color={Colors.textInverse} />}
              <Text style={styles.addToActiveBtnText}>
                {addingToActive ? "Ekleniyor..." : "Aktif İlaçlara Ekle"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <SafeAreaView style={styles.modal} edges={["top", "bottom"]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{formatDate(selected.savedAt)}</Text>
                {selected.analysis.doctorName && (
                  <Text style={styles.modalSubtitle}>Dr. {selected.analysis.doctorName}</Text>
                )}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => handleDelete(selected.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelected(null)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              {prescImageUrls[selected.id] && (
                <Image source={{ uri: prescImageUrls[selected.id]! }} style={styles.detailImage} resizeMode="contain" />
              )}
              <PrescriptionDetail analysis={selected.analysis} />
            </ScrollView>

            <ConfirmModal
              visible={!!deleteConfirmId}
              title="Reçeteyi Sil"
              message="Bu reçeteyi silmek istiyor musun?"
              confirmLabel="Sil"
              onConfirm={confirmDelete}
              onCancel={() => setDeleteConfirmId(null)}
              loading={deleting}
            />
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function AnalysisResult({ analysis, onClose, addedToActive, onAddToActive }: {
  analysis: PrescriptionAnalysis;
  onClose: () => void;
  addedToActive: boolean;
  onAddToActive: () => void;
}) {
  return (
    <View>
      <View style={styles.successBanner}>
        <Ionicons name="checkmark-circle" size={18} color={Colors.secondary} />
        <Text style={styles.successText}>Reçete kaydedildi!</Text>
        <Button title="Kapat" onPress={onClose} variant="secondary" size="sm" />
      </View>
      <PrescriptionDetail analysis={analysis} />
      {addedToActive ? (
        <View style={styles.addedToActiveBanner}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
          <Text style={styles.addedToActiveText}>
            {analysis.medicines.length} ilaç aktif ilaçlara eklendi!
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.addToActiveBtn} onPress={onAddToActive} activeOpacity={0.8}>
          <Ionicons name="add-circle" size={18} color={Colors.textInverse} />
          <Text style={styles.addToActiveBtnText}>İlaçları Aktif İlaçlara Ekle</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PrescriptionDetail({ analysis }: { analysis: PrescriptionAnalysis }) {
  return (
    <View style={styles.detailContainer}>
      {(analysis.doctorName || analysis.patientName || analysis.date) && (
        <Card style={styles.infoCard}>
          <Text style={styles.cardTitle}>Reçete Bilgileri</Text>
          {analysis.doctorName && <InfoRow icon="person" label="Doktor" value={analysis.doctorName} />}
          {analysis.patientName && <InfoRow icon="person-circle" label="Hasta" value={analysis.patientName} />}
          {analysis.date && <InfoRow icon="calendar" label="Tarih" value={analysis.date} />}
        </Card>
      )}

      <SectionHeader title={`${analysis.medicines.length} İlaç`} />

      {analysis.medicines.length === 0 ? (
        <Card><Text style={styles.noMedText}>Reçetede ilaç bulunamadı.</Text></Card>
      ) : (
        analysis.medicines.map((med, i) => <MedicineCard key={i} med={med} />)
      )}
    </View>
  );
}

function MedicineCard({ med }: { med: PrescriptionMedicine }) {
  return (
    <Card style={styles.medicineCard}>
      <View style={styles.medHeader}>
        <View style={styles.medIconWrap}>
          <Ionicons name="medical" size={20} color={Colors.primary} />
        </View>
        <View style={styles.medHeaderText}>
          <Text style={styles.medName}>{med.name}</Text>
          {med.dosage && <Text style={styles.medDosage}>{med.dosage}</Text>}
        </View>
      </View>

      <View style={styles.usageSummary}>
        {med.frequency && (
          <View style={styles.usageChip}>
            <Ionicons name="repeat" size={13} color={Colors.primary} />
            <Text style={styles.usageChipText}>{med.frequency}</Text>
          </View>
        )}
        {med.duration && (
          <View style={[styles.usageChip, styles.usageChipGreen]}>
            <Ionicons name="calendar-outline" size={13} color={Colors.secondary} />
            <Text style={[styles.usageChipText, { color: Colors.secondary }]}>{med.duration}</Text>
          </View>
        )}
      </View>

      {med.instructions && (
        <View style={styles.instructionBox}>
          <Ionicons name="time" size={14} color={Colors.primary} />
          <Text style={styles.instructionText}>{med.instructions}</Text>
        </View>
      )}

      {med.purpose && (
        <View style={styles.medSection}>
          <Text style={styles.medSectionTitle}>Ne İçin?</Text>
          <Text style={styles.medSectionText}>{med.purpose}</Text>
        </View>
      )}

      {med.sideEffects && (
        <View style={[styles.medSection, styles.sideEffectBox]}>
          <View style={styles.sideEffectHeader}>
            <Ionicons name="warning" size={14} color={Colors.warning} />
            <Text style={styles.sideEffectTitle}>Yan Etkiler</Text>
          </View>
          <Text style={styles.sideEffectText}>{med.sideEffects}</Text>
        </View>
      )}
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={Colors.textMuted} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function calcReminderTimes(firstTime: string, frequency: string): string[] {
  const intervalMap: Record<string, number> = {
    "Günde 1 kez": 0, "Günde 2 kez": 12, "Günde 3 kez": 8,
    "Her 8 saatte bir": 8, "Her 12 saatte bir": 12, "Gerektiğinde": 0,
  };
  const countMap: Record<string, number> = {
    "Günde 1 kez": 1, "Günde 2 kez": 2, "Günde 3 kez": 3,
    "Her 8 saatte bir": 3, "Her 12 saatte bir": 2, "Gerektiğinde": 1,
  };
  const interval = intervalMap[frequency] ?? 0;
  const count = countMap[frequency] ?? 1;
  if (count === 1 || interval === 0) return [firstTime];
  const [h, m] = firstTime.split(":").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const totalMin = (h ?? 8) * 60 + (m ?? 0) + i * interval * 60;
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  });
}

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
  } catch {
    return null;
  }
}

async function fetchMedicineImage(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { headers: { "User-Agent": "IlacAsistan/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: Colors.text },
  headerSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },

  prescCard: { padding: 12 },
  prescRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  prescThumb: { width: 64, height: 64, borderRadius: 10 },
  prescThumbPlaceholder: { backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  prescInfo: { flex: 1 },
  prescDate: { fontSize: 13, fontWeight: "700", color: Colors.text },
  prescDoctor: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  prescMedCount: { fontSize: 12, color: Colors.primary, fontWeight: "600", marginTop: 3 },
  prescMedNames: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  medNameChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  medNameChipText: { fontSize: 11, color: Colors.primary, fontWeight: "500" },
  moreText: { fontSize: 11, color: Colors.textMuted, alignSelf: "center" },
  expandBtn: { padding: 4, marginLeft: 4 },

  expandedMeds: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    gap: 10,
  },
  expandedMedRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  expandedMedAvatar: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  expandedMedAvatarText: { fontSize: 17, fontWeight: "800" },
  expandedMedInfo: { flex: 1 },
  expandedMedName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  expandedMedMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
  expandedMedDetail: {
    fontSize: 12, color: Colors.primary, fontWeight: "500",
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: Radius.full,
  },
  expandedInstructionRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 5,
    backgroundColor: Colors.secondaryLight, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: Radius.sm, borderLeftWidth: 2, borderLeftColor: Colors.secondary,
  },
  expandedMedInstruction: {
    fontSize: 12, color: Colors.primaryDark, flex: 1, lineHeight: 17,
  },
  expandedSideEffect: {
    flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 5,
    backgroundColor: Colors.warningLight, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: Radius.sm, borderLeftWidth: 2, borderLeftColor: Colors.warning,
  },
  expandedSideEffectText: {
    fontSize: 12, color: Colors.text, flex: 1, lineHeight: 17,
  },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.surface },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  modalActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  deleteBtn: { padding: 4 },
  modalContent: { padding: 16, gap: 12, paddingBottom: 32 },

  // Upload
  uploadArea: {
    borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed",
    borderRadius: Radius.xl, padding: 32, alignItems: "center",
  },
  uploadIconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  uploadTitle: { fontSize: 20, fontWeight: "700", color: Colors.text, marginBottom: 8 },
  uploadDescription: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  uploadButtons: { gap: 10, width: "100%" },

  previewContainer: { position: "relative", marginBottom: 12 },
  preview: { width: "100%", height: 200, borderRadius: Radius.lg, backgroundColor: Colors.surfaceAlt },
  changePhoto: { position: "absolute", top: 8, right: 8 },

  loadingCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 32,
    alignItems: "center", marginBottom: 12, ...Shadows.sm,
  },
  loadingText: { fontSize: 16, fontWeight: "600", color: Colors.text, marginTop: 12 },
  loadingSubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },

  errorCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.lg, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.danger + "30",
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.danger, lineHeight: 18 },

  timeModalDesc: {
    fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18,
  },
  timingRow: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg,
    padding: 14, marginBottom: 10, gap: 8,
  },
  timingMedInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timingMedName: { fontSize: 14, fontWeight: "700", color: Colors.text, flex: 1 },
  timingFreq: {
    fontSize: 12, color: Colors.primary, fontWeight: "600",
    backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
  },
  timingInputWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  timingInput: {
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 18, fontWeight: "700", color: Colors.text,
    backgroundColor: Colors.background, width: 90, textAlign: "center",
  },
  timingPreview: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  timingPreviewText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },

  addToActiveBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    padding: 14, marginBottom: 12, justifyContent: "center",
  },
  addToActiveBtnText: { color: Colors.textInverse, fontSize: 15, fontWeight: "700" },
  addedToActiveBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    padding: 12, marginBottom: 12,
  },
  addedToActiveText: { fontSize: 14, color: Colors.primary, fontWeight: "600" },

  scannerTabBar: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg, padding: 4,
  },
  scannerTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: Radius.md,
  },
  scannerTabActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.text, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  scannerTabText: { fontSize: 13, fontWeight: "500", color: Colors.textMuted },
  scannerTabTextActive: { color: Colors.primary, fontWeight: "700" },

  manualForm: { gap: 14 },
  manualInfoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.primaryLight, padding: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary + "30",
  },
  manualInfoText: { flex: 1, fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },
  manualRow: { flexDirection: "row", gap: 10 },
  manualField: { flex: 1, gap: 5 },
  manualLabel: { fontSize: 13, fontWeight: "600", color: Colors.text },
  manualHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  manualInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: Colors.text, backgroundColor: Colors.surface,
  },
  manualMedsInput: {
    borderWidth: 1.5, borderColor: Colors.primary + "60", borderRadius: Radius.md,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.surface,
    minHeight: 130, textAlignVertical: "top",
  },
  analyzeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 15, marginTop: 4,
  },
  analyzeBtnText: { color: Colors.textInverse, fontSize: 15, fontWeight: "700" },

  tutorialIntroCard: {
    alignItems: "center", gap: 8, backgroundColor: Colors.primaryLight,
    borderRadius: Radius.xl, padding: 20, marginBottom: 16,
  },
  tutorialIntroTitle: { fontSize: 17, fontWeight: "800", color: Colors.text },
  tutorialIntroBody: { fontSize: 13.5, color: Colors.primaryDark, textAlign: "center", lineHeight: 19 },
  tutorialContinueBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 15, marginTop: 4,
  },
  tutorialContinueBtnText: { color: Colors.textInverse, fontSize: 15, fontWeight: "700" },

  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.secondaryLight, borderRadius: Radius.lg, padding: 12, marginBottom: 12,
  },
  successText: { flex: 1, fontSize: 14, fontWeight: "600", color: Colors.primaryDark },

  detailImage: { width: "100%", height: 180, borderRadius: Radius.lg, marginBottom: 8 },
  detailContainer: { gap: 0 },

  infoCard: { marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  infoValue: { fontSize: 13, color: Colors.text, flex: 1 },
  noMedText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", padding: 8 },

  medicineCard: { marginBottom: 10 },
  medHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
  medIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  medHeaderText: { flex: 1 },
  medName: { fontSize: 16, fontWeight: "700", color: Colors.text },
  medDosage: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  usageSummary: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  usageChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary + "30",
  },
  usageChipGreen: { backgroundColor: Colors.secondaryLight, borderColor: Colors.secondary + "30" },
  usageChipText: { fontSize: 13, fontWeight: "600", color: Colors.primary },

  instructionBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: Colors.secondaryLight, padding: 10, borderRadius: Radius.sm,
    marginBottom: 4, borderLeftWidth: 3, borderLeftColor: Colors.secondary,
  },
  instructionText: { fontSize: 13, color: Colors.primaryDark, flex: 1, lineHeight: 18 },

  medSection: { marginTop: 10 },
  medSectionTitle: { fontSize: 12, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  medSectionText: { fontSize: 14, color: Colors.text, lineHeight: 20 },

  sideEffectBox: {
    backgroundColor: Colors.warningLight, padding: 10, borderRadius: Radius.sm,
    borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  sideEffectHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  sideEffectTitle: { fontSize: 12, fontWeight: "700", color: Colors.warning },
  sideEffectText: { fontSize: 13, color: Colors.text, lineHeight: 18 },

  expandedMedNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  correctLink: { fontSize: 12, color: Colors.primary, fontWeight: "600", textDecorationLine: "underline" },
  correctRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  correctInput: {
    flex: 1, minWidth: 120, borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 13, color: Colors.text, backgroundColor: Colors.background,
  },
  correctConfirmBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 6, minWidth: 60, alignItems: "center",
  },
  correctConfirmText: { fontSize: 12, fontWeight: "700", color: Colors.textInverse },
  correctCancelBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  correctCancelText: { fontSize: 12, color: Colors.textSecondary },
});
