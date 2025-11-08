// Script d'initialisation personnalisé pour optimisations
(function() {
  'use strict';

  // Enregistrement du Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js')
        .then(function(registration) {
          console.log('ServiceWorker enregistré:', registration.scope);
        })
        .catch(function(error) {
          console.log('ServiceWorker échec:', error);
        });
    });
  }

  // Lazy loading optimisé pour les images
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // Détection du thème préféré de l'utilisateur
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    console.log('Mode sombre préféré détecté');
    // Potentiellement appliquer un thème sombre personnalisé
  }

  // Analytics Google - Remplacez YOUR_GA_ID par votre ID Google Analytics
  /*
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR_GA_ID', {
    'anonymize_ip': true,
    'cookie_flags': 'SameSite=None;Secure'
  });
  */

  // Gestion des erreurs JavaScript
  window.addEventListener('error', function(e) {
    console.error('Erreur JavaScript:', e.error);
    // Envoyer à un service de monitoring si configuré
  });

  // Performance monitoring
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn('Tâche longue détectée:', entry.name, entry.duration);
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['measure', 'navigation'] });
    } catch (e) {
      console.log('Performance Observer non supporté pour ce type');
    }
  }

  // Amélioration de l'accessibilité: annonce des changements de page
  const announcePageChange = () => {
    const pageTitle = document.title;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Page chargée: ${pageTitle}`;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  };

  // Appeler lors du chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announcePageChange);
  } else {
    announcePageChange();
  }

  // Optimisation des animations au scroll
  let ticking = false;
  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        // Votre code de gestion du scroll ici
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Console info
  console.log('%c?? La Meute Normande', 'color: #ffc107; font-size: 20px; font-weight: bold;');
  console.log('%cSite web optimisé pour les performances et l\'accessibilité', 'color: #6c757d;');

})();
