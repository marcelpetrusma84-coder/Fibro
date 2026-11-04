// wachtwoord-reset - een moderator geeft iemand een tijdelijk wachtwoord (v265, 4 november 2026)
//
// Waarom zo: Fibro gebruikt geen echte e-mailadressen (iedereen heeft <naam>@fibro.internal), dus een
// "wachtwoord vergeten"-mail kan niet. Wie zijn wachtwoord kwijt is, vraagt het aan een moderator.
// Die vult op moderatie.html de gebruikersnaam in en krijgt een tijdelijk wachtwoord om door te geven.
// Bij de volgende keer inloggen moet de vriend zelf een nieuw wachtwoord kiezen (login.html,
// user_metadata.tijdelijk_wachtwoord).
//
// Berichten blijven gewoon: die hangen aan de herstelsleutel of Face ID-herstel, niet aan het wachtwoord.
//
// Regels:
//  - alleen een ingelogde moderator (profiles.is_moderator) mag dit;
//  - het wachtwoord van een andere moderator kan zo niet veranderd worden (dat gaat via Supabase zelf);
//  - het tijdelijke wachtwoord maakt de server zelf, uit letters en cijfers die je niet kunt verwarren.
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Zonder 0/O, 1/l/I: makkelijk over te typen of voor te lezen.
const TEKENS = "abcdefghjkmnpqrstuvwxyz23456789";
export function maakTijdelijkWachtwoord(lengte = 12): string {
  const grens = 256 - (256 % TEKENS.length); // geen voorkeur voor bepaalde tekens
  let uit = "";
  while (uit.length < lengte) {
    const b = new Uint8Array(lengte * 2);
    crypto.getRandomValues(b);
    for (const x of b) {
      if (x < grens && uit.length < lengte) uit += TEKENS[x % TEKENS.length];
    }
  }
  return uit;
}

// Gebruikersnaam zoals in login.html: spaties eraf; % en _ niet als jokerteken laten tellen.
export function schoneNaam(naam: unknown): string {
  return String(naam ?? "").trim().slice(0, 40);
}
function zonderJokers(s: string) {
  return s.replace(/[\\%_]/g, (m) => "\\" + m);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return antwoord({ ok: false, reden: "alleen POST" }, 405);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Wie vraagt er? Alleen met een geldige inlogpas.
    const pas = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let uid: string | null = null;
    if (pas) {
      const { data } = await supabase.auth.getUser(pas);
      uid = data && data.user ? data.user.id : null;
    }
    if (!uid) return antwoord({ ok: false, reden: "niet ingelogd" }, 401);

    // 2. Alleen een moderator.
    const { data: ik, error: ikFout } = await supabase
      .from("profiles").select("is_moderator").eq("id", uid).maybeSingle();
    if (ikFout) throw ikFout;
    if (!ik || ik.is_moderator !== true) return antwoord({ ok: false, reden: "geen moderator" }, 403);

    // 3. Over wie gaat het?
    let invoer: Record<string, unknown> = {};
    try { invoer = await req.json(); } catch (_e) { /* leeg */ }
    const naam = schoneNaam(invoer.gebruikersnaam);
    if (!naam) return antwoord({ ok: false, reden: "geen naam" }, 400);
    const { data: wie, error: wieFout } = await supabase
      .from("profiles").select("id, username, is_moderator")
      .ilike("username", zonderJokers(naam)).limit(2);
    if (wieFout) throw wieFout;
    if (!wie || wie.length === 0) return antwoord({ ok: false, reden: "niet gevonden" }, 404);
    if (wie.length > 1) return antwoord({ ok: false, reden: "niet eenduidig" }, 409);
    const doel = wie[0];
    if (doel.is_moderator === true) return antwoord({ ok: false, reden: "moderator" }, 403);

    // 4. Nieuw tijdelijk wachtwoord, en het seintje "kies zelf een nieuw" (bestaande gegevens blijven).
    const { data: huidig, error: huidigFout } = await supabase.auth.admin.getUserById(doel.id);
    if (huidigFout || !huidig?.user) return antwoord({ ok: false, reden: "niet gevonden" }, 404);
    const wachtwoord = maakTijdelijkWachtwoord();
    const { error: zetFout } = await supabase.auth.admin.updateUserById(doel.id, {
      password: wachtwoord,
      user_metadata: { ...(huidig.user.user_metadata || {}), tijdelijk_wachtwoord: true },
    });
    if (zetFout) throw zetFout;

    console.log("[wachtwoord-reset] door", uid, "voor", doel.id);
    return antwoord({ ok: true, gebruikersnaam: doel.username, wachtwoord });
  } catch (e) {
    console.error("[wachtwoord-reset] fout", e);
    return antwoord({ ok: false, reden: "serverfout" }, 500);
  }
});
