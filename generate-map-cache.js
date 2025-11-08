// Script Node.js pour générer le cache de coordonnées GPS depuis Zoho Calendar
// À exécuter : node generate-map-cache.js

const https = require('https');
const fs = require('fs');

const ICAL_URL = 'https://calendar.zoho.eu/ical/zz080112301ab3047e81313179c3ee5fd4b00c2a7157b801985735a7b689432472bf947fc87d113e58fdc5e83eea16ec9dc7bc3e4c';
const CORS_PROXY = 'https://corsproxy.io/?';
const OUTPUT_FILE = './assets/data/events-map-cache.json';

// Délai entre requêtes Nominatim (1 seconde minimum)
const GEOCODE_DELAY = 1000;

// Cache de géocodage (pour éviter de refaire les mêmes requêtes)
let geocodeCache = {};

// Charger le cache existant si disponible
try {
  if (fs.existsSync(OUTPUT_FILE)) {
    const data = fs.readFileSync(OUTPUT_FILE, 'utf8');
    geocodeCache = JSON.parse(data);
    console.log(`?? Cache existant chargé: ${Object.keys(geocodeCache).length} entrées`);
  }
} catch (e) {
  console.log('?? Pas de cache existant, création d\'un nouveau');
}

/**
 * Télécharge le fichier iCal depuis Zoho
 */
function fetchIcal() {
  return new Promise((resolve, reject) => {
    const url = CORS_PROXY + encodeURIComponent(ICAL_URL);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse le fichier iCal et extrait les événements
 */
function parseIcal(icalData) {
  const events = [];
  const lines = icalData.split('\n');
  
  let currentEvent = null;
  
  for (let line of lines) {
    line = line.trim();
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.location) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9).replace(/\\,/g, ',');
      } else if (line.startsWith('UID:')) {
        currentEvent.id = line.substring(4);
      }
    }
  }
  
  return events;
}

/**
 * Géocode une adresse avec Nominatim
 */
async function geocodeAddress(address) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    
    https.get(url, {
      headers: {
        'User-Agent': 'LaMeuteNormande-CacheGenerator/1.0'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results && results.length > 0) {
            resolve({
              lat: parseFloat(results[0].lat),
              lon: parseFloat(results[0].lon)
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Génère le cache complet
 */
async function generateCache() {
  console.log('?? Téléchargement du calendrier Zoho...');
  
  try {
    const icalData = await fetchIcal();
    console.log('? Calendrier téléchargé');
    
    const events = parseIcal(icalData);
    console.log(`?? ${events.length} événements trouvés`);
    
    let geocoded = 0;
    let cached = 0;
    let failed = 0;
    
    for (const event of events) {
      const location = event.location;
      
      // Vérifier si déjà en cache
      if (geocodeCache[location]) {
        console.log(`?? [${cached + geocoded + failed + 1}/${events.length}] Cache hit: ${location}`);
        cached++;
        continue;
      }
      
      // Géocoder
      console.log(`?? [${cached + geocoded + failed + 1}/${events.length}] Géocodage: ${location}`);
      
      const coords = await geocodeAddress(location);
      
      if (coords) {
        geocodeCache[location] = coords;
        geocoded++;
        console.log(`   ? ${coords.lat}, ${coords.lon}`);
      } else {
        console.log(`   ? Échec géocodage`);
        failed++;
      }
      
      // Attendre 1 seconde entre chaque requête (rate limit Nominatim)
      if (geocoded + failed < events.length - cached) {
        await new Promise(resolve => setTimeout(resolve, GEOCODE_DELAY));
      }
    }
    
    // Sauvegarder le cache
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geocodeCache, null, 2), 'utf8');
    
    console.log('\n? Cache généré avec succès!');
    console.log(`   ?? ${cached} depuis cache`);
    console.log(`   ?? ${geocoded} nouveaux géocodés`);
    console.log(`   ? ${failed} échecs`);
    console.log(`   ?? Total: ${Object.keys(geocodeCache).length} entrées`);
    console.log(`   ?? Fichier: ${OUTPUT_FILE}`);
    
  } catch (error) {
    console.error('? Erreur:', error);
    process.exit(1);
  }
}

// Exécuter
generateCache();
