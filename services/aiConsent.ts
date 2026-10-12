import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// App Store Guideline 5.1.2(i): kişisel veri üçüncü taraf bir AI'a (Anthropic
// Claude) gönderilmeden önce bu açıkça söylenmeli ve kullanıcıdan izin
// alınmalı. İzin hesap başına, cihazda saklanıyor; Profil'den değiştirilebilir.

export type AiConsent = "granted" | "denied";

const keyFor = (userId: string) => `ai_consent:${userId}`;

const listeners = new Set<() => void>();
export function onAiConsentChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** null = henüz sorulmadı */
export async function getAiConsent(): Promise<AiConsent | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const value = await AsyncStorage.getItem(keyFor(userId)).catch(() => null);
  return value === "granted" || value === "denied" ? value : null;
}

export async function setAiConsent(value: AiConsent): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await AsyncStorage.setItem(keyFor(userId), value);
  listeners.forEach((fn) => fn());
}

export const AI_CONSENT_REQUIRED_MESSAGE =
  "Yapay zeka özelliklerini kullanmak için veri paylaşımına izin vermelisin. Profil > Yapay Zeka İzni bölümünden açabilirsin.";
