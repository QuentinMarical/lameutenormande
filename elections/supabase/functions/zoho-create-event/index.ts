// Edge Function : crée un évènement dans le calendrier Zoho (outil admin "Calendrier", voir
// admin/calendrier/) via l'API Zoho Calendar. Le site public ne lit jamais Zoho directement :
// le flux public reste events.ics à la racine, régénéré depuis le calendrier Zoho par le robot
// GitHub Actions .github/workflows/update-calendar.yml (toutes les heures). Cette fonction se
// contente de bien vouloir déclencher ce robot juste après création (best-effort, optionnel)
// pour ne pas attendre l'heure pleine — voir GITHUB_TOKEN/GITHUB_REPO ci-dessous.
//
// Sécurité : le JWT de l'appelant (transmis automatiquement par supabase-js functions.invoke)
// est vérifié par la gateway Supabase (verify_jwt par défaut), puis on revérifie nous-mêmes
// is_admin() via un client scopé à ce JWT avant tout appel à l'API Zoho — même table
// public.admins que les autres panels (élections/sondages).
//
// Secrets requis (Dashboard → Edge Functions → Secrets, ou `supabase secrets set`) — les vrais
// identifiants d'accès, jamais éditables depuis le panel admin :
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   GITHUB_TOKEN, GITHUB_REPO (optionnels — déclenchement immédiat du robot GitHub, hors
//     périmètre Zoho donc pas dans l'onglet Réglages ; sans eux la synchronisation se fait
//     simplement à la prochaine heure pleine)
// Les paramètres Zoho non sensibles ci-dessous ont une valeur par défaut ici, mais peuvent être
// surchargés depuis l'onglet Réglages du panel admin (table public.app_settings, clés
// zoho_calendar_uid / zoho_accounts_domain / zoho_api_domain) sans redéployer :
//   ZOHO_CALENDAR_UID, ZOHO_ACCOUNTS_DOMAIN (accounts.zoho.eu), ZOHO_API_DOMAIN (calendar.zoho.eu)
// Voir elections/supabase/README.md, section "Fonction zoho-create-event", pour la marche à
// suivre complète (création de l'appli Zoho, génération du refresh token, UID du calendrier).
//
// Déploiement : supabase functions deploy zoho-create-event
// (ou Dashboard → Edge Functions → Via Editor → coller ce fichier → Deploy, JWT verification ACTIVÉE)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ZOHO_CLIENT_ID = Deno.env.get("ZOHO_CLIENT_ID") ?? "";
const ZOHO_CLIENT_SECRET = Deno.env.get("ZOHO_CLIENT_SECRET") ?? "";
const ZOHO_REFRESH_TOKEN = Deno.env.get("ZOHO_REFRESH_TOKEN") ?? "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";

// Valeurs par défaut ; surchargeables sans redéploiement via l'onglet Réglages du panel admin
// (table public.app_settings, lue plus bas dans Deno.serve()).
const DEFAULT_ZOHO_CALENDAR_UID = Deno.env.get("ZOHO_CALENDAR_UID") ?? "";
const DEFAULT_ZOHO_ACCOUNTS_DOMAIN = Deno.env.get("ZOHO_ACCOUNTS_DOMAIN") || "accounts.zoho.eu";
const DEFAULT_ZOHO_API_DOMAIN = Deno.env.get("ZOHO_API_DOMAIN") || "calendar.zoho.eu";
const DEFAULT_GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

// Format attendu par l'API Zoho Calendar pour dateandtime.start/end : yyyyMMdd'T'HHmmss'Z' en
// UTC pour un évènement horodaté, yyyyMMdd (sans heure) pour une journée entière — le champ
// timezone à côté ne sert qu'à l'affichage, la valeur elle-même doit être en UTC.
function fmtZohoDateTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}
// Journée entière : le client envoie une date calendaire "YYYY-MM-DD" (pas un ISO/ni un objet
// Date) précisément pour éviter qu'un aller-retour par l'UTC ne fasse glisser le jour d'une
// unité dans un fuseau en avance sur UTC — on se contente donc de retirer les tirets.
function fmtZohoDate(dateStr: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

async function getAccessToken(accountsDomain: string): Promise<string> {
  const url = `https://${accountsDomain}/oauth/v2/token?refresh_token=${encodeURIComponent(ZOHO_REFRESH_TOKEN)}&client_id=${encodeURIComponent(ZOHO_CLIENT_ID)}&client_secret=${encodeURIComponent(ZOHO_CLIENT_SECRET)}&grant_type=refresh_token`;
  const r = await fetch(url, { method: "POST" });
  const j = await r.json();
  if (!j.access_token) throw new Error("ZOHO_AUTH_FAILED: " + JSON.stringify(j));
  return j.access_token as string;
}

// Best-effort : un échec ici ne doit pas faire échouer la création de l'évènement (déjà faite
// côté Zoho à ce stade) — la synchronisation horaire normale du robot prendra le relais.
async function triggerCalendarSync(githubRepo: string): Promise<void> {
  if (!GITHUB_TOKEN || !githubRepo) return;
  try {
    await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/update-calendar.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lameutenormande-zoho-tool",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    });
  } catch { /* best-effort */ }
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

  // Surcharges Zoho non sensibles réglées depuis l'onglet Réglages du panel admin (table déjà
  // lisible par cet appelant, puisqu'il vient de passer la vérification is_admin() ci-dessus).
  // Le dépôt GitHub (synchro immédiate, hors périmètre Zoho) n'est volontairement pas réglable
  // ici : reste un secret de fonction (GITHUB_REPO), voir README section 5.5.
  const { data: settingsRows } = await asCaller.from("app_settings").select("key,value")
    .in("key", ["zoho_calendar_uid", "zoho_accounts_domain", "zoho_api_domain"]);
  const settings = Object.fromEntries((settingsRows || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const calendarUid = settings.zoho_calendar_uid || DEFAULT_ZOHO_CALENDAR_UID;
  const accountsDomain = settings.zoho_accounts_domain || DEFAULT_ZOHO_ACCOUNTS_DOMAIN;
  const apiDomain = settings.zoho_api_domain || DEFAULT_ZOHO_API_DOMAIN;
  const githubRepo = DEFAULT_GITHUB_REPO;

  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN || !calendarUid) {
    return json({ error: "ZOHO_NOT_CONFIGURED" }, 500);
  }

  let p: { title?: string; location?: string; description?: string; url?: string; start?: string; end?: string; allDay?: boolean; furry?: boolean };
  try { p = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const title = String(p.title || "").trim();
  if (!title) return json({ error: "BAD_TITLE" }, 400);
  if (!p.start || !p.end) return json({ error: "BAD_DATES" }, 400);

  const allDay = !!p.allDay;
  let start: string | null, end: string | null;
  if (allDay) {
    start = fmtZohoDate(p.start);
    end = fmtZohoDate(p.end);
    if (!start || !end || end < start) return json({ error: "BAD_DATES" }, 400);
  } else {
    const startD = new Date(p.start);
    const endD = new Date(p.end);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD.getTime() < startD.getTime()) return json({ error: "BAD_DATES" }, 400);
    start = fmtZohoDateTime(startD);
    end = fmtZohoDateTime(endD);
  }

  const finalTitle = p.furry && !/\u{1F98A}/u.test(title) ? "🦊 " + title : title;
  let description = String(p.description || "").trim();
  const eventUrl = String(p.url || "").trim();
  if (eventUrl) description = description ? description + "\n\n" + eventUrl : eventUrl;

  const eventdata: Record<string, unknown> = {
    title: finalTitle,
    dateandtime: { start, end, timezone: "Europe/Paris" },
    isallday: allDay,
  };
  if (description) eventdata.description = description;
  const location = String(p.location || "").trim();
  if (location) eventdata.location = location;

  try {
    const accessToken = await getAccessToken(accountsDomain);
    const r = await fetch(`https://${apiDomain}/api/v1/calendars/${encodeURIComponent(calendarUid)}/events`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "eventdata=" + encodeURIComponent(JSON.stringify(eventdata)),
    });
    const zohoResult = await r.json();
    if (!r.ok || zohoResult?.status === "failure") return json({ error: "ZOHO_CREATE_FAILED", detail: zohoResult }, 502);

    await triggerCalendarSync(githubRepo);
    return json({ ok: true, event: zohoResult });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
