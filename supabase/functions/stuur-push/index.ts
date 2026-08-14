import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { receiver_id, title, body, url } = await req.json();
    if (!receiver_id) throw new Error("receiver_id ontbreekt");

    webpush.setVapidDetails(
      "mailto:beheer@fibro.app",
      Deno.env.get("VAPID_PUBLIC_KEY"),
      Deno.env.get("VAPID_PRIVATE_KEY"),
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", receiver_id);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: false, reden: "geen abonnementen" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title: title || "Fibro",
      body: body || "Je hebt een nieuw bericht",
      url: url || "/Fibro/chat.html",
    });

    let verstuurd = 0;
    for (const rij of subs) {
      try {
        await webpush.sendNotification(rij.subscription, payload);
        verstuurd++;
      } catch (e) {
        console.error("Push fout:", e && e.statusCode ? e.statusCode : e);
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().eq("id", rij.id);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true, verstuurd }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
