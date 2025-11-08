# ??? Système de Cache Carte - Ultra Rapide

## ?? Performances

| Méthode | Temps de chargement |
|---------|---------------------|
| **Avant** (géocodage temps réel) | ?? 20-30 secondes |
| **Après** (fichier cache) | ? **< 1 seconde** |

---

## ?? Fichiers

### `assets/data/events-map-cache.json`
Fichier JSON contenant les coordonnées GPS pré-calculées de tous les lieux d'événements.

**Format :**
```json
{
  "Saint-Denis, France": {
    "lat": 48.9356,
    "lon": 2.3539
  },
  "Lille, France": {
    "lat": 50.6292,
    "lon": 3.0573
  }
}
```

### `generate-map-cache.js`
Script Node.js qui génère automatiquement le cache depuis Zoho Calendar.

### `update-map-cache.ps1`
Script PowerShell pour mettre à jour facilement le cache.

---

## ?? Utilisation

### Option 1: Automatique (Recommandé)

**Prérequis:** Node.js installé

1. Double-cliquer sur `update-map-cache.ps1`
2. Attendre la génération (~20 secondes)
3. Le cache est mis à jour automatiquement

**OU en ligne de commande:**
```powershell
.\update-map-cache.ps1
```

---

### Option 2: Manuelle

Si vous n'avez pas Node.js, éditez manuellement `assets/data/events-map-cache.json` :

1. Aller sur https://www.latlong.net/
2. Chercher le lieu de votre événement
3. Copier les coordonnées lat/lng
4. Ajouter dans le fichier JSON :

```json
{
  "Votre Ville, France": {
    "lat": 48.XXXX,
    "lon": 2.XXXX
  }
}
```

---

## ?? Quand mettre à jour le cache ?

**Vous devez mettre à jour le cache quand :**
- ? Vous ajoutez un nouvel événement dans Zoho Calendar
- ? Vous modifiez le lieu d'un événement existant
- ? Vous supprimez un événement (optionnel, pas obligatoire)

**Fréquence recommandée :**
- Après chaque modification d'événement
- OU une fois par semaine
- OU avant chaque déploiement du site

---

## ?? Workflow

### Workflow complet :

```
1. Ajouter événement dans Zoho Calendar
   ?
2. Exécuter update-map-cache.ps1
   ?
3. Le fichier events-map-cache.json est mis à jour
   ?
4. Déployer le site
   ?
5. La carte s'affiche INSTANTANÉMENT (< 1 seconde)
```

### Workflow manuel (sans Node.js) :

```
1. Ajouter événement dans Zoho Calendar
   ?
2. Chercher coordonnées GPS sur latlong.net
   ?
3. Ajouter manuellement dans events-map-cache.json
   ?
4. Déployer le site
   ?
5. La carte s'affiche INSTANTANÉMENT
```

---

## ?? Installation Node.js (pour automatisation)

### Windows :
1. Télécharger : https://nodejs.org/
2. Installer (version LTS recommandée)
3. Redémarrer PowerShell
4. Tester : `node --version`

### Vérifier l'installation :
```powershell
node --version
# Doit afficher : v20.x.x ou v18.x.x
```

---

## ?? Dépannage

### Problème : "Node.js n'est pas installé"
**Solution :** Installer Node.js ou utiliser la méthode manuelle

### Problème : "Erreur lors de la génération du cache"
**Solutions possibles :**
1. Vérifier la connexion Internet
2. Vérifier que le lien iCal Zoho est accessible
3. Réessayer dans quelques minutes (rate limit Nominatim)

### Problème : "Marqueurs manquants sur la carte"
**Solution :** Le lieu n'est pas dans le cache
1. Exécuter `update-map-cache.ps1`
2. OU ajouter manuellement les coordonnées dans le JSON

### Problème : "Carte vide"
**Solutions :**
1. Ouvrir Console (F12) et vérifier les erreurs
2. Vérifier que `events-map-cache.json` existe
3. Vérifier que le fichier JSON est valide (https://jsonlint.com/)

---

## ?? Logs de Debug

Ouvrir Console (F12) pour voir :

```
? BON :
?? Initialisation carte et calendrier...
? Carte Leaflet initialisée
?? Cache géocodage chargé: 19 entrées
?? Chargement des événements depuis Zoho...
? iCal Zoho chargé, parsing...
?? Événements trouvés: 19
??? Mise à jour de la carte...
? 19/19 marqueurs ajoutés sur la carte

? ERREUR :
? Erreur chargement cache
? Pas de coordonnées en cache pour: [lieu]
```

---

## ? Avantages du cache

| Avant (temps réel) | Après (cache) |
|--------------------|---------------|
| ? 20-30 secondes | ? < 1 seconde |
| ? Requêtes API Nominatim | ? Pas de requêtes |
| ? Rate limit | ? Pas de limite |
| ? Dépend d'Internet | ? Fonctionne offline (une fois chargé) |
| ? Lent sur mobile | ? Ultra rapide partout |

---

## ?? Sécurité & Limite

**Nominatim Rate Limit :**
- Maximum 1 requête par seconde
- Le script respecte automatiquement cette limite

**Cache File :**
- Taille : ~1-2 KB pour 20 événements
- Pas de limite de taille pratique
- Peut contenir 1000+ lieux sans problème

---

## ?? Exemple Complet

### Ajouter un nouvel événement :

**1. Dans Zoho Calendar :**
```
Titre : Furry Convention Paris 2026
Lieu : Paris, France
Date : 15-17 Mai 2026
```

**2. Mettre à jour le cache :**
```powershell
.\update-map-cache.ps1
```

**3. Résultat dans events-map-cache.json :**
```json
{
  "Paris, France": {
    "lat": 48.8566,
    "lon": 2.3522
  }
}
```

**4. Déployer ? La carte affiche INSTANTANÉMENT le nouveau marqueur !**

---

## ?? Résumé

**1 seul fichier à mettre à jour = `events-map-cache.json`**

**2 méthodes :**
- ? Automatique : `update-map-cache.ps1` (avec Node.js)
- ?? Manuelle : Éditer le JSON directement

**Résultat : Carte ULTRA-RAPIDE (< 1 seconde) ! ??**

---

**Fichier** : `MAP_CACHE_README.md`  
**Version** : 1.0  
**Date** : Novembre 2025

??? **Votre carte est maintenant 20x plus rapide ! Plus jamais d'attente ! ?**
