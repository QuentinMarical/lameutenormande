// Installation de l'espace admin comme application (PWA) : proposée une seule fois par appareil,
// au premier login admin confirmé (voir AdminPWA.maybeShowInstallBanner(), appelée depuis
// admin/index.html une fois la session admin validée) — jamais reproposée ensuite, qu'elle ait
// été acceptée, refusée, ou déjà installée (repérable via le mode d'affichage "standalone").
// Chrome/Edge savent proposer l'installation (évènement beforeinstallprompt) ; Safari et Firefox
// ne l'émettent jamais, la bannière ne s'affiche donc simplement pas sur ces navigateurs.
(function () {
  'use strict';
  const STORAGE_KEY = 'admin_pwa_install_prompted';
  let deferredPrompt = null;
  let loginConfirmed = false;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function alreadyPrompted() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  }
  function markPrompted() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* stockage indisponible : tant pis, on ne réessaiera pas cette session */ }
  }

  function showBanner() {
    if (document.querySelector('.pwa-install-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.innerHTML = '<span>Installer l’espace admin comme application sur cet appareil ?</span>'
      + '<span class="pwa-install-actions">'
      + '<button type="button" class="btn small" data-action="install">Installer</button>'
      + '<button type="button" class="btn secondary small" data-action="dismiss">Plus tard</button>'
      + '</span>';
    banner.addEventListener('click', async (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.action === 'install' && deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
      markPrompted();
      banner.remove();
    });
    document.body.appendChild(banner);
  }

  function maybeShow() {
    if (!loginConfirmed || isStandalone() || alreadyPrompted() || !deferredPrompt) return;
    showBanner();
  }

  // L'évènement peut arriver avant ou après la confirmation de connexion admin (selon la vitesse
  // du round-trip Supabase) : on retente à chaque déclencheur plutôt que de supposer un ordre.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    maybeShow();
  });
  window.addEventListener('appinstalled', markPrompted);

  window.AdminPWA = {
    maybeShowInstallBanner: function () { loginConfirmed = true; maybeShow(); }
  };
})();
