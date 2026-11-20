import { PrescriptionAnalysis, PrescriptionMedicine } from "../types";
import { supabase } from "./supabase";
import { getAiConsent, AI_CONSENT_REQUIRED_MESSAGE } from "./aiConsent";

// Prompt'lar ve model seçimi artık yalnızca sunucuda (supabase/functions/claude-proxy).
// İstemci sadece işlem türünü ve veriyi gönderir.
//
// Önemli: AI doz, miktar, sıklık veya süre ÜRETMEZ. Yalnızca reçetede/kutuda
// yazanı okur; yazmıyorsa alan boş (null) gelir ve kullanıcı kendisi girer.
type AiTask = "prescription_image" | "prescription_text" | "medicine_image" | "medicine_name" | "chat";

interface ClaudeResponse {
  content: { type: string; text?: string }[];
  stop_reason?: string;
}

// Sonnet 5.5 / Haiku 5.5'te adaptif düşünme varsayılan olarak açık: cevap
// bir veya birkaç "thinking" bloğuyla başlayabiliyor, content[0] metin
// olmayabilir. Bu yüzden tüm text bloklarını birleştiriyoruz.
function extractText(response: ClaudeResponse): string {
  if (response.stop_reason === "refusal") {
    throw new Error("AI bu isteği yanıtlayamadı. Lütfen farklı bir şekilde tekrar deneyin.");
  }
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

async function callClaude(task: AiTask, payload: Record<string, unknown>): Promise<ClaudeResponse> {
  if ((await getAiConsent()) !== "granted") {
    throw new Error(AI_CONSENT_REQUIRED_MESSAGE);
  }
  const { data, error } = await supabase.functions.invoke("claude-proxy", {
    body: { task, payload },
  });
  if (error) {
    console.error("[callClaude] Edge Function hatası:", error, "context:", (error as any)?.context);
    let message: string | undefined;
    try { message = (await (error as any)?.context?.json?.())?.error; } catch {}
    throw new Error(message ?? "Yapay zeka isteği başarısız oldu. Lütfen tekrar deneyin.");
  }
  if (data?.error) {
    console.error("[callClaude] claude-proxy hata döndü:", data.error);
    throw new Error(data.error);
  }
  return data as ClaudeResponse;
}

function parseJson<T>(text: string): T | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
  } catch {
    // ignore
  }
  return null;
}

// Model "null" değerini bazen metin olarak yazıyor; boş/"null" alanları undefined yap.
function clean<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "string" && (!v.trim() || v.trim().toLowerCase() === "null")) continue;
    out[k] = v;
  }
  return out as T;
}

function cleanAnalysis(a: PrescriptionAnalysis): PrescriptionAnalysis {
  return {
    ...clean(a),
    medicines: Array.isArray(a.medicines) ? a.medicines.map((m) => clean(m)).filter((m) => m.name) : [],
  };
}

export async function analyzePrescription(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<PrescriptionAnalysis> {
  const text = extractText(await callClaude("prescription_image", { image: base64Image, mimeType }));
  const parsed = parseJson<PrescriptionAnalysis>(text);
  return parsed ? cleanAnalysis(parsed) : { medicines: [], rawText: text };
}

export async function analyzePrescriptionText(text: string): Promise<PrescriptionAnalysis> {
  const out = extractText(await callClaude("prescription_text", { text }));
  const parsed = parseJson<PrescriptionAnalysis>(out);
  return parsed ? cleanAnalysis(parsed) : { medicines: [], rawText: text };
}

// İlaç kutusu fotoğrafından okunan bilgiler. Doz/sıklık bilinçli olarak yok:
// kullanıcı bunları reçetesinden kendisi girer.
export interface MedicineImageAnalysis {
  name?: string;
  activeIngredient?: string;
  purpose?: string;
  sideEffects?: string;
  expiryDate?: string;
}

export async function analyzeMedicineImage(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<MedicineImageAnalysis> {
  const text = extractText(await callClaude("medicine_image", { image: base64Image, mimeType }));
  const parsed = parseJson<MedicineImageAnalysis>(text);
  return parsed ? clean(parsed) : {};
}

// İsimden genel ilaç bilgisi (ad düzeltme için). Doz alanları dönmez.
export async function getMedicineInfoByName(
  name: string
): Promise<Pick<PrescriptionMedicine, "name" | "purpose" | "sideEffects">> {
  const text = extractText(await callClaude("medicine_name", { name }));
  const parsed = parseJson<Pick<PrescriptionMedicine, "name" | "purpose" | "sideEffects">>(text);
  return parsed ? clean(parsed) : { name };
}

export async function chatWithAssistant(
  messages: { role: "user" | "assistant"; content: string }[],
  userMessage: string
): Promise<string> {
  return extractText(await callClaude("chat", { history: messages, message: userMessage }));
}
