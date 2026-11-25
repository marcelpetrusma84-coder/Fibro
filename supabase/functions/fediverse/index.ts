// fediverse (25 nov 2026) - liken en reageren op PeerTube-video's met je EIGEN fediverse-account (Mastodon, of een
// server die net zo werkt: Pleroma, Akkoma, GoToSocial). Voor de PeerTube-widget (peertube.js, fediverse.js).
//
// Waarom via de server? De huisregel van de app (connect-src) laat de app alleen met Stekky en een paar goedgekeurde
// servers praten. Iemands eigen fediverse-server kan elke server zijn; die zetten we niet allemaal in de huisregel.
// Deze functie stuurt een vraag van de app door naar die ene server en geeft alleen de paar velden terug die de app
// nodig heeft (regels.js: klein()).
//
// Inloggen gaat op de pagina van de fediverse-server zelf (OAuth met PKCE): Stekky ziet het wachtwoord nooit. De
// inlogsleutel (token) staat alleen op het toestel van de gebruiker; de app stuurt hem mee in de vraag (POST, dus niet
// in het adres en niet in de logboeken). Deze functie BEWAART HEM NIET en schrijft hem nergens weg.
//
// Wat kan er (body.actie):
//   app      { server, terug }                                       -> { client_id, client_secret }  (Stekky aanmelden bij die server)
//   token    { server, terug, client_id, client_secret, code, verifier } -> { token }
//   ik       { server, token }                                       -> { acct, naam }
//   zoek     { server, token, video }                                -> { id, favoriet, likes, reacties, acct } of { geen: true }
//   like     { server, token, id, aan }                              -> { id, favoriet, likes, reacties, acct }
//   reageer  { server, token, id, tekst }                            -> { id }
//   antwoorden { server, token, id }                                 -> { antwoorden: [{ id, acct, naam, tekst, datum }] } (platte tekst)
//   uit      { server, token, client_id, client_secret }             -> { ok }  (de sleutel intrekken)
//
// Veiligheid:
//  - alleen ingelogde, niet-geblokkeerde Stekky-gebruikers; hoogstens 30 vragen per minuut per gebruiker
//  - de fediverse-server: alleen een gewone naam, https op poort 443, nooit een adres in een eigen netwerk (ook niet
//    na het opzoeken van de naam); doorverwijzingen worden niet gevolgd
//  - video's alleen van de goedgekeurde PeerTube-servers; terugadres alleen de app zelf (en de Netlify-testversies)
//  - de sleutel mag alleen zoeken, liken en reageren (SCOPES); reacties hoogstens 500 tekens
//  - hoogstens 300 KB en 8 seconden per vraag; er gaat nooit een heel antwoord van de server terug
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  APP_NAAM, SCOPES, WEBSITE, goedTerugAdres, netteServer, privéIp, netteVideo, goedStatusId, goedeSleutel, goedeCode,
  goedeVerifier, netteTekst, metVermelding, klein,
} from "./regels.js";

const TIJD_MS = 8000;
const MAX_BYTES = 300 * 1024;
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

const vragen = new Map<string, number[]>();
function teVeel(sleutel: string) {
  const nu = Date.now();
  const lijst = (vragen.get(sleutel) || []).filter((t) => nu - t < 60000);
  lijst.push(nu);
  vragen.set(sleutel, lijst);
  if (vragen.size > 5000) vragen.clear();
  return lijst.length > PER_MINUUT;
}

async function naamVeilig(host: string) {
  const dns = (Deno as unknown as { resolveDns?: (h: string, t: string) => Promise<string[]> }).resolveDns;
  if (typeof dns !== "function") return true;
  let gevonden = 0;
  for (const soort of ["A", "AAAA"]) {
    try {
      for (const a of await dns(host, soort)) { gevonden++; if (privéIp(a)) return false; }
    } catch (_e) { /* geen adressen van deze soort */ }
  }
  return gevonden > 0;
}

async function leesMax(r: Response) {
  if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) return null;
  if (!r.body) return "";
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
  return new TextDecoder().decode(alles);
}

type Vraag = { methode?: string; token?: string; json?: unknown; formulier?: Record<string, string> };
// Eén vraag aan de fediverse-server. Geeft { status, data } of { fout }.
async function vraagServer(server: string, pad: string, v: Vraag = {}) {
  if (!(await naamVeilig(server))) return { fout: "server", status: 400 };
  const headers: Record<string, string> = { "Accept": "application/json", "User-Agent": "Stekky/1.0 (+" + WEBSITE + ")" };
  if (v.token) headers["Authorization"] = "Bearer " + v.token;
  let body: string | undefined;
  if (v.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(v.json); }
  if (v.formulier) { headers["Content-Type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(v.formulier).toString(); }
  const r = await fetch("https://" + server + pad, {
    method: v.methode || (body ? "POST" : "GET"), headers, body, redirect: "manual", credentials: "omit",
    signal: AbortSignal.timeout(TIJD_MS),
  });
  if (r.status >= 300 && r.status < 400) { try { await r.body?.cancel(); } catch (_e) { /* */ } return { fout: "niet bereikbaar", status: 502 }; }
  const tekst = await leesMax(r);
  if (tekst === null) return { fout: "te groot", status: 502 };
  let data: unknown = null;
  try { data = tekst ? JSON.parse(tekst) : null; } catch (_e) { data = null; }
  if (r.status === 401 || r.status === 403) return { fout: "uitgelogd", status: 401 };
  if (r.status === 404) return { fout: "niet gevonden", status: 404 };
  if (r.status === 429) return { fout: "even wachten", status: 429 };
  if (!r.ok) return { fout: "niet bereikbaar", status: 502 };
  return { status: r.status, data };
}

// deno-lint-ignore no-explicit-any
type Body = Record<string, any>;
async function voerUit(b: Body) {
  const server = netteServer(b.server);
  if (!server) return { fout: "server", status: 400 };
  const actie = b.actie;
  const nodigToken = ["ik", "zoek", "like", "reageer", "antwoorden", "uit"].includes(actie);
  if (nodigToken && !goedeSleutel(b.token)) return { fout: "uitgelogd", status: 401 };

  if (actie === "app") {
    if (!goedTerugAdres(b.terug)) return { fout: "terugadres", status: 400 };
    const r = await vraagServer(server, "/api/v1/apps", { json: { client_name: APP_NAAM, redirect_uris: b.terug, scopes: SCOPES, website: WEBSITE } });
    return "fout" in r ? r : { data: klein("app", r.data) };
  }
  if (actie === "token") {
    if (!goedTerugAdres(b.terug) || !goedeSleutel(b.client_id) || !goedeSleutel(b.client_secret) || !goedeCode(b.code) || !goedeVerifier(b.verifier)) return { fout: "gegevens", status: 400 };
    const r = await vraagServer(server, "/oauth/token", { formulier: {
      grant_type: "authorization_code", code: b.code, client_id: b.client_id, client_secret: b.client_secret,
      redirect_uri: b.terug, code_verifier: b.verifier, scope: SCOPES,
    } });
    return "fout" in r ? r : { data: klein("token", r.data) };
  }
  if (actie === "ik") {
    const r = await vraagServer(server, "/api/v1/accounts/verify_credentials", { token: b.token });
    return "fout" in r ? r : { data: klein("ik", r.data) };
  }
  if (actie === "zoek") {
    const video = netteVideo(b.video);
    if (!video) return { fout: "video", status: 400 };
    const q = new URLSearchParams({ q: video, resolve: "true", type: "statuses", limit: "1" });
    const r = await vraagServer(server, "/api/v2/search?" + q.toString(), { token: b.token });
    return "fout" in r ? r : { data: klein("zoek", r.data) };
  }
  if (actie === "like") {
    if (!goedStatusId(b.id)) return { fout: "gegevens", status: 400 };
    const r = await vraagServer(server, "/api/v1/statuses/" + b.id + (b.aan === false ? "/unfavourite" : "/favourite"), { token: b.token, methode: "POST" });
    return "fout" in r ? r : { data: klein("status", r.data) };
  }
  if (actie === "reageer") {
    const tekst = netteTekst(b.tekst);
    if (!goedStatusId(b.id) || !tekst) return { fout: "gegevens", status: 400 };
    // eerst het bericht zelf: van wie is de video? Die naam komt vooraan, zodat de maker de reactie echt krijgt
    const s = await vraagServer(server, "/api/v1/statuses/" + b.id, { token: b.token });
    if ("fout" in s) return s;
    const status = klein("status", s.data);
    if (!status) return { fout: "niet gevonden", status: 404 };
    const r = await vraagServer(server, "/api/v1/statuses", { token: b.token, json: {
      status: metVermelding(tekst, status.acct), in_reply_to_id: b.id, visibility: "public",
    } });
    if ("fout" in r) return r;
    const nieuw = klein("status", r.data);
    return nieuw ? { data: { id: nieuw.id } } : { fout: "niet bereikbaar", status: 502 };
  }
  if (actie === "antwoorden") {
    // de antwoorden op één van je eigen reacties (alleen voor je eigen Home; bezoekers zien niets)
    if (!goedStatusId(b.id)) return { fout: "gegevens", status: 400 };
    const r = await vraagServer(server, "/api/v1/statuses/" + b.id + "/context", { token: b.token });
    return "fout" in r ? r : { data: klein("context", r.data) };
  }
  if (actie === "uit") {
    if (!goedeSleutel(b.client_id) || !goedeSleutel(b.client_secret)) return { data: { ok: true } };
    const r = await vraagServer(server, "/oauth/revoke", { formulier: { client_id: b.client_id, client_secret: b.client_secret, token: b.token } });
    return { data: { ok: !("fout" in r) } };
  }
  return { fout: "actie", status: 400 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return antwoord({ ok: false, reden: "alleen POST" }, 405);
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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
    let body: Body = {};
    try { body = await req.json(); } catch (_e) { /* */ }
    if (!body || typeof body !== "object") body = {};
    const r = await voerUit(body);
    if ("fout" in r) return antwoord({ ok: false, reden: r.fout }, r.status || 502);
    if (!r.data) return antwoord({ ok: false, reden: "niet bereikbaar" }, 502);
    return antwoord({ ok: true, ...r.data });
  } catch (e) {
    const tijd = e && (e as Error).name === "TimeoutError";
    return antwoord({ ok: false, reden: tijd ? "te langzaam" : "niet bereikbaar" }, tijd ? 504 : 502);
  }
});
