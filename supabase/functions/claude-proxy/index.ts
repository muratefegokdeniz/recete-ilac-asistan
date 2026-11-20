// Supabase Edge Function — İlaç Asistanı'nın tüm AI çağrıları buradan geçer.
//
// Güvenlik modeli:
//  - İstemci artık model, system prompt veya serbest "messages" göndermiyor.
//    Sadece bir işlem türü ("task") ve o işleme ait veriyi gönderiyor. Prompt'lar
//    ve model seçimi yalnızca sunucuda tanımlı; böylece fonksiyon herkesin
//    kullanabileceği genel amaçlı bir Claude proxy'si olmaktan çıkıyor.
//  - Her istek gerçek bir oturuma (auth.getUser) ve has_ai_access yetkisine bağlı.
//  - Kullanıcı başına günlük istek limiti var (ai_usage tablosu).
//  - Girdi boyutları sınırlı.
//
// Tıbbi güvenlik modeli (App Store Guideline 1.4.2):
//  - AI hiçbir zaman doz, miktar, kullanım sıklığı veya süre ÜRETMEZ.
//    Yalnızca reçetede / kutuda açıkça yazanı okur; yazmıyorsa null döner.
//  - İsimden ilaç bilgisi istendiğinde doz alanları hiç istenmez.
//  - Sohbet asistanı kişiye özel doz/miktar söylemez, eczacıya yönlendirir.
import Anthropic from "npm:@anthropic-ai/sdk@0.91.0";
import { createClient } from "npm:@supabase/supabase-js@2.104.1";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const MODEL_ACCURACY = "claude-sonnet-5-5";
const MODEL_LIGHT = "claude-haiku-5-5";

const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "60");
const MAX_IMAGE_BASE64 = 7_000_000; // ~5 MB görsel
const MAX_TEXT = 4_000;
const MAX_CHAT_HISTORY = 20;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type Mime = (typeof ALLOWED_MIME)[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class InputError extends Error {}

function str(v: unknown, field: string, max = MAX_TEXT): string {
  if (typeof v !== "string" || !v.trim()) throw new InputError(`${field} zorunludur`);
  if (v.length > max) throw new InputError(`${field} çok uzun`);
  return v;
}

function image(payload: Record<string, unknown>) {
  const data = str(payload.image, "image", MAX_IMAGE_BASE64);
  const mime = (payload.mimeType ?? "image/jpeg") as string;
  if (!ALLOWED_MIME.includes(mime as Mime)) throw new InputError("Desteklenmeyen görsel türü");
  return { type: "image" as const, source: { type: "base64" as const, media_type: mime as Mime, data } };
}

// ---------------------------------------------------------------------------
// Prompt'lar
// ---------------------------------------------------------------------------

const NO_DOSE_RULES = `KESİN KURALLAR:
- Doz, miktar, kullanım sıklığı ve kullanım süresi bilgilerini ASLA kendin üretme, tahmin etme veya "genel/standart" bilgiden tamamlama.
- Bu alanlara yalnızca belgede AÇIKÇA YAZAN ifadeyi aynen aktar. Belgede yazmıyorsa veya okunamıyorsa değeri null yap.
- Kilo, yaş veya başka bir bilgiye göre hesaplama yapma.
- Yanıtın yalnızca geçerli bir JSON nesnesi olsun.`;

const PRESCRIPTION_JSON = `{
  "doctorName": "Reçetede yazan doktor adı veya null",
  "patientName": "Reçetede yazan hasta adı veya null",
  "date": "Reçetede yazan tarih veya null",
  "rawText": "Reçetede okunan tüm metin",
  "medicines": [
    {
      "name": "Reçetede yazan ilaç adı ve formu",
      "dosage": "Reçetede yazan tek seferlik doz ifadesi, birebir (yoksa null)",
      "frequency": "Reçetede yazan kullanım sıklığı, birebir (yoksa null)",
      "duration": "Reçetede yazan kullanım süresi, birebir (yoksa null)",
      "instructions": "Reçetede yazan kullanım talimatı, birebir (örn. tok karnına) (yoksa null)",
      "purpose": "Bu ilacın genel olarak ne için kullanıldığı, 1-2 cümle, doz içermeden",
      "sideEffects": "En sık görülen birkaç yan etki, doz veya miktar içermeden"
    }
  ]
}`;

function prescriptionImageRequest(p: Record<string, unknown>) {
  return {
    model: MODEL_ACCURACY,
    max_tokens: 6000,
    system: `Sen bir reçete OKUMA asistanısın. Görevin, Türkçe reçetelerde yazan bilgiyi düzenli bir listeye aktarmak. Tıbbi karar vermezsin.\n${NO_DOSE_RULES}`,
    messages: [{
      role: "user",
      content: [
        image(p),
        {
          type: "text",
          text: `Bu reçeteyi oku ve şu JSON formatında, Türkçe yanıt ver:\n${PRESCRIPTION_JSON}\n\nGörsel bir reçete değilse veya okunamıyorsa "medicines": [] döndür.`,
        },
      ],
    }],
  };
}

function prescriptionTextRequest(p: Record<string, unknown>) {
  const text = str(p.text, "text");
  return {
    model: MODEL_ACCURACY,
    max_tokens: 4000,
    system: `Sen bir reçete DÜZENLEME asistanısın. Kullanıcının elle yazdığı reçete bilgisini düzenli bir listeye ayırırsın. Tıbbi karar vermezsin.\n${NO_DOSE_RULES}\n- "Belge" burada kullanıcının yazdığı metindir: kullanıcı bir ilaç için doz/sıklık/süre yazmadıysa o alan null olmalı.`,
    messages: [{
      role: "user",
      content: `Aşağıdaki metni şu JSON formatına ayır (Türkçe). İlaç adlarını kullanıcının yazdığı gibi koru.\n${PRESCRIPTION_JSON}\n\nMetin:\n"""\n${text}\n"""`,
    }],
  };
}

function medicineImageRequest(p: Record<string, unknown>) {
  return {
    model: MODEL_ACCURACY,
    max_tokens: 3000,
    system: `Sen bir ilaç kutusu OKUMA asistanısın. Kutunun üzerinde yazan ürün bilgilerini okuyup ilaç dolabı kaydı için düzenlersin. Doz veya kullanım önerisi vermezsin.\n${NO_DOSE_RULES}`,
    messages: [{
      role: "user",
      content: [
        image(p),
        {
          type: "text",
          text: `Bu ilaç kutusunu oku ve şu JSON formatında, Türkçe yanıt ver:
{
  "name": "Kutuda yazan ürün adı, güç ve form (örn. Parol 500 mg Tablet)",
  "activeIngredient": "Kutuda yazan etken madde (yoksa null)",
  "purpose": "Bu ilacın genel olarak ne için kullanıldığı, 1-2 cümle, doz içermeden",
  "sideEffects": "En sık görülen birkaç yan etki, doz veya miktar içermeden",
  "expiryDate": "Kutuda okunan son kullanma tarihi YYYY-MM formatında (yoksa null)"
}
Ürün adı okunamıyorsa "name": null döndür; tahmin etme.`,
        },
      ],
    }],
  };
}

function medicineNameRequest(p: Record<string, unknown>) {
  const name = str(p.name, "name", 200);
  return {
    model: MODEL_LIGHT,
    max_tokens: 1500,
    system: `Sen bir ilaç bilgi asistanısın. Bir ilacın adı verildiğinde yalnızca genel tanıtım bilgisi verirsin.\n${NO_DOSE_RULES}`,
    messages: [{
      role: "user",
      content: `İlaç adı: "${name}"\n\nŞu JSON formatında, Türkçe yanıt ver (doz, miktar, sıklık veya süre bilgisi EKLEME):
{
  "name": "İlacın doğru yazılmış adı ve formu",
  "purpose": "Genel olarak ne için kullanıldığı, 1-2 cümle",
  "sideEffects": "En sık görülen birkaç yan etki"
}`,
    }],
  };
}

const CHAT_SYSTEM = `Sen "İlaç Asistanı" uygulamasındaki Türkçe konuşan bir bilgi asistanısın. İlaçların ne işe yaradığı, yan etkiler, genel etkileşim uyarıları, aç/tok karnına kullanım ve ilaç–besin ilişkisi gibi konularda GENEL bilgi verirsin.

KESİN KURALLAR:
- Hiçbir zaman kişiye özel doz, miktar, tablet sayısı, mg/kg hesabı, maksimum günlük doz veya kullanım süresi söyleme. Kilo, yaş veya başka bir bilgiye göre doz hesaplama.
- "Ne kadar almalıyım", "kaç tane", "dozu artırabilir miyim", "kaçırdığım dozu ne yapmalıyım", "çocuğuma ne kadar vereyim" gibi sorularda sayısal bir değer verme; kullanıcıyı reçetesine, ilacın prospektüsüne, eczacısına veya doktoruna yönlendir.
- Teşhis koyma, ilaç başlatma/bırakma/değiştirme önerme.
- Acil durum belirtilerinde (nefes darlığı, şiddetli alerjik reaksiyon, bilinç kaybı, aşırı doz şüphesi vb.) hemen 112'yi aramasını söyle.
- Yanıtların kısa, sade ve Türkçe olsun.`;

function chatRequest(p: Record<string, unknown>) {
  const message = str(p.message, "message");
  const historyRaw = Array.isArray(p.history) ? p.history : [];
  const history = historyRaw.slice(-MAX_CHAT_HISTORY).map((m: any) => {
    if ((m?.role !== "user" && m?.role !== "assistant") || typeof m?.content !== "string") {
      throw new InputError("Geçersiz sohbet geçmişi");
    }
    return { role: m.role, content: m.content.slice(0, MAX_TEXT) };
  });
  // Messages API ilk mesajın "user" olmasını istiyor.
  while (history.length && history[0].role !== "user") history.shift();
  return {
    model: MODEL_LIGHT,
    max_tokens: 1500,
    system: CHAT_SYSTEM,
    messages: [...history, { role: "user", content: message }],
  };
}

const TASKS: Record<string, (p: Record<string, unknown>) => Record<string, unknown>> = {
  prescription_image: prescriptionImageRequest,
  prescription_text: prescriptionTextRequest,
  medicine_image: medicineImageRequest,
  medicine_name: medicineNameRequest,
  chat: chatRequest,
};

// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Yalnızca POST" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Yetkisiz istek" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) return json({ error: "Yetkisiz istek" }, 401);

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("has_ai_access")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.has_ai_access) {
      return json({ error: "Bu hesapta AI özellikleri aktif değil" }, 403);
    }

    const body = await req.json().catch(() => null);
    const task = body?.task as string | undefined;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;
    const build = task ? TASKS[task] : undefined;
    if (!build) return json({ error: "Geçersiz işlem" }, 400);

    let request: Record<string, unknown>;
    try {
      request = build(payload);
    } catch (e) {
      if (e instanceof InputError) return json({ error: e.message }, 400);
      throw e;
    }

    // Günlük limit — supabase/migrations/20261119_ai_usage.sql
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await supabaseClient
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString());
    if (countError) {
      console.error("[claude-proxy] ai_usage okunamadı:", countError);
      return json({ error: "Şu an AI isteği işlenemiyor" }, 503);
    }
    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ error: "Bugünlük yapay zeka kullanım sınırına ulaştın. Yarın tekrar deneyebilirsin." }, 429);
    }
    await supabaseClient.from("ai_usage").insert({ user_id: user.id, task });

    // Sonnet 5.5 sınıflandırıcıları bazen zararsız istekleri reddedebiliyor;
    // fallbacks: "default" reddi sunucu tarafında önerilen modelde yeniden dener.
    const options: { headers?: Record<string, string> } = {};
    if (request.model === MODEL_ACCURACY) {
      request.fallbacks = "default";
      options.headers = { "anthropic-beta": "server-side-fallback-2026-07-01" };
    }
    // deno-lint-ignore no-explicit-any
    const response = await anthropic.messages.create(request as any, options);
    return json(response);
  } catch (error) {
    console.error("[claude-proxy] error:", error);
    return json({ error: "Yapay zeka isteği başarısız oldu" }, 500);
  }
});
