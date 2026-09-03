/* Helpers partagés par toutes les pages de l'outil d'élections. Expose window.E
   Identification des votants par code individuel (aucun compte) ; admins via Supabase Auth e-mail + mot de passe. */
(function () {
  'use strict';
  const cfg = window.ELECTIONS_CONFIG || {};
  const E = { cfg };
  window.E = E;

  // ---------- Client Supabase ----------
  E.ready = !!(window.supabase && cfg.SUPABASE_URL && !/VOTRE/.test(cfg.SUPABASE_URL));
  E.sb = E.ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  }) : null;

  // Mode démo locale (?mock=1) : données factices en mémoire, aucun appel réseau. Voir assets/dev-mock.js
  if (new URLSearchParams(location.search).has('mock') && document.currentScript) {
    document.write('<script src="' + document.currentScript.src.replace(/common\.js.*$/, 'dev-mock.js') + '"><\/script>');
  }

  // ---------- DOM ----------
  E.qs = (s, r) => (r || document).querySelector(s);
  E.qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  E.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  E.h = function (tag, attrs, ...children) {
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
  E.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  E.loader = (txt) => E.h('div', { class: 'loader' }, txt || 'Chargement…');

  // ---------- Toasts ----------
  E.toast = function (msg, kind) {
    let box = E.qs('.toasts');
    if (!box) { box = E.h('div', { class: 'toasts' }); document.body.appendChild(box); }
    const t = E.h('div', { class: 'toast ' + (kind || 'info'), text: msg });
    box.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 4500);
  };

  // ---------- Dates ----------
  const dtf = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  const df = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
  E.fmtDateTime = (d) => d ? dtf.format(new Date(d)) : '—';
  E.fmtDate = (d) => d ? df.format(new Date(d)) : '—';
  E.countdown = function (el, date, onEnd) {
    const target = new Date(date).getTime();
    const parts = ['j', 'h', 'min', 's'].map(u => ({ b: E.h('b', { text: '0' }), s: E.h('span', { text: u }) }));
    E.clear(el); el.classList.add('countdown');
    parts.forEach(p => el.appendChild(E.h('div', null, p.b, p.s)));
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

  // ---------- Avatars (FNV-1a → couleur, unavatar Telegram en priorité) ----------
  function hashString(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  const palette = ['#7AA2FF', '#5865F2', '#FF8A65', '#9CCC65', '#FFB86B', '#8E9AAF', '#A8A29E', '#F06292'];
  E.avatarEl = function ({ username, displayName, avatarUrl, size, cls }) {
    const seed = String(username || displayName || '?').toLowerCase();
    const label = (displayName || username || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const bg = palette[hashString(seed) % palette.length];
    const wrap = E.h('div', { class: 'icon-circle ' + (cls || ''), style: { background: bg }, 'aria-hidden': 'true' },
      E.h('span', { class: 'initials', text: label }));
    const src = avatarUrl || (username ? `https://unavatar.io/telegram/${encodeURIComponent(username)}?fallback=false` : null);
    if (src) {
      const img = E.h('img', { class: 'avatar', alt: '', loading: 'lazy' });
      img.onload = () => img.classList.add('loaded');
      img.onerror = () => img.remove();
      img.src = src; wrap.appendChild(img);
    }
    if (size) { wrap.style.width = wrap.style.height = wrap.style.flexBasis = size + 'px'; }
    return wrap;
  };

  // ---------- Rôles ----------
  let rolesCache = null;
  E.loadRoles = async function () {
    if (rolesCache) return rolesCache;
    const meta = new Map((window.ROLE_CATALOG || []).map(r => [r.id, r]));
    let rows = [];
    if (E.sb) { const { data } = await E.sb.from('role_catalog').select('*').order('sort_order'); rows = data || []; }
    if (!rows.length) rows = window.ROLE_CATALOG || [];
    rolesCache = new Map(rows.map(r => [r.id, Object.assign({ icon: '🐾' }, meta.get(r.id) || {}, r)]));
    return rolesCache;
  };
  E.roleInfo = (id) => (rolesCache && rolesCache.get(id)) || (window.ROLE_CATALOG || []).find(r => r.id === id) || { id, label: id, icon: '🐾', seats: 1, max_choices: 1 };
  E.rolesOf = (election) => (Array.isArray(election.roles) ? election.roles : []).map(E.roleInfo);

  // ---------- Codes individuels ----------
  E.normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  E.prettyCode = (s) => { const n = E.normCode(s); return n.length > 8 ? n.slice(0, -8) + '-' + n.slice(-8, -4) + '-' + n.slice(-4) : n; };
  const codeKey = (electionId) => 'elections.code.' + electionId;
  E.getCode = (electionId) => { try { return localStorage.getItem(codeKey(electionId)) || ''; } catch { return ''; } };
  E.setCode = (electionId, code) => { try { localStorage.setItem(codeKey(electionId), code); } catch {} };
  E.clearCode = (electionId) => { try { localStorage.removeItem(codeKey(electionId)); } catch {} };
  E.checkCode = async (code, electionId) => {
    const { data, error } = await E.sb.rpc('check_code', { p_code: code, p_election: electionId });
    if (error) throw error;
    return data;
  };

  /** Garde : renvoie {code, label, has_ballot, candidacies} ou affiche le formulaire de saisie du code et renvoie null. */
  E.requireCode = async function (container, election, opts) {
    opts = opts || {};
    if (!E.ready) { E.notConfigured(container); return null; }
    const urlCode = new URLSearchParams(location.search).get('code');
    const stored = urlCode || E.getCode(election.id);
    if (stored) {
      try { const info = await E.checkCode(stored, election.id); E.setCode(election.id, info.code); info.code = info.code || stored; return info; }
      catch (err) { E.clearCode(election.id); if (!/CODE_/.test(err.message || '')) E.toast(E.errMsg(err), 'error'); }
    }
    E.clear(container);
    const input = E.h('input', { class: 'input code-input', placeholder: 'MEUTE-XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', required: true });
    input.addEventListener('input', () => { input.value = E.prettyCode(input.value); });
    const btn = E.h('button', { class: 'btn', type: 'submit' }, '➡️ Continuer');
    const form = E.h('form', { class: 'card info column' },
      E.h('div', { class: 'title' }, '🎟️ Ton code de vote'),
      E.h('div', { class: 'desc' }, 'Pour ' + (opts.verb || 'voter') + ', saisis le code individuel que le staff t\'a transmis. Il est personnel : ne le partage pas.'),
      E.h('div', { class: 'field', style: { marginTop: '6px' } }, input),
      E.h('div', { class: 'btn-row', style: { marginTop: 0 } }, btn),
      E.h('div', { class: 'hint' }, 'Pas de code ? Demande-le à un membre du staff sur ', E.h('a', { href: cfg.TELEGRAM_INVITE || '#', target: '_blank', rel: 'noopener' }, 'Telegram'), '.'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); btn.disabled = true; btn.textContent = 'Vérification…';
      try {
        const info = await E.checkCode(input.value, election.id);
        E.setCode(election.id, info.code);
        E.toast('Code accepté' + (info.label ? ', bienvenue ' + info.label : '') + ' !', 'success');
        const u = new URL(location.href); u.searchParams.delete('code'); location.href = u.href;
      } catch (err) { E.toast(E.errMsg(err), 'error'); btn.disabled = false; btn.textContent = '➡️ Continuer'; input.focus(); }
    });
    container.appendChild(form);
    if (location.hash === '#code') setTimeout(() => input.focus({ preventScroll: false }), 50);
    return null;
  };

  /** Puce « code » dans la navigation, avec bouton pour changer de code. */
  E.codeChip = function (election, info) {
    const slot = E.qs('.topbar #codeSlot'); if (!slot) return;
    const chip = E.h('span', { class: 'account', id: 'codeSlot' },
      E.h('span', null, '🎟️'), E.h('span', { class: 'code-pill' }, info ? info.code : '—'), info && info.label ? E.h('span', { class: 'lbl' }, info.label) : null,
      E.h('button', { type: 'button', title: 'Changer de code', onClick: () => { E.clearCode(election.id); location.reload(); } }, info ? 'changer' : 'saisir'));
    slot.replaceWith(chip);
  };

  // ---------- Admin (Supabase Auth) ----------
  E.adminSession = async () => E.sb ? (await E.sb.auth.getSession()).data.session : null;
  E.isAdmin = async function () {
    const s = await E.adminSession(); if (!s) return false;
    const { data } = await E.sb.rpc('is_admin'); return !!data;
  };
  E.signOut = async function () { if (E.sb) await E.sb.auth.signOut(); location.reload(); };

  // ---------- Scrutins ----------
  E.electionState = function (e) {
    if (!e) return { phase: 'none', label: 'Aucun scrutin', cls: 'muted' };
    const closesPassed = e.voting_closes_at && Date.now() >= new Date(e.voting_closes_at).getTime();
    if (e.status === 'archived') return { phase: 'archived', label: 'Archivé', cls: 'muted' };
    if (e.status === 'closed' || (e.status === 'open' && !e.voting_open && !e.candidacy_open && closesPassed)) return { phase: 'closed', label: 'Terminé', cls: 'muted' };
    if (e.status === 'draft') return { phase: 'draft', label: 'Brouillon', cls: 'warn' };
    if (e.voting_open && !closesPassed) return { phase: 'vote', label: 'Vote en cours', cls: 'ok live' };
    if (e.candidacy_open) return { phase: 'candidatures', label: 'Candidatures ouvertes', cls: 'ok' };
    return { phase: 'pending', label: 'En préparation', cls: 'warn' };
  };
  E.phaseBadge = function (e) {
    const s = E.electionState(e);
    return E.h('span', { class: 'badge ' + s.cls }, E.h('i', { class: 'dot' }), s.label);
  };
  E.activeElection = async function () {
    if (!E.sb) return null;
    const { data } = await E.sb.rpc('active_election');
    return data && data[0] || null;
  };
  E.electionBySlug = async function (slug) {
    const { data } = await E.sb.from('elections').select('*').eq('slug', slug).maybeSingle();
    return data;
  };
  E.electionFromUrl = async function () {
    const slug = new URLSearchParams(location.search).get('e');
    if (slug) return E.electionBySlug(slug);
    const act = await E.activeElection();
    if (act) return act;
    const { data } = await E.sb.from('elections').select('*').neq('status', 'draft').order('created_at', { ascending: false }).limit(1);
    return data && data[0] || null;
  };
  E.publicCandidates = async function (electionId) {
    const { data } = await E.sb.rpc('public_candidates', { p_election: electionId });
    return data || [];
  };

  // ---------- Realtime ----------
  /** Abonnement aux changements : broadcast public « elections » émis par les triggers SQL. */
  E.subscribe = function (tables, cb) {
    if (!E.sb) return null;
    const ch = E.sb.channel('elections', { config: { private: false } })
      .on('broadcast', { event: 'change' }, (msg) => { const p = msg && msg.payload; if (!p || !tables.length || tables.includes(p.table)) cb(p); });
    ch.subscribe();
    return ch;
  };
  E.debounce = function (fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 400); }; };

  // ---------- Erreurs RPC → français ----------
  const ERR = {
    CODE_INVALID: 'Code inconnu pour ce scrutin. Vérifie la saisie.',
    CODE_REVOKED: 'Ce code a été désactivé par le staff.',
    ELECTION_NOT_FOUND: 'Scrutin introuvable.',
    ELECTION_NOT_OPEN: 'Ce scrutin n\'est pas ouvert.',
    CANDIDACY_CLOSED: 'Les candidatures sont fermées.',
    VOTING_CLOSED: 'Les votes sont fermés.',
    ROLE_NOT_IN_ELECTION: 'Ce rôle ne fait pas partie du scrutin.',
    TELEGRAM_USERNAME_REQUIRED: 'Un pseudo Telegram est requis pour ce rôle.',
    DISCORD_USERNAME_REQUIRED: 'Un pseudo Discord est requis pour ce rôle.',
    TOO_MANY_CHOICES: 'Trop de candidats cochés pour un rôle.',
    INVALID_CANDIDATE: 'Un des candidats choisis n\'est plus valide (retiré ?). Recharge la page.',
    EMPTY_BALLOT: 'Ton bulletin est vide : choisis au moins un candidat.',
    ADMIN_REQUIRED: 'Réservé aux administrateurs.',
    BALLOT_NOT_FOUND: 'Bulletin introuvable.',
    CANDIDATE_NOT_FOUND: 'Candidature introuvable.',
    BAD_COUNT: 'Nombre de codes invalide (1 à 1000).',
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.'
  };
  E.errMsg = function (err) {
    const m = (err && (err.message || err.error_description || String(err))) || 'Erreur inconnue';
    for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
    return m;
  };

  // ---------- Layout commun ----------
  E.renderNav = async function (active) {
    const nav = E.qs('#nav'); if (!nav) return;
    const links = [['index.html', 'Accueil'], ['voter.html', 'Voter'], ['candidater.html', 'Candidater'], ['resultats.html', 'Résultats']];
    const q = location.search.match(/[?&]e=([^&]+)/); const suffix = q ? '?e=' + q[1] : '';
    E.clear(nav);
    links.forEach(([href, label]) => nav.appendChild(E.h('a', { href: href + suffix, class: active === href ? 'active' : '' }, label)));
    // À droite, à la place des réseaux sociaux du site : accès par code et accès admin
    const bar = nav.parentElement;
    E.qsa('.actions', bar).forEach(n => n.remove());
    const actions = E.h('div', { class: 'actions' });
    actions.appendChild(E.h('a', { id: 'codeSlot', class: 'tool primary', href: 'index.html' + suffix + '#code', title: 'Saisir mon code de vote' }, '🎟️ Mon code'));
    const admin = E.ready && await E.adminSession();
    actions.appendChild(E.h('a', { class: 'tool admin', href: 'admin.html', title: admin ? 'Panel admin (' + (admin.user.email || '') + ')' : 'Accès administrateur' }, admin ? '⚙️ Admin' : '⚙️'));
    bar.appendChild(actions);
  };
  E.notConfigured = function (container) {
    E.clear(container).appendChild(E.h('div', { class: 'card warn' }, E.h('div', { class: 'icon' }, '🛠️'),
      E.h('div', { class: 'body' }, E.h('div', { class: 'title' }, 'Outil pas encore configuré'),
        E.h('div', { class: 'desc' }, 'Renseigne SUPABASE_URL et SUPABASE_ANON_KEY dans assets/config.js (voir supabase/README.md).'))));
  };

  // ---------- Partage ----------
  E.shareBlock = function (url, text) {
    const wrap = E.h('div', { class: 'share' });
    const qr = E.h('div', { class: 'qr' });
    wrap.appendChild(qr);
    const body = E.h('div', { style: { flex: '1', minWidth: '200px' } },
      E.h('div', { class: 'title', style: { fontWeight: '700', marginBottom: '6px' } }, 'Partager le scrutin'),
      E.h('div', { class: 'desc muted small' }, url),
      E.h('div', { class: 'btn-row' },
        E.h('a', { class: 'btn telegram small', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener' }, '✈ Telegram'),
        E.h('button', { class: 'btn secondary small', type: 'button', onClick: async () => { try { await navigator.clipboard.writeText(url); E.toast('Lien copié !', 'success'); } catch { E.toast(url); } } }, '📋 Copier le lien')));
    wrap.appendChild(body);
    if (window.QRCode) {
      const canvas = document.createElement('canvas'); qr.appendChild(canvas);
      window.QRCode.toCanvas(canvas, url, { width: 116, margin: 0, color: { dark: '#0d0d1a', light: '#ffffff' } }, () => {});
    } else qr.textContent = 'QR';
    return wrap;
  };

  E.footer = function () {
    const f = E.qs('#footer'); if (!f) return;
    const q = location.search.match(/[?&]e=([^&]+)/); const suffix = q ? '?e=' + q[1] : '';
    const contact = cfg.TELEGRAM_INVITE || 'https://lameutenormande.fr/contact.html';
    f.innerHTML = '<div class="footer-divider"></div>'
      + '<div class="footer-title">Élections de la Meute</div>'
      + '<p>Outil de vote interne de <a href="https://lameutenormande.fr" class="link-violet">La Meute Normande</a> · un code individuel par membre, aucun compte à créer · résultats en direct.</p>'
      + '<div class="footer-links">'
      + '<a href="index.html' + suffix + '">Accueil</a><a href="voter.html' + suffix + '">Voter</a><a href="candidater.html' + suffix + '">Candidater</a><a href="resultats.html' + suffix + '">Résultats</a><a href="admin.html">Administration</a>'
      + '<a href="' + contact + '" target="_blank" rel="noopener">Pas de code ? Contacter le staff</a>'
      + '</div>'
      + '<div class="legal-links"><button type="button" class="legal-btn" data-legal="mentions">Mentions légales</button><span class="legal-sep">·</span><button type="button" class="legal-btn" data-legal="confidentialite">Politique de confidentialité</button><span class="legal-sep">·</span><button type="button" class="legal-btn" data-legal="cookies">Politique de cookies</button></div>'
      + '<p class="legal">Outil réalisé par <a href="tg://resolve?domain=NitraFox" class="link-nitra">Nitra🦊</a> · le staff voit qui a voté, jamais le contenu d’un bulletin.</p>';
    f.addEventListener('click', (e) => { const b = e.target.closest('.legal-btn'); if (b && E.openLegal) E.openLegal(b.dataset.legal); });
  };
})();
