/* Connexion Telegram (Login Widget + Edge Function) et Discord (OAuth Supabase). Expose window.A */
(function () {
  'use strict';
  const A = {};
  window.A = A;
  const cfg = window.ELECTIONS_CONFIG || {};

  const callbackUrl = () => new URL('auth/callback.html', cfg.SITE_URL || (location.origin + location.pathname.replace(/[^/]*$/, ''))).href;

  A.signInDiscord = async function (returnTo) {
    try { localStorage.setItem('elections.returnTo', returnTo || 'index.html'); } catch {}
    const { error } = await E.sb.auth.signInWithOAuth({
      provider: 'discord',
      options: { scopes: 'identify guilds', redirectTo: callbackUrl() }
    });
    if (error) E.toast(E.errMsg(error), 'error');
  };

  /** Après le retour OAuth Discord : vérifie l'appartenance au serveur via l'Edge Function. */
  A.verifyDiscord = async function (session) {
    if (!session || !session.provider_token) return { ok: false, error: 'Jeton Discord absent : reconnecte-toi.' };
    const { data, error } = await E.sb.functions.invoke('verify-discord', { body: { provider_token: session.provider_token } });
    if (error) return { ok: false, error: await readFnError(error) };
    return data || { ok: false };
  };

  /** Callback du Telegram Login Widget (data-onauth="onTelegramAuth(user)"). */
  window.onTelegramAuth = async function (user) {
    const btn = E.qs('#tg-status');
    if (btn) btn.textContent = 'Vérification du compte Telegram…';
    try {
      const { data, error } = await E.sb.functions.invoke('telegram-auth', { body: user });
      if (error) throw new Error(await readFnError(error));
      if (!data || !data.token_hash) throw new Error(data && data.error || 'Réponse inattendue');
      const { error: e2 } = await E.sb.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
      if (e2) throw e2;
      let returnTo = 'index.html';
      try { returnTo = localStorage.getItem('elections.returnTo') || returnTo; localStorage.removeItem('elections.returnTo'); } catch {}
      if (data.is_member === false) E.toast('Connecté, mais ton compte n\'est pas dans le groupe Telegram principal.', 'error');
      location.href = returnTo;
    } catch (err) {
      if (btn) btn.textContent = '';
      E.toast('Connexion Telegram impossible : ' + E.errMsg(err), 'error');
    }
  };

  async function readFnError(error) {
    try {
      if (error.context && typeof error.context.json === 'function') { const j = await error.context.json(); return j.error || j.message || error.message; }
    } catch {}
    return error.message || String(error);
  }

  /** Affiche les deux boutons de connexion dans container. */
  A.renderLogin = function (container, opts) {
    opts = opts || {};
    try { localStorage.setItem('elections.returnTo', opts.returnTo || 'index.html'); } catch {}
    E.clear(container);
    const grid = E.h('div', { class: 'grid-2' });

    // Discord
    grid.appendChild(E.h('div', { class: 'card column', style: { marginBottom: 0 } },
      E.h('div', { class: 'title' }, '🎧 Avec Discord'),
      E.h('div', { class: 'desc' }, 'On vérifie que ton compte est sur le serveur Discord de la Meute.'),
      E.h('button', { class: 'btn discord', type: 'button', onClick: () => A.signInDiscord(opts.returnTo) }, 'Se connecter avec Discord')));

    // Telegram
    const tgCard = E.h('div', { class: 'card column', style: { marginBottom: 0 } },
      E.h('div', { class: 'title' }, '✈ Avec Telegram'),
      E.h('div', { class: 'desc' }, 'On vérifie que ton compte est dans le groupe Telegram principal.'));
    const holder = E.h('div', { style: { minHeight: '40px', display: 'flex', alignItems: 'center' } });
    const status = E.h('div', { id: 'tg-status', class: 'small muted' });
    tgCard.appendChild(holder); tgCard.appendChild(status);
    grid.appendChild(tgCard);
    container.appendChild(grid);

    if (!cfg.TELEGRAM_BOT_USERNAME) { holder.textContent = 'Bot Telegram non configuré.'; return; }
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', cfg.TELEGRAM_BOT_USERNAME);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '12');
    s.setAttribute('data-userpic', 'false');
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    s.setAttribute('data-lang', 'fr');
    holder.appendChild(s);
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') {
      status.textContent = 'Le widget Telegram ne fonctionne que sur le domaine déclaré auprès de BotFather (' + (cfg.SITE_URL || '') + ').';
    }
  };

  /** Page auth/callback.html : finalise la session puis redirige. */
  A.handleCallback = async function (statusEl) {
    const say = (t) => { if (statusEl) statusEl.textContent = t; };
    try {
      say('Récupération de la session…');
      let session = (await E.sb.auth.getSession()).data.session;
      if (!session) {
        // supabase-js traite le hash / code dans l'URL ; on lui laisse un instant
        await new Promise(r => setTimeout(r, 800));
        session = (await E.sb.auth.getSession()).data.session;
      }
      if (!session) throw new Error('Connexion non aboutie. Réessaie.');
      const provider = session.user.app_metadata && session.user.app_metadata.provider;
      if (provider === 'discord') {
        say('Vérification de ton appartenance au serveur Discord…');
        const r = await A.verifyDiscord(session);
        if (!r.ok) { say('Vérification impossible : ' + (r.error || '')); }
        else if (!r.is_member) { say('Connecté, mais ton compte n\'est pas sur le serveur Discord de la Meute.'); }
      }
      let returnTo = 'index.html';
      try { returnTo = localStorage.getItem('elections.returnTo') || returnTo; localStorage.removeItem('elections.returnTo'); } catch {}
      say('Redirection…');
      location.replace('../' + returnTo.replace(/^\.?\//, ''));
    } catch (err) {
      say('Erreur : ' + E.errMsg(err));
      if (statusEl) statusEl.parentElement.appendChild(E.h('div', { class: 'btn-row center' }, E.h('a', { class: 'btn', href: '../index.html' }, 'Retour à l\'accueil')));
    }
  };
})();
