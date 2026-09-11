// Edge Function : opérations sur les comptes admin qui nécessitent l'API Admin Supabase
// (service_role) — impossible à faire depuis Postgres seul. Trois actions :
//   - invite         : crée le compte Auth (mot de passe temporaire) + la ligne public.admins.
//   - reset_password : régénère un mot de passe temporaire pour un compte admin existant.
//   - delete         : supprime le compte Auth (cascade sur public.admins, cf. FK on delete cascade).
// Activer/désactiver un compte se fait entièrement en SQL (admin_set_disabled), sans passer ici.
// Les trois actions sont journalisées (best-effort) via la RPC public.log_admin_action(), lue par
// admin/logs/ — jamais le mot de passe temporaire généré, seulement l'email/label/user_id.
//
// Sécurité : le JWT de l'appelant (transmis automatiquement par supabase-js functions.invoke)
// est vérifié par la gateway Supabase (verify_jwt par défaut, PAS de --no-verify-jwt au déploiement),
// puis on revérifie nous-mêmes is_admin() via un client scopé à ce JWT avant toute opération
// service_role. Aucun secret à configurer : SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY
// sont injectées automatiquement dans l'environnement de toute Edge Function Supabase.
//
// Déploiement : supabase functions deploy admin-users
// (ou Dashboard → Edge Functions → Via Editor → coller ce fichier → Deploy, JWT verification ACTIVÉE)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS : la fonction est appelée depuis le navigateur (E.sb.functions.invoke), qui préfixe
// tout POST cross-origin d'un preflight OPTIONS ; sans ces en-têtes le navigateur bloque la
// réponse avant même qu'elle atteigne le code de l'app (invisible côté logs de la function).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

// Sans caractères ambigus. Le projet Supabase exige au moins un caractère de chacune des 4
// classes (minuscule/majuscule/chiffre/symbole) : un tirage purement aléatoire sur un alphabet
// mixte ne le garantit pas à coup sûr, donc on force un caractère de chaque classe puis on
// complète aléatoirement avant de mélanger (sinon Supabase rejette la création/le reset avec
// "Password should contain at least one character of each: ...").
const CLASSES = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghjkmnpqrstuvwxyz", "23456789", "!@#$%^&*-_+="];
const ALL_CHARS = CLASSES.join("");
function randChar(alphabet: string) {
  return alphabet[crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length];
}
function genTempPassword(len = 14) {
  const chars = CLASSES.map(randChar);
  while (chars.length < len) chars.push(randChar(ALL_CHARS));
  // Fisher-Yates : les 4 caractères garantis ne doivent pas rester groupés en tête.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Best-effort (un échec ici ne doit jamais faire échouer l'opération elle-même, déjà faite côté
// Auth à ce stade) : public.log_admin_action() revérifie is_admin() et dérive l'acteur de
// auth.uid() côté serveur, sûr à appeler avec le JWT de l'appelant. Ne JAMAIS faire porter à
// details le mot de passe temporaire généré (invite/reset_password) — l'audit reste lisible par
// tout admin, pas un canal pour se repasser un secret.
async function logAdminAction(sb: ReturnType<typeof createClient>, action: string, target?: string | null, details?: Record<string, unknown>): Promise<void> {
  try { await sb.rpc("log_admin_action", { p_action: action, p_target: target ?? null, p_details: details ?? {} }); } catch { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: isAdmin, error: isAdminErr } = await asCaller.rpc("is_admin");
  if (isAdminErr || !isAdmin) return json({ error: "ADMIN_REQUIRED" }, 403);
  const { data: { user: caller } } = await asCaller.auth.getUser();

  let p: { action?: string; email?: string; label?: string; user_id?: string };
  try { p = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    if (p.action === "invite") {
      const email = String(p.email || "").trim().toLowerCase();
      const label = String(p.label || "").trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "BAD_EMAIL" }, 400);
      const tempPassword = genTempPassword();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
      });
      if (createErr || !created.user) return json({ error: createErr?.message || "CREATE_FAILED" }, 400);
      const { error: insErr } = await admin.from("admins").insert({
        user_id: created.user.id, label: label || null, must_change_password: true,
      });
      if (insErr) {
        // Pas de compte Auth orphelin (sans ligne admins) si l'insertion échoue.
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: insErr.message }, 400);
      }
      await logAdminAction(asCaller, "admin_invited", created.user.id, { email, label: label || null });
      return json({ ok: true, user_id: created.user.id, email, temp_password: tempPassword });
    }

    if (p.action === "reset_password") {
      const userId = String(p.user_id || "");
      if (!userId) return json({ error: "BAD_USER" }, 400);
      const tempPassword = genTempPassword();
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
      if (updErr) return json({ error: updErr.message }, 400);
      await admin.from("admins").update({ must_change_password: true }).eq("user_id", userId);
      await logAdminAction(asCaller, "admin_password_reset", userId);
      return json({ ok: true, temp_password: tempPassword });
    }

    if (p.action === "delete") {
      const userId = String(p.user_id || "");
      if (!userId) return json({ error: "BAD_USER" }, 400);
      if (caller && userId === caller.id) return json({ error: "CANNOT_DELETE_SELF" }, 400);
      const { data: target } = await admin.from("admins").select("is_dev").eq("user_id", userId).maybeSingle();
      if (!target) return json({ error: "ADMIN_NOT_FOUND" }, 404);
      if (target.is_dev) return json({ error: "CANNOT_DELETE_DEV" }, 400);
      const { count } = await admin.from("admins").select("user_id", { count: "exact", head: true }).eq("disabled", false).neq("user_id", userId);
      if (!count) return json({ error: "CANNOT_DELETE_LAST_ADMIN" }, 400);
      // La ligne public.admins disparaît automatiquement (FK user_id ... on delete cascade).
      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) return json({ error: delErr.message }, 400);
      await logAdminAction(asCaller, "admin_deleted", userId);
      return json({ ok: true });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
