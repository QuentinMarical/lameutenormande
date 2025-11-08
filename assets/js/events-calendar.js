/**
 * Système de Calendrier Interactif avec Google Maps
 * FullCalendar + Google Maps API Integration
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    eventsDataUrl: 'assets/data/events.json',
    defaultView: 'dayGridMonth',
    locale: 'fr',
    mapZoomDefault: 8,
    mapZoomEvent: 14,
    mapCenter: { lat: 49.4432, lng: 1.0993 } // Rouen
  };

  // Variables globales
  let calendar = null;
  let map = null;
  let markers = [];
  let eventsData = [];
  let infoWindow = null;

  /**
   * Initialisation du calendrier
   */
  function initCalendar() {
    const calendarEl = document.getElementById('fullcalendar');
    if (!calendarEl) {
      console.error('Calendar: Element #fullcalendar non trouvé');
      return;
    }

    // Charger les événements
    loadEvents().then(() => {
      calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: CONFIG.defaultView,
        locale: CONFIG.locale,
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek,listMonth'
        },
        buttonText: {
          today: "Aujourd'hui",
          month: 'Mois',
          week: 'Semaine',
          list: 'Liste'
        },
        events: eventsData.map(evt => ({
          id: evt.id,
          title: evt.title,
          start: evt.start,
          end: evt.end,
          backgroundColor: evt.color,
          borderColor: evt.color,
          extendedProps: {
            location: evt.location,
            description: evt.description,
            type: evt.type
          }
        })),
        eventClick: handleEventClick,
        eventMouseEnter: handleEventHover,
        height: '100%',
        aspectRatio: 1.5,
        eventDisplay: 'block',
        displayEventTime: false,
        weekNumbers: false,
        navLinks: true,
        editable: false,
        dayMaxEvents: 3,
        moreLinkText: 'plus',
        eventTimeFormat: {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }
      });

      calendar.render();
      console.log('Calendar: Initialisé avec', eventsData.length, 'événements');
    });
  }

  /**
   * Charger les événements depuis JSON
   */
  async function loadEvents() {
    try {
      const response = await fetch(CONFIG.eventsDataUrl);
      if (!response.ok) throw new Error('Impossible de charger les événements');
      
      eventsData = await response.json();
      console.log('Calendar: Événements chargés', eventsData);
    } catch (error) {
      console.error('Calendar: Erreur chargement événements', error);
      eventsData = [];
    }
  }

  /**
   * Gérer le clic sur un événement
   */
  function handleEventClick(info) {
    info.jsEvent.preventDefault();
    
    const event = info.event;
    const location = event.extendedProps.location;

    if (location && map) {
      // Zoomer sur la carte
      map.setCenter({ lat: location.lat, lng: location.lng });
      map.setZoom(CONFIG.mapZoomEvent);

      // Trouver le marker correspondant
      const marker = markers.find(m => m.eventId === event.id);
      if (marker) {
        // Animer le marker
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 2000);

        // Afficher l'info window
        if (infoWindow) {
          infoWindow.setContent(createInfoWindowContent(event));
          infoWindow.open(map, marker);
        }
      }

      // Feedback visuel sur le calendrier
      const el = info.el;
      el.style.transform = 'scale(1.05)';
      el.style.transition = 'transform 0.3s ease';
      setTimeout(() => {
        el.style.transform = 'scale(1)';
      }, 300);

      // Annoncer pour l'accessibilité
      announceEvent(event);
    }
  }

  /**
   * Gérer le hover sur événement
   */
  function handleEventHover(info) {
    const event = info.event;
    const location = event.extendedProps.location;

    if (location) {
      info.el.style.cursor = 'pointer';
      info.el.title = `${event.title} - ${location.name}\nCliquez pour voir sur la carte`;
    }
  }

  /**
   * Initialiser Google Maps
   */
  function initMap() {
    const mapEl = document.getElementById('google-map');
    if (!mapEl) {
      console.error('Map: Element #google-map non trouvé');
      return;
    }

    // Créer la carte
    map = new google.maps.Map(mapEl, {
      center: CONFIG.mapCenter,
      zoom: CONFIG.mapZoomDefault,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    // Info window unique
    infoWindow = new google.maps.InfoWindow();

    // Ajouter les markers
    eventsData.forEach(event => {
      if (event.location) {
        const marker = new google.maps.Marker({
          position: { lat: event.location.lat, lng: event.location.lng },
          map: map,
          title: event.title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: event.color,
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          animation: google.maps.Animation.DROP
        });

        marker.eventId = event.id;
        markers.push(marker);

        // Clic sur marker
        marker.addListener('click', () => {
          const calEvent = calendar.getEventById(event.id);
          if (calEvent) {
            // Centrer le calendrier sur l'événement
            calendar.gotoDate(calEvent.start);
            
            // Highlight l'événement
            highlightCalendarEvent(event.id);
          }

          // Afficher info
          infoWindow.setContent(createInfoWindowContent(calEvent || event));
          infoWindow.open(map, marker);

          // Animer
          marker.setAnimation(google.maps.Animation.BOUNCE);
          setTimeout(() => marker.setAnimation(null), 1400);
        });

        // Hover sur marker
        marker.addListener('mouseover', () => {
          marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: event.color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3
          });
        });

        marker.addListener('mouseout', () => {
          marker.setIcon({
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: event.color,
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2
          });
        });
      }
    });

    console.log('Map: Initialisée avec', markers.length, 'markers');
  }

  /**
   * Créer le contenu de l'info window
   */
  function createInfoWindowContent(event) {
    const props = event.extendedProps || event;
    const location = props.location || event.location;
    
    return `
      <div style="padding: 10px; max-width: 250px;">
        <h3 style="margin: 0 0 8px 0; color: ${event.color || event.backgroundColor}; font-size: 1.1rem;">
          ${event.title}
        </h3>
        ${event.start ? `
          <p style="margin: 4px 0; font-size: 0.9rem;">
            <strong>??</strong> ${formatDate(event.start)}
            ${event.end && event.end !== event.start ? ` - ${formatDate(event.end)}` : ''}
          </p>
        ` : ''}
        ${location ? `
          <p style="margin: 4px 0; font-size: 0.9rem;">
            <strong>??</strong> ${location.name}
          </p>
        ` : ''}
        ${props.description ? `
          <p style="margin: 8px 0 0 0; font-size: 0.85rem; color: #666;">
            ${props.description}
          </p>
        ` : ''}
      </div>
    `;
  }

  /**
   * Formater une date
   */
  function formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Highlight un événement dans le calendrier
   */
  function highlightCalendarEvent(eventId) {
    // Retirer tous les highlights
    document.querySelectorAll('.fc-event').forEach(el => {
      el.classList.remove('event-highlighted');
    });

    // Ajouter le highlight
    const eventEls = document.querySelectorAll(`[data-event-id="${eventId}"]`);
    eventEls.forEach(el => {
      el.classList.add('event-highlighted');
      
      // Scroll vers l'événement si nécessaire
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  /**
   * Annoncer un événement pour l'accessibilité
   */
  function announceEvent(event) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Événement sélectionné: ${event.title} le ${formatDate(event.start)}`;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  /**
   * Charger FullCalendar CSS et JS
   */
  function loadFullCalendar() {
    return new Promise((resolve, reject) => {
      // CSS
      if (!document.querySelector('link[href*="fullcalendar"]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.css';
        document.head.appendChild(css);
      }

      // JS
      if (window.FullCalendar) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js';
      script.onload = () => {
        // Charger le locale français
        const localeScript = document.createElement('script');
        localeScript.src = 'https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.10/locales/fr.global.min.js';
        localeScript.onload = resolve;
        localeScript.onerror = reject;
        document.head.appendChild(localeScript);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Initialisation globale
   */
  async function init() {
    // Vérifier qu'on est sur la page événements
    if (!document.getElementById('events-calendar-section')) {
      return;
    }

    try {
      // Charger FullCalendar
      await loadFullCalendar();
      console.log('Calendar: FullCalendar chargé');

      // Attendre que Google Maps soit chargé
      if (typeof google === 'undefined' || !google.maps) {
        console.warn('Calendar: En attente de Google Maps...');
        // Attendre avec timeout
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const checkInterval = setInterval(() => {
            if (typeof google !== 'undefined' && google.maps) {
              clearInterval(checkInterval);
              resolve();
            } else if (attempts++ > 50) { // 5 secondes max
              clearInterval(checkInterval);
              reject(new Error('Google Maps timeout'));
            }
          }, 100);
        });
      }

      // Initialiser le calendrier et la carte
      await loadEvents();
      initCalendar();
      initMap();

      console.log('Calendar: Système initialisé avec succès');
    } catch (error) {
      console.error('Calendar: Erreur initialisation', error);
    }
  }

  // Démarrage
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export pour debug
  window.EventsCalendar = {
    getCalendar: () => calendar,
    getMap: () => map,
    getMarkers: () => markers,
    getEvents: () => eventsData
  };

})();
