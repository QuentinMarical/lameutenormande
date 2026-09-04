// Edge Function : annonces Telegram (nouvelle candidature, rappels J-1 ouverture/fermeture
// candidatures et votes, résultats finaux à la clôture).
// Appelée depuis Postgres (pg_net) par notify_telegram() avec l'en-tête x-notify-secret.
//
// Secrets requis : TELEGRAM_BOT_TOKEN, TELEGRAM_ANNOUNCE_CHAT_ID, NOTIFY_SECRET, SITE_URL (optionnel).
// Déploiement : supabase functions deploy telegram-notify --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT_ID = Deno.env.get("TELEGRAM_ANNOUNCE_CHAT_ID") ?? "";
const SECRET = Deno.env.get("NOTIFY_SECRET") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://lameutenormande.fr/elections/").replace(/\/?$/, "/");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function send(text: string) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error("Telegram: " + (j.description ?? r.status));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SECRET || req.headers.get("x-notify-secret") !== SECRET) return json({ error: "Unauthorized" }, 401);
  if (!BOT_TOKEN || !CHAT_ID) return json({ error: "Function non configurée" }, 500);

  let p: { type: string; election_id?: string; candidate_id?: string };
  try { p = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: election } = await db.from("elections").select("*").eq("id", p.election_id).maybeSingle();
  if (!election) return json({ error: "Scrutin introuvable" }, 404);
  const { data: roles } = await db.from("role_catalog").select("*").order("sort_order");
  const roleLabel = (id: string) => roles?.find((r) => r.id === id)?.label ?? id;
  const link = `${SITE_URL}?e=${encodeURIComponent(election.slug)}`;

  try {
    if (p.type === "candidacy") {
      const { data: c } = await db.from("candidates").select("*").eq("id", p.candidate_id).maybeSingle();
      if (!c) return json({ error: "Candidature introuvable" }, 404);
      await send(`🐾 <b>Nouvelle candidature</b> — ${esc(election.title)}\n` +
        `<b>${esc(c.display_name)}</b> se présente au poste de <b>${esc(roleLabel(c.role))}</b>.` +
        (c.bio ? `\n<i>${esc(c.bio.slice(0, 300))}${c.bio.length > 300 ? "…" : ""}</i>` : "") +
        `\n\n👉 Voir les candidats : ${SITE_URL}voter.html?e=${encodeURIComponent(election.slug)}`);
    } else if (p.type === "reminder") {
      const { data: part } = await db.rpc("participation", { p_election: election.id }).maybeSingle();
      const closes = election.voting_closes_at ? new Date(election.voting_closes_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : "bientôt";
      await send(`⏰ <b>Dernières 24 h pour voter !</b> — ${esc(election.title)}\n` +
        `Clôture : <b>${esc(closes)}</b>. ${part?.voters ?? 0} membre(s) ont déjà voté.\n\n🗳 Voter : ${SITE_URL}voter.html?e=${encodeURIComponent(election.slug)}`);
    } else if (p.type === "reminder_candidacy_open") {
      const at = election.candidacy_opens_at ? new Date(election.candidacy_opens_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : "bientôt";
      await send(`🐾 <b>Candidatures ouvertes dans 24 h</b> — ${esc(election.title)}\n` +
        `Ouverture : <b>${esc(at)}</b>.\n\n👉 ${SITE_URL}candidater.html?e=${encodeURIComponent(election.slug)}`);
    } else if (p.type === "reminder_candidacy_close") {
      const at = election.candidacy_closes_at ? new Date(election.candidacy_closes_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : "bientôt";
      await send(`⏰ <b>Dernières 24 h pour candidater !</b> — ${esc(election.title)}\n` +
        `Fermeture des candidatures : <b>${esc(at)}</b>.\n\n👉 ${SITE_URL}candidater.html?e=${encodeURIComponent(election.slug)}`);
    } else if (p.type === "reminder_voting_open") {
      const at = election.voting_opens_at ? new Date(election.voting_opens_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : "bientôt";
      await send(`🗳 <b>Ouverture des votes dans 24 h</b> — ${esc(election.title)}\n` +
        `Ouverture : <b>${esc(at)}</b>.\n\n👉 ${SITE_URL}?e=${encodeURIComponent(election.slug)}`);
    } else if (p.type === "results") {
      const { data: results } = await db.rpc("results", { p_election: election.id });
      const { data: part } = await db.rpc("participation", { p_election: election.id }).maybeSingle();
      const lines: string[] = [];
      for (const rid of (election.roles as string[])) {
        const rows = (results ?? []).filter((r) => r.role === rid).sort((a, b) => b.votes - a.votes);
        const seats = roles?.find((r) => r.id === rid)?.seats ?? 1;
        lines.push(`\n<b>${esc(roleLabel(rid))}</b>`);
        if (!rows.length) { lines.push("  — aucun candidat"); continue; }
        rows.forEach((r, i) => lines.push(`  ${i < seats ? "🏆" : "•"} ${esc(r.display_name)} — ${r.votes} voix`));
      }
      await send(`📊 <b>Résultats — ${esc(election.title)}</b>\n${part?.voters ?? 0} votant(s).` + lines.join("\n") +
        `\n\n🔎 Détails : ${SITE_URL}resultats.html?e=${encodeURIComponent(election.slug)}\n${link}`);
    } else return json({ error: "type inconnu" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
  return json({ ok: true });
});
