/* Mode démo locale : remplace le client Supabase par une base en mémoire.
   Activé uniquement avec ?mock=1 dans l'URL (chargé par common.js). Jamais utilisé en production.
   Options : ?mock=1&as=anon | member | nonmember | admin (défaut : admin) */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const as = params.get('as') || 'admin';
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const uid = (n) => '00000000-0000-4000-8000-0000000000' + String(n).padStart(2, '0');

  const me = { user_id: uid(1), provider: 'telegram', provider_id: '424242', username: 'nitrafox', display_name: 'Nitra', avatar_url: null,
    is_member: as !== 'nonmember', member_checked_at: iso(now), account_created_at: null, is_admin: as === 'admin', banned: false, created_at: iso(now - 864e5 * 40) };
  const profiles = [me,
    { user_id: uid(2), provider: 'discord', provider_id: '1001', username: 'kitjune', display_name: 'Kitjune', avatar_url: null, is_member: true, account_created_at: iso(now - 864e5 * 900), is_admin: false, banned: false, created_at: iso(now - 864e5 * 30) },
    { user_id: uid(3), provider: 'telegram', provider_id: '1002', username: 'spyro_the_bat', display_name: 'Spyro The Bat', avatar_url: null, is_member: true, account_created_at: null, is_admin: false, banned: false, created_at: iso(now - 864e5 * 30) },
    { user_id: uid(4), provider: 'discord', provider_id: '1003', username: 'froxy', display_name: 'Froxy', avatar_url: null, is_member: true, account_created_at: iso(now - 864e5 * 5), is_admin: false, banned: false, created_at: iso(now - 864e5 * 5) },
    { user_id: uid(5), provider: 'telegram', provider_id: '1004', username: 'froxy', display_name: 'Froxy', avatar_url: null, is_member: false, account_created_at: null, is_admin: false, banned: false, created_at: iso(now - 864e5 * 2) },
    { user_id: uid(6), provider: 'discord', provider_id: '1005', username: 'azowo', display_name: 'AzOwO', avatar_url: null, is_member: true, account_created_at: iso(now - 864e5 * 400), is_admin: false, banned: false, created_at: iso(now - 864e5 * 10) }];
  const elections = [
    { id: uid(10), slug: 'staff-2026', title: 'Élection du staff 2026', description: 'Renouvellement de l\'équipe de la Meute Normande.', roles: ['tete', 'patte_gauche', 'patte_droite', 'communication', 'modo_telegram', 'modo_discord'],
      status: 'open', candidacy_open: true, voting_open: true, voting_closes_at: iso(now + 36e5 * 30), results_public: true, reminder_sent: false, results_sent: false, created_at: iso(now - 864e5 * 7), updated_at: iso(now) },
    { id: uid(11), slug: 'staff-2025', title: 'Élection du staff 2025', description: '', roles: ['tete', 'modo_telegram'], status: 'archived', candidacy_open: false, voting_open: false, voting_closes_at: iso(now - 864e5 * 365), results_public: true, reminder_sent: true, results_sent: true, created_at: iso(now - 864e5 * 372), updated_at: iso(now - 864e5 * 365) }];
  const C = (n, user, role, name, bio, tg, dc) => ({ id: uid(20 + n), election_id: uid(10), user_id: user, role, display_name: name, bio, telegram_username: tg, discord_username: dc, withdrawn: false, created_at: iso(now - 864e5 * 3 + n * 36e5), updated_at: iso(now - 864e5 * 3 + n * 36e5) });
  const candidates = [
    C(1, uid(2), 'tete', 'Kitjune', 'Membre depuis le début, je veux continuer à faire grandir la meute avec des rassemblements réguliers et une équipe soudée. On a plein d\'idées pour 2026 : week-end à la mer, stand aux conventions, et plus de soirées jeux.', 'KITJUNE', 'kitjune'),
    C(2, uid(3), 'tete', 'Spyro The Bat', 'Je m\'occupe déjà du calendrier, je propose de coordonner davantage.', 'spyro_the_bat', null),
    C(3, uid(3), 'communication', 'Spyro The Bat', 'Annonces, Instagram, site : je continue !', 'spyro_the_bat', null),
    C(4, uid(1), 'patte_gauche', 'Nitra', 'Je gère le site, je peux seconder sur la logistique.', 'nitrafox', 'nitra'),
    C(5, uid(4), 'modo_discord', 'Froxy', 'Présent tous les soirs sur le Discord, calme et diplomate.', 'TheFoxFurieFR', 'froxy'),
    C(6, uid(6), 'modo_discord', 'AzOwO', 'Musique, bonne humeur et bans quand il faut.', 'AzOwO_Music', 'azowo'),
    C(7, uid(6), 'modo_telegram', 'AzOwO', '', 'AzOwO_Music', 'azowo'),
    C(8, uid(2), 'modo_telegram', 'Kitjune', 'Déjà modo, je rempile.', 'KITJUNE', 'kitjune'),
    C(10, uid(3), 'modo_discord', 'Spyro The Bat', 'Je peux aussi aider côté Discord.', 'spyro_the_bat', 'spyro')];
  candidates.push(Object.assign(C(9, uid(4), 'patte_droite', 'Froxy', 'Finalement non.', 'TheFoxFurieFR', 'froxy'), { withdrawn: true }));
  const ballots = [];
  const choices = [];
  const B = (n, user, hoursAgo, ch, inval) => { const id = uid(40 + n); ballots.push({ id, election_id: uid(10), user_id: user, first_submitted_at: iso(now - 36e5 * hoursAgo), submitted_at: iso(now - 36e5 * hoursAgo), invalidated: !!inval, invalidated_by: inval ? uid(1) : null, invalidated_reason: inval || null }); Object.entries(ch).forEach(([role, ids]) => ids.forEach(c => choices.push({ ballot_id: id, role, candidate_id: uid(20 + c) }))); };
  B(1, uid(2), 40, { tete: [1], communication: [3], modo_discord: [5, 6] });
  B(2, uid(3), 30, { tete: [1], patte_gauche: [4], modo_telegram: [7, 8] });
  B(3, uid(4), 20, { tete: [2], modo_discord: [5] });
  B(4, uid(5), 19, { tete: [2] }, 'Même personne que le compte Discord Froxy');
  B(5, uid(6), 5, { tete: [1], patte_gauche: [4], communication: [3], modo_discord: [6], modo_telegram: [7] });
  if (as === 'admin' || as === 'member') B(6, uid(1), 2, { tete: [1], modo_telegram: [8] });
  const audit = [{ id: 1, at: iso(now - 36e5 * 19), actor: uid(1), action: 'ballot_invalidated', target: uid(44), details: { reason: 'Même personne que le compte Discord Froxy' } }, { id: 2, at: iso(now - 36e5 * 40), actor: uid(2), action: 'ballot_cast', target: uid(41), details: { choices: 4 } }];
  const settings = [];
  const roleCat = (window.ROLE_CATALOG || []).map((r, i) => Object.assign({ sort_order: i * 10 }, r));

  // ----- vues -----
  const prof = (id) => profiles.find(p => p.user_id === id) || {};
  const views = {
    role_catalog: () => roleCat, profiles: () => profiles, elections: () => elections, candidates: () => candidates.map(c => Object.assign({ profiles: prof(c.user_id) }, c)),
    ballots: () => ballots, ballot_choices: () => choices, audit_log: () => audit, app_settings: () => settings,
    public_candidates: () => candidates.filter(c => !c.withdrawn).map(c => Object.assign({}, c, { provider: prof(c.user_id).provider, avatar_url: prof(c.user_id).avatar_url })),
    results: () => candidates.filter(c => !c.withdrawn).map(c => ({ election_id: c.election_id, role: c.role, candidate_id: c.id, display_name: c.display_name, avatar_url: null, provider: prof(c.user_id).provider, telegram_username: c.telegram_username, discord_username: c.discord_username,
      votes: choices.filter(x => x.candidate_id === c.id && !ballots.find(b => b.id === x.ballot_id).invalidated).length })),
    participation: () => elections.map(e => ({ election_id: e.id, voters: ballots.filter(b => b.election_id === e.id && !b.invalidated).length, invalidated: ballots.filter(b => b.election_id === e.id && b.invalidated).length, last_vote_at: ballots.filter(b => b.election_id === e.id).map(b => b.submitted_at).sort().pop() || null })),
    participation_timeline: () => { const out = []; elections.forEach(e => { const bs = ballots.filter(b => b.election_id === e.id && !b.invalidated).map(b => new Date(b.first_submitted_at).setMinutes(0, 0, 0)).sort(); let cum = 0; [...new Set(bs)].forEach(hr => { cum += bs.filter(x => x === hr).length; out.push({ election_id: e.id, hour: iso(hr), cumulative: cum }); }); }); return out; },
    admin_voters: () => ballots.map(b => { const p = prof(b.user_id); const susp = []; if (p.account_created_at && now - new Date(p.account_created_at) < 30 * 864e5) susp.push('nouveau_compte'); if (!p.is_member) susp.push('non_membre');
      if (ballots.some(b2 => b2.election_id === b.election_id && b2.user_id !== b.user_id && prof(b2.user_id).provider !== p.provider && ((prof(b2.user_id).username || '').toLowerCase() === (p.username || '').toLowerCase() || (prof(b2.user_id).display_name || '').toLowerCase() === (p.display_name || '').toLowerCase()))) susp.push('doublon_pseudo');
      return Object.assign({ ballot_id: b.id }, b, { provider: p.provider, provider_id: p.provider_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, is_member: p.is_member, member_checked_at: p.member_checked_at, account_created_at: p.account_created_at, banned: p.banned, suspicion: susp, nb_choix: choices.filter(x => x.ballot_id === b.id).length }); })
  };

  // ----- query builder minimal -----
  const get = (row, path) => path.split('.').reduce((o, k) => o == null ? o : o[k], row);
  function query(table) {
    const filters = []; let order = null, lim = null, single = false, mode = 'select', payload = null;
    const q = {
      select() { return q; }, eq(k, v) { filters.push(r => String(get(r, k)) === String(v)); return q; }, neq(k, v) { filters.push(r => get(r, k) !== v); return q; },
      in(k, arr) { filters.push(r => arr.includes(get(r, k))); return q; }, order(k, o) { order = order || { k, asc: !o || o.ascending !== false }; return q; }, limit(n) { lim = n; return q; },
      maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      update(p) { mode = 'update'; payload = p; return q; }, upsert(p) { mode = 'upsert'; payload = p; return q; }, insert(p) { mode = 'insert'; payload = p; return q; },
      then(res, rej) {
        let data;
        if (mode === 'select') {
          let rows = (views[table] ? views[table]() : []).filter(r => filters.every(f => f(r)));
          if (order) rows = rows.slice().sort((a, b) => (get(a, order.k) > get(b, order.k) ? 1 : -1) * (order.asc ? 1 : -1));
          if (lim) rows = rows.slice(0, lim);
          data = single ? (rows[0] || null) : rows;
        } else if (mode === 'update') { (views[table] ? views[table]() : []).filter(r => filters.every(f => f(r))).forEach(r => { const real = (table === 'candidates' ? candidates : []).find(x => x.id === r.id); if (real) Object.assign(real, payload); }); data = null; }
        else if (mode === 'upsert') { const arr = table === 'app_settings' ? settings : []; [].concat(payload).forEach(p => { const i = arr.findIndex(x => x.key === p.key); if (i >= 0) arr[i] = p; else arr.push(p); }); data = null; }
        else data = null;
        return Promise.resolve({ data, error: null }).then(res, rej);
      }
    };
    return q;
  }

  const rpcs = {
    active_election: () => elections.filter(e => e.status === 'open'),
    my_ballot: ({ p_election }) => { const b = ballots.find(x => x.election_id === p_election && x.user_id === me.user_id); if (!b) return 'null'; const ch = {}; choices.filter(x => x.ballot_id === b.id).forEach(x => (ch[x.role] = ch[x.role] || []).push(x.candidate_id)); return { ballot_id: b.id, submitted_at: b.submitted_at, invalidated: b.invalidated, choices: ch }; },
    cast_ballot: ({ p_election, p_choices }) => { let b = ballots.find(x => x.election_id === p_election && x.user_id === me.user_id); const replaced = !!b; if (!b) { b = { id: uid(60), election_id: p_election, user_id: me.user_id, first_submitted_at: iso(now), submitted_at: iso(now), invalidated: false }; ballots.push(b); } else { b.submitted_at = iso(Date.now()); b.invalidated = false; for (let i = choices.length - 1; i >= 0; i--) if (choices[i].ballot_id === b.id) choices.splice(i, 1); }
      Object.entries(p_choices).forEach(([role, ids]) => ids.forEach(c => choices.push({ ballot_id: b.id, role, candidate_id: c }))); return { ok: true, replaced, ballot_id: b.id }; },
    upsert_candidacy: (a) => { let c = candidates.find(x => x.election_id === a.p_election && x.user_id === me.user_id && x.role === a.p_role); if (!c) { c = C(candidates.length + 1, me.user_id, a.p_role, '', '', null, null); candidates.push(c); } Object.assign(c, { display_name: a.p_display_name, bio: a.p_bio, telegram_username: a.p_telegram_username, discord_username: a.p_discord_username, withdrawn: false, updated_at: iso(Date.now()) }); return c; },
    withdraw_candidacy: ({ p_candidate }) => { const c = candidates.find(x => x.id === p_candidate); if (c) c.withdrawn = true; return null; },
    admin_invalidate_ballot: ({ p_ballot, p_reason }) => { const b = ballots.find(x => x.id === p_ballot); b.invalidated = true; b.invalidated_reason = p_reason; return null; },
    admin_restore_ballot: ({ p_ballot }) => { const b = ballots.find(x => x.id === p_ballot); b.invalidated = false; b.invalidated_reason = null; return null; },
    admin_ban_user: ({ p_user, p_banned }) => { prof(p_user).banned = p_banned; if (p_banned) ballots.filter(b => b.user_id === p_user).forEach(b => { b.invalidated = true; b.invalidated_reason = 'Compte banni'; }); return null; },
    admin_save_election: ({ p }) => { let e = elections.find(x => x.id === p.id); if (!e) { e = { id: uid(12 + elections.length), created_at: iso(Date.now()), reminder_sent: false, results_sent: false, roles: [], status: 'draft', candidacy_open: false, voting_open: false, results_public: true, description: '' }; elections.push(e); } Object.assign(e, p, { updated_at: iso(Date.now()) }); return e; },
    log_audit: () => null
  };

  const session = as === 'anon' ? null : { user: { id: me.user_id, app_metadata: { provider: 'telegram' } }, provider_token: null };
  window.E.sb = {
    from: query,
    rpc: (name, args) => Promise.resolve(rpcs[name] ? { data: rpcs[name](args || {}), error: null } : { data: null, error: { message: 'RPC inconnue ' + name } }),
    auth: { getSession: async () => ({ data: { session } }), signOut: async () => {}, signInWithOAuth: async () => ({ error: { message: 'Mode démo : pas de connexion réelle' } }), verifyOtp: async () => ({ error: null }) },
    functions: { invoke: async () => ({ data: { ok: true, is_member: true }, error: null }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } })
  };
  window.E.ready = true;
  console.info('[elections] Mode démo actif (as=' + as + ').');
})();
