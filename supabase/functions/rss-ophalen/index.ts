// rss-ophalen (19 nov 2026) - haalt één RSS- of Atom-feed op voor de RSS-widget (rsswidget.js).
//
// Waarom via de server? De meeste nieuwssites (NOS, NU.nl, ...) laten een app in de browser hun feed niet zelf
// ophalen (CORS), en de huisregel van de app (connect-src) laat ook niet elke site toe. Deze functie haalt de feed
// op en geeft alleen platte tekst terug: de naam van de feed en per bericht de kop, de link en de datum.
// De nieuwssite ziet dus de server van Supabase, niet het toestel of het internetadres van de gebruiker.
//
// Alleen het toestel van de EIGENAAR van de widget roept dit aan (bij het toevoegen en om het half uur bij het
// bekijken van Home). Vrienden krijgen de koppen via P2P (sync.js, 'klein:rss') en praten met niemand.
//
// Veiligheid:
//  - alleen ingelogde, niet-geblokkeerde gebruikers; hoogstens 30 feeds per minuut per gebruiker (per server)
//  - alleen https op poort 443, geen IP-adressen, geen namen of adressen van een eigen netwerk (ook niet na het
//    opzoeken van de naam en niet na een doorverwijzing; hoogstens 3 doorverwijzingen)
//  - hoogstens 2 MB en 8 seconden; geen cookies; er gaat nooit HTML terug, alleen tekst (feed.js)
//  - de link van de feed staat in de vraag (POST), niet in het adres: zo staat hij niet in de logboeken
import { createClient } from "npm:@supabase/supabase-js@2";
import { leesFeed, netteFeedUrl, privéIp, tekenset } from "./feed.js";

const MAX_BYTES = 2 * 1024 * 1024;
const TIJD_MS = 8000;
const PER_MINUUT = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function antwoord(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Hoeveel vragen per gebruiker in de laatste minuut (alleen in het geheugen van deze server)
const vragen = new Map<string, number[]>();
function teVeel(uid: string) {
  const nu = Date.now();
  const lijst = (vragen.get(uid) || []).filter((t) => nu - t < 60000);
  lijst.push(nu);
  vragen.set(uid, lijst);
  if (vragen.size > 5000) vragen.clear();
  return lijst.length > PER_MINUUT;
}

// Wijst de naam naar een adres in een eigen netwerk? (Kan de server namen niet opzoeken, dan houdt https ons veilig:
// een adres in een eigen netwerk heeft geen geldig certificaat voor de naam van een nieuwssite.)
async function naamVeilig(host: string) {
  const dns = (Deno as unknown as { resolveDns?: (h: string, t: string) => Promise<string[]> }).resolveDns;
  if (typeof dns !== "function") return true;
  let gevonden = 0;
  for (const soort of ["A", "AAAA"]) {
    try {
      const adressen = await dns(host, soort);
      for (const a of adressen) {
        gevonden++;
        if (privéIp(a)) return false;
      }
    } catch (_e) { /* geen adressen van deze soort */ }
  }
  return gevonden > 0;
}

async function leesMax(r: Response) {
  const lengte = Number(r.headers.get("content-length") || 0);
  if (lengte > MAX_BYTES) return null;
  if (!r.body) return new Uint8Array();
  const lezer = r.body.getReader();
  const stukken: Uint8Array[] = [];
  let totaal = 0;
  while (true) {
    const { done, value } = await lezer.read();
    if (done) break;
    totaal += value.length;
    if (totaal > MAX_BYTES) { try { await lezer.cancel(); } catch (_e) { /* */ } return null; }
    stukken.push(value);
  }
  const alles = new Uint8Array(totaal);
  let p = 0;
  for (const s of stukken) { alles.set(s, p); p += s.length; }
  return alles;
}

async function haalFeed(begin: string) {
  const signaal = AbortSignal.timeout(TIJD_MS);
  let url = begin;
  for (let stap = 0; stap <= 3; stap++) {
    const nette = netteFeedUrl(url);
    if (!nette) return { fout: "adres", status: 400 };
    if (!(await naamVeilig(new URL(nette).hostname))) return { fout: "adres", status: 400 };
    const r = await fetch(nette, {
      redirect: "manual",
      signal: signaal,
      credentials: "omit",
      headers: {
        "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5",
        "User-Agent": "StekkyRSS/1.0 (feedlezer van de Stekky-app)",
      },
    });
    if (r.status >= 300 && r.status < 400) {
      const naar = r.headers.get("location");
      try { await r.body?.cancel(); } catch (_e) { /* */ }
      if (!naar) return { fout: "niet bereikbaar", status: 502 };
      url = new URL(naar, nette).href;
      continue;
    }
    if (!r.ok) { try { await r.body?.cancel(); } catch (_e) { /* */ } return { fout: "niet bereikbaar", status: 502 }; }
    const bytes = await leesMax(r);
    if (!bytes) return { fout: "te groot", status: 413 };
    const begin200 = new TextDecoder("latin1").decode(bytes.slice(0, 200));
    let tekst = "";
    try { tekst = new TextDecoder(tekenset(begin200)).decode(bytes); } catch (_e) { tekst = new TextDecoder().decode(bytes); }
    const feed = leesFeed(tekst, nette);
    if (!feed || (!feed.titel && !feed.berichten.length)) return { fout: "geen feed", status: 422 };
    return { feed };
  }
  return { fout: "te veel doorverwijzingen", status: 502 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return antwoord({ ok: false, reden: "alleen POST" }, 405);
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Wie vraagt er? Alleen met een geldige inlogpas, en niet als je geblokkeerd bent.
    const pas = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let uid: string | null = null;
    if (pas) {
      const { data } = await supabase.auth.getUser(pas);
      uid = data && data.user ? data.user.id : null;
    }
    if (!uid) return antwoord({ ok: false, reden: "niet ingelogd" }, 401);
    const { data: profiel } = await supabase.from("profiles").select("geblokkeerd").eq("id", uid).maybeSingle();
    if (profiel && profiel.geblokkeerd) return antwoord({ ok: false, reden: "geblokkeerd" }, 403);
    if (teVeel(uid)) return antwoord({ ok: false, reden: "even wachten" }, 429);

    // 2. Welke feed?
    let body: { url?: unknown } = {};
    try { body = await req.json(); } catch (_e) { /* */ }
    const url = typeof body.url === "string" ? netteFeedUrl(body.url) : null;
    if (!url) return antwoord({ ok: false, reden: "adres" }, 400);

    // 3. Ophalen en lezen
    const r = await haalFeed(url);
    if ("feed" in r && r.feed) return antwoord({ ok: true, titel: r.feed.titel, berichten: r.feed.berichten });
    return antwoord({ ok: false, reden: r.fout }, r.status || 502);
  } catch (e) {
    const tijd = e && (e as Error).name === "TimeoutError";
    return antwoord({ ok: false, reden: tijd ? "te langzaam" : "niet bereikbaar" }, tijd ? 504 : 502);
  }
});
