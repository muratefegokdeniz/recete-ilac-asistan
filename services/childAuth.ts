import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { ActiveMedicine, ChildVaccine, TakenDose } from "../types";

const DEVICE_ID_KEY = "childDeviceId";
const CHILD_SESSION_KEY = "childSession";

export interface ChildSession {
  requestId: string;
  deviceId: string;
  displayName: string;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function submitLinkRequest(
  email: string,
  password: string,
  childDisplayName: string
): Promise<string> {
  const deviceId = await getOrCreateDeviceId();
  const { data, error } = await supabase.functions.invoke("family-link-request", {
    body: { email, password, childDisplayName, deviceId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.requestId as string;
}

export async function checkLinkStatus(
  requestId: string
): Promise<{ status: "pending" | "approved" | "denied"; parentUserId?: string; displayName?: string }> {
  const deviceId = await getOrCreateDeviceId();
  const { data, error } = await supabase.functions.invoke("family-link-status", {
    body: { requestId, deviceId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function saveChildSession(session: ChildSession): Promise<void> {
  await AsyncStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(session));
}

export async function getChildSession(): Promise<ChildSession | null> {
  const raw = await AsyncStorage.getItem(CHILD_SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearChildSession(): Promise<void> {
  await AsyncStorage.removeItem(CHILD_SESSION_KEY);
}

interface ChildState {
  medicines: ActiveMedicine[];
  vaccines: ChildVaccine[];
  takenDoses: { active_medicine_id: string; scheduled_time: string; taken_at: string | null; skipped: boolean }[];
}

async function callChildData(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("child-data", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchChildState(session: ChildSession): Promise<ChildState> {
  const data = await callChildData({ requestId: session.requestId, deviceId: session.deviceId, action: "getState" });
  return {
    medicines: (data.medicines ?? []).map((r: any) => ({
      id: r.id,
      medicineId: r.medicine_id ?? "",
      medicineName: r.medicine_name,
      dosage: r.dosage,
      frequency: r.frequency,
      mealTiming: r.meal_timing ?? undefined,
      startDate: r.start_date,
      endDate: r.end_date ?? undefined,
      reminderTimes: r.reminder_times ?? [],
      notes: r.notes ?? undefined,
      takenDoses: [],
      memberName: r.member_name ?? undefined,
    })),
    vaccines: (data.vaccines ?? []).map((r: any) => ({
      id: r.id,
      childName: r.child_name,
      vaccineName: r.vaccine_name,
      recommendedAge: r.recommended_age,
      dueDate: r.due_date,
      completedAt: r.completed_at ?? undefined,
      notificationId: r.notification_id ?? undefined,
    })),
    takenDoses: data.takenDoses ?? [],
  };
}

export async function markChildDose(
  session: ChildSession,
  activeMedicineId: string,
  scheduledTime: string,
  opts: { taken?: boolean; skipped?: boolean }
): Promise<void> {
  await callChildData({
    requestId: session.requestId, deviceId: session.deviceId, action: "markDose",
    activeMedicineId, scheduledTime, taken: !!opts.taken, skipped: !!opts.skipped,
  });
}

export async function markChildVaccine(session: ChildSession, vaccineId: string, completed: boolean): Promise<void> {
  await callChildData({ requestId: session.requestId, deviceId: session.deviceId, action: "markVaccine", vaccineId, completed });
}
