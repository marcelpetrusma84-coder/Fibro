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
//
// v2 (19 nov 2026): ook één plaatje doorgeven ({ plaatje: url }). Licht voor de server: hij rekent niet (de telefoon
// van de eigenaar verkleint het), hoogstens 300 KB, alleen echte plaatjes (jpg, png, webp, gif, avif; op de eerste
// bytes gecontroleerd), dezelfde regels als bij feeds, en hoogstens 40 plaatjes per minuut per gebruiker. De telefoon
// vraagt alleen plaatjes van nieuwe berichten, hoogstens 6 per keer (rsswidget.js). Er wordt niets bewaard.
//
// v3 (19 nov 2026): ook voor de Mastodon-widget (mastodon.js): die leest de openbare RSS-feed van een account
// (https://server/@naam.rss). Geen inloggen bij Mastodon. Gevoelige berichten en berichten met een
// inhoudswaarschuwing krijgen geen plaatje-adres (feed.js), dus die plaatjes haalt de server nooit op.
import { createClient } from "npm:@supabase/supabase-js@2";
import { leesFeed, netteFeedUrl, privéIp, soortPlaatje, tekenset } from "./feed.js";

const MAX_BYTES = 2 * 1024 * 1024;
const TIJD_MS = 8000;
const PER_MINUUT = 30;
const MAX_PLAATJE = 300 * 1024;
const PLAATJES_PER_MINUUT = 40;

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
function teVeel(sleutel: string, max = PER_MINUUT) {
  const nu = Date.now();
  const lijst = (vragen.get(sleutel) || []).filter((t) => nu - t < 60000);
  lijst.push(nu);
  vragen.set(sleutel, lijst);
  if (vragen.size > 5000) vragen.clear();
  return lijst.length > max;
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

async function leesMax(r: Response, max = MAX_BYTES) {
  const lengte = Number(r.headers.get("content-length") || 0);
  if (lengte > max) return null;
  if (!r.body) return new Uint8Array();
  const lezer = r.body.getReader();
  const stukken: Uint8Array[] = [];
  let totaal = 0;
  while (true) {
    const { done, value } = await lezer.read();
    if (done) break;
    totaal += value.length;
    if (totaal > max) { try { await lezer.cancel(); } catch (_e) { /* */ } return null; }
    stukken.push(value);
  }
  const alles = new Uint8Array(totaal);
  let p = 0;
  for (const s of stukken) { alles.set(s, p); p += s.length; }
  return alles;
}

// Veilig ophalen: elke stap (ook na een doorverwijzing) opnieuw gecontroleerd; hoogstens 3 doorverwijzingen
async function haalVeilig(begin: string, accept: string, max: number) {
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
      headers: { "Accept": accept, "User-Agent": "StekkyRSS/1.0 (feedlezer van de Stekky-app)" },
    });
    if (r.status >= 300 && r.status < 400) {
      const naar = r.headers.get("location");
      try { await r.body?.cancel(); } catch (_e) { /* */ }
      if (!naar) return { fout: "niet bereikbaar", status: 502 };
      url = new URL(naar, nette).href;
      continue;
    }
    if (!r.ok) { try { await r.body?.cancel(); } catch (_e) { /* */ } return { fout: "niet bereikbaar", status: 502 }; }
    const bytes = await leesMax(r, max);
    if (!bytes) return { fout: "te groot", status: 413 };
    return { bytes, url: nette };
  }
  return { fout: "te veel doorverwijzingen", status: 502 };
}

async function haalFeed(begin: string) {
  const r = await haalVeilig(begin, "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5", MAX_BYTES);
  if (!("bytes" in r) || !r.bytes) return r;
  {
    const bytes = r.bytes, nette = r.url;
    const begin200 = new TextDecoder("latin1").decode(bytes.slice(0, 200));
    let tekst = "";
    try { tekst = new TextDecoder(tekenset(begin200)).decode(bytes); } catch (_e) { tekst = new TextDecoder().decode(bytes); }
    const feed = leesFeed(tekst, nette);
    if (!feed || (!feed.titel && !feed.berichten.length)) return { fout: "geen feed", status: 422 };
    return { feed };
  }
}

async function haalPlaatje(begin: string) {
  const r = await haalVeilig(begin, "image/avif, image/webp, image/jpeg, image/png, image/gif;q=0.9", MAX_PLAATJE);
  if (!("bytes" in r) || !r.bytes) return r;
  const soort = soortPlaatje(r.bytes);
  if (!soort) return { fout: "geen plaatje", status: 422 };
  return { bytes: r.bytes, soort };
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
    let body: { url?: unknown; plaatje?: unknown } = {};
    try { body = await req.json(); } catch (_e) { /* */ }

    // v2: één plaatje doorgeven (niet bewaren, niet verkleinen)
    if (typeof body.plaatje === "string") {
      if (teVeel("p:" + uid, PLAATJES_PER_MINUUT)) return antwoord({ ok: false, reden: "even wachten" }, 429);
      const adres = netteFeedUrl(body.plaatje);
      if (!adres) return antwoord({ ok: false, reden: "adres" }, 400);
      const p = await haalPlaatje(adres);
      if (!("soort" in p) || !p.bytes) return antwoord({ ok: false, reden: p.fout }, p.status || 502);
      return new Response(p.bytes, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": p.soort, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    }

    // 2. Welke feed?
    if (teVeel(uid)) return antwoord({ ok: false, reden: "even wachten" }, 429);
    const url = typeof body.url === "string" ? netteFeedUrl(body.url) : null;
    if (!url) return antwoord({ ok: false, reden: "adres" }, 400);

    // 3. Ophalen en lezen
    const r = await haalFeed(url);
    if ("feed" in r && r.feed) return antwoord({ ok: true, titel: r.feed.titel, berichten: r.feed.berichten, afbeelding: r.feed.afbeelding, link: r.feed.link });
    return antwoord({ ok: false, reden: r.fout }, r.status || 502);
  } catch (e) {
    const tijd = e && (e as Error).name === "TimeoutError";
    return antwoord({ ok: false, reden: tijd ? "te langzaam" : "niet bereikbaar" }, tijd ? 504 : 502);
  }
});
