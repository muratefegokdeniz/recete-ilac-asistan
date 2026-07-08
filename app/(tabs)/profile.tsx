import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { Colors, Radius, Shadows } from "../../constants/Colors";
import { Button, ConfirmModal, EmptyState, DatePickerField } from "../../components/ui";
import { ChildProfileModal } from "../../components/ChildProfileModal";
import { useAuth } from "../../context/AuthContext";
import {
  getProfile, saveProfile, UserProfile,
  getFamilyMembers, addFamilyMember, updateFamilyMember, deleteFamilyMember,
  getAllActiveMedicines, getChildVaccines, createVaccineCardForChild,
  setVaccineCompleted, setVaccineNotificationId,
  getPendingChildLinkRequests, respondToChildLinkRequest, ChildLinkRequest,
} from "../../services/database";
import { scheduleVaccineReminder } from "../../services/notifications";
import { FamilyMember, ChildVaccine } from "../../types";
import { fallbackMemberColor } from "../../constants/MemberColors";

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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [editingChild, setEditingChild] = useState<FamilyMember | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ChildLinkRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Aşı kartı
  const [childNamesFromMeds, setChildNamesFromMeds] = useState<string[]>([]);
  const [hiddenChildren, setHiddenChildren] = useState<string[]>([]);
  const [selectedVaccineChild, setSelectedVaccineChild] = useState<string | null>(null);
  const [vaccines, setVaccines] = useState<ChildVaccine[]>([]);
  const [vaccineLoading, setVaccineLoading] = useState(false);
  const [showBirthDateModal, setShowBirthDateModal] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [creatingCard, setCreatingCard] = useState(false);
  const [createCardError, setCreateCardError] = useState<string | null>(null);
  const [togglingVaccineId, setTogglingVaccineId] = useState<string | null>(null);

  const vaccineChildren = Array.from(new Set([...familyMembers.map((m) => m.name), ...childNamesFromMeds]))
    .filter((n) => !hiddenChildren.includes(n));

  function colorForChild(name: string): string {
    return familyMembers.find((m) => m.name === name)?.color ?? fallbackMemberColor(name, vaccineChildren);
  }

  useFocusEffect(
    useCallback(() => {
      getProfile().then((p) => { if (p) setProfile(p); }).catch(() => {});
      loadFamilyMembers();
      loadVaccineChildren();
      loadPendingRequests();
    }, [])
  );

  async function loadFamilyMembers() {
    try {
      setFamilyMembers(await getFamilyMembers());
    } catch (e) { console.error(e); }
  }

  async function loadPendingRequests() {
    try {
      setPendingRequests(await getPendingChildLinkRequests());
    } catch (e) { console.error(e); }
  }

  async function handleRespond(id: string, approve: boolean) {
    setRespondingId(id);
    try {
      await respondToChildLinkRequest(id, approve);
      await Promise.all([loadPendingRequests(), loadFamilyMembers()]);
    } catch (e) { console.error(e); } finally {
      setRespondingId(null);
    }
  }

  async function loadVaccineChildren() {
    try {
      const [members, meds, hidden] = await Promise.all([
        getFamilyMembers(),
        getAllActiveMedicines(),
        AsyncStorage.getItem("hiddenChildren"),
      ]);
      const fromMeds = meds.filter((m) => m.memberName).map((m) => m.memberName!);
      const hiddenList: string[] = hidden ? JSON.parse(hidden) : [];
      setChildNamesFromMeds(fromMeds);
      setHiddenChildren(hiddenList);

      const memberNames = members.map((m) => m.name);
      const children = Array.from(new Set([...memberNames, ...fromMeds])).filter((n) => !hiddenList.includes(n));
      setSelectedVaccineChild((prev) => {
        const next = prev && children.includes(prev) ? prev : (children[0] ?? null);
        if (next) getChildVaccines(next).then(setVaccines);
        else setVaccines([]);
        return next;
      });
    } catch (e) { console.error(e); }
  }

  async function selectVaccineChild(name: string) {
    setSelectedVaccineChild(name);
    setVaccineLoading(true);
    try {
      setVaccines(await getChildVaccines(name));
    } finally {
      setVaccineLoading(false);
    }
  }

  async function handleCreateVaccineCard() {
    if (!selectedVaccineChild || !birthDate) {
      setCreateCardError("Doğum tarihi gereklidir.");
      return;
    }
    setCreatingCard(true);
    setCreateCardError(null);
    try {
      await createVaccineCardForChild(selectedVaccineChild, birthDate);
      setVaccines(await getChildVaccines(selectedVaccineChild));
      setShowBirthDateModal(false);
      setBirthDate("");
    } catch (e: any) {
      setCreateCardError(e?.message ?? "Aşı kartı oluşturulamadı.");
    } finally {
      setCreatingCard(false);
    }
  }

  async function handleToggleVaccine(vaccine: ChildVaccine) {
    if (!selectedVaccineChild) return;
    setTogglingVaccineId(vaccine.id);
    try {
      const nowCompleted = !vaccine.completedAt;
      await setVaccineCompleted(vaccine.id, nowCompleted);
      if (nowCompleted && vaccine.notificationId) {
        await setVaccineNotificationId(vaccine.id, null);
      } else if (!nowCompleted) {
        const notifId = await scheduleVaccineReminder(selectedVaccineChild, vaccine.vaccineName, vaccine.dueDate);
        if (notifId) await setVaccineNotificationId(vaccine.id, notifId);
      }
      setVaccines(await getChildVaccines(selectedVaccineChild));
    } finally {
      setTogglingVaccineId(null);
    }
  }

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

        {/* Bekleyen Çocuk Girişi İstekleri */}
        {pendingRequests.length > 0 && (
          <View style={[styles.section, styles.pendingSection]}>
            <Text style={styles.sectionTitle}>Bekleyen Bağlantı İstekleri</Text>
            {pendingRequests.map((req) => (
              <View key={req.id} style={styles.pendingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingName}>{req.childDisplayName}</Text>
                  <Text style={styles.pendingSub}>Aileme bağlı girmek istiyor</Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    style={styles.pendingDenyBtn}
                    onPress={() => handleRespond(req.id, false)}
                    disabled={respondingId === req.id}
                  >
                    <Text style={styles.pendingDenyText}>Reddet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pendingApproveBtn}
                    onPress={() => handleRespond(req.id, true)}
                    disabled={respondingId === req.id}
                  >
                    {respondingId === req.id
                      ? <ActivityIndicator size="small" color="white" />
                      : <Text style={styles.pendingApproveText}>Onayla</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

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

        {/* Aile Üyeleri */}
        <View style={styles.section}>
          <View style={styles.childrenSectionHeader}>
            <Text style={styles.sectionTitle}>Çocuklarım</Text>
            <TouchableOpacity onPress={() => setShowAddChild(true)} style={styles.addChildLink}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.addChildLinkText}>Ekle</Text>
            </TouchableOpacity>
          </View>
          {familyMembers.length === 0 ? (
            <Text style={[styles.infoValue, styles.infoEmpty]}>Henüz çocuk eklenmedi.</Text>
          ) : (
            familyMembers.map((child) => (
              <TouchableOpacity key={child.id} style={styles.childRow} onPress={() => setEditingChild(child)} activeOpacity={0.75}>
                <View style={[styles.childAvatar, { backgroundColor: child.color }]}>
                  <Text style={styles.childAvatarText}>{child.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childSub}>
                    {[child.age ? `${child.age} yaş` : null, child.gender, child.bloodType]
                      .filter(Boolean).join(" · ") || "Detay girilmedi"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Aşı Kartları */}
        {vaccineChildren.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aşı Kartları</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vaccineChildRow}>
              {vaccineChildren.map((name) => {
                const color = colorForChild(name);
                const active = selectedVaccineChild === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.vaccineChildTab, active && { backgroundColor: color, borderColor: color }]}
                    onPress={() => selectVaccineChild(name)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.vaccineChildDot, { backgroundColor: active ? Colors.textInverse : color }]} />
                    <Text style={[styles.vaccineChildTabText, active && styles.vaccineChildTabTextActive]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {vaccineLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : vaccines.length === 0 ? (
              <EmptyState
                icon={<MaterialIcons name="vaccines" size={36} color={Colors.textMuted} />}
                title={`${selectedVaccineChild} için Aşı Kartı Yok`}
                description="Standart aşı takvimini oluşturmak için doğum tarihini gir."
                action={{ label: "Aşı Kartı Oluştur", onPress: () => setShowBirthDateModal(true) }}
              />
            ) : (
              <View style={{ gap: 10, marginTop: 8 }}>
                {vaccines.map((v) => {
                  const today = new Date().toISOString().split("T")[0]!;
                  const overdue = !v.completedAt && v.dueDate < today;
                  return (
                    <View key={v.id} style={styles.vaccineCard}>
                      <TouchableOpacity
                        style={[styles.vaccineCheckbox, v.completedAt && styles.vaccineCheckboxDone]}
                        onPress={() => handleToggleVaccine(v)}
                        disabled={togglingVaccineId === v.id}
                        activeOpacity={0.75}
                      >
                        {togglingVaccineId === v.id ? (
                          <ActivityIndicator size="small" color={v.completedAt ? "white" : Colors.primary} />
                        ) : v.completedAt ? (
                          <Ionicons name="checkmark" size={16} color="white" />
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
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showBirthDateModal} transparent animationType="fade" onRequestClose={() => setShowBirthDateModal(false)}>
        <View style={styles.vaccineModalOverlay}>
          <View style={styles.vaccineModalCard}>
            <Text style={styles.modalTitle}>{selectedVaccineChild} için Doğum Tarihi</Text>
            <DatePickerField label="Doğum Tarihi" value={birthDate} onChange={setBirthDate} placeholder="Doğum tarihini seç" />
            {createCardError && <Text style={styles.errorText}>{createCardError}</Text>}
            <View style={styles.vaccineModalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBirthDateModal(false)} disabled={creatingCard}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <Button title="Oluştur" onPress={handleCreateVaccineCard} loading={creatingCard} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

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

      <ChildProfileModal
        visible={showAddChild}
        mode="create"
        onCancel={() => setShowAddChild(false)}
        onSave={async (member) => {
          await addFamilyMember(member);
          await loadFamilyMembers();
          setShowAddChild(false);
        }}
      />

      <ChildProfileModal
        visible={!!editingChild}
        mode="edit"
        initial={editingChild ?? undefined}
        onCancel={() => setEditingChild(null)}
        onSave={async (member) => {
          if (!editingChild) return;
          await updateFamilyMember(editingChild.id, member);
          await loadFamilyMembers();
          setEditingChild(null);
        }}
        onDelete={async () => {
          if (!editingChild) return;
          await deleteFamilyMember(editingChild.id);
          await loadFamilyMembers();
          setEditingChild(null);
        }}
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

  childrenSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  addChildLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  addChildLinkText: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  childRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  childAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  childAvatarText: { fontSize: 16, fontWeight: "800", color: "white" },
  childName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  childSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.md,
    padding: 12, borderWidth: 1, borderColor: Colors.danger + "30",
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.danger, lineHeight: 18 },

  // Bekleyen bağlantı istekleri
  pendingSection: { borderWidth: 1.5, borderColor: Colors.primary + "40" },
  pendingRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pendingName: { fontSize: 15, fontWeight: "700", color: Colors.text },
  pendingSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pendingActions: { flexDirection: "row", gap: 8 },
  pendingDenyBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  pendingDenyText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  pendingApproveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.primary, minWidth: 70, alignItems: "center" },
  pendingApproveText: { fontSize: 13, fontWeight: "700", color: "white" },

  // Aşı Kartları
  vaccineChildRow: { gap: 8, paddingBottom: 12 },
  vaccineChildTab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  vaccineChildDot: { width: 8, height: 8, borderRadius: 4 },
  vaccineChildTabText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  vaccineChildTabTextActive: { color: Colors.textInverse },

  vaccineCard: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: Colors.background, borderRadius: Radius.lg, padding: 14,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  vaccineCheckbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  vaccineCheckboxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vaccineName: { fontSize: 14, fontWeight: "700", color: Colors.text },
  vaccineAge: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  vaccineDue: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  vaccineDueOverdue: { color: Colors.danger, fontWeight: "700" },

  vaccineModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  vaccineModalCard: { width: "100%", maxWidth: 420, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: 20, gap: 12 },
  vaccineModalButtons: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalCancelBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: Colors.textSecondary },
});
