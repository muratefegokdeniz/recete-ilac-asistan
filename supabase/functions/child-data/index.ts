// Çocuk cihazının Supabase oturumu yok, o yüzden RLS'den geçemiyor. Bu
// fonksiyon her istekte requestId+deviceId'yi onaylı bir child_link_requests
// satırına eşleyip, sadece o çocuğun kendi adına ("member_name"/"child_name")
// etiketlenmiş verileri döner/günceller. service_role kullanır ama erişim
// alanı bilinçli olarak sadece bu çocuğun kendi kayıtlarıyla sınırlıdır.
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
    const body = await req.json();
    const { requestId, deviceId, action } = body;

    if (!requestId || !deviceId || !action) {
      return new Response(
        JSON.stringify({ error: "requestId, deviceId ve action zorunludur" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: link, error: linkError } = await admin
      .from("child_link_requests")
      .select("parent_user_id, child_display_name, status")
      .eq("id", requestId)
      .eq("device_id", deviceId)
      .eq("status", "approved")
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ error: "Onaylı bağlantı bulunamadı" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parentUserId = link.parent_user_id as string;
    const childName = link.child_display_name as string;

    if (action === "getState") {
      const [medsRes, vaccinesRes] = await Promise.all([
        admin.from("active_medicines").select("*").eq("user_id", parentUserId).eq("member_name", childName),
        admin.from("child_vaccines").select("*").eq("user_id", parentUserId).eq("child_name", childName),
      ]);
      if (medsRes.error) throw medsRes.error;
      if (vaccinesRes.error) throw vaccinesRes.error;

      const medicineIds = (medsRes.data ?? []).map((m: any) => m.id);
      let takenDoses: any[] = [];
      if (medicineIds.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const dosesRes = await admin
          .from("taken_doses")
          .select("*")
          .in("active_medicine_id", medicineIds)
          .gte("scheduled_time", `${today}T00:00:00`)
          .lte("scheduled_time", `${today}T23:59:59`);
        if (dosesRes.error) throw dosesRes.error;
        takenDoses = dosesRes.data ?? [];
      }

      return new Response(
        JSON.stringify({ medicines: medsRes.data ?? [], vaccines: vaccinesRes.data ?? [], takenDoses }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "markDose") {
      const { activeMedicineId, scheduledTime, taken, skipped } = body;
      if (!activeMedicineId || !scheduledTime) {
        return new Response(JSON.stringify({ error: "activeMedicineId ve scheduledTime zorunludur" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Bu ilacın gerçekten bu çocuğa ait olduğunu doğrula.
      const { data: med, error: medError } = await admin
        .from("active_medicines")
        .select("id")
        .eq("id", activeMedicineId)
        .eq("user_id", parentUserId)
        .eq("member_name", childName)
        .single();
      if (medError || !med) {
        return new Response(JSON.stringify({ error: "İlaç bulunamadı" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: upsertError } = await admin.from("taken_doses").upsert({
        id: `${activeMedicineId}_${scheduledTime}`,
        user_id: parentUserId,
        active_medicine_id: activeMedicineId,
        scheduled_time: scheduledTime,
        taken_at: taken ? new Date().toISOString() : null,
        skipped: !!skipped,
      });
      if (upsertError) throw upsertError;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "markVaccine") {
      const { vaccineId, completed } = body;
      if (!vaccineId) {
        return new Response(JSON.stringify({ error: "vaccineId zorunludur" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: vac, error: vacError } = await admin
        .from("child_vaccines")
        .select("id")
        .eq("id", vaccineId)
        .eq("user_id", parentUserId)
        .eq("child_name", childName)
        .single();
      if (vacError || !vac) {
        return new Response(JSON.stringify({ error: "Aşı kaydı bulunamadı" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updateError } = await admin
        .from("child_vaccines")
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq("id", vaccineId);
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Bilinmeyen action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[child-data] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
