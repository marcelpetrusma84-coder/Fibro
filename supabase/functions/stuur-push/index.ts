import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  const { receiver_id, title, body, url } = await req.json()
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", receiver_id)

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: corsHeaders })
  }

  const payload = JSON.stringify({ title, body, url: url || "/Fibro/chat.html" })

  for (const sub of subs) {
    try {
      const { endpoint } = sub.subscription
      const headers = await buildVapidHeaders(endpoint, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "TTL": "86400" },
        body: payload,
      })
      console.log("Push status:", res.status)
    } catch(e) {
      console.error("Push fout:", e)
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders })
})

async function buildVapidHeaders(endpoint, publicKey, privateKey) {
  const url = new URL(endpoint)
  const audience = url.protocol + "//" + url.host
  const header = { typ: "JWT", alg: "ES256" }
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:admin@fibro.internal" }
  const encode = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  const signingInput = encode(header) + "." + encode(payload)
  const keyData = Uint8Array.from(atob(privateKey.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyData, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cryptoKey, new TextEncoder().encode(signingInput))
  const jwt = signingInput + "." + btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  return { "Authorization": "vapid t=" + jwt + ", k=" + publicKey }
}
