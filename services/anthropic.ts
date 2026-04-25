import Anthropic from "@anthropic-ai/sdk";
import { PrescriptionAnalysis, PrescriptionMedicine } from "../types";

const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? "";
console.log("[Anthropic] API key yüklendi mi:", apiKey ? `Evet (${apiKey.length} karakter, başlangıç: ${apiKey.substring(0, 12)}...)` : "HAYIR - key boş!");

const client = new Anthropic({
  apiKey,
  dangerouslyAllowBrowser: true,
});

export async function analyzePrescription(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<PrescriptionAnalysis> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `Sen bir eczacı asistanısın. Türkçe reçeteleri analiz edip ilaçlar hakkında detaylı bilgi veriyorsun.
Yanıtını her zaman geçerli bir JSON formatında ver.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Bu reçeteyi analiz et ve aşağıdaki JSON formatında yanıt ver. Tüm bilgileri Türkçe yaz.

{
  "doctorName": "Doktor adı (yoksa null)",
  "patientName": "Hasta adı (yoksa null)",
  "date": "Reçete tarihi (yoksa null)",
  "rawText": "Reçetedeki tüm metin",
  "medicines": [
    {
      "name": "İlaç adı ve formu (örn: Amoksisilin 500mg Kapsül)",
      "dosage": "Tek seferde alınacak doz (örn: 1 kapsül, 2 tablet)",
      "frequency": "Günde kaç kez (örn: Günde 3 kez, Her 8 saatte bir)",
      "duration": "Kaç gün kullanılacak (örn: 7 gün, 10 gün)",
      "instructions": "Ne zaman alınacak: sabah/öğle/akşam ve aç mı tok mu karnına (örn: Sabah aç karnına, Yemeklerle birlikte)",
      "purpose": "Bu ilaç ne için yazıldı, hangi şikayete iyi gelir (2-3 cümle)",
      "sideEffects": "En önemli yan etkiler"
    }
  ]
}

Reçetede yazan bilgileri birebir oku. Eğer bir alan reçetede yoksa genel tıbbi bilgiden doldur.
Reçete değilse veya okunamıyorsa boş medicines dizisi ile yanıt ver.`,
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as PrescriptionAnalysis;
    }
  } catch {
    // ignore parse error
  }

  return { medicines: [], rawText: text };
}

export interface MedicineImageAnalysis {
  name: string;
  dosage?: string;
  purpose?: string;
  sideEffects?: string;
  instructions?: string;
  frequency?: string;
  expiryDate?: string;
  activeIngredient?: string;
}

export async function analyzeMedicineImage(
  base64Image: string,
  mimeType: string = "image/jpeg"
): Promise<MedicineImageAnalysis> {
  console.log("[analyzeMedicineImage] base64 uzunluğu:", base64Image?.length ?? 0);
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: `Sen bir eczacı asistanısın. İlaç görsellerini tanıyıp Türkçe kapsamlı bilgi veriyorsun. Yanıtını JSON formatında ver.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Bu ilaç görseli veya kutusu hakkında mümkün olduğunca detaylı bilgi ver. Eğer görsel net değilse veya ilaç tanınamıyorsa, gördüğün bilgilere göre en iyi tahmini yap.

JSON formatında yanıt ver (tüm alanları Türkçe doldur):
{
  "name": "İlaç adı ve dozu (örn: Parol 500mg Tablet)",
  "activeIngredient": "Etken madde (örn: Parasetamol 500mg)",
  "dosage": "Standart doz (örn: Yetişkin: 1-2 tablet)",
  "frequency": "Kullanım sıklığı (örn: Günde 3-4 kez, her 4-6 saatte bir)",
  "purpose": "Ne için kullanılır - hastalıklar ve belirtiler (2-3 cümle açıklama)",
  "instructions": "Nasıl kullanılır, dikkat edilmesi gerekenler (tok/aç karnına, su ile vs)",
  "sideEffects": "Olası yan etkiler (en önemli 3-5 tanesi)",
  "expiryDate": "Kutu üzerinde son kullanma tarihi varsa YYYY-MM formatında, yoksa null"
}

Önemli: Tüm bilgileri Türkçe yaz. Eğer görselde yazı varsa (ilaç adı, SKT gibi) mutlaka oku.`,
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as MedicineImageAnalysis;
    }
  } catch {
    // ignore parse error
  }

  return { name: "Bilinmeyen İlaç" };
}

export async function getSkipAdvice(
  medicineName: string,
  reason: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `Sen Türkçe konuşan, empatik ve bilgili bir eczacı asistanısın.
Kullanıcı bir ilacını atladığında, nedenine göre kısa ve pratik önerilerde bulunuyorsun.
Yanıtın 2-4 cümle olsun. Gerektiğinde doktora danışmayı hatırlat.`,
    messages: [{
      role: "user",
      content: `İlaç adı: ${medicineName}\nAtlama nedeni: ${reason}\n\nBu durumda ne yapmalıyım?`,
    }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function getMedicineInfoByName(name: string): Promise<PrescriptionMedicine> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `Sen bir eczacı asistanısın. Türkçe ilaç bilgisi veriyorsun. Yanıtını JSON formatında ver.`,
    messages: [{
      role: "user",
      content: `"${name}" ilacı hakkında bilgi ver. JSON formatında yanıt ver:
{
  "name": "İlaç adı ve formu",
  "dosage": "Standart doz",
  "frequency": "Kullanım sıklığı",
  "duration": null,
  "instructions": "Nasıl kullanılır (tok/aç karnına vs)",
  "purpose": "Ne için kullanılır (2-3 cümle)",
  "sideEffects": "Önemli yan etkiler"
}`,
    }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as PrescriptionMedicine;
  } catch {}
  return { name };
}

export async function chatWithAssistant(
  messages: { role: "user" | "assistant"; content: string }[],
  userMessage: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `Sen Türkçe konuşan, yardımcı ve bilgili bir eczacı asistanısın.
İlaçlar, ilaç kullanımı, yan etkiler, ilaç etkileşimleri ve sağlık konularında bilgi veriyorsun.
Her zaman samimi, anlaşılır ve güvenilir bilgi veriyorsun.
Ciddi tıbbi durumlarda mutlaka doktora başvurulmasını tavsiye ediyorsun.
Yanıtların kısa, net ve Türkçe olsun.`,
    messages: [
      ...messages,
      { role: "user", content: userMessage },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
