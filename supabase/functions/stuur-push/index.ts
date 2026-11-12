// stuur-push - een pushmelding naar de telefoon(s) van een vriend (v148, 12 oktober 2026; nu v258)
//
// v148: de tekst komt nu van de server, in de taal van de ontvanger (profiles.taal, zie
// sql/taal.sql). Wat de app als title/body meestuurt (oudere versies doen dat nog), telt niet
// meer. Alleen een ingelogde gebruiker kan een melding sturen, en alleen naar een vriend
// (friendships, status accepted; blokkeren haalt de vriendschap weg). Een geblokkeerd account
// stuurt niets. Zo kan niemand meer met een zelfgekozen tekst meldingen naar een account sturen.
// type: 'bericht' (standaard) of 'buzz'. Het type gaat mee naar de service worker (trillen).
// v151 (15 oktober 2026): ook 'oproep', 'oproep-video' en 'gemist' (bellen). Een oproep opent het
// belscherm (bellen.html, inkomend: opnemen of weigeren) en leeft maar 45 s bij de pushdienst: staat
// de telefoon uit, dan komt er later geen 'belt je' meer binnen. 'gemist' vervangt hem (zelfde tag).
// v255 (2 nov 2026): type 'moderatie': na een melding (tabel rapporten) krijgen alle moderators een pushmelding
// "Nieuwe melding in Moderatie", zonder inhoud. Mag alleen als de afzender in de laatste 2 minuten zelf een melding deed.
// v256 (3 nov 2026): de melding bij een nieuw bericht of buzz komt nu van de SERVER: een trigger op messages
// (sql/push-vanaf-server.sql) roept deze functie aan met { message_id }. De app van de afzender doet dat ook nog (als
// reserve), maar elk bericht geeft hoogstens EEN melding: de tabel push_log (message_id als sleutel) is het slot.
// Zo komt de melding ook als de afzender Fibro meteen sluit of zijn internet net wegvalt. Zonder inlogpas: het bericht
// moet bestaan, minder dan 2 minuten oud zijn en nog geen melding hebben gehad; afzender en ontvanger komen uit het
// bericht zelf. Oude versies van de app (receiver_id + type, met inlogpas) gebruiken hetzelfde slot.
// v257 (3 nov 2026): meldingen voor spellen.
//  - 'spel': een uitnodiging ("Bram daagt je uit voor Draughts"). Via { message_id } van het uitnodigingsbericht
//    ('spelinvite:<spel>:<van>:<sessie>'); een tik opent de chat en het spel. Leeft 2 minuten (je vriend wacht).
//  - 'spel-gemist': de uitnodiger stopte met wachten en je kwam niet. Vervangt de uitnodiging (zelfde tag).
//  - 'spel-verlaten': je vriend ging weg uit jullie spel terwijl jij er even niet was.
//    Deze twee met inlogpas en { receiver_id, type, spel }; alleen als er de laatste uren echt een uitnodiging tussen
//    jullie was (gemist: van de afzender aan jou, het laatste half uur).
// v258 (3 nov 2026): makkelijker contact. Twee nieuwe meldingen, allebei alleen vanaf de server (triggers in
// sql/contact-push.sql), met alleen een id; alles komt uit de rij zelf en elke rij geeft hoogstens EEN melding (push_log).
//  - 'vriend-nieuw': { invite_id } "Sanne heeft je uitnodiging aangenomen! Zeg hoi". Naar wie de uitnodiging maakte,
//    zodra iemand hem gebruikt en jullie vrienden zijn. Een tik opent de chat met de nieuwe vriend.
//  - 'gastenboek': { gastenboek_id } "Tijn schreef in je gastenboek". Niet in je eigen gastenboek, en niet opnieuw als
//    dezelfde vriend de laatste 10 minuten al eerder schreef. Wat erin staat gaat niet mee.
//  - 'like': { like_id } "❤️ Tijn reageerde op je foto" (of nummer, video), ook alleen vanaf de server (trigger op
//    profiel_likes, sql/profiel-likes.sql). Dezelfde vriend bij dezelfde eigenaar hoogstens een melding per 10 minuten.
// v266 (5 nov 2026): 'online': { online_id } "🟢 Bram is nu online". Alleen vanaf de server (trigger op profiles in
// sql/pushmeldingen.sql, als iemand online komt na minstens 30 minuten weg), volgens slimme regels zodat het niet
// irritant wordt (kiesOnlineOntvangers).
// v266: zelf kiezen (☰ > Pushmeldingen): chat_instellingen.push_uit is wat de ontvanger uitzette (buzz, spel, vriend,
// gastenboek, like, online). Dan geen melding (PUSH_GROEP, staatUit). Berichten en bellen gaan altijd door.
// groepen (10 nov 2026): { groep_bericht_id } van de trigger op groep_berichten (sql/groep-extra.sql). Alle leden behalve
// de afzender krijgen "Nieuw bericht in een groep" (zoals bij de gewone chat zonder naam of inhoud); een tik opent de
// groep. Een 'stil' bericht (reactie, weggehaald) geeft niets. Elk bericht hoogstens een keer (push_log), en per groep
// vervangt een nieuwe melding de vorige (tag).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7"; // vaste versie: een nieuwere geeft geen 'default' (boot error 10 nov 2026)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tekst = { title: string; body: string };
const TEKSTEN: Record<string, Record<string, Tekst>> = {
  groep: {
    nl: { title: "Stekky", body: "Nieuw bericht in een groep 👥" },
    en: { title: "Stekky", body: "New message in a group 👥" },
  },
  bericht: {
    nl: { title: "Stekky", body: "Je hebt een nieuw bericht 💬" },
    en: { title: "Stekky", body: "You have a new message 💬" },
  },
  buzz: {
    nl: { title: "⚡ Buzz!", body: "{naam} buzzt je!" },
    en: { title: "⚡ Buzz!", body: "{naam} is buzzing you!" },
  },
  oproep: {
    nl: { title: "Stekky", body: "📞 {naam} belt je" },
    en: { title: "Stekky", body: "📞 {naam} is calling you" },
  },
  "oproep-video": {
    nl: { title: "Stekky", body: "📹 {naam} belt je (video)" },
    en: { title: "Stekky", body: "📹 {naam} is video calling you" },
  },
  gemist: {
    nl: { title: "Stekky", body: "📵 Gemiste oproep van {naam}" },
    en: { title: "Stekky", body: "📵 Missed call from {naam}" },
  },
  spel: {
    nl: { title: "Stekky", body: "🎮 {naam} daagt je uit voor {spel}!" },
    en: { title: "Stekky", body: "🎮 {naam} challenges you to {spel}!" },
  },
  "spel-gemist": {
    nl: { title: "Stekky", body: "🎮 {naam} wilde {spel} met je spelen" },
    en: { title: "Stekky", body: "🎮 {naam} wanted to play {spel} with you" },
  },
  "spel-verlaten": {
    nl: { title: "Stekky", body: "🎮 {naam} heeft jullie spel {spel} verlaten" },
    en: { title: "Stekky", body: "🎮 {naam} left your game of {spel}" },
  },
  "vriend-nieuw": {
    nl: { title: "Stekky", body: "🎉 {naam} heeft je uitnodiging aangenomen! Zeg hoi 👋" },
    en: { title: "Stekky", body: "🎉 {naam} accepted your invite! Say hi 👋" },
  },
  gastenboek: {
    nl: { title: "Stekky", body: "📖 {naam} schreef in je gastenboek" },
    en: { title: "Stekky", body: "📖 {naam} wrote in your guestbook" },
  },
  like: {
    nl: { title: "Stekky", body: "{emoji} {naam} reageerde op je {wat}" },
    en: { title: "Stekky", body: "{emoji} {naam} reacted to your {wat}" },
  },
  online: {
    nl: { title: "Stekky", body: "🟢 {naam} is nu online" },
    en: { title: "Stekky", body: "🟢 {naam} is online now" },
  },
  moderatie: {
    nl: { title: "Stekky · Moderatie", body: "🚩 Er is een nieuwe melding. Kijk in Moderatie." },
    en: { title: "Stekky · Moderation", body: "🚩 There is a new report. Check Moderation." },
  },
};
const MELDING_BINNEN_MS = 2 * 60 * 1000
const BERICHT_VERS_MS = 2 * 60 * 1000 // een bericht krijgt alleen kort na het versturen een melding
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Hoe lang de pushdienst een melding bewaart als de telefoon even onbereikbaar is (seconden)
const LEVENSDUUR: Record<string, number> = { oproep: 45, "oproep-video": 45, gemist: 24 * 60 * 60, spel: 120, "spel-gemist": 24 * 60 * 60, "spel-verlaten": 60 * 60,
  "vriend-nieuw": 3 * 24 * 60 * 60, gastenboek: 3 * 24 * 60 * 60, like: 24 * 60 * 60 };
const GASTENBOEK_RUST_MS = 10 * 60 * 1000; // v258: zelfde vriend, zelfde gastenboek: hoogstens een melding per 10 minuten
// v258: deze meldingen komen alleen van de server (met een id), nooit van een app met receiver_id + type
const ALLEEN_SERVER = new Set(["spel", "vriend-nieuw", "gastenboek", "like", "online", "groep"]);
// v258: likes onder een foto, nummer of video (zelfde lijst als in sql/profiel-likes.sql en profielreacties.js)
const LIKE_EMOJI = new Set(["❤️", "😂", "🔥", "😍", "😮", "👏"]);
const LIKE_WAT: Record<string, { nl: string; en: string }> = {
  foto: { nl: "foto", en: "photo" }, muziek: { nl: "nummer", en: "song" }, video: { nl: "video", en: "video" },
};
const LIKE_RUST_MS = 10 * 60 * 1000;
// v257: de spellen (zelfde namen als in de chat, SPEL_INFO)
const SPELNAMEN: Record<string, { nl: string; en: string }> = {
  botkaaseiren: { nl: "Tic-Tac-Toe", en: "Tic-Tac-Toe" }, vieroprij: { nl: "Four in a Row", en: "Four in a Row" },
  pesten: { nl: "Pesten", en: "Pesten" }, // 11 nov 2026: het eerste kaartspel
  toepen: { nl: "Toepen", en: "Toepen" }, // 11 nov 2026: kaartspellen uit de Store
  eenentwintigen: { nl: "Eenentwintigen", en: "Twenty-One" },
  schaken: { nl: "Schaken", en: "Chess" }, schakendrie: { nl: "Schaken met drie spelers", en: "Three-player chess" },
  dammen: { nl: "Draughts", en: "Draughts" }, pong: { nl: "Neo Paddle", en: "Neo Paddle" }, flappybird: { nl: "Flapper", en: "Flapper" },
  swarm: { nl: "The Swarm", en: "The Swarm" }, pacman: { nl: "Ghost Tag", en: "Ghost Tag" },
  endlessrunner: { nl: "Runner & Gunner", en: "Runner & Gunner" }, pinball: { nl: "Twin Snakes", en: "Twin Snakes" },
  breakout: { nl: "Block It", en: "Block It" }, shmup: { nl: "Neon Raiders", en: "Neon Raiders" },
};
const SESSIE = /^[A-Za-z0-9_-]{1,64}$/;
const SPEL_RECENT_MS = 3 * 60 * 60 * 1000, GEMIST_RECENT_MS = 30 * 60 * 1000;
// 'spelinvite:<spel>:<van>:<sessie>' -> { spel, van, sessie } of null
function leesUitnodiging(inhoud: unknown) {
  if (typeof inhoud !== "string" || !inhoud.startsWith("spelinvite:")) return null;
  const [, spel, van, sessie] = inhoud.split(":");
  if (!Object.hasOwn(SPELNAMEN, spel) || !UUID.test(van || "") || !SESSIE.test(sessie || "")) return null;
  return { spel, van, sessie };
}
const IEMAND: Record<string, string> = { nl: "Iemand", en: "Someone" };

// v266: welke meldingen kun je uitzetten (soort -> groep in chat_instellingen.push_uit). Niet: bericht en bellen.
const PUSH_GROEP: Record<string, string> = {
  buzz: "buzz", spel: "spel", "spel-gemist": "spel", "spel-verlaten": "spel", "vriend-nieuw": "vriend",
  gastenboek: "gastenboek", like: "like", online: "online",
};
// Heeft de ontvanger deze soort uitgezet? Lukt het opzoeken niet (kolom bestaat nog niet), dan gewoon sturen.
async function staatUit(supabase: any, ontvanger: string, soort: string): Promise<boolean> {
  const groep = PUSH_GROEP[soort];
  if (!groep) return false;
  try {
    const { data, error } = await supabase.from("chat_instellingen").select("push_uit").eq("gebruiker_id", ontvanger).maybeSingle();
    if (error) { console.error("push_uit:", error.code || error); return false; }
    return Array.isArray(data && data.push_uit) && data.push_uit.includes(groep);
  } catch (e) { console.error("push_uit:", e); return false; }
}

// v266: de regels voor 'online', zodat zo'n melding niet irritant wordt. (Even weg en terug, korter dan 30 minuten,
// komt hier niet eens: dat houdt de trigger al tegen.)
const ONLINE_REGELS = {
  versMs: 2 * 60 * 1000,           // de vriend moet nu echt online zijn (laatste teken minder dan 2 minuten geleden)
  zelfOnlineMs: 5 * 60 * 1000,     // ben je zelf online (teken minder dan 5 minuten geleden), dan zie je het al in Fibro
  paarRustMs: 3 * 60 * 60 * 1000,  // dezelfde vriend hoogstens eens per 3 uur
  ontvangerRustMs: 20 * 60 * 1000, // hoogstens een online-melding per 20 minuten (wie dan ook)
  maxPerDag: 6,                    // en hoogstens 6 per 24 uur
  stilVan: 23, stilTot: 8,         // 's nachts (23:00 tot 8:00, Nederlandse tijd) niets
  levensduurS: 10 * 60,            // staat de telefoon uit, dan na 10 minuten niet meer bezorgen (dan klopt het niet meer)
};
function uurInNederland(nu: number): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "numeric", hourCycle: "h23" }).format(new Date(nu)));
  } catch (_e) { return new Date(nu).getUTCHours() + 1; }
}
// Wie krijgt een melding dat 'vriend' online kwam? kandidaten: vrienden (beide kanten 'accepted') die de schakelaar
// aan hebben, met hun profiel. log: verstuurde online-meldingen van de laatste 24 uur aan deze kandidaten.
// Geeft [{ id, taal }] terug, of [] (bijvoorbeeld 's nachts).
function kiesOnlineOntvangers(
  { nu, vriend, kandidaten, log }: {
    nu: number; vriend: string;
    kandidaten: { id: string; taal?: string; online_status?: boolean; laatst_gezien?: string | null; geblokkeerd?: boolean }[];
    log: { ontvanger: string; vriend: string; tijd: string }[];
  },
) {
  const R = ONLINE_REGELS;
  const uur = uurInNederland(nu);
  if (uur >= R.stilVan || uur < R.stilTot) return [];
  const uit: { id: string; taal?: string }[] = [];
  for (const k of kandidaten) {
    if (!k || k.id === vriend || k.geblokkeerd) continue;
    const gezien = k.laatst_gezien ? new Date(k.laatst_gezien).getTime() : 0;
    if (k.online_status && nu - gezien < R.zelfOnlineMs) continue; // zit zelf al in Fibro
    const mijn = log.filter((l) => l.ontvanger === k.id).map((l) => ({ ...l, t: new Date(l.tijd).getTime() }));
    if (mijn.some((l) => l.vriend === vriend && nu - l.t < R.paarRustMs)) continue;
    if (mijn.some((l) => nu - l.t < R.ontvangerRustMs)) continue;
    if (mijn.filter((l) => nu - l.t < 24 * 60 * 60 * 1000).length >= R.maxPerDag) continue;
    uit.push({ id: k.id, taal: k.taal });
  }
  return uit;
}

// v266: iemand kwam online (trigger op profiles). Alles komt uit de database zelf, niet uit de vraag.
async function meldOnline(supabase: any, vriend: string) {
  const nu = Date.now();
  const { data: p, error: fp } = await supabase.from("profiles")
    .select("id, username, online_status, laatst_gezien, toon_online, geblokkeerd").eq("id", vriend).maybeSingle();
  if (fp) throw fp;
  if (!p) return antwoord({ ok: false, reden: "onbekend account" }, 404);
  if (!p.online_status || p.toon_online === false || p.geblokkeerd) return antwoord({ ok: true, verstuurd: 0, reden: "niet online" });
  if (!p.laatst_gezien || nu - new Date(p.laatst_gezien).getTime() > ONLINE_REGELS.versMs) return antwoord({ ok: true, verstuurd: 0, reden: "te oud" });
  // Vrienden, van beide kanten bevestigd (blokkeren haalt de vriendschap weg)
  const { data: heen, error: f1 } = await supabase.from("friendships").select("friend_id").eq("user_id", vriend).eq("status", "accepted");
  if (f1) throw f1;
  const ids = [...new Set((heen || []).map((r: { friend_id: string }) => r.friend_id))].filter((id) => id !== vriend);
  if (!ids.length) return antwoord({ ok: true, verstuurd: 0, reden: "geen vrienden" });
  const { data: terug, error: f2 } = await supabase.from("friendships").select("user_id").in("user_id", ids).eq("friend_id", vriend).eq("status", "accepted");
  if (f2) throw f2;
  const wederzijds = new Set((terug || []).map((r: { user_id: string }) => r.user_id));
  // Wie heeft 'online' uitgezet? Standaard (geen rij) staat hij aan. (Bestaat de kolom nog niet, dan niemand.)
  const vrienden = ids.filter((id) => wederzijds.has(id));
  const { data: keuzes, error: f3 } = await supabase.from("chat_instellingen").select("gebruiker_id, push_uit").in("gebruiker_id", vrienden);
  if (f3) { console.error("chat_instellingen:", f3.code || f3); return antwoord({ ok: true, verstuurd: 0, reden: "geen schakelaar" }); }
  const uitIds = new Set((keuzes || []).filter((r: { push_uit?: string[] }) => Array.isArray(r.push_uit) && r.push_uit.includes("online"))
    .map((r: { gebruiker_id: string }) => r.gebruiker_id));
  const aanIds = vrienden.filter((id) => !uitIds.has(id));
  if (!aanIds.length) return antwoord({ ok: true, verstuurd: 0, reden: "niemand wil het" });
  let { data: kandidaten, error: f4 } = await supabase.from("profiles")
    .select("id, taal, online_status, laatst_gezien, geblokkeerd").in("id", aanIds);
  if (f4 && f4.code === "42703") ({ data: kandidaten, error: f4 } = await supabase.from("profiles").select("id, online_status, laatst_gezien, geblokkeerd").in("id", aanIds));
  if (f4) throw f4;
  const { data: log, error: f5 } = await supabase.from("online_meldingen").select("ontvanger, vriend, tijd")
    .in("ontvanger", aanIds).gte("tijd", new Date(nu - 24 * 60 * 60 * 1000).toISOString());
  if (f5) { console.error("online_meldingen:", f5.code || f5); return antwoord({ ok: true, verstuurd: 0, reden: "geen logboek" }); }
  const ontvangers = kiesOnlineOntvangers({ nu, vriend, kandidaten: kandidaten || [], log: log || [] });
  if (!ontvangers.length) return antwoord({ ok: true, verstuurd: 0, reden: "rustig houden" });

  webpush.setVapidDetails("mailto:fibro.contact@proton.me", Deno.env.get("VAPID_PUBLIC_KEY"), Deno.env.get("VAPID_PRIVATE_KEY"));
  let verstuurd = 0;
  for (const o of ontvangers) {
    // Eerst opschrijven, dan sturen: liever een melding te weinig dan twee keer dezelfde
    const { error: fl } = await supabase.from("online_meldingen").insert({ ontvanger: o.id, vriend });
    if (fl) { console.error("online_meldingen:", fl.code || fl); continue; }
    const taal = o.taal === "en" ? "en" : "nl";
    const naam = String(p.username || IEMAND[taal]).slice(0, 40);
    const payload = JSON.stringify({
      title: TEKSTEN.online[taal].title, body: TEKSTEN.online[taal].body.replace("{naam}", naam),
      url: "/Fibro/chat.html?vriend=" + encodeURIComponent(vriend), type: "online",
      tag: "online", // een nieuwe online-melding vervangt de vorige: nooit een rij op je scherm
    });
    const { data: subs } = await supabase.from("push_subscriptions").select("id, subscription").eq("user_id", o.id);
    for (const rij of subs || []) {
      try {
        await webpush.sendNotification(rij.subscription, payload, { TTL: ONLINE_REGELS.levensduurS, urgency: "low" });
        verstuurd++;
      } catch (e) {
        console.error("Push fout:", e && e.statusCode ? e.statusCode : e);
        if (e && (e.statusCode === 404 || e.statusCode === 410)) await supabase.from("push_subscriptions").delete().eq("id", rij.id);
      }
    }
  }
  return antwoord({ ok: true, verstuurd, ontvangers: ontvangers.length });
}

function antwoord(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Iets vapid instellen en een melding naar alle telefoons van een lijst accounts sturen
async function stuurNaar(supabase: any, ontvangers: { id: string; taal?: string }[], soort: string, url: string) {
  webpush.setVapidDetails("mailto:fibro.contact@proton.me", Deno.env.get("VAPID_PUBLIC_KEY"), Deno.env.get("VAPID_PRIVATE_KEY"));
  let verstuurd = 0;
  for (const o of ontvangers) {
    const taal = o.taal === "en" ? "en" : "nl";
    const payload = JSON.stringify({ ...TEKSTEN[soort][taal], url, type: soort, tag: soort });
    const { data: subs } = await supabase.from("push_subscriptions").select("id, subscription").eq("user_id", o.id);
    for (const rij of subs || []) {
      try {
        await webpush.sendNotification(rij.subscription, payload, { TTL: 24 * 60 * 60 });
        verstuurd++;
      } catch (e) {
        console.error("Push fout:", e && e.statusCode ? e.statusCode : e);
        if (e && (e.statusCode === 404 || e.statusCode === 410)) await supabase.from("push_subscriptions").delete().eq("id", rij.id);
      }
    }
  }
  return verstuurd;
}

// v256: welke melding hoort bij de inhoud van een bericht (de inhoud zelf is versleuteld: alleen het begin telt)
function soortVanBericht(inhoud: unknown): string | null {
  if (inhoud === "buzz:") return "buzz";
  if (leesUitnodiging(inhoud)) return "spel"; // v257
  if (typeof inhoud === "string" && inhoud.startsWith("e2e:")) return "bericht";
  return null; // speluitnodiging, belregel, ... : daar hoort geen berichtmelding bij
}

// v256: het slot. true = deze functie mag de melding voor dit bericht sturen (en niemand anders meer).
async function pakSlot(supabase: any, messageId: string): Promise<boolean> {
  let error;
  try { ({ error } = await supabase.from("push_log").insert({ message_id: messageId })); } catch (e) { error = e as any; }
  if (!error) return true;
  if (error.code === "23505") return false; // al verstuurd
  // Iets anders mis met het slot (bijvoorbeeld de tabel bestaat nog niet): liever een melding te veel dan geen
  console.error("push_log:", error.code || error);
  return true;
}

// v255: een nieuwe melding: alle moderators een seintje (niet de melder zelf), zonder te zeggen wat of over wie
async function meldModerators(supabase: any, afzender: string) {
  const sinds = new Date(Date.now() - MELDING_BINNEN_MS).toISOString();
  const { data: recent, error: f1 } = await supabase.from("rapporten").select("id").eq("melder_id", afzender).gte("created_at", sinds).limit(1);
  if (f1) throw f1;
  if (!recent || recent.length === 0) return antwoord({ ok: false, reden: "geen melding" }, 403);
  let { data: mods, error: f2 } = await supabase.from("profiles").select("id, taal").eq("is_moderator", true);
  if (f2 && f2.code === "42703") ({ data: mods, error: f2 } = await supabase.from("profiles").select("id").eq("is_moderator", true));
  if (f2) throw f2;
  const ontvangers = (mods || []).filter((m: { id: string }) => m.id !== afzender);
  const verstuurd = await stuurNaar(supabase, ontvangers, "moderatie", "/Fibro/moderatie.html");
  return antwoord({ ok: true, verstuurd });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const invoer = await req.json();
    const { type } = invoer;
    const { receiver_id } = invoer;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // v256: melding bij een bericht (van de trigger of van de app): alles komt uit het bericht zelf
    if (invoer.message_id) {
      const id = String(invoer.message_id);
      if (!UUID.test(id)) return antwoord({ ok: false, reden: "ongeldig bericht" }, 400);
      const { data: b, error: fb } = await supabase.from("messages")
        .select("id, sender_id, receiver_id, content, created_at").eq("id", id).maybeSingle();
      if (fb) throw fb;
      if (!b) return antwoord({ ok: false, reden: "geen bericht" }, 404);
      if (Date.now() - new Date(b.created_at).getTime() > BERICHT_VERS_MS) return antwoord({ ok: false, reden: "te oud" });
      const soort = soortVanBericht(b.content);
      if (!soort) return antwoord({ ok: false, reden: "geen melding nodig" });
      if (!(await pakSlot(supabase, b.id))) return antwoord({ ok: true, verstuurd: 0, reden: "al verstuurd" });
      const uitn = soort === "spel" ? leesUitnodiging(b.content) : null;
      if (uitn && uitn.van !== b.sender_id) return antwoord({ ok: false, reden: "ongeldige uitnodiging" }, 400);
      return await stuurVriendMelding(supabase, b.sender_id, b.receiver_id, soort, uitn);
    }

    // groepen: een nieuw bericht in een groep (trigger op groep_berichten)
    if (invoer.groep_bericht_id) {
      const id = String(invoer.groep_bericht_id);
      if (!UUID.test(id)) return antwoord({ ok: false, reden: "ongeldig bericht" }, 400);
      const { data: b, error: fb } = await supabase.from("groep_berichten")
        .select("id, groep_id, sender_id, stil, created_at").eq("id", id).maybeSingle();
      if (fb) throw fb;
      if (!b) return antwoord({ ok: false, reden: "geen bericht" }, 404);
      if (b.stil) return antwoord({ ok: false, reden: "geen melding nodig" });
      if (Date.now() - new Date(b.created_at).getTime() > BERICHT_VERS_MS) return antwoord({ ok: false, reden: "te oud" });
      const { data: afz } = await supabase.from("profiles").select("geblokkeerd").eq("id", b.sender_id).maybeSingle();
      if (!afz || afz.geblokkeerd) return antwoord({ ok: false, reden: "geblokkeerd" }, 403);
      if (!(await pakSlot(supabase, b.id))) return antwoord({ ok: true, verstuurd: 0, reden: "al verstuurd" });
      const { data: leden, error: fl } = await supabase.from("groep_leden").select("user_id").eq("groep_id", b.groep_id);
      if (fl) throw fl;
      const ids = (leden || []).map((l: any) => l.user_id).filter((u: string) => u !== b.sender_id);
      if (!ids.length) return antwoord({ ok: true, verstuurd: 0 });
      const { data: profielen } = await supabase.from("profiles").select("id, taal").in("id", ids);
      webpush.setVapidDetails("mailto:fibro.contact@proton.me", Deno.env.get("VAPID_PUBLIC_KEY"), Deno.env.get("VAPID_PRIVATE_KEY"));
      let verstuurd = 0;
      for (const p of profielen || []) {
        const taal = p.taal === "en" ? "en" : "nl";
        const payload = JSON.stringify({ ...TEKSTEN.groep[taal], url: "/Fibro/groep.html?id=" + encodeURIComponent(b.groep_id), type: "groep", tag: "groep-" + b.groep_id });
        const { data: subs } = await supabase.from("push_subscriptions").select("id, subscription").eq("user_id", p.id);
        for (const rij of subs || []) {
          try {
            await webpush.sendNotification(rij.subscription, payload, { TTL: 24 * 60 * 60 });
            verstuurd++;
          } catch (e) {
            console.error("Push fout:", e && (e as any).statusCode ? (e as any).statusCode : e);
            if (e && ((e as any).statusCode === 404 || (e as any).statusCode === 410)) await supabase.from("push_subscriptions").delete().eq("id", rij.id);
          }
        }
      }
      return antwoord({ ok: true, verstuurd });
    }

    // v258: iemand gebruikte een uitnodiging (trigger op invite_tokens): de maker hoort dat hij een nieuwe vriend heeft
    if (invoer.invite_id) {
      const id = String(invoer.invite_id);
      if (!UUID.test(id)) return antwoord({ ok: false, reden: "ongeldige uitnodiging" }, 400);
      const { data: u, error: fu } = await supabase.from("invite_tokens")
        .select("id, created_by, used_by, used_at").eq("id", id).maybeSingle();
      if (fu) throw fu;
      if (!u || !u.created_by || !u.used_by || !u.used_at) return antwoord({ ok: false, reden: "geen uitnodiging" }, 404);
      if (Date.now() - new Date(u.used_at).getTime() > BERICHT_VERS_MS) return antwoord({ ok: false, reden: "te oud" });
      if (!(await pakSlot(supabase, u.id))) return antwoord({ ok: true, verstuurd: 0, reden: "al verstuurd" });
      return await stuurVriendMelding(supabase, u.used_by, u.created_by, "vriend-nieuw");
    }

    // v258: een nieuw bericht in een gastenboek (trigger op guestbook_entries)
    if (invoer.gastenboek_id) {
      const id = String(invoer.gastenboek_id);
      if (!UUID.test(id)) return antwoord({ ok: false, reden: "ongeldig gastenboekbericht" }, 400);
      const { data: g, error: fg } = await supabase.from("guestbook_entries")
        .select("id, profile_id, author_id, created_at").eq("id", id).maybeSingle();
      if (fg) throw fg;
      if (!g || !g.profile_id || !g.author_id) return antwoord({ ok: false, reden: "geen gastenboekbericht" }, 404);
      if (g.author_id === g.profile_id) return antwoord({ ok: false, reden: "geen melding nodig" });
      const tijd = new Date(g.created_at).getTime();
      if (Date.now() - tijd > BERICHT_VERS_MS) return antwoord({ ok: false, reden: "te oud" });
      const { data: eerder, error: fe } = await supabase.from("guestbook_entries").select("id")
        .eq("profile_id", g.profile_id).eq("author_id", g.author_id).neq("id", g.id)
        .gte("created_at", new Date(tijd - GASTENBOEK_RUST_MS).toISOString()).lte("created_at", g.created_at).limit(1);
      if (fe) throw fe;
      if (eerder && eerder.length) return antwoord({ ok: true, verstuurd: 0, reden: "net al gemeld" });
      if (!(await pakSlot(supabase, g.id))) return antwoord({ ok: true, verstuurd: 0, reden: "al verstuurd" });
      return await stuurVriendMelding(supabase, g.author_id, g.profile_id, "gastenboek");
    }

    // v258: een like onder een foto, nummer of video (trigger op profiel_likes)
    if (invoer.like_id) {
      const id = String(invoer.like_id);
      if (!UUID.test(id)) return antwoord({ ok: false, reden: "ongeldige like" }, 400);
      const { data: l, error: fl } = await supabase.from("profiel_likes")
        .select("id, eigenaar, liker, soort, emoji, created_at").eq("id", id).maybeSingle();
      if (fl) throw fl;
      if (!l || !l.eigenaar || !l.liker) return antwoord({ ok: false, reden: "geen like" }, 404);
      if (!Object.hasOwn(LIKE_WAT, l.soort) || !LIKE_EMOJI.has(l.emoji)) return antwoord({ ok: false, reden: "ongeldige like" }, 400);
      const tijd = new Date(l.created_at).getTime();
      if (Date.now() - tijd > BERICHT_VERS_MS) return antwoord({ ok: false, reden: "te oud" });
      const { data: eerder, error: fe } = await supabase.from("profiel_likes").select("id")
        .eq("eigenaar", l.eigenaar).eq("liker", l.liker).neq("id", l.id)
        .gte("created_at", new Date(tijd - LIKE_RUST_MS).toISOString()).lte("created_at", l.created_at).limit(1);
      if (fe) throw fe;
      if (eerder && eerder.length) return antwoord({ ok: true, verstuurd: 0, reden: "net al gemeld" });
      if (!(await pakSlot(supabase, l.id))) return antwoord({ ok: true, verstuurd: 0, reden: "al verstuurd" });
      return await stuurVriendMelding(supabase, l.liker, l.eigenaar, "like", null, { emoji: l.emoji, soort: l.soort });
    }

    // v266: iemand kwam online (trigger op profiles)
    if (invoer.online_id) {
      const id = String(invoer.online_id);
      if (!UUID.test(id)) return antwoord({ ok: false, reden: "ongeldig account" }, 400);
      return await meldOnline(supabase, id);
    }

    if (!receiver_id && type !== "moderatie") throw new Error("receiver_id ontbreekt");

    // 1. Wie stuurt er? Alleen met een geldige inlogpas.
    const pas = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let afzender: string | null = null;
    if (pas) {
      const { data } = await supabase.auth.getUser(pas);
      afzender = data && data.user ? data.user.id : null;
    }
    if (!afzender) return antwoord({ ok: false, reden: "niet ingelogd" }, 401);
    if (type === "moderatie") return await meldModerators(supabase, afzender);
    if (afzender === receiver_id) return antwoord({ ok: false, reden: "niet naar jezelf" }, 400);

    // v257: gemiste uitnodiging en verlaten spel: alleen als er echt een uitnodiging tussen jullie was
    if (type === "spel-gemist" || type === "spel-verlaten") {
      const spel = String(invoer.spel || "");
      if (!Object.hasOwn(SPELNAMEN, spel)) return antwoord({ ok: false, reden: "onbekend spel" }, 400);
      const gemist = type === "spel-gemist";
      const sinds = new Date(Date.now() - (gemist ? GEMIST_RECENT_MS : SPEL_RECENT_MS)).toISOString();
      let q = supabase.from("messages").select("id").like("content", "spelinvite:" + spel + ":%").gte("created_at", sinds);
      q = gemist ? q.eq("sender_id", afzender).eq("receiver_id", receiver_id)
        : q.or("and(sender_id.eq." + afzender + ",receiver_id.eq." + receiver_id + "),and(sender_id.eq." + receiver_id + ",receiver_id.eq." + afzender + ")");
      const { data: was, error: fw } = await q.limit(1);
      if (fw) throw fw;
      if (!was || !was.length) return antwoord({ ok: false, reden: "geen spel" }, 403);
      return await stuurVriendMelding(supabase, afzender, receiver_id, type, { spel, van: afzender, sessie: "" });
    }
    if (ALLEEN_SERVER.has(String(type))) return antwoord({ ok: false, reden: "alleen vanaf de server" }, 400);

    // v256: oude versies van de app vragen zelf om een berichtmelding. Hetzelfde slot als de trigger: het nieuwste
    // bericht van de laatste 2 minuten van deze afzender aan deze ontvanger. Had dat al een melding, dan niets.
    const oudeSoort = Object.hasOwn(TEKSTEN, String(type)) ? String(type) : "bericht";
    if (oudeSoort === "bericht" || oudeSoort === "buzz") {
      let alVerstuurd = false;
      try { // het slot is een extraatje: lukt het opzoeken niet, dan gewoon sturen zoals vroeger
        const sinds = new Date(Date.now() - BERICHT_VERS_MS).toISOString();
        const { data: laatste, error: fl } = await supabase.from("messages").select("id, content")
          .eq("sender_id", afzender).eq("receiver_id", receiver_id).gte("created_at", sinds)
          .order("created_at", { ascending: false }).limit(5);
        if (fl) throw fl;
        const bericht = (laatste || []).find((m: { content: string }) => soortVanBericht(m.content) === oudeSoort);
        if (bericht) alVerstuurd = !(await pakSlot(supabase, bericht.id));
      } catch (e) { console.error("slot (oude app):", e); }
      if (alVerstuurd) return antwoord({ ok: true, verstuurd: 0, reden: "al verstuurd" });
    }
    return await stuurVriendMelding(supabase, afzender, receiver_id, type);
  } catch (e) {
    return antwoord({ error: String(e) }, 500);
  }
});

// Een melding van afzender aan een vriend (bericht, buzz, oproep, gemist). Alleen naar een vriend, niet als de
// afzender geblokkeerd is; tekst in de taal van de ontvanger.
async function stuurVriendMelding(supabase: any, afzender: string, receiver_id: string, type: unknown,
  uitn: { spel: string; van: string; sessie: string } | null = null, like: { emoji: string; soort: string } | null = null) {
  {
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

    // 2b. v266: heeft de ontvanger deze soort uitgezet (☰ > Pushmeldingen)? Berichten en bellen gaan altijd door.
    if (await staatUit(supabase, receiver_id, String(type))) return antwoord({ ok: true, verstuurd: 0, reden: "uitgezet" });

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
    const soort = Object.hasOwn(TEKSTEN, String(type)) ? String(type) : "bericht";
    const taal = ontvanger.taal === "en" ? "en" : "nl";
    const tekst = TEKSTEN[soort][taal];
    const naam = String(ik.username || IEMAND[taal]).slice(0, 40);
    const bellen = soort === "oproep" || soort === "oproep-video";
    const spelNaam = uitn && SPELNAMEN[uitn.spel] ? SPELNAMEN[uitn.spel][taal] : "";
    const isSpel = soort === "spel" || soort === "spel-gemist" || soort === "spel-verlaten";
    if (isSpel && !spelNaam) return antwoord({ ok: false, reden: "onbekend spel" }, 400);
    const melding: Record<string, string> = {
      title: tekst.title,
      body: tekst.body.replace("{naam}", naam).replace("{spel}", spelNaam)
        .replace("{emoji}", like ? like.emoji : "").replace("{wat}", like && LIKE_WAT[like.soort] ? LIKE_WAT[like.soort][taal] : ""),
      url: bellen
        ? "/Fibro/bellen.html?vriend=" + encodeURIComponent(afzender) + "&naam=" + encodeURIComponent(naam) +
          "&inkomend=1" + (soort === "oproep-video" ? "&video=1" : "")
        : soort === "spel" && uitn
        ? "/Fibro/chat.html?spelVriend=" + encodeURIComponent(afzender) + "&spelType=" + encodeURIComponent(uitn.spel) +
          "&sessieId=" + encodeURIComponent(uitn.sessie) + "&starterId=" + encodeURIComponent(afzender)
        : isSpel || soort === "vriend-nieuw" ? "/Fibro/chat.html?vriend=" + encodeURIComponent(afzender)
        : soort === "gastenboek" || soort === "like" ? "/Fibro/index.html" // v258: je gastenboek en je profiel staan op je beginscherm
        : "/Fibro/chat.html",
      type: soort,
    };
    if (bellen || soort === "gemist") melding.tag = "oproep-" + afzender;
    if (isSpel) melding.tag = "spel-" + afzender; // v257: gemist en verlaten vervangen de uitnodiging
    if (soort === "vriend-nieuw") melding.tag = "vriend-" + afzender; // v258
    if (soort === "gastenboek") melding.tag = "gastenboek-" + afzender;
    if (soort === "like") melding.tag = "like-" + afzender;
    const payload = JSON.stringify(melding);
    const opties = LEVENSDUUR[soort] ? { TTL: LEVENSDUUR[soort], urgency: bellen || soort === "spel" ? "high" : "normal" } : undefined;

    webpush.setVapidDetails(
      "mailto:fibro.contact@proton.me",
      Deno.env.get("VAPID_PUBLIC_KEY"),
      Deno.env.get("VAPID_PRIVATE_KEY"),
    );

    let verstuurd = 0;
    for (const rij of subs) {
      try {
        await webpush.sendNotification(rij.subscription, payload, opties);
        verstuurd++;
      } catch (e) {
        console.error("Push fout:", e && e.statusCode ? e.statusCode : e);
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().eq("id", rij.id);
        }
      }
    }
    return antwoord({ ok: true, verstuurd });
  }
}
