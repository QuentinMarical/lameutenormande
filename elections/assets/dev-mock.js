/* Mode démo locale : remplace le client Supabase par une base en mémoire.
   Activé uniquement avec ?mock=1 dans l'URL (chargé par common.js). Jamais utilisé en production.
   Options : ?mock=1&as=member (défaut, code MEUTE-TEST-0001 mémorisé) | anon (aucun code) | admin (session admin) */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const as = params.get('as') || 'member';
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const uid = (n) => '00000000-0000-4000-8000-0000000000' + String(n).padStart(2, '0');
  const ELECTION = uid(10);

  const elections = [
    { id: ELECTION, slug: 'staff-2026', title: 'Élection du staff 2026', description: 'Renouvellement de l\'équipe de la Meute Normande.', roles: ['tete', 'patte_gauche', 'patte_droite', 'communication', 'modo_telegram', 'modo_discord'],
      status: 'open', candidacy_open: true, voting_open: true, voting_closes_at: iso(now + 36e5 * 30), results_public: true, reminder_sent: false, results_sent: false, created_at: iso(now - 864e5 * 7), updated_at: iso(now) },
    { id: uid(11), slug: 'staff-2025', title: 'Élection du staff 2025', description: '', roles: ['tete', 'modo_telegram'], status: 'archived', candidacy_open: false, voting_open: false, voting_closes_at: iso(now - 864e5 * 365), results_public: true, reminder_sent: true, results_sent: true, created_at: iso(now - 864e5 * 372), updated_at: iso(now - 864e5 * 365) }];

  const VC = (n, code, label, used, extra) => Object.assign({ id: uid(30 + n), election_id: ELECTION, code, code_key: code.replace(/-/g, ''), label, distributed: !!label, first_used_at: used ? iso(now - 36e5 * used) : null, last_used_at: used ? iso(now - 36e5) : null, uses: used ? 3 : 0, revoked: false, revoked_reason: null, created_at: iso(now - 864e5 * 6) }, extra || {});
  const codes = [
    VC(1, 'MEUTE-TEST-0001', 'Nitra', 2), VC(2, 'MEUTE-K7Q2-XA9F', 'Kitjune', 40), VC(3, 'MEUTE-P3HN-7ZWD', 'Spyro The Bat', 30),
    VC(4, 'MEUTE-B8RT-2MLC', 'Froxy', 20), VC(5, 'MEUTE-W4GS-QJ6E', 'Froxy', 19, { uses: 25 }), VC(6, 'MEUTE-D9VY-3KHP', 'AzOwO', 5),
    VC(7, 'MEUTE-N2FX-8TRA', null, 0), VC(8, 'MEUTE-Z6CM-5UQB', 'Yellow', 0), VC(9, 'MEUTE-H5LJ-9EDS', 'Dragos', 0, { revoked: true, revoked_reason: 'Envoyé à la mauvaise personne' })];
  const codeOf = (n) => uid(30 + n);

  const C = (n, code, role, name, bio, tg, dc) => ({ id: uid(20 + n), election_id: ELECTION, code_id: codeOf(code), role, display_name: name, bio, telegram_username: tg, discord_username: dc, withdrawn: false, created_at: iso(now - 864e5 * 3 + n * 36e5), updated_at: iso(now - 864e5 * 3 + n * 36e5) });
  const candidates = [
    C(1, 2, 'tete', 'Kitjune', 'Membre depuis le début, je veux continuer à faire grandir la meute avec des rassemblements réguliers et une équipe soudée. On a plein d\'idées pour 2026 : week-end à la mer, stand aux conventions, et plus de soirées jeux.', 'KITJUNE', 'kitjune'),
    C(2, 3, 'tete', 'Spyro The Bat', 'Je m\'occupe déjà du calendrier, je propose de coordonner davantage.', 'spyro_the_bat', null),
    C(3, 3, 'communication', 'Spyro The Bat', 'Annonces, Instagram, site : je continue !', 'spyro_the_bat', null),
    C(4, 1, 'patte_gauche', 'Nitra', 'Je gère le site, je peux seconder sur la logistique.', 'nitrafox', 'nitra'),
    C(5, 4, 'modo_discord', 'Froxy', 'Présent tous les soirs sur le Discord, calme et diplomate.', 'TheFoxFurieFR', 'froxy'),
    C(6, 6, 'modo_discord', 'AzOwO', 'Musique, bonne humeur et bans quand il faut.', 'AzOwO_Music', 'azowo'),
    C(7, 6, 'modo_telegram', 'AzOwO', '', 'AzOwO_Music', 'azowo'),
    C(8, 2, 'modo_telegram', 'Kitjune', 'Déjà modo, je rempile.', 'KITJUNE', 'kitjune'),
    C(10, 3, 'modo_discord', 'Spyro The Bat', 'Je peux aussi aider côté Discord.', 'spyro_the_bat', 'spyro')];
  candidates.push(Object.assign(C(9, 4, 'patte_droite', 'Froxy', 'Finalement non.', 'TheFoxFurieFR', 'froxy'), { withdrawn: true }));

  const ballots = [], choices = [];
  const B = (n, code, hoursAgo, ch, inval, subs) => { const id = uid(40 + n); ballots.push({ id, election_id: ELECTION, code_id: codeOf(code), first_submitted_at: iso(now - 36e5 * hoursAgo), submitted_at: iso(now - 36e5 * (hoursAgo - 1)), submissions: subs || 1, invalidated: !!inval, invalidated_by: null, invalidated_reason: inval || null }); Object.entries(ch).forEach(([role, ids]) => ids.forEach(c => choices.push({ ballot_id: id, role, candidate_id: uid(20 + c) }))); };
  B(1, 2, 40, { tete: [1], communication: [3], modo_discord: [5, 6] });
  B(2, 3, 30, { tete: [1], patte_gauche: [4], modo_telegram: [7, 8] });
  B(3, 4, 20, { tete: [2], modo_discord: [5] });
  B(4, 5, 19, { tete: [2] }, 'Étiquette en double avec un autre code', 6);
  B(5, 6, 5, { tete: [1], patte_gauche: [4], communication: [3], modo_discord: [6], modo_telegram: [7] });
  B(6, 1, 2, { tete: [1], modo_telegram: [8] });
  const audit = [{ id: 1, at: iso(now - 36e5 * 19), actor: 'admin:' + uid(1), action: 'ballot_invalidated', target: uid(44), details: { reason: 'Étiquette en double' } }, { id: 2, at: iso(now - 36e5 * 40), actor: 'code:Kitjune', action: 'ballot_cast', target: uid(41), details: { choices: 4 } }, { id: 3, at: iso(now - 864e5 * 6), actor: 'admin:' + uid(1), action: 'codes_generated', target: ELECTION, details: { n: 9 } }];
  const settings = [];
  const roleCat = (window.ROLE_CATALOG || []).map((r, i) => Object.assign({ sort_order: i * 10 }, r));
  if (as === 'member') { try { localStorage.setItem('elections.code.' + ELECTION, 'MEUTE-TEST-0001'); } catch {} }
  if (as === 'anon') { try { localStorage.removeItem('elections.code.' + ELECTION); } catch {} }

  const vc = (id) => codes.find(c => c.id === id) || {};
  const views = {
    role_catalog: () => roleCat, elections: () => elections, voter_codes: () => codes, candidates: () => candidates.map(c => Object.assign({ voter_codes: vc(c.code_id) }, c)),
    ballots: () => ballots, ballot_choices: () => choices.map(x => Object.assign({ ballots: ballots.find(b => b.id === x.ballot_id) }, x)), audit_log: () => audit, app_settings: () => settings,
    public_candidates: () => candidates.filter(c => !c.withdrawn),
    results: () => candidates.filter(c => !c.withdrawn).map(c => ({ election_id: c.election_id, role: c.role, candidate_id: c.id, display_name: c.display_name, telegram_username: c.telegram_username, discord_username: c.discord_username,
      votes: choices.filter(x => x.candidate_id === c.id && !ballots.find(b => b.id === x.ballot_id).invalidated).length })),
    participation: () => elections.map(e => ({ election_id: e.id, voters: ballots.filter(b => b.election_id === e.id && !b.invalidated).length, invalidated: ballots.filter(b => b.election_id === e.id && b.invalidated).length, codes_issued: codes.filter(c => c.election_id === e.id && !c.revoked).length, last_vote_at: ballots.filter(b => b.election_id === e.id).map(b => b.submitted_at).sort().pop() || null })),
    participation_timeline: () => { const out = []; elections.forEach(e => { const bs = ballots.filter(b => b.election_id === e.id && !b.invalidated).map(b => new Date(b.first_submitted_at).setMinutes(0, 0, 0)).sort(); let cum = 0; [...new Set(bs)].forEach(hr => { cum += bs.filter(x => x === hr).length; out.push({ election_id: e.id, hour: iso(hr), cumulative: cum }); }); }); return out; },
    admin_voters: () => ballots.map(b => { const c = vc(b.code_id); const susp = []; if (!c.label) susp.push('sans_etiquette'); if (b.submissions >= 5) susp.push('nombreuses_soumissions'); if (c.uses >= 20) susp.push('code_tres_utilise');
      if (c.label && codes.some(c2 => c2.id !== c.id && c2.label && c2.label.toLowerCase() === c.label.toLowerCase())) susp.push('etiquette_en_double');
      return Object.assign({ ballot_id: b.id }, b, { code: c.code, label: c.label, distributed: c.distributed, revoked: c.revoked, uses: c.uses, suspicion: susp, nb_choix: choices.filter(x => x.ballot_id === b.id).length }); })
  };

  const get = (row, path) => path.split('.').reduce((o, k) => o == null ? o : o[k], row);
  function query(table) {
    const filters = []; let order = null, lim = null, single = false, mode = 'select', payload = null;
    const q = {
      select() { return q; }, eq(k, v) { filters.push(r => String(get(r, k)) === String(v)); return q; }, neq(k, v) { filters.push(r => get(r, k) !== v); return q; },
      in(k, arr) { filters.push(r => arr.includes(get(r, k))); return q; }, order(k, o) { order = order || { k, asc: !o || o.ascending !== false }; return q; }, limit(n) { lim = n; return q; },
      maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      update(p) { mode = 'update'; payload = p; return q; }, upsert(p) { mode = 'upsert'; payload = p; return q; }, insert(p) { mode = 'insert'; payload = p; return q; },
      then(res, rej) {
        let data = null;
        if (mode === 'select') {
          let rows = (views[table] ? views[table]() : []).filter(r => filters.every(f => f(r)));
          if (order) rows = rows.slice().sort((a, b) => (get(a, order.k) > get(b, order.k) ? 1 : -1) * (order.asc ? 1 : -1));
          if (lim) rows = rows.slice(0, lim);
          data = single ? (rows[0] || null) : rows;
        } else if (mode === 'upsert' && table === 'app_settings') { [].concat(payload).forEach(p => { const i = settings.findIndex(x => x.key === p.key); if (i >= 0) settings[i] = p; else settings.push(p); }); }
        return Promise.resolve({ data, error: null }).then(res, rej);
      }
    };
    return q;
  }

  const err = (m) => { const e = new Error(m); e.message = m; return e; };
  function resolveCode(code, election) {
    const key = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const c = codes.find(x => x.code_key === key && x.election_id === election);
    if (!c) throw err('CODE_INVALID'); if (c.revoked) throw err('CODE_REVOKED');
    c.first_used_at = c.first_used_at || iso(now); c.last_used_at = iso(Date.now()); c.uses++;
    return c;
  }
  const rpcs = {
    is_admin: () => as === 'admin',
    active_election: () => elections.filter(e => e.status === 'open'),
    check_code: ({ p_code, p_election }) => { const c = resolveCode(p_code, p_election); return { ok: true, code: c.code, label: c.label, has_ballot: ballots.some(b => b.code_id === c.id && !b.invalidated), candidacies: candidates.filter(x => x.code_id === c.id && !x.withdrawn).length }; },
    my_ballot: ({ p_code, p_election }) => { const c = resolveCode(p_code, p_election); const b = ballots.find(x => x.election_id === p_election && x.code_id === c.id); if (!b) return 'null'; const ch = {}; choices.filter(x => x.ballot_id === b.id).forEach(x => (ch[x.role] = ch[x.role] || []).push(x.candidate_id)); return { ballot_id: b.id, submitted_at: b.submitted_at, invalidated: b.invalidated, choices: ch }; },
    my_candidacies: ({ p_code, p_election }) => { const c = resolveCode(p_code, p_election); return candidates.filter(x => x.code_id === c.id); },
    cast_ballot: ({ p_code, p_election, p_choices }) => { const c = resolveCode(p_code, p_election); let b = ballots.find(x => x.election_id === p_election && x.code_id === c.id); const replaced = !!b;
      if (!b) { b = { id: uid(60), election_id: p_election, code_id: c.id, first_submitted_at: iso(Date.now()), submitted_at: iso(Date.now()), submissions: 1, invalidated: false }; ballots.push(b); }
      else { b.submitted_at = iso(Date.now()); b.submissions++; b.invalidated = false; for (let i = choices.length - 1; i >= 0; i--) if (choices[i].ballot_id === b.id) choices.splice(i, 1); }
      Object.entries(p_choices).forEach(([role, ids]) => ids.forEach(x => choices.push({ ballot_id: b.id, role, candidate_id: x }))); return { ok: true, replaced, ballot_id: b.id }; },
    upsert_candidacy: (a) => { const c = resolveCode(a.p_code, a.p_election); let k = candidates.find(x => x.election_id === a.p_election && x.code_id === c.id && x.role === a.p_role); if (!k) { k = C(candidates.length + 1, 1, a.p_role, '', '', null, null); k.code_id = c.id; candidates.push(k); } Object.assign(k, { display_name: a.p_display_name, bio: a.p_bio, telegram_username: a.p_telegram_username, discord_username: a.p_discord_username, withdrawn: false, updated_at: iso(Date.now()) }); return k; },
    withdraw_candidacy: ({ p_code, p_election, p_candidate }) => { const c = resolveCode(p_code, p_election); const k = candidates.find(x => x.id === p_candidate && x.code_id === c.id); if (!k) throw err('CANDIDATE_NOT_FOUND'); k.withdrawn = true; return null; },
    admin_invalidate_ballot: ({ p_ballot, p_reason }) => { const b = ballots.find(x => x.id === p_ballot); b.invalidated = true; b.invalidated_reason = p_reason; return null; },
    admin_restore_ballot: ({ p_ballot }) => { const b = ballots.find(x => x.id === p_ballot); b.invalidated = false; b.invalidated_reason = null; return null; },
    admin_withdraw_candidacy: ({ p_candidate, p_restore }) => { const k = candidates.find(x => x.id === p_candidate); k.withdrawn = !p_restore; return null; },
    admin_generate_codes: ({ p_election, p_n, p_prefix, p_labels }) => { const out = []; for (let i = 0; i < p_n; i++) { const s = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); const code = (p_prefix || 'MEUTE').toUpperCase() + '-' + s.slice(0, 4) + '-' + s.slice(4); const row = VC(codes.length + 1, code, p_labels && p_labels[i] || null, 0); row.election_id = p_election; row.distributed = false; codes.push(row); out.push(row); } return out; },
    admin_update_code: ({ p_code_id, p_label, p_distributed, p_revoked, p_reason }) => { const c = codes.find(x => x.id === p_code_id); if (p_label != null) c.label = p_label.trim() || null; if (p_distributed != null) c.distributed = p_distributed; if (p_revoked != null) { c.revoked = p_revoked; c.revoked_reason = p_revoked ? p_reason : null; if (p_revoked) ballots.filter(b => b.code_id === c.id).forEach(b => { b.invalidated = true; b.invalidated_reason = p_reason || 'Code révoqué'; }); } return null; },
    admin_save_election: ({ p }) => { let e = elections.find(x => x.id === p.id); if (!e) { e = { id: uid(12 + elections.length), created_at: iso(Date.now()), reminder_sent: false, results_sent: false, roles: [], status: 'draft', candidacy_open: false, voting_open: false, results_public: true, description: '' }; elections.push(e); } Object.assign(e, p, { updated_at: iso(Date.now()) }); return e; },
    log_audit: () => null
  };

  const session = as === 'admin' ? { user: { id: uid(1), email: 'admin@lameutenormande.fr' } } : null;
  window.E.sb = {
    from: query,
    rpc: (name, args) => { try { return Promise.resolve(rpcs[name] ? { data: rpcs[name](args || {}), error: null } : { data: null, error: { message: 'RPC inconnue ' + name } }); } catch (e) { return Promise.resolve({ data: null, error: { message: e.message } }); } },
    auth: { getSession: async () => ({ data: { session } }), signOut: async () => {}, signInWithPassword: async () => ({ error: { message: 'Mode démo : utilise &as=admin' } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } })
  };
  window.E.ready = true;
  console.info('[elections] Mode démo actif (as=' + as + ').');
})();
