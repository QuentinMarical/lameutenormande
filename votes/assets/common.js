/* Helpers partagés par les pages de l'outil de sondages. Expose window.V
   Pas de code individuel ici (contrairement à l'outil d'élections) : n'importe qui répond
   avec un pseudo librement choisi. Un device_token généré côté navigateur (mémorisé comme
   le code des élections) sert uniquement de clé d'édition pour modifier sa réponse jusqu'à
   la clôture — jamais une preuve d'identité. Les admins réutilisent le même compte Supabase
   Auth que le panel des élections (table public.admins commune). */
(function () {
  'use strict';
  const cfg = window.VOTES_CONFIG || {};
  const V = { cfg };
  window.V = V;

  // ---------- Client Supabase (schéma "public" par défaut, pour is_admin()/auth ;
  //            .schema('votes') explicitement pour tout ce qui touche aux sondages) ----------
  V.ready = !!(window.supabase && cfg.SUPABASE_URL && !/VOTRE/.test(cfg.SUPABASE_URL));
  V.sb = V.ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  }) : null;
  V.vsb = V.ready ? V.sb.schema('votes') : null;

  // ---------- DOM ----------
  V.qs = (s, r) => (r || document).querySelector(s);
  V.qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  V.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  V.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  V.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  V.loader = (txt) => V.h('div', { class: 'loader' }, txt || 'Chargement…');

  // ---------- Toasts ----------
  V.toast = function (msg, kind) {
    let box = V.qs('.toasts');
    if (!box) { box = V.h('div', { class: 'toasts' }); document.body.appendChild(box); }
    const t = V.h('div', { class: 'toast ' + (kind || 'info'), text: msg });
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 4500);
  };

  // ---------- Dates ----------
  const dtf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  const df = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
  V.fmtDateTime = (d) => d ? dtf.format(new Date(d)) : '—';
  V.fmtDate = (d) => d ? df.format(new Date(d)) : '—';
  V.countdown = function (el, date, onEnd) {
    const target = new Date(date).getTime();
    const parts = ['j', 'h', 'min', 's'].map(u => ({ b: V.h('b', { text: '0' }), s: V.h('span', { text: u }) }));
    V.clear(el); el.classList.add('countdown');
    parts.forEach(p => el.appendChild(V.h('div', null, p.b, p.s)));
    let ended = false;
    function tick() {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      [d, h, m, s].forEach((v, i) => parts[i].b.textContent = String(v).padStart(i ? 2 : 1, '0'));
      if (target - Date.now() <= 0 && !ended) { ended = true; clearInterval(iv); onEnd && onEnd(); }
    }
    tick(); const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  };

  // ---------- Avatars (mêmes initiales colorées que l'outil d'élections) ----------
  function hashString(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  const palette = ['#7AA2FF', '#5865F2', '#FF8A65', '#9CCC65', '#FFB86B', '#8E9AAF', '#A8A29E', '#F06292'];
  V.avatarEl = function (displayName, size) {
    const seed = String(displayName || '?').toLowerCase();
    const label = (displayName || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const bg = palette[hashString(seed) % palette.length];
    const wrap = V.h('div', { class: 'icon-circle', style: { background: bg }, 'aria-hidden': 'true' }, V.h('span', { class: 'initials', text: label }));
    if (size) { wrap.style.width = wrap.style.height = wrap.style.flexBasis = size + 'px'; }
    return wrap;
  };

  // ---------- Identité du navigateur (aucun compte, aucun secret : juste une clé d'édition) ----------
  const DEVICE_KEY = 'votes.device';
  V.deviceToken = function () {
    try {
      let t = localStorage.getItem(DEVICE_KEY);
      if (!t) { t = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, t); }
      return t;
    } catch { return 'no-storage-' + Math.random().toString(36).slice(2); }
  };
  const PSEUDO_KEY = 'votes.pseudo';
  V.getSavedPseudo = () => { try { return localStorage.getItem(PSEUDO_KEY) || ''; } catch { return ''; } };
  V.savePseudo = (p) => { try { localStorage.setItem(PSEUDO_KEY, p); } catch {} };

  // ---------- Admin (Supabase Auth, table public.admins commune avec l'outil d'élections) ----------
  V.adminSession = async () => V.sb ? (await V.sb.auth.getSession()).data.session : null;
  V.isAdmin = async function () {
    const s = await V.adminSession(); if (!s) return false;
    const { data } = await V.sb.rpc('is_admin'); return !!data;
  };
  V.signOut = async function () { if (V.sb) await V.sb.auth.signOut(); location.reload(); };

  // ---------- États d'un sondage ----------
  V.pollState = function (p) {
    if (!p) return { phase: 'none', label: 'Aucun sondage', cls: 'muted' };
    const closesPassed = p.closes_at && Date.now() >= new Date(p.closes_at).getTime();
    if (p.status === 'closed' || (p.status === 'open' && closesPassed)) return { phase: 'closed', label: 'Terminé', cls: 'muted' };
    if (p.status === 'draft') return { phase: 'draft', label: 'Brouillon', cls: 'warn' };
    return { phase: 'open', label: 'En cours', cls: 'ok live' };
  };
  V.phaseBadge = function (p) {
    const s = V.pollState(p);
    return V.h('span', { class: 'badge ' + s.cls }, V.h('i', { class: 'dot' }), s.label);
  };

  // ---------- Erreurs RPC → français ----------
  const ERR = {
    polls_slug_key: 'Cet identifiant (URL) est déjà utilisé par un autre sondage : choisis-en un autre.',
    POLL_NOT_FOUND: 'Sondage introuvable.',
    POLL_NOT_OPEN: 'Ce sondage n\'est pas ouvert.',
    POLL_CLOSED: 'Ce sondage est terminé.',
    BAD_DEVICE: 'Erreur technique (appareil non identifié) : recharge la page.',
    BAD_PSEUDO: 'Choisis un pseudo (1 à 60 caractères).',
    BAD_ANSWERS: 'Réponses invalides.',
    MISSING_ANSWER: 'Une question obligatoire n\'a pas de réponse.',
    BAD_CHOICE: 'Un choix n\'est plus valide. Recharge la page.',
    BAD_QUESTION_TYPE: 'Type de question invalide.',
    BAD_QUESTIONS: 'Liste de questions invalide.',
    ADMIN_REQUIRED: 'Réservé aux administrateurs.',
    RESPONSE_NOT_FOUND: 'Réponse introuvable (déjà supprimée ?). Recharge la page.',
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.'
  };
  V.errMsg = function (err) {
    const m = (err && (err.message || err.error_description || String(err))) || 'Erreur inconnue';
    for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
    return m;
  };

  // ---------- Layout commun ----------
  V.renderNav = async function (active) {
    const nav = V.qs('#nav'); if (!nav) return;
    const links = [['index.html', 'Sondages']];
    V.clear(nav);
    links.forEach(([href, label]) => nav.appendChild(V.h('a', { href, class: active === href ? 'active' : '' }, label)));
    const bar = nav.parentElement;
    V.qsa('.actions', bar).forEach(n => n.remove());
    const actions = V.h('div', { class: 'actions' });
    bar.appendChild(actions);
    const admin = V.ready && await V.adminSession();
    actions.appendChild(V.h('a', { class: 'tool admin', href: 'admin.html', title: admin ? 'Panel admin (' + (admin.user.email || '') + ')' : 'Accès administrateur' }, admin ? 'Admin' : '⚙'));
  };
  V.notConfigured = function (container) {
    V.clear(container).appendChild(V.h('div', { class: 'card warn' }, V.h('div', { class: 'body' },
      V.h('div', { class: 'title' }, 'Outil pas encore configuré'),
      V.h('div', { class: 'desc' }, 'Renseigne SUPABASE_URL et SUPABASE_ANON_KEY dans assets/config.js.'))));
  };
  V.footer = function () {
    const f = V.qs('#footer'); if (!f) return;
    f.innerHTML = '<div class="footer-divider"></div>'
      + '<div class="footer-title">Sondages de la Meute</div>'
      + '<p class="legal">Outil réalisé par <a href="tg://resolve?domain=NitraFox" class="link-nitra">Nitra🦊</a> pour <a href="https://lameutenormande.fr" class="link-violet">La Meute Normande</a>.</p>';
  };
})();
