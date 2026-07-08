// Çocuk cihazı, annesinin email+şifresini burada gönderir. Bu bilgi SADECE
// "aile doğrulama" için kullanılır — çocuğun cihazına anneye ait gerçek bir
// oturum (session/token) HİÇBİR ZAMAN dönülmez. Doğrulama başarılıysa,
// annenin kendi RLS yetkisiyle "bekleyen istek" satırı oluşturulur; anne
// uygulamayı açtığında bunu görüp onaylar/reddeder.
import { createClient } from "npm:@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, childDisplayName, deviceId } = await req.json();

    if (!email || !password || !childDisplayName || !deviceId) {
      return new Response(
        JSON.stringify({ error: "email, password, childDisplayName ve deviceId zorunludur" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Anne kimlik bilgilerini doğrula — bu, geçici bir oturum oluşturur ama
    // bu oturumun access_token'ı çocuğun cihazına asla gönderilmez, sadece
    // bu fonksiyon içinde RLS'yi geçmek için bir kez kullanılıp atılır.
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });

    if (authError || !authData.session || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Email veya şifre hatalı" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parentClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
    });

    const id = `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error: insertError } = await parentClient.from("child_link_requests").insert({
      id,
      parent_user_id: authData.user.id,
      child_display_name: childDisplayName,
      device_id: deviceId,
      status: "pending",
    });

    // Bu fonksiyon içinde açılan geçici oturumu hemen kapat.
    await authClient.auth.signOut().catch(() => {});

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ requestId: id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[family-link-request] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
