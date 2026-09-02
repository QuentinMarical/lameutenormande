// Edge Function : connexion via le Telegram Login Widget.
// 1. Vérifie la signature HMAC des données du widget (secret = SHA256(bot token)).
// 2. Vérifie que l'utilisateur est membre du groupe principal (getChatMember).
// 3. Crée / retrouve le compte Supabase, met à jour le profil.
// 4. Renvoie un token_hash de magic link que le front échange contre une session.
//
// Secrets requis : TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fournis par la plateforme).
// Déploiement : supabase functions deploy telegram-auth --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAIL_DOMAIN = Deno.env.get("TELEGRAM_EMAIL_DOMAIN") ?? "telegram.lameutenormande.fr";
const MAX_AGE_S = 300;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function verifyTelegram(data: Record<string, string>): Promise<boolean> {
  const { hash, ...rest } = data;
  if (!hash) return false;
  const checkString = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("\n");
  const secret = await crypto.subtle.digest("SHA-256", enc.encode(BOT_TOKEN));
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(checkString)));
  return sig === hash;
}

async function isChatMember(userId: string): Promise<boolean> {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(CHAT_ID)}&user_id=${userId}`);
  const j = await r.json();
  if (!j.ok) return false;
  return ["creator", "administrator", "member", "restricted"].includes(j.result?.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!BOT_TOKEN || !CHAT_ID) return json({ error: "Function non configurée (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  // Ne garder que les champs signés par Telegram, en chaînes
  const allowed = ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"];
  const data: Record<string, string> = {};
  for (const k of allowed) if (body[k] !== undefined && body[k] !== null) data[k] = String(body[k]);

  if (!data.id || !data.auth_date || !data.hash) return json({ error: "Données Telegram incomplètes" }, 400);
  if (!(await verifyTelegram(data))) return json({ error: "Signature Telegram invalide" }, 401);
  if (Math.abs(Date.now() / 1000 - Number(data.auth_date)) > MAX_AGE_S) return json({ error: "Connexion expirée, réessaie" }, 401);

  const isMember = await isChatMember(data.id);
  const email = `tg_${data.id}@${EMAIL_DOMAIN}`;
  const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || `Telegram ${data.id}`;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Retrouver l'utilisateur via le profil (provider, provider_id)
  let userId: string | null = null;
  const { data: prof } = await admin.from("profiles").select("user_id").eq("provider", "telegram").eq("provider_id", data.id).maybeSingle();
  if (prof) userId = prof.user_id;

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email, email_confirm: true,
      user_metadata: { provider: "telegram", provider_id: data.id, username: data.username ?? null, display_name: displayName, avatar_url: data.photo_url ?? null },
    });
    if (error) {
      // L'email existe déjà (profil supprimé ?) : on le retrouve
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list?.users.find((u) => u.email === email);
      if (!found) return json({ error: "Création du compte impossible : " + error.message }, 500);
      userId = found.id;
    } else userId = created.user.id;
  }

  const { error: upErr } = await admin.from("profiles").upsert({
    user_id: userId, provider: "telegram", provider_id: data.id,
    username: data.username ?? null, display_name: displayName, avatar_url: data.photo_url ?? null,
    is_member: isMember, member_checked_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (upErr) return json({ error: "Mise à jour du profil impossible : " + upErr.message }, 500);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) return json({ error: "Génération de session impossible : " + (linkErr?.message ?? "") }, 500);

  return json({ ok: true, token_hash: link.properties.hashed_token, is_member: isMember });
});
