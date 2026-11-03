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
  oproep: {
    nl: { title: "Fibro", body: "📞 {naam} belt je" },
    en: { title: "Fibro", body: "📞 {naam} is calling you" },
  },
  "oproep-video": {
    nl: { title: "Fibro", body: "📹 {naam} belt je (video)" },
    en: { title: "Fibro", body: "📹 {naam} is video calling you" },
  },
  gemist: {
    nl: { title: "Fibro", body: "📵 Gemiste oproep van {naam}" },
    en: { title: "Fibro", body: "📵 Missed call from {naam}" },
  },
  spel: {
    nl: { title: "Fibro", body: "🎮 {naam} daagt je uit voor {spel}!" },
    en: { title: "Fibro", body: "🎮 {naam} challenges you to {spel}!" },
  },
  "spel-gemist": {
    nl: { title: "Fibro", body: "🎮 {naam} wilde {spel} met je spelen" },
    en: { title: "Fibro", body: "🎮 {naam} wanted to play {spel} with you" },
  },
  "spel-verlaten": {
    nl: { title: "Fibro", body: "🎮 {naam} heeft jullie spel {spel} verlaten" },
    en: { title: "Fibro", body: "🎮 {naam} left your game of {spel}" },
  },
  "vriend-nieuw": {
    nl: { title: "Fibro", body: "🎉 {naam} heeft je uitnodiging aangenomen! Zeg hoi 👋" },
    en: { title: "Fibro", body: "🎉 {naam} accepted your invite! Say hi 👋" },
  },
  gastenboek: {
    nl: { title: "Fibro", body: "📖 {naam} schreef in je gastenboek" },
    en: { title: "Fibro", body: "📖 {naam} wrote in your guestbook" },
  },
  moderatie: {
    nl: { title: "Fibro · Moderatie", body: "🚩 Er is een nieuwe melding. Kijk in Moderatie." },
    en: { title: "Fibro · Moderation", body: "🚩 There is a new report. Check Moderation." },
  },
};
const MELDING_BINNEN_MS = 2 * 60 * 1000
const BERICHT_VERS_MS = 2 * 60 * 1000 // een bericht krijgt alleen kort na het versturen een melding
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Hoe lang de pushdienst een melding bewaart als de telefoon even onbereikbaar is (seconden)
const LEVENSDUUR: Record<string, number> = { oproep: 45, "oproep-video": 45, gemist: 24 * 60 * 60, spel: 120, "spel-gemist": 24 * 60 * 60, "spel-verlaten": 60 * 60,
  "vriend-nieuw": 3 * 24 * 60 * 60, gastenboek: 3 * 24 * 60 * 60 };
const GASTENBOEK_RUST_MS = 10 * 60 * 1000; // v258: zelfde vriend, zelfde gastenboek: hoogstens een melding per 10 minuten
// v258: deze meldingen komen alleen van de server (met een id), nooit van een app met receiver_id + type
const ALLEEN_SERVER = new Set(["spel", "vriend-nieuw", "gastenboek"]);
// v257: de spellen (zelfde namen als in de chat, SPEL_INFO)
const SPELNAMEN: Record<string, { nl: string; en: string }> = {
  botkaaseiren: { nl: "Tic-Tac-Toe", en: "Tic-Tac-Toe" }, vieroprij: { nl: "Four in a Row", en: "Four in a Row" },
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
  uitn: { spel: string; van: string; sessie: string } | null = null) {
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
      body: tekst.body.replace("{naam}", naam).replace("{spel}", spelNaam),
      url: bellen
        ? "/Fibro/bellen.html?vriend=" + encodeURIComponent(afzender) + "&naam=" + encodeURIComponent(naam) +
          "&inkomend=1" + (soort === "oproep-video" ? "&video=1" : "")
        : soort === "spel" && uitn
        ? "/Fibro/chat.html?spelVriend=" + encodeURIComponent(afzender) + "&spelType=" + encodeURIComponent(uitn.spel) +
          "&sessieId=" + encodeURIComponent(uitn.sessie) + "&starterId=" + encodeURIComponent(afzender)
        : isSpel || soort === "vriend-nieuw" ? "/Fibro/chat.html?vriend=" + encodeURIComponent(afzender)
        : soort === "gastenboek" ? "/Fibro/index.html" // v258: je gastenboek staat op je beginscherm
        : "/Fibro/chat.html",
      type: soort,
    };
    if (bellen || soort === "gemist") melding.tag = "oproep-" + afzender;
    if (isSpel) melding.tag = "spel-" + afzender; // v257: gemist en verlaten vervangen de uitnodiging
    if (soort === "vriend-nieuw") melding.tag = "vriend-" + afzender; // v258
    if (soort === "gastenboek") melding.tag = "gastenboek-" + afzender;
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
