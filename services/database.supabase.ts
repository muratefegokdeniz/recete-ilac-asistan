import { supabase } from "./supabase";
import { Medicine, ActiveMedicine, TakenDose, SavedPrescription, ChatMessage } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function rowToMedicine(r: any): Medicine {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    purpose: r.purpose ?? undefined,
    sideEffects: r.side_effects ?? undefined,
    dosage: r.dosage ?? undefined,
    frequency: r.frequency ?? undefined,
    mealTiming: r.meal_timing ?? undefined,
    expiryDate: r.expiry_date ?? undefined,
    quantity: r.quantity ?? 0,
    imageUri: r.image_uri ?? undefined,
    addedAt: r.added_at,
  };
}

function rowToActiveMedicine(r: any): ActiveMedicine {
  return {
    id: r.id,
    medicineId: r.medicine_id ?? "",
    medicineName: r.medicine_name,
    dosage: r.dosage,
    frequency: r.frequency,
    mealTiming: r.meal_timing ?? undefined,
    startDate: r.start_date,
    endDate: r.end_date ?? undefined,
    reminderTimes: r.reminder_times ?? [],
    notificationIds: r.notification_ids ?? undefined,
    notes: r.notes ?? undefined,
    takenDoses: [],
    memberName: r.member_name ?? undefined,
  };
}

function rowToTakenDose(r: any): TakenDose {
  return {
    id: r.id,
    scheduledTime: r.scheduled_time,
    takenAt: r.taken_at ?? undefined,
    skipped: r.skipped ?? false,
  };
}

function rowToPrescription(r: any): SavedPrescription {
  return {
    id: r.id,
    imageUri: r.image_uri ?? undefined,
    analysis: r.analysis,
    savedAt: r.saved_at,
  };
}

export interface UserProfile {
  fullName?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  bloodType?: string;
  chronicConditions?: string;
  allergies?: string;
}

// ─── Init ───────────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  // Supabase'de tablolar zaten hazır, burada bir şey yapmaya gerek yok
}

// ─── Medicines ───────────────────────────────────────────────────────────────

export async function getAllMedicines(): Promise<Medicine[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToMedicine);
}

export async function addMedicine(medicine: Medicine): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Giriş yapılmamış");
  const { error } = await supabase.from("medicines").insert({
    id: medicine.id,
    user_id: userId,
    name: medicine.name,
    description: medicine.description ?? null,
    purpose: medicine.purpose ?? null,
    side_effects: medicine.sideEffects ?? null,
    dosage: medicine.dosage ?? null,
    frequency: medicine.frequency ?? null,
    meal_timing: medicine.mealTiming ?? null,
    expiry_date: medicine.expiryDate ?? null,
    quantity: medicine.quantity ?? 0,
    image_uri: medicine.imageUri ?? null,
    added_at: medicine.addedAt,
  });
  if (error) throw error;
}

export async function deleteMedicine(id: string): Promise<void> {
  const { error, count } = await supabase
    .from("medicines")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  if (!count) throw new Error("Silme işlemi başarısız. Supabase DELETE policy eksik olabilir.");
}

// ─── Active Medicines ────────────────────────────────────────────────────────

export async function getAllActiveMedicines(): Promise<ActiveMedicine[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("active_medicines")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToActiveMedicine);
}

export async function addActiveMedicine(medicine: ActiveMedicine): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Giriş yapılmamış");
  const { error } = await supabase.from("active_medicines").insert({
    id: medicine.id,
    user_id: userId,
    medicine_id: medicine.medicineId || null,
    medicine_name: medicine.medicineName,
    dosage: medicine.dosage,
    frequency: medicine.frequency,
    meal_timing: medicine.mealTiming ?? null,
    start_date: medicine.startDate,
    end_date: medicine.endDate || null,
    reminder_times: medicine.reminderTimes,
    notification_ids: medicine.notificationIds ?? null,
    notes: medicine.notes ?? null,
    member_name: medicine.memberName ?? null,
  });
  if (error) throw error;
}

export async function deleteActiveMedicine(id: string): Promise<void> {
  const { error } = await supabase.from("taken_doses").delete().eq("active_medicine_id", id);
  if (error) throw error;
  const { error: e2, count } = await supabase
    .from("active_medicines")
    .delete({ count: "exact" })
    .eq("id", id);
  if (e2) throw e2;
  if (!count) throw new Error("Silme işlemi başarısız. Supabase DELETE policy eksik olabilir.");
}

// ─── Taken Doses ─────────────────────────────────────────────────────────────

export async function markDoseTaken(dose: TakenDose, activeMedicineId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Giriş yapılmamış");
  const { error } = await supabase.from("taken_doses").upsert({
    id: dose.id,
    user_id: userId,
    active_medicine_id: activeMedicineId,
    scheduled_time: dose.scheduledTime,
    taken_at: dose.takenAt ?? null,
    skipped: false,
  });
  if (error) throw error;
}

export async function skipDose(dose: TakenDose, activeMedicineId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Giriş yapılmamış");
  const { error } = await supabase.from("taken_doses").upsert({
    id: dose.id,
    user_id: userId,
    active_medicine_id: activeMedicineId,
    scheduled_time: dose.scheduledTime,
    taken_at: null,
    skipped: true,
  });
  if (error) throw error;
}

export async function getTodayDoses(activeMedicineId: string): Promise<TakenDose[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("taken_doses")
    .select("*")
    .eq("active_medicine_id", activeMedicineId)
    .gte("scheduled_time", `${today}T00:00:00`)
    .lte("scheduled_time", `${today}T23:59:59`);
  if (error) throw error;
  return (data ?? []).map(rowToTakenDose);
}

export async function getDosesForDateRange(activeMedicineId: string, startDate: string, endDate: string): Promise<TakenDose[]> {
  const { data, error } = await supabase
    .from("taken_doses")
    .select("*")
    .eq("active_medicine_id", activeMedicineId)
    .gte("scheduled_time", `${startDate}T00:00:00`)
    .lte("scheduled_time", `${endDate}T23:59:59`);
  if (error) throw error;
  return (data ?? []).map(rowToTakenDose);
}

export async function getDosesForDate(activeMedicineId: string, date: string): Promise<TakenDose[]> {
  const { data, error } = await supabase
    .from("taken_doses")
    .select("*")
    .eq("active_medicine_id", activeMedicineId)
    .gte("scheduled_time", `${date}T00:00:00`)
    .lte("scheduled_time", `${date}T23:59:59`);
  if (error) throw error;
  return (data ?? []).map(rowToTakenDose);
}

// ─── Prescriptions ───────────────────────────────────────────────────────────

export async function getAllPrescriptions(): Promise<SavedPrescription[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPrescription);
}

export async function savePrescription(prescription: SavedPrescription): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Giriş yapılmamış");
  const { error } = await supabase.from("prescriptions").insert({
    id: prescription.id,
    user_id: userId,
    image_uri: prescription.imageUri ?? null,
    analysis: prescription.analysis,
    saved_at: prescription.savedAt,
  });
  if (error) throw error;
}

export async function deletePrescription(id: string): Promise<void> {
  const { error, count } = await supabase
    .from("prescriptions")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  if (!count) throw new Error("Silme işlemi başarısız. Supabase DELETE policy eksik olabilir.");
}

// ─── Chat History ────────────────────────────────────────────────────────────

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export async function getChatConversations(): Promise<ChatConversation[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    messages: r.messages ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function upsertChatConversation(conv: ChatConversation): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase.from("chat_conversations").upsert({
    id: conv.id,
    user_id: userId,
    title: conv.title,
    messages: conv.messages,
    created_at: conv.createdAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteChatConversation(id: string): Promise<void> {
  const { error } = await supabase.from("chat_conversations").delete().eq("id", id);
  if (error) throw error;
}

// ─── Login Logs ──────────────────────────────────────────────────────────────

export async function logLogin(userId: string, email: string): Promise<void> {
  await supabase.from("login_logs").insert({
    user_id: userId,
    email,
    logged_in_at: new Date().toISOString(),
  });
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!data) return null;
  return {
    fullName: data.full_name ?? undefined,
    age: data.age ?? undefined,
    gender: data.gender ?? undefined,
    height: data.height ?? undefined,
    weight: data.weight ?? undefined,
    bloodType: data.blood_type ?? undefined,
    chronicConditions: data.chronic_conditions ?? undefined,
    allergies: data.allergies ?? undefined,
  };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Giriş yapılmamış");
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: profile.fullName ?? null,
    age: profile.age ?? null,
    gender: profile.gender ?? null,
    height: profile.height ?? null,
    weight: profile.weight ?? null,
    blood_type: profile.bloodType ?? null,
    chronic_conditions: profile.chronicConditions ?? null,
    allergies: profile.allergies ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
