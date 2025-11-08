/**
 * Fix pour le menu hamburger mobile
 * Gestion manuelle du toggle si Bootstrap échoue
 */

(function() {
  'use strict';

  function initMobileMenuFix() {
    // Attendre que le DOM soit chargé
    const navbar = document.querySelector('.navbar-collapse');
    const toggleBtn = document.querySelector('.navbar-toggler');
    
    if (!navbar || !toggleBtn) {
      console.warn('Mobile Menu Fix: Éléments navbar non trouvés');
      return;
    }

    // Flag pour éviter les doublons d'événements
    let isManuallyManaged = false;

    // Fonction pour toggle le menu
    function toggleMenu(e) {
      if (e) e.preventDefault();
      
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      
      if (isExpanded) {
        // Fermer le menu
        navbar.classList.remove('show');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.classList.add('collapsed');
        document.body.style.overflow = '';
      } else {
        // Ouvrir le menu
        navbar.classList.add('show');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.classList.remove('collapsed');
        // Empêcher le scroll du body quand le menu est ouvert
        document.body.style.overflow = 'hidden';
      }
    }

    // Vérifier si Bootstrap fonctionne après un court délai
    setTimeout(() => {
      // Tester si Bootstrap gère déjà le toggle
      const bsCollapse = window.bootstrap?.Collapse;
      
      if (!bsCollapse) {
        // Bootstrap ne fonctionne pas, activer la gestion manuelle
        isManuallyManaged = true;
        console.log('Mobile Menu Fix: Gestion manuelle activée');
        
        // Ajouter l'événement de clic
        toggleBtn.addEventListener('click', toggleMenu);
        
        // Fermer le menu si on clique sur un lien
        const navLinks = navbar.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
          link.addEventListener('click', () => {
            if (window.innerWidth < 992) {
              toggleMenu();
            }
          });
        });
        
        // Fermer le menu si on clique en dehors
        document.addEventListener('click', (e) => {
          if (window.innerWidth < 992 && 
              !navbar.contains(e.target) && 
              !toggleBtn.contains(e.target) &&
              navbar.classList.contains('show')) {
            toggleMenu();
          }
        });
        
        // Fermer le menu sur Escape
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && navbar.classList.contains('show')) {
            toggleMenu();
            toggleBtn.focus();
          }
        });
      }
    }, 500);

    // Fermer le menu lors du resize si on passe en desktop
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (window.innerWidth >= 992 && navbar.classList.contains('show')) {
          navbar.classList.remove('show');
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.classList.add('collapsed');
          document.body.style.overflow = '';
        }
      }, 150);
    });

    console.log('Mobile Menu Fix: Initialisé');
  }

  // Initialiser au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenuFix);
  } else {
    initMobileMenuFix();
  }

})();
