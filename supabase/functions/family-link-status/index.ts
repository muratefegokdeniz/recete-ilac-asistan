// Çocuk cihazı, gönderdiği bağlantı isteğinin onaylanıp onaylanmadığını
// buradan sorar. Çocuğun cihazında Supabase oturumu olmadığı için bu
// fonksiyon service_role key ile RLS'yi bypass eder — ama sadece requestId
// VE deviceId birlikte eşleşirse veri döner, başka bir isteğin bilgisini
// asla vermez.
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
    const { requestId, deviceId } = await req.json();
    if (!requestId || !deviceId) {
      return new Response(
        JSON.stringify({ error: "requestId ve deviceId zorunludur" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await admin
      .from("child_link_requests")
      .select("id, parent_user_id, child_display_name, status")
      .eq("id", requestId)
      .eq("device_id", deviceId)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "İstek bulunamadı" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: data.status,
        parentUserId: data.status === "approved" ? data.parent_user_id : undefined,
        displayName: data.status === "approved" ? data.child_display_name : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[family-link-status] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
