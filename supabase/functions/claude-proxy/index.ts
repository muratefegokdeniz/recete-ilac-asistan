// Supabase Edge Function — proxies Messages API calls to Claude using a
// server-side secret (ANTHROPIC_API_KEY). The Anthropic API key never ships
// inside the mobile app bundle.
//
// Auth: the platform's default JWT check only rejects requests with no
// token at all — it still accepts the public anon key's JWT. We additionally
// resolve the token to a real logged-in user via auth.getUser() so someone
// who only knows the anon key (shipped in every app bundle) can't invoke
// this function without a real account.
import Anthropic from "npm:@anthropic-ai/sdk@0.91.0";
import { createClient } from "npm:@supabase/supabase-js@2.104.1";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Yetkisiz istek" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { model, max_tokens, system, messages } = await req.json();

    if (!model || !max_tokens || !messages) {
      return new Response(
        JSON.stringify({ error: "model, max_tokens ve messages zorunludur" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await anthropic.messages.create({ model, max_tokens, system, messages });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[claude-proxy] error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Bilinmeyen hata" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
