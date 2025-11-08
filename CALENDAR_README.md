# ??? Calendrier Dynamique avec Zoho Calendar

## ? Fonctionnalités

- **100% Dynamique** - Chargement automatique depuis Zoho Calendar
- **2 Couleurs Seulement** - Bleu (furry) et Orange (autres)
- **Détection Automatique** - Analyse les titres pour appliquer la bonne couleur
- **Synchronisation Temps Réel** - Ajoutez sur Zoho ? Apparaît sur le site
- **Zéro Maintenance** - Plus besoin de modifier le code !

---

## ?? **SYSTÈME DE COULEURS (2 COULEURS)**

### ?? **BLEU (#43BCCD) - Événements FURRY**

Le système détecte automatiquement si un événement est furry en cherchant ces mots-clés dans le **titre** :

- `furry`
- `furries`
- `fursona`
- `fursuit`
- `anthro`
- `canthro`
- `faun`

**Exemples de titres détectés en BLEU :**
- ? "Furry BlackLight 2025"
- ? "Canthrofur"
- ? "Fauntastic 6"
- ? "Meetup Furries Normandie"
- ? "Anthrocon Europe"

### ?? **ORANGE (#DDA600) - TOUT LE RESTE**

Tous les autres événements (conventions, festivals, meetups non-furry) sont automatiquement en orange.

**Exemples de titres détectés en ORANGE :**
- ? "Japan Expo Paris"
- ? "Geek Days Lille"
- ? "Normannia"
- ? "Festival Manga Deauville"
- ? "Cidre & Dragon"

---

## ?? **AJOUTER UN ÉVÉNEMENT**

### Étapes :

1. **Aller sur Zoho Calendar** : https://calendar.zoho.eu/
2. **Créer un événement** avec :
   - **Titre** : Nom de l'événement
     - ? **Astuce** : Si c'est furry, mettez "furry" dans le titre !
   - **Date/Heure** : Quand ça se passe
   - **Lieu** : Adresse complète
   - **Description** : Détails supplémentaires
3. **Sauvegarder**
4. **Actualiser** la page web ? L'événement apparaît automatiquement !

### ?? Exemples de création :

**Pour un événement FURRY (?? Bleu) :**
```
Titre : "Furry Meet Rouen 2025"
Date : 15/06/2025 14:00
Lieu : Parc du Champ de Mars, Rouen
Description : Rencontre de la meute normande
```
? Sera automatiquement affiché en **BLEU**

**Pour un événement NON-FURRY (?? Orange) :**
```
Titre : "Japan Expo Paris 2026"
Date : 09/07/2026 10:00
Lieu : Villepinte
Description : Plus grande convention de culture japonaise
```
? Sera automatiquement affiché en **ORANGE**

---

## ?? **SYNCHRONISATION AUTOMATIQUE**

### Comment ça marche ?

```
Zoho Calendar (iCal)
        ?
   Proxy CORS
        ?
  Parser iCal.js
        ?
Détection mots-clés
        ?
Application couleur
        ?
   FullCalendar
```

### Temps de synchronisation :

- **Ajout d'événement** ? Visible immédiatement après actualisation
- **Modification** ? Visible après actualisation
- **Suppression** ? Disparaît après actualisation

---

## ?? **CONFIGURATION (DÉJÀ FAIT !)**

Tout est configuré et prêt à l'emploi :

? Flux iCal Zoho intégré  
? Parser automatique  
? Détection de couleurs  
? Proxy CORS configuré  
? FullCalendar optimisé  

---

## ?? **LANCER LE SITE**

### Option 1 : Fichier BAT (Recommandé)
```bash
Double-clic sur start-server.bat
```

### Option 2 : Commande manuelle
```bash
python -m http.server 8000
```

Puis ouvrir : **http://localhost:8000/Événements.html**

---

## ?? **WORKFLOW MOBIRISE**

1. **Modifier** dans Mobirise (design, structure)
2. **Exporter** vers `C:\Users\maric\Documents\TEST\`
3. **Exécuter** `.\reinject-optimizations.ps1`
4. **Tester** avec `start-server.bat`
5. **Déployer**

Le script réinjecte automatiquement tout le système calendrier !

---

## ?? **DÉPANNAGE**

### La carte ne s'affiche pas
- ? Vérifier que vous êtes sur `http://localhost:8000` (pas `file://`)

### Le calendrier est vide

**Ouvrir la console (F12) et chercher :**

```
? BON : "? iCal Zoho chargé, parsing..."
? BON : "?? Événements trouvés: X"
? BON : "? Calendrier initialisé : X événements"

? ERREUR : "? Erreur chargement iCal"
  ? Problème de connexion ou Zoho inaccessible
```

### Les couleurs sont incorrectes

**Vérifier le titre de l'événement dans Zoho :**
- Pour avoir du **BLEU** ? Le titre doit contenir un des mots : `furry`, `furries`, `anthro`, etc.
- Sinon ? Sera **ORANGE**

**Exemple :**
```
? "BlackLight 2025" ? Orange (pas de mot-clé)
? "Furry BlackLight 2025" ? Bleu (contient "furry")
```

### Après export Mobirise

```powershell
.\reinject-optimizations.ps1
```

---

## ?? **TECHNOLOGIES**

- **Zoho Calendar** (iCal) - Source des événements
- **FullCalendar 6.1.10** - Affichage
- **iCal.js 1.5.0** - Parser
- **corsproxy.io** - Proxy CORS
- **Google Maps** (iframe) - Carte

---

## ?? **CONSEILS**

### Pour identifier facilement les événements furry :

Utilisez un **préfixe** dans vos titres Zoho :
- `[Furry] BlackLight 2025`
- `[Furry] Canthrofur`
- `[Furry] Meetup Normandie`

### Pour les événements multi-jours :

Zoho Calendar gère automatiquement les durées :
```
Début : 15/06/2025 10:00
Fin : 17/06/2025 18:00
? Affiché sur 3 jours dans le calendrier
```

### Pour les événements récurrents :

Créez des événements répétitifs directement dans Zoho :
- Meetup mensuel
- Convention annuelle
- Etc.

---

## ? **AVANTAGES**

| Avant (Manuel) | Après (Automatique) |
|----------------|---------------------|
| Modifier events.json | Créer sur Zoho |
| Export Mobirise ? Script | Export Mobirise ? Script |
| Calculer lat/lng manuellement | Zoho gère le lieu |
| Choisir couleur à la main | Détection auto |
| Risque d'erreur JSON | Zoho valide tout |
| ?? 10 minutes par événement | ?? 2 minutes |

---

## ?? **LOGS DE DEBUG**

Pour voir ce qui se passe, ouvrez la console (F12) :

```javascript
? iCal Zoho chargé, parsing...
?? Événements trouvés: 19
  ?? Furry BlackLight 2025 ? Bleu (Furry)
  ?? Japan Expo Paris ? Orange (Autre)
  ?? Canthrofur ? Bleu (Furry)
  ?? Geek Days Lille ? Orange (Autre)
  ...
? Événements parsés: 19
?? Événements furry: 3
?? Autres événements: 16
? Calendrier initialisé : 19 événements depuis Zoho (3 furry, 16 autres)
```

---

## ?? **RÉSUMÉ**

**Vous n'avez PLUS JAMAIS besoin de modifier le code !**

1. ? Créez un événement sur **Zoho Calendar**
2. ? Si c'est furry ? Mettez "furry" dans le titre
3. ? Actualisez la page ? **C'est fait !**

**Le système gère tout automatiquement :**
- Chargement des événements
- Détection furry/autre
- Application des couleurs
- Affichage dans le calendrier

---

**Fichier** : `CALENDAR_README.md`  
**Version** : 3.0 (Dynamic + 2 Colors)  
**Date** : Novembre 2025

?? **Votre calendrier est maintenant 100% automatique et dynamique ! Plus rien à coder ! ??**
