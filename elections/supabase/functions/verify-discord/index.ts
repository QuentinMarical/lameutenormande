// Edge Function : après connexion OAuth Discord, vérifie que le compte est sur le serveur
// de la Meute (scope "guilds") et met à jour le profil (username, avatar, date de création, is_member).
//
// Secrets requis : DISCORD_GUILD_ID (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY fournis).
// Déploiement : supabase functions deploy verify-discord

import { createClient } from "npm:@supabase/supabase-js@2";

const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DISCORD_EPOCH = 1420070400000n;
const snowflakeToDate = (id: string) => new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!GUILD_ID) return json({ error: "Function non configurée (DISCORD_GUILD_ID)" }, 500);

  // Identifier l'utilisateur Supabase appelant
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: uErr } = await userClient.auth.getUser();
  if (uErr || !user) return json({ error: "Non authentifié" }, 401);
  if (user.app_metadata?.provider !== "discord") return json({ error: "Ce compte n'est pas un compte Discord" }, 400);

  let body: { provider_token?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }
  const token = body.provider_token;
  if (!token) return json({ error: "provider_token manquant" }, 400);

  const headers = { Authorization: `Bearer ${token}` };
  const meRes = await fetch("https://discord.com/api/v10/users/@me", { headers });
  if (!meRes.ok) return json({ error: "Jeton Discord invalide ou expiré, reconnecte-toi" }, 401);
  const me = await meRes.json();

  // Le jeton doit appartenir au même compte que la session Supabase
  const providerId = user.user_metadata?.provider_id ?? user.user_metadata?.sub ?? user.identities?.find((i) => i.provider === "discord")?.id;
  if (providerId && String(providerId) !== String(me.id)) return json({ error: "Jeton Discord ne correspondant pas au compte" }, 403);

  const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers });
  if (!guildsRes.ok) return json({ error: "Impossible de lire la liste des serveurs (scope guilds manquant ?)" }, 502);
  const guilds: { id: string }[] = await guildsRes.json();
  const isMember = guilds.some((g) => String(g.id) === GUILD_ID);

  const avatar = me.avatar
    ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.${me.avatar.startsWith("a_") ? "gif" : "png"}?size=128`
    : null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error: upErr } = await admin.from("profiles").upsert({
    user_id: user.id, provider: "discord", provider_id: String(me.id),
    username: me.username, display_name: me.global_name ?? me.username, avatar_url: avatar,
    account_created_at: snowflakeToDate(String(me.id)).toISOString(),
    is_member: isMember, member_checked_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (upErr) return json({ error: "Mise à jour du profil impossible : " + upErr.message }, 500);

  return json({ ok: true, is_member: isMember, username: me.username });
});
