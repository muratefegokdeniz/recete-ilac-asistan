// Web: tarayıcı Notification API + setTimeout ile günlük hatırlatma

export async function requestPermissions(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// Her bildirim için { id, medicineName, reminderTime } localStorage'da saklanır
// Sayfa açıkken setTimeout ile o güne ait zamanı kontrol eder

const STORAGE_KEY = "ilac_reminders";

interface ReminderEntry {
  id: string;
  medicineName: string;
  reminderTime: string; // "HH:MM"
}

function loadReminders(): ReminderEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveReminders(list: ReminderEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Kaç ms sonra bugün saat HH:MM olacak
function msUntilTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h ?? 8, m ?? 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // yarın
  return target.getTime() - now.getTime();
}

const timers: Record<string, ReturnType<typeof setTimeout>> = {};

function armTimer(entry: ReminderEntry) {
  if (timers[entry.id]) clearTimeout(timers[entry.id]);
  const delay = msUntilTime(entry.reminderTime);
  timers[entry.id] = setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification("💊 İlaç Vakti", {
        body: `${entry.medicineName} alma zamanı geldi.`,
        icon: "/icon.png",
      });
    }
    // Yarınki için yeniden zamanla
    armTimer(entry);
  }, delay);
}

// Uygulama açılınca tüm kayıtlı bildirimleri yeniden zamanla
export function rehydrateReminders() {
  const list = loadReminders();
  list.forEach(armTimer);
}

export async function scheduleDailyReminder(
  medicineName: string,
  reminderTime: string
): Promise<string | null> {
  if (typeof Notification === "undefined") return null;
  if (Notification.permission !== "granted") {
    const ok = await requestPermissions();
    if (!ok) return null;
  }
  const id = `reminder_${Date.now()}`;
  const entry: ReminderEntry = { id, medicineName, reminderTime };
  const list = loadReminders();
  list.push(entry);
  saveReminders(list);
  armTimer(entry);
  return id;
}

export async function cancelReminders(notificationIds: string[]): Promise<void> {
  for (const id of notificationIds) {
    if (timers[id]) { clearTimeout(timers[id]); delete timers[id]; }
  }
  const list = loadReminders().filter((r) => !notificationIds.includes(r.id));
  saveReminders(list);
}

// Web'de aylar sonrasına setTimeout kurmak sayfa yenilemelerinde güvenilir
// olmadığından aşı bildirimleri şimdilik sadece native'de planlanıyor.
export async function scheduleVaccineReminder(
  _childName: string,
  _vaccineName: string,
  _dueDate: string
): Promise<string | null> {
  return null;
}
