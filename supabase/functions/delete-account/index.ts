// Hesap silme — Apple Guideline 5.1.1(v) / Play Store: uygulama içinden hesap
// oluşturma sunan uygulamalar, uygulama içinden kalıcı hesap silmeyi de
// sunmak zorunda. Bu fonksiyon, çağıran kullanıcının TÜM verisini (Storage
// fotoğrafları + tüm tablolardaki satırları) ve en son auth.users kaydının
// kendisini service_role ile siler. Kimlik doğrulaması claude-proxy ile aynı
// desen: sadece anon key değil, gerçek bir oturum JWT'si gerekiyor.
import { createClient } from "npm:@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "user-images";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Yetkisiz istek" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Yetkisiz istek" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userId = user.id;

    // 1) Storage: bu kullanıcıya ait tüm reçete/ilaç fotoğrafları
    for (const folder of ["prescriptions", "medicines"]) {
      const { data: files } = await admin.storage.from(BUCKET).list(`${userId}/${folder}`);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${folder}/${f.name}`);
        await admin.storage.from(BUCKET).remove(paths);
      }
    }

    // 2) Tablolar — FK bağımlılık sırasına göre (önce çocuk kayıtlar, sonra ana kayıtlar)
    const { data: meds } = await admin.from("active_medicines").select("id").eq("user_id", userId);
    const activeMedicineIds = (meds ?? []).map((m: { id: string }) => m.id);
    if (activeMedicineIds.length > 0) {
      await admin.from("taken_doses").delete().in("active_medicine_id", activeMedicineIds);
    }
    await admin.from("active_medicines").delete().eq("user_id", userId);
    await admin.from("medicines").delete().eq("user_id", userId);
    await admin.from("prescriptions").delete().eq("user_id", userId);
    await admin.from("chat_conversations").delete().eq("user_id", userId);
    await admin.from("child_vaccines").delete().eq("user_id", userId);
    await admin.from("family_members").delete().eq("user_id", userId);
    await admin.from("child_link_requests").delete().eq("parent_user_id", userId);
    await admin.from("login_logs").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    // 3) Son adım: auth.users kaydının kendisi (bundan önceki adımlardan biri
    //    hata verirse buraya hiç gelinmez, kullanıcı tekrar deneyebilir).
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) throw deleteUserError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[delete-account] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
