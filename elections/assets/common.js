/* Helpers partagés par toutes les pages de l'outil d'élections. Expose window.E */
(function () {
  'use strict';
  const cfg = window.ELECTIONS_CONFIG || {};
  const E = { cfg };
  window.E = E;

  // ---------- Client Supabase ----------
  E.ready = !!(window.supabase && cfg.SUPABASE_URL && !/VOTRE/.test(cfg.SUPABASE_URL));
  E.sb = E.ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
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

  // ---------- Avatars (FNV-1a → couleur, unavatar en priorité) ----------
  function hashString(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  const palette = ['#7AA2FF', '#5865F2', '#FF8A65', '#9CCC65', '#FFB86B', '#8E9AAF', '#A8A29E', '#F06292'];
  E.avatarEl = function ({ username, displayName, avatarUrl, provider, size, cls }) {
    const seed = String(username || displayName || '?').toLowerCase();
    const label = (displayName || username || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const bg = palette[hashString(seed) % palette.length];
    const wrap = E.h('div', { class: 'icon-circle ' + (cls || ''), style: { background: bg }, 'aria-hidden': 'true' },
      E.h('span', { class: 'initials', text: label }));
    const src = avatarUrl || (username && provider !== 'discord' ? `https://unavatar.io/telegram/${encodeURIComponent(username)}?fallback=false` : null);
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

  // ---------- Session / profil ----------
  let profileCache;
  E.getSession = async () => E.sb ? (await E.sb.auth.getSession()).data.session : null;
  E.getProfile = async function (force) {
    if (!E.sb) return null;
    if (profileCache !== undefined && !force) return profileCache;
    const session = await E.getSession();
    if (!session) { profileCache = null; return null; }
    const { data } = await E.sb.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    profileCache = data || null;
    return profileCache;
  };
  E.signOut = async function () { if (E.sb) await E.sb.auth.signOut(); profileCache = undefined; location.reload(); };

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
    const { data } = await E.sb.from('public_candidates').select('*').eq('election_id', electionId).order('created_at');
    return data || [];
  };

  // ---------- Realtime ----------
  /** Abonnement aux changements : broadcast public « elections » émis par les triggers SQL (fonctionne aussi pour les visiteurs anonymes). */
  E.subscribe = function (tables, cb) {
    if (!E.sb) return null;
    const ch = E.sb.channel('elections', { config: { private: false } })
      .on('broadcast', { event: 'change' }, (msg) => { const p = msg && msg.payload; if (!p || !tables.length || tables.includes(p.table)) cb(p); });
    ch.subscribe();
    return ch;
  };
  E.debounce = function (fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 400); }; };

  // ---------- Telegram (compteur écrit par GitHub Actions) ----------
  E.loadTelegramCount = async function () {
    try {
      const r = await fetch(cfg.TELEGRAM_JSON || 'telegram.json', { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return (j && typeof j.members === 'number') ? j : null;
    } catch { return null; }
  };

  // ---------- Erreurs RPC → français ----------
  const ERR = {
    AUTH_REQUIRED: 'Connecte-toi pour continuer.',
    NOT_MEMBER: 'Ton compte n\'est pas reconnu comme membre du groupe.',
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
    CANDIDATE_NOT_FOUND: 'Candidature introuvable.'
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
    E.clear(nav);
    links.forEach(([href, label]) => nav.appendChild(E.h('a', { href, class: active === href ? 'active' : '' }, label)));
    nav.appendChild(E.h('span', { class: 'spacer' }));
    const p = await E.getProfile();
    if (p) {
      if (p.is_admin) nav.appendChild(E.h('a', { href: 'admin.html', class: active === 'admin.html' ? 'active' : '' }, '⚙️ Admin'));
      nav.appendChild(E.h('span', { class: 'account' },
        E.avatarEl({ username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url, provider: p.provider }),
        E.h('span', null, p.display_name || p.username || 'Membre'),
        E.h('span', { class: 'badge ' + p.provider }, p.provider === 'telegram' ? 'TG' : 'DC'),
        E.h('button', { type: 'button', onClick: E.signOut, title: 'Se déconnecter' }, '⏏')));
    } else if (E.ready && active !== 'index.html') {
      nav.appendChild(E.h('a', { href: 'index.html#connexion' }, 'Se connecter'));
    }
  };
  E.notConfigured = function (container) {
    E.clear(container).appendChild(E.h('div', { class: 'card warn' }, E.h('div', { class: 'icon' }, '🛠️'),
      E.h('div', { class: 'body' }, E.h('div', { class: 'title' }, 'Outil pas encore configuré'),
        E.h('div', { class: 'desc' }, 'Renseigne SUPABASE_URL et SUPABASE_ANON_KEY dans assets/config.js (voir supabase/README.md).'))));
  };

  /** Garde : renvoie le profil membre, sinon affiche l'écran de connexion / non-membre dans container. */
  E.requireMember = async function (container, opts) {
    opts = opts || {};
    if (!E.ready) { E.notConfigured(container); return null; }
    const session = await E.getSession();
    if (!session) {
      E.clear(container);
      container.appendChild(E.h('div', { class: 'card info column' },
        E.h('div', { class: 'title' }, '🔐 Connexion requise'),
        E.h('div', { class: 'desc' }, 'Pour ' + (opts.verb || 'voter') + ', connecte-toi avec le compte Telegram ou Discord avec lequel tu es membre de la Meute. Aucun mot de passe : on vérifie juste que tu fais partie du groupe.')));
      const box = E.h('div'); container.appendChild(box);
      window.A && A.renderLogin(box, { returnTo: location.pathname.split('/').pop() + location.search });
      return null;
    }
    const p = await E.getProfile(true);
    if (!p) { E.clear(container).appendChild(E.h('div', { class: 'card danger' }, E.h('div', { class: 'body' }, E.h('div', { class: 'title' }, 'Profil introuvable'), E.h('div', { class: 'desc' }, 'Déconnecte-toi puis reconnecte-toi.')))); return null; }
    if (p.banned) { E.clear(container).appendChild(E.h('div', { class: 'card danger' }, E.h('div', { class: 'icon' }, '⛔'), E.h('div', { class: 'body' }, E.h('div', { class: 'title' }, 'Compte suspendu'), E.h('div', { class: 'desc' }, 'Ce compte a été exclu du scrutin par l\'équipe. Contacte le staff si tu penses qu\'il s\'agit d\'une erreur.')))); return null; }
    if (!p.is_member && !opts.allowNonMember) {
      E.clear(container);
      container.appendChild(E.h('div', { class: 'card warn column' },
        E.h('div', { class: 'title' }, '🚪 Tu dois être membre du groupe'),
        E.h('div', { class: 'desc' }, `Ton compte ${p.provider === 'telegram' ? 'Telegram' : 'Discord'} (${p.username || p.display_name || ''}) n'a pas été trouvé dans ${p.provider === 'telegram' ? 'le groupe Telegram principal' : 'le serveur Discord'} de la Meute. Rejoins-le puis reconnecte-toi pour relancer la vérification.`),
        E.h('div', { class: 'btn-row' },
          E.h('a', { class: 'btn telegram', href: cfg.TELEGRAM_INVITE, target: '_blank', rel: 'noopener' }, '✈ Groupe Telegram'),
          E.h('a', { class: 'btn discord', href: cfg.DISCORD_INVITE, target: '_blank', rel: 'noopener' }, '🎧 Serveur Discord'),
          E.h('button', { class: 'btn secondary', type: 'button', onClick: E.signOut }, '↻ Se reconnecter pour revérifier'))));
      return null;
    }
    return p;
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
    f.innerHTML = 'Outil d\'élections de <a href="https://lameutenormande.fr">La Meute Normande</a> · identité vérifiée via Telegram / Discord · <a href="resultats.html">résultats en direct</a>';
  };
})();
