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
  // Journal partagé avec les élections/le reste de l'admin (même table public.audit_log, même
  // projet Supabase) : admin_log_event() est une RPC du schéma public, appelable via V.sb comme
  // via E.sb. Échec silencieux dans les deux cas — ne doit jamais bloquer connexion/déconnexion.
  V.logAdminLogin = async function () { try { await V.sb.rpc('admin_log_event', { p_event: 'login' }); } catch {} };
  V.signOut = async function () {
    if (V.sb) { try { await V.sb.rpc('admin_log_event', { p_event: 'logout' }); } catch {} await V.sb.auth.signOut(); }
    location.reload();
  };

  // ---------- États d'un sondage ----------
  // closes_at n'est plus un champ que l'admin remplit à la main (ça ne servait à rien pour un
  // sondage de présence : les gens répondent jusqu'au dernier moment) — il est calculé tout seul
  // à la création d'un sondage lié à un évènement (le lendemain de sa fin, voir
  // admin/votes/index.html:creerSondageDepuisEvenement), pour clôturer automatiquement une fois
  // l'évènement passé plutôt que de laisser le sondage ouvert indéfiniment.
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

  // ---------- Rendu d'un sondage (questions, résultats, formulaire de réponse) ----------
  // Partagé entre sondage.html (un seul sondage, en page dédiée) et index.html (tous les
  // sondages affichés à la suite, chacun dans son propre accordéon) : monte tout le contenu
  // d'un sondage — bannière de phase, résultats, formulaire — dans `root`, un conteneur vide.
  // Ne touche à rien en dehors de `root` (pas de titre de page à mettre à jour ici, ça reste au
  // code appelant pour sondage.html).
  V.mountPoll = async function (root, poll) {
    const h = V.h;
    V.clear(root).appendChild(V.loader());

    const { data: questions } = await V.vsb.from('questions').select('*').eq('poll_id', poll.id).order('sort_order');
    const qs = questions || [];
    const device = V.deviceToken();
    const st = V.pollState(poll);

    V.clear(root);
    const banner = h('div', { class: 'card column ' + (st.phase === 'open' ? 'ok' : 'info') },
      h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } }, V.phaseBadge(poll),
        poll.closes_at && st.phase === 'open' ? h('span', { class: 'small muted' }, 'Se termine le ' + V.fmtDateTime(poll.closes_at)) : null));
    root.appendChild(banner);

    const zone = h('div'); root.appendChild(zone);

    let myResp = null;
    if (st.phase !== 'draft') {
      // L'identité d'une réponse est le pseudo (pas l'appareil) : on ne peut pré-détecter une réponse
      // existante que si ce navigateur a déjà mémorisé un pseudo. Sinon la case pseudo vide en dessous
      // (blur) prendra le relais dès que la personne tape son pseudo, y compris sur un nouvel appareil.
      const savedPseudo = V.getSavedPseudo();
      if (savedPseudo) {
        const { data } = await V.vsb.rpc('my_response', { p_poll: poll.id, p_pseudo: savedPseudo });
        myResp = data && data !== 'null' ? data : null;
      }
    }

    function showVotersModal(label, matching) {
      const list = h('div', { class: 'recap' });
      matching.forEach(r => list.appendChild(h('div', null,
        h('span', null, r.pseudo + (r.contact ? ' — ' + r.contact : '')),
        h('span', { class: 'small muted' }, V.fmtDateTime(r.submitted_at)))));
      const bg = h('div', { class: 'modal-bg' });
      const modal = h('div', { class: 'modal' }, h('h3', null, label), list,
        h('div', { class: 'btn-row' }, h('button', { class: 'btn secondary', type: 'button', onClick: () => bg.remove() }, 'Fermer')));
      bg.appendChild(modal);
      bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
      document.body.appendChild(bg);
    }

    function renderResults(highlightMine) {
      V.clear(zone);
      zone.appendChild(h('h2', { class: 'section-title' }, 'Résultats'));
      Promise.resolve(V.vsb.rpc('poll_results', { p_poll: poll.id })).then(({ data: rows, error }) => {
        if (error) { zone.appendChild(h('div', { class: 'card danger' }, h('div', { class: 'body' }, V.errMsg(error)))); return; }
        rows = rows || [];
        zone.appendChild(h('div', { class: 'small muted', style: { marginBottom: '10px' } }, rows.length + ' réponse' + (rows.length > 1 ? 's' : '')));
        qs.forEach(q => {
          const block = h('div', { class: 'poll-question' });
          block.appendChild(h('div', { class: 'q-label' }, q.label));
          if (q.type === 'yesno' || q.type === 'choice' || q.type === 'multi_choice') {
            const options = q.type === 'yesno' ? [['yes', 'Oui'], ['no', 'Non']] : (q.options || []).map(o => [o, o]);
            const answered = rows.filter(r => r.answers && r.answers[q.id] != null && r.answers[q.id] !== '');
            const total = answered.length;
            options.forEach(([val, label]) => {
              const matching = answered.filter(r => {
                const a = r.answers[q.id];
                return Array.isArray(a) ? a.includes(val) : a === val;
              });
              const count = matching.length;
              const pct = total ? Math.round((count / total) * 100) : 0;
              const mine = highlightMine && myResp && myResp.answers && (Array.isArray(myResp.answers[q.id]) ? myResp.answers[q.id].includes(val) : myResp.answers[q.id] === val);
              // Qui a répondu ça (les réponses sont déjà publiques, pas une fuite) : un bouton plutôt
              // qu'un simple survol, pour que ça marche aussi au toucher sur mobile.
              const voirBtn = count ? h('button', { class: 'poll-voters-btn', type: 'button', title: 'Voir qui a répondu', 'aria-label': 'Voir qui a répondu', onClick: (e) => { e.stopPropagation(); showVotersModal(label, matching); } }, '❯') : null;
              const row = h('div', { class: 'poll-result' + (mine ? ' mine' : '') },
                h('div', { class: 'bar-fill', style: { width: pct + '%' } }),
                h('div', { class: 'row' }, h('div', { class: 'label' }, mine ? '✓ ' : '', label), h('div', { class: 'right' }, h('span', { class: 'pct' }, count + (count > 1 ? ' réponses' : ' réponse')), voirBtn)));
              block.appendChild(row);
            });
          } else {
            const answered = rows.filter(r => r.answers && r.answers[q.id] != null && r.answers[q.id] !== '');
            if (!answered.length) block.appendChild(h('div', { class: 'small muted' }, 'Aucune réponse pour l\'instant.'));
            answered.forEach(r => block.appendChild(h('div', { class: 'poll-free-answer' }, h('span', null, r.pseudo), h('span', { class: 'muted' }, String(r.answers[q.id])))));
          }
          zone.appendChild(block);
        });
        const row = h('div', { class: 'btn-row' });
        if (st.phase === 'open') row.appendChild(h('button', { class: 'btn secondary', type: 'button', onClick: () => renderForm() }, myResp ? 'Modifier ma réponse' : 'Je vote'));
        row.appendChild(h('button', { class: 'btn secondary', type: 'button', onClick: () => renderResults(true) }, 'Actualiser'));
        if (st.phase === 'open' && myResp) row.appendChild(h('button', { class: 'btn danger', type: 'button', onClick: supprimerMaReponse }, 'Supprimer ma réponse'));
        zone.appendChild(row);
      });
    }

    async function supprimerMaReponse() {
      if (!confirm('Supprimer ta réponse à ce sondage ?')) return;
      const { error } = await V.vsb.rpc('delete_response', { p_poll: poll.id, p_pseudo: myResp.pseudo });
      if (error) { V.toast(V.errMsg(error), 'error'); return; }
      myResp = null;
      V.toast('Réponse supprimée.', 'success');
      renderForm();
    }

    function renderForm() {
      V.clear(zone);
      if (st.phase === 'draft') { zone.appendChild(h('div', { class: 'card warn' }, h('div', { class: 'body' }, h('div', { class: 'title' }, 'Sondage en préparation'), h('div', { class: 'desc' }, 'Ce sondage n\'est pas encore publié.')))); return; }
      if (st.phase === 'closed') { renderResults(true); return; }

      const answers = {};
      qs.forEach(q => { if (myResp && myResp.answers && q.id in myResp.answers) answers[q.id] = myResp.answers[q.id]; });
      const pseudoInput = h('input', { class: 'input', placeholder: 'Ton pseudo', maxlength: '60', value: (myResp && myResp.pseudo) || V.getSavedPseudo(), required: true });
      const contactInput = h('input', { class: 'input', placeholder: 'Ex. @pseudo Discord, lien Instagram, numéro…', maxlength: '200', value: (myResp && myResp.contact) || '' });

      const form = h('form', { class: 'card column' },
        h('div', { class: 'title', style: { fontSize: '16px' } }, myResp ? 'Modifier ma réponse' : 'Répondre au sondage'),
        h('div', { class: 'small muted' }, 'Ton pseudo et tes réponses seront visibles par tous, sur cette page.'),
        h('div', { class: 'field' }, h('label', null, 'Pseudo'), pseudoInput),
        h('div', { class: 'field' },
          h('label', null, 'Contact (facultatif)'), contactInput,
          h('div', { class: 'small muted' }, 'Utile si tu proposes ou cherches du covoiturage, pour qu\'on puisse te recontacter. La Meute Normande met juste les gens en relation : elle n\'est pas responsable des échanges, trajets ou accords qui en découlent.')));
      zone.appendChild(form);

      // Reprendre un pseudo déjà utilisé sur ce sondage (même depuis un nouvel appareil) charge et
      // permet de modifier cette réponse existante, plutôt que d'en créer une seconde.
      pseudoInput.addEventListener('blur', async () => {
        const typed = pseudoInput.value.trim();
        if (!typed || (myResp && myResp.pseudo && myResp.pseudo.toLowerCase() === typed.toLowerCase())) return;
        const { data } = await V.vsb.rpc('my_response', { p_poll: poll.id, p_pseudo: typed });
        const found = data && data !== 'null' ? data : null;
        if (found) {
          myResp = found;
          V.toast('Réponse déjà enregistrée pour « ' + found.pseudo + ' », modifie-la si besoin.');
          renderForm();
        }
      });

      qs.forEach(q => {
        const block = h('div', { class: 'poll-question' });
        block.appendChild(h('div', { class: 'q-label' }, q.label, q.required ? h('span', { class: 'q-required' }, '*') : null));
        const optsWrap = h('div');
        function paint() {
          V.qsa('.poll-option', optsWrap).forEach(el => {
            const on = el.dataset.on === '1';
            el.classList.toggle('selected', on);
            el.setAttribute('aria-checked', on ? 'true' : 'false');
          });
        }
        if (q.type === 'yesno' || q.type === 'choice') {
          optsWrap.setAttribute('role', 'radiogroup');
          const options = q.type === 'yesno' ? [['yes', 'Oui'], ['no', 'Non']] : (q.options || []).map(o => [o, o]);
          options.forEach(([val, label]) => {
            const opt = h('div', { class: 'poll-option', role: 'radio', tabindex: '0', 'aria-checked': answers[q.id] === val ? 'true' : 'false', dataset: { on: answers[q.id] === val ? '1' : '0' } }, h('span', null, label));
            const toggle = () => { answers[q.id] = val; V.qsa('.poll-option', optsWrap).forEach(el => el.dataset.on = '0'); opt.dataset.on = '1'; paint(); };
            opt.addEventListener('click', toggle);
            opt.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
            optsWrap.appendChild(opt);
          });
        } else if (q.type === 'multi_choice') {
          const set = new Set(Array.isArray(answers[q.id]) ? answers[q.id] : []);
          (q.options || []).forEach(val => {
            const opt = h('div', { class: 'poll-option', role: 'checkbox', tabindex: '0', 'aria-checked': set.has(val) ? 'true' : 'false', dataset: { on: set.has(val) ? '1' : '0' } }, h('span', null, val));
            const toggle = () => { if (set.has(val)) set.delete(val); else set.add(val); answers[q.id] = [...set]; opt.dataset.on = set.has(val) ? '1' : '0'; paint(); };
            opt.addEventListener('click', toggle);
            opt.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
            optsWrap.appendChild(opt);
          });
        } else if (q.type === 'number') {
          const inp = h('input', { class: 'input', type: 'number', value: answers[q.id] != null ? answers[q.id] : '' });
          inp.addEventListener('input', () => { answers[q.id] = inp.value === '' ? null : Number(inp.value); });
          optsWrap.appendChild(inp);
        } else {
          const inp = h('input', { class: 'input', type: 'text', maxlength: '200', value: answers[q.id] || '' });
          inp.addEventListener('input', () => { answers[q.id] = inp.value; });
          optsWrap.appendChild(inp);
        }
        block.appendChild(optsWrap);
        paint();
        zone.appendChild(block);
      });

      const submitBtn = h('button', { class: 'btn', type: 'button' }, myResp ? 'Enregistrer mes réponses' : 'Envoyer mes réponses');
      const foot = h('div', { class: 'btn-row' }, submitBtn, myResp ? h('button', { class: 'btn secondary', type: 'button', onClick: () => renderResults(true) }, 'Annuler') : null);
      zone.appendChild(foot);
      if (!myResp) zone.appendChild(h('div', { class: 'btn-row' }, h('button', { class: 'btn secondary wide', type: 'button', onClick: () => renderResults(false) }, 'Afficher les résultats')));

      form.addEventListener('submit', async (e) => { e.preventDefault(); await submit(); });
      submitBtn.addEventListener('click', async (e) => { e.preventDefault(); await submit(); });

      async function submit() {
        const pseudo = pseudoInput.value.trim();
        if (!pseudo) { V.toast('Choisis un pseudo.', 'error'); return; }
        for (const q of qs) {
          const v = answers[q.id];
          const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
          if (q.required && empty) { V.toast('Réponds à « ' + q.label + ' ».', 'error'); return; }
        }
        submitBtn.disabled = true; submitBtn.textContent = 'Envoi…';
        const payload = {};
        qs.forEach(q => { const v = answers[q.id]; const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0); if (!empty) payload[q.id] = v; });
        const { data, error } = await V.vsb.rpc('respond', { p_poll: poll.id, p_device_token: device, p_pseudo: pseudo, p_answers: payload, p_contact: contactInput.value.trim() || null });
        if (error) { V.toast(V.errMsg(error), 'error'); submitBtn.disabled = false; submitBtn.textContent = myResp ? 'Enregistrer mes réponses' : 'Envoyer mes réponses'; return; }
        V.savePseudo(pseudo);
        myResp = { pseudo, contact: contactInput.value.trim() || null, answers: payload, submitted_at: new Date().toISOString() };
        V.toast('Réponse enregistrée, merci ' + pseudo + ' !', 'success');
        renderResults(true);
      }
    }

    if (st.phase === 'draft' || (st.phase === 'open' && !myResp)) renderForm();
    else renderResults(true);
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
  // Le menu est le module Mobirise "menu2" réel du reste du site public, en dur dans le HTML
  // (voir Modules Mobirise/OK/Module Menu/V6 fonctionnel), avec les vrais assets du site
  // (bootstrap.min.css/bundle.js, dropdown/, theme/, mbr-additional.css) : aucun code custom
  // ici, le dropdown/hamburger sont gérés par ces scripts comme sur le reste du site.
  V.notConfigured = function (container) {
    V.clear(container).appendChild(V.h('div', { class: 'card warn' }, V.h('div', { class: 'body' },
      V.h('div', { class: 'title' }, 'Outil pas encore configuré'),
      V.h('div', { class: 'desc' }, 'Renseigne SUPABASE_URL et SUPABASE_ANON_KEY dans assets/config.js.'))));
  };
  V.footer = function () {
    const f = V.qs('#footer'); if (!f) return;
    f.innerHTML = '<div class="footer-divider"></div>'
      + '<p class="legal small" style="max-width:520px;margin:0 auto .5rem">Sondage libre, sans compte : ton pseudo et tes réponses sont visibles publiquement une fois envoyés.</p>'
      + '<p class="legal">Site réalisé par <a href="tg://resolve?domain=NitraFox" class="link-nitra">Nitra🦊</a>'
      + ' &amp; calendrier alimenté par <a href="tg://resolve?domain=Spyro_The_Bat" class="link-violet">Spyro the bat🦇</a>.</p>'
      + '<div class="legal-links"><button type="button" class="legal-btn" data-legal="mentions">Mentions légales</button><span class="legal-sep">·</span><button type="button" class="legal-btn" data-legal="confidentialite">Politique de confidentialité</button><span class="legal-sep">·</span><button type="button" class="legal-btn" data-legal="cookies">Politique de cookies</button></div>';
    f.addEventListener('click', (e) => { const b = e.target.closest('.legal-btn'); if (b && V.openLegal) V.openLegal(b.dataset.legal); });
  };
})();
