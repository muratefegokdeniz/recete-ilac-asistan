import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { markDoseTaken } from "./database";

const ALARM_CATEGORY = "alarm-dose";
let alarmCategoryConfigured = false;
async function ensureAlarmCategory(): Promise<void> {
  if (alarmCategoryConfigured || Platform.OS === "web") return;
  alarmCategoryConfigured = true;
  try {
    await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY, [
      { identifier: "TAKE", buttonTitle: "Aldım" },
    ]);
  } catch (e) {
    console.warn("Alarm bildirim kategorisi ayarlanamadı:", e);
  }
}

let doseActionListenerRegistered = false;
export function registerDoseActionListener(): void {
  if (doseActionListenerRegistered || Platform.OS === "web") return;
  doseActionListenerRegistered = true;
  Notifications.addNotificationResponseReceivedListener(async (response) => {
    if (response.actionIdentifier !== "TAKE") return;
    const data = response.notification.request.content.data as
      | { activeMedicineId?: string; time?: string }
      | undefined;
    if (!data?.activeMedicineId || !data?.time) return;
    const today = new Date().toISOString().split("T")[0];
    const scheduledTime = `${today}T${data.time}`;
    try {
      await markDoseTaken(
        { id: `${data.activeMedicineId}_${scheduledTime}`, scheduledTime, takenAt: new Date().toISOString() },
        data.activeMedicineId
      );
    } catch (e) {
      console.error("Bildirimden doz işaretlenemedi:", e);
    }
  });
}

let handlerConfigured = false;
function ensureNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === "web") return;
  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    // Expo Go (SDK 53+) bazı Android sürümlerinde bunu senkron olarak fırlatabiliyor;
    // uygulamanın geri kalanının çökmemesi için burada yutuyoruz.
    console.warn("Bildirim işleyicisi ayarlanamadı:", e);
  }
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  ensureNotificationHandler();
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (e) {
    console.warn("Bildirim izni istenemedi:", e);
    return false;
  }
}

// "08:30" → { hour: 8, minute: 30 }
function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 8, minute: m ?? 0 };
}

export async function scheduleDailyReminder(
  medicineName: string,
  reminderTime: string,
  options?: { isAlarm?: boolean; activeMedicineId?: string }
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const { hour, minute } = parseTime(reminderTime);
    if (options?.isAlarm) await ensureAlarmCategory();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: options?.isAlarm ? "⏰ İlaç Alarmı" : "💊 İlaç Vakti",
        body: `${medicineName} alma zamanı geldi.`,
        sound: true,
        data: { activeMedicineId: options?.activeMedicineId, time: reminderTime },
        categoryIdentifier: options?.isAlarm ? ALARM_CATEGORY : undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch (e) {
    console.error("Bildirim zamanlanamadı:", e);
    return null;
  }
}

// Ebeveyne çocuğun gecikmiş dozu için anlık bildirim gönderir.
export async function notifyMissedChildDose(
  memberName: string,
  medicineName: string,
  time: string
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ İlaç Alınmadı",
        body: `${memberName}, ${medicineName} ilacını (${time}) henüz "aldım" olarak işaretlemedi.`,
        sound: true,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("Gecikme bildirimi gönderilemedi:", e);
  }
}

export async function cancelReminders(notificationIds: string[]): Promise<void> {
  if (Platform.OS === "web") return;
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

// Aşı vade tarihi tek seferlik olduğu için DAILY değil DATE tetikleyicisi kullanır.
export async function scheduleVaccineReminder(
  childName: string,
  vaccineName: string,
  dueDate: string // "YYYY-MM-DD"
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const date = new Date(`${dueDate}T09:00:00`);
  if (date.getTime() <= Date.now()) return null; // geçmiş tarih için bildirim planlanmaz
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💉 Aşı Zamanı",
        body: `${childName} için ${vaccineName} aşısının zamanı geldi.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
    return id;
  } catch (e) {
    console.error("Aşı bildirimi zamanlanamadı:", e);
    return null;
  }
}
