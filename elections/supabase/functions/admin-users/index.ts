// Edge Function : opérations sur les comptes admin qui nécessitent l'API Admin Supabase
// (service_role) — impossible à faire depuis Postgres seul. Deux actions :
//   - invite         : crée le compte Auth (mot de passe temporaire) + la ligne public.admins.
//   - reset_password : régénère un mot de passe temporaire pour un compte admin existant.
// Activer/désactiver un compte se fait entièrement en SQL (admin_set_disabled), sans passer ici.
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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Alphabet sans caractères ambigus, avec au moins un peu de diversité de classes de caractères.
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function genTempPassword(len = 14) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: isAdmin, error: isAdminErr } = await asCaller.rpc("is_admin");
  if (isAdminErr || !isAdmin) return json({ error: "ADMIN_REQUIRED" }, 403);

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
      return json({ ok: true, user_id: created.user.id, email, temp_password: tempPassword });
    }

    if (p.action === "reset_password") {
      const userId = String(p.user_id || "");
      if (!userId) return json({ error: "BAD_USER" }, 400);
      const tempPassword = genTempPassword();
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
      if (updErr) return json({ error: updErr.message }, 400);
      await admin.from("admins").update({ must_change_password: true }).eq("user_id", userId);
      return json({ ok: true, temp_password: tempPassword });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
