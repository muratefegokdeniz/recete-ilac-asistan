import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// "08:30" → { hour: 8, minute: 30 }
function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 8, minute: m ?? 0 };
}

export async function scheduleDailyReminder(
  medicineName: string,
  reminderTime: string
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const { hour, minute } = parseTime(reminderTime);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💊 İlaç Vakti",
        body: `${medicineName} alma zamanı geldi.`,
        sound: true,
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

export async function cancelReminders(notificationIds: string[]): Promise<void> {
  if (Platform.OS === "web") return;
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}
