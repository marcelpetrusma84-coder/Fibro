// get-turn-credentials - een tijdelijk pasje voor onze eigen TURN-server (v149, 13 oktober 2026)
//
// Vroeger haalde deze functie TURN-gegevens bij Metered; dat werkte sinds oktober 2026 niet meer
// (fout 400, hotspot-test 10 okt). Nu staat er een eigen coturn op een VPS bij TransIP
// (server/turnserver.conf, server/LEESMIJ.txt) en maakt deze functie zelf een pasje:
//   gebruikersnaam = <verloopt>:<uid>    (verloopt = unix-tijd in seconden)
//   wachtwoord     = base64(HMAC-SHA1(TURN_GEHEIM, gebruikersnaam))
// coturn (use-auth-secret) rekent met hetzelfde geheim na of het pasje klopt en nog geldig is.
// Er gaat dus niets naar een andere dienst: de functie rekent alleen.
//
// Alleen een ingelogde gebruiker krijgt een pasje, een geblokkeerd account niet.
// Het geheim staat als secret TURN_GEHEIM in Supabase (Edge Functions -> Secrets) en op de server
// (/etc/turnserver.conf, static-auth-secret), nooit in de repo.
// Het geheim bestaat alleen uit kleine letters a-z. Van TURN_GEHEIM telt alleen dat: hoofdletters
// worden klein, en spaties, enters en andere tekens die er bij het overtypen of plakken op een
// telefoon in sluipen, tellen niet mee (13 okt: drie keer overtypen ging mis).
// Zonder (bruikbaar) TURN_GEHEIM: status 503; de app belt dan alleen rechtstreeks (STUN).
import { createClient } from "npm:@supabase/supabase-js@2";

// Waar de postbode staat. Komt er een domein bij (TLS op 443), dan hier een regel
// "turns:turn.<domein>:443?transport=tcp" toevoegen (en in ice-config.js de STUN).
const TURN_URLS = [
  "turn:136.144.154.200:3478?transport=udp",
  "turn:136.144.154.200:3478?transport=tcp",
];
// Een pasje is 24 uur geldig; de app gebruikt het hoogstens 12 uur (ice-config.js), zodat
// er tijdens een gesprek altijd nog minstens 12 uur over is.
const GELDIG_S = 24 * 60 * 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function antwoord(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function maakWachtwoord(geheim: string, gebruikersnaam: string) {
  const tekst = new TextEncoder();
  const sleutel = await crypto.subtle.importKey(
    "raw", tekst.encode(geheim), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const handtekening = new Uint8Array(await crypto.subtle.sign("HMAC", sleutel, tekst.encode(gebruikersnaam)));
  let bin = "";
  for (const b of handtekening) bin += String.fromCharCode(b);
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const geheim = (Deno.env.get("TURN_GEHEIM") || "").toLowerCase().replace(/[^a-z]/g, "");
    if (geheim.length < 16) return antwoord({ ok: false, reden: "server nog niet ingesteld" }, 503);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // 1. Wie vraagt er? Alleen met een geldige inlogpas.
    const pas = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let uid: string | null = null;
    if (pas) {
      const { data } = await supabase.auth.getUser(pas);
      uid = data && data.user ? data.user.id : null;
    }
    if (!uid) return antwoord({ ok: false, reden: "niet ingelogd" }, 401);

    // 2. Geen pasje voor een geblokkeerd account.
    const { data: profiel, error } = await supabase
      .from("profiles")
      .select("geblokkeerd")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw error;
    if (profiel && profiel.geblokkeerd) return antwoord({ ok: false, reden: "geblokkeerd" }, 403);

    // 3. Het pasje.
    const verloopt = Math.floor(Date.now() / 1000) + GELDIG_S;
    const username = verloopt + ":" + uid;
    const credential = await maakWachtwoord(geheim, username);
    return antwoord({ iceServers: [{ urls: TURN_URLS, username, credential }], verloopt });
  } catch (e) {
    return antwoord({ error: String(e && e.message ? e.message : e) }, 500);
  }
});
