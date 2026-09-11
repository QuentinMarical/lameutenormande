// Edge Function : crée/modifie/consulte un évènement du calendrier Zoho (outil admin
// "Calendrier", voir admin/calendrier/) via l'API Zoho Calendar. Le site public ne lit jamais
// Zoho directement : le flux public reste events.ics à la racine, régénéré depuis le calendrier
// Zoho par le robot GitHub Actions .github/workflows/update-calendar.yml (toutes les heures).
// Cette fonction se contente de bien vouloir déclencher ce robot juste après création/màj
// (best-effort, optionnel) pour ne pas attendre l'heure pleine — voir GITHUB_TOKEN/GITHUB_REPO.
//
// Gardé sous le nom historique "zoho-create-event" (pas renommé en "zoho-events") pour ne pas
// devoir redéployer une nouvelle fonction : `action` dans le corps de la requête distingue
// désormais "create" (défaut), "update", "get" et "delete".
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
// Le refresh token doit couvrir le scope ZohoCalendar.calendar.READ,ZohoCalendar.event.CREATE,
// ZohoCalendar.event.READ,ZohoCalendar.event.UPDATE,ZohoCalendar.event.DELETE (le scope est figé
// à sa génération : si ton refresh token actuel ne couvrait pas DELETE, regénère-le avec ce
// scope élargi — voir README).
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

// Marqueur de présence de la Meute (convention déjà utilisée par admin/votes/ et actus.html pour
// détecter, depuis events.ics, les évènements où le staff a confirmé sa présence) : ajouter cette
// adresse comme participant "optionnel" (attendance:2 → réponse non obligatoire, c'est une
// adresse-marqueur, pas une vraie boîte mail) suffit à ce qu'elle apparaisse en ATTENDEE dans
// l'export ICS du calendrier.
const GO_ATTENDEE_EMAIL = "go@events.lameutenormande";

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

// Zoho répond parfois par une page HTML (auth/scope invalide, mauvais domaine…) plutôt qu'un
// JSON d'erreur propre : r.json() planterait alors avec un message opaque ("Unexpected token
// '<'..."). On récupère le texte brut à la place dans ce cas, tronqué, pour rester diagnosticable.
async function safeJson(r: Response): Promise<{ ok: true; data: any } | { ok: false; status: number; bodyText: string }> {
  const text = await r.text();
  try { return { ok: true, data: JSON.parse(text) }; }
  catch { return { ok: false, status: r.status, bodyText: text.slice(0, 500) }; }
}

// Zoho limite le nombre de renouvellements de jeton (grant_type=refresh_token) sur une courte
// période ("You have made too many requests continuously") : un nouveau jeton par requête
// (create/update/get) l'atteint vite en usage normal. Un jeton reste valable ~1h ; on le garde
// donc en mémoire tant que l'instance de la fonction reste "chaude" (réutilisée entre appels par
// le runtime Edge Functions), avec une marge de sécurité de 5 min avant sa vraie expiration.
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(accountsDomain: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;
  const url = `https://${accountsDomain}/oauth/v2/token?refresh_token=${encodeURIComponent(ZOHO_REFRESH_TOKEN)}&client_id=${encodeURIComponent(ZOHO_CLIENT_ID)}&client_secret=${encodeURIComponent(ZOHO_CLIENT_SECRET)}&grant_type=refresh_token`;
  const r = await fetch(url, { method: "POST" });
  const parsed = await safeJson(r);
  if (!parsed.ok) throw new Error("ZOHO_AUTH_FAILED: non-JSON response, status " + parsed.status + ": " + parsed.bodyText);
  const j = parsed.data;
  if (!j.access_token) throw new Error("ZOHO_AUTH_FAILED: " + JSON.stringify(j));
  const expiresInMs = (typeof j.expires_in === "number" ? j.expires_in : 3600) * 1000;
  cachedToken = { accessToken: j.access_token, expiresAt: Date.now() + expiresInMs - 5 * 60 * 1000 };
  return j.access_token as string;
}

// Best-effort : un échec ici ne doit pas faire échouer l'opération (déjà faite côté Zoho à ce
// stade) — la synchronisation horaire normale du robot prendra le relais.
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

type EventPayload = {
  action?: string; uid?: string; etag?: string;
  title?: string; location?: string; description?: string; url?: string;
  start?: string; end?: string; allDay?: boolean; furry?: boolean; presente?: boolean;
};

// Construit le "eventdata" envoyé à Zoho (POST création comme PUT mise à jour) : l'API remplace
// l'évènement entier à la mise à jour, donc on renvoie toujours l'ensemble des champs gérés ici
// (title/dates/description/lieu/participants), jamais un simple diff.
// callerEmail : e-mail du compte admin du site connecté (via son JWT, jamais fourni par le
// client) — toujours ajouté comme participant pour garder une trace de qui a créé/modifié
// l'évènement, et ça évite au passage d'envoyer un tableau "attendees" vide (Zoho l'interdit,
// voir plus bas) quand "présente" n'est pas coché.
function buildEventData(p: EventPayload, callerEmail: string | null): { eventdata: Record<string, unknown> } | { error: string } {
  const title = String(p.title || "").trim();
  if (!title) return { error: "BAD_TITLE" };
  if (!p.start || !p.end) return { error: "BAD_DATES" };

  const allDay = !!p.allDay;
  let start: string | null, end: string | null;
  if (allDay) {
    start = fmtZohoDate(p.start);
    end = fmtZohoDate(p.end);
    if (!start || !end || end < start) return { error: "BAD_DATES" };
  } else {
    const startD = new Date(p.start);
    const endD = new Date(p.end);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || endD.getTime() < startD.getTime()) return { error: "BAD_DATES" };
    start = fmtZohoDateTime(startD);
    end = fmtZohoDateTime(endD);
  }

  // Normalisation symétrique (pas juste un ajout) : une édition qui décoche "furry" doit aussi
  // pouvoir retirer l'émoji déjà présent dans le titre, pas seulement en empêcher l'ajout.
  const strippedTitle = title.replace(/^\u{1F98A}\s*/u, "");
  const finalTitle = p.furry ? "🦊 " + strippedTitle : strippedTitle;

  const eventdata: Record<string, unknown> = {
    title: finalTitle,
    dateandtime: { start, end, timezone: "Europe/Paris" },
    isallday: allDay,
    description: String(p.description || "").trim(),
    location: String(p.location || "").trim(),
    url: String(p.url || "").trim(),
    notify_attendee: 0,
  };
  // Zoho refuse un tableau "attendees" vide (ARRAY_SIZE_OUT_OF_RANGE, taille attendue [1-50]) :
  // jamais un tableau vide pour "aucun participant". L'admin qui enregistre (créateur ou
  // modificateur) y figure toujours, pour garder une trace de qui a touché l'évènement — en plus
  // du marqueur de présence de la Meute quand la case est cochée, pas à sa place.
  const attendees: { email: string; attendance: number }[] = [];
  if (p.presente) attendees.push({ email: GO_ATTENDEE_EMAIL, attendance: 2 });
  if (callerEmail && callerEmail.toLowerCase() !== GO_ATTENDEE_EMAIL) attendees.push({ email: callerEmail, attendance: 2 });
  if (attendees.length) eventdata.attendees = attendees;
  if (p.etag) eventdata.etag = p.etag;
  return { eventdata };
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
  const callerEmail = caller?.email ?? null;

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

  let p: EventPayload;
  try { p = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }
  const action = p.action || "create";
  const eventsBase = `https://${apiDomain}/api/v1/calendars/${encodeURIComponent(calendarUid)}/events`;

  try {
    const accessToken = await getAccessToken(accountsDomain);
    const authHeaders = { Authorization: `Zoho-oauthtoken ${accessToken}` };

    // L'UID d'évènement Zoho ("<hex>@<domaine>") va tel quel dans l'URL, non encodé : l'exemple
    // officiel de Zoho l'utilise littéral (avec le "@"), et leur routeur ne décode pas un "%40"
    // (d'où le 404 générique observé avec encodeURIComponent). On valide son format au passage.
    const UID_RE = /^[A-Za-z0-9]+@[A-Za-z0-9.-]+$/;

    if (action === "get") {
      if (!p.uid || !UID_RE.test(p.uid)) return json({ error: "BAD_UID" }, 400);
      const r = await fetch(`${eventsBase}/${p.uid}`, { headers: authHeaders });
      const parsed = await safeJson(r);
      if (!parsed.ok) return json({ error: "ZOHO_GET_FAILED", detail: { status: parsed.status, body: parsed.bodyText } }, 502);
      if (!r.ok) return json({ error: "ZOHO_GET_FAILED", detail: parsed.data }, 502);
      return json({ ok: true, event: parsed.data });
    }

    if (action === "delete") {
      if (!p.uid || !UID_RE.test(p.uid)) return json({ error: "BAD_UID" }, 400);
      const r = await fetch(`${eventsBase}/${p.uid}`, { method: "DELETE", headers: authHeaders });
      const parsed = await safeJson(r);
      if (!parsed.ok) return json({ error: "ZOHO_DELETE_FAILED", detail: { status: parsed.status, body: parsed.bodyText } }, 502);
      if (!r.ok || parsed.data?.status === "failure") return json({ error: "ZOHO_DELETE_FAILED", detail: parsed.data }, 502);
      await triggerCalendarSync(githubRepo);
      return json({ ok: true });
    }

    if (action !== "create" && action !== "update") return json({ error: "BAD_ACTION" }, 400);
    const built = buildEventData(p, callerEmail);
    if ("error" in built) return json({ error: built.error }, 400);

    const isUpdate = action === "update";
    if (isUpdate && (!p.uid || !UID_RE.test(p.uid))) return json({ error: "BAD_UID" }, 400);
    const r = await fetch(isUpdate ? `${eventsBase}/${p.uid!}` : eventsBase, {
      method: isUpdate ? "PUT" : "POST",
      headers: { ...authHeaders, "Content-Type": "application/x-www-form-urlencoded" },
      body: "eventdata=" + encodeURIComponent(JSON.stringify(built.eventdata)),
    });
    const failCode = isUpdate ? "ZOHO_UPDATE_FAILED" : "ZOHO_CREATE_FAILED";
    const parsed = await safeJson(r);
    if (!parsed.ok) return json({ error: failCode, detail: { status: parsed.status, body: parsed.bodyText } }, 502);
    const zohoResult = parsed.data;
    if (!r.ok || zohoResult?.status === "failure") return json({ error: failCode, detail: zohoResult }, 502);

    await triggerCalendarSync(githubRepo);
    return json({ ok: true, event: zohoResult });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
