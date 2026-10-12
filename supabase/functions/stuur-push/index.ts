// stuur-push - een pushmelding naar de telefoon(s) van een vriend (v148, 12 oktober 2026)
//
// v148: de tekst komt nu van de server, in de taal van de ontvanger (profiles.taal, zie
// sql/taal.sql). Wat de app als title/body meestuurt (oudere versies doen dat nog), telt niet
// meer. Alleen een ingelogde gebruiker kan een melding sturen, en alleen naar een vriend
// (friendships, status accepted; blokkeren haalt de vriendschap weg). Een geblokkeerd account
// stuurt niets. Zo kan niemand meer met een zelfgekozen tekst meldingen naar een account sturen.
// type: 'bericht' (standaard) of 'buzz'. Het type gaat mee naar de service worker (trillen).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tekst = { title: string; body: string };
const TEKSTEN: Record<string, Record<string, Tekst>> = {
  bericht: {
    nl: { title: "Fibro", body: "Je hebt een nieuw bericht 💬" },
    en: { title: "Fibro", body: "You have a new message 💬" },
  },
  buzz: {
    nl: { title: "⚡ Buzz!", body: "{naam} buzzt je!" },
    en: { title: "⚡ Buzz!", body: "{naam} is buzzing you!" },
  },
};
const IEMAND: Record<string, string> = { nl: "Iemand", en: "Someone" };

function antwoord(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { receiver_id, type } = await req.json();
    if (!receiver_id) throw new Error("receiver_id ontbreekt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // 1. Wie stuurt er? Alleen met een geldige inlogpas.
    const pas = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let afzender: string | null = null;
    if (pas) {
      const { data } = await supabase.auth.getUser(pas);
      afzender = data && data.user ? data.user.id : null;
    }
    if (!afzender) return antwoord({ ok: false, reden: "niet ingelogd" }, 401);
    if (afzender === receiver_id) return antwoord({ ok: false, reden: "niet naar jezelf" }, 400);

    // 2. Alleen naar een vriend.
    const { data: vriendschap, error: fout1 } = await supabase
      .from("friendships")
      .select("user_id")
      .eq("user_id", afzender)
      .eq("friend_id", receiver_id)
      .eq("status", "accepted")
      .limit(1);
    if (fout1) throw fout1;
    if (!vriendschap || vriendschap.length === 0) {
      return antwoord({ ok: false, reden: "geen vrienden" }, 403);
    }

    // 3. De naam van de afzender en de taal van de ontvanger, in een keer.
    // (Bestaat de kolom taal nog niet, 42703, dan zonder: alles in het Nederlands, zoals vroeger.)
    let { data: profielen, error: fout2 } = await supabase
      .from("profiles")
      .select("id, username, taal, geblokkeerd")
      .in("id", [afzender, receiver_id]);
    if (fout2 && fout2.code === "42703") {
      ({ data: profielen, error: fout2 } = await supabase
        .from("profiles")
        .select("id, username, geblokkeerd")
        .in("id", [afzender, receiver_id]));
    }
    if (fout2) throw fout2;
    const ik = (profielen || []).find((p) => p.id === afzender);
    const ontvanger = (profielen || []).find((p) => p.id === receiver_id);
    if (!ik || !ontvanger) return antwoord({ ok: false, reden: "onbekend account" }, 404);
    if (ik.geblokkeerd) return antwoord({ ok: false, reden: "geblokkeerd" }, 403);

    // 4. De telefoons van de ontvanger.
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", receiver_id);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return antwoord({ ok: false, reden: "geen abonnementen" });
    }

    // 5. De tekst, in de taal van de ontvanger.
    const soort = type === "buzz" ? "buzz" : "bericht";
    const taal = ontvanger.taal === "en" ? "en" : "nl";
    const tekst = TEKSTEN[soort][taal];
    const naam = String(ik.username || IEMAND[taal]).slice(0, 40);
    const payload = JSON.stringify({
      title: tekst.title,
      body: tekst.body.replace("{naam}", naam),
      url: "/Fibro/chat.html",
      type: soort,
    });

    webpush.setVapidDetails(
      "mailto:beheer@fibro.app",
      Deno.env.get("VAPID_PUBLIC_KEY"),
      Deno.env.get("VAPID_PRIVATE_KEY"),
    );

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
    return antwoord({ ok: true, verstuurd });
  } catch (e) {
    return antwoord({ error: String(e) }, 500);
  }
});
