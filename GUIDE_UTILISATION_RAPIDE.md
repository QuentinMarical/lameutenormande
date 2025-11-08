# ?? Guide d'utilisation rapide - Système 100% Automatique

## ?? **POUR AJOUTER UN ÉVÉNEMENT (en 2 minutes)**

### **Étape 1 : Obtenir les coordonnées GPS (30 secondes)**

1. Ouvrir **Google Maps** : https://maps.google.com
2. Chercher le lieu de votre événement
3. **Clic droit** sur le marqueur rouge
4. Cliquer sur **"Copier les coordonnées"**
5. Vous avez maintenant : `48.9356, 2.3539`

---

### **Étape 2 : Créer l'événement dans Zoho (1 minute)**

1. Ouvrir **Zoho Calendar**
2. Créer un **nouvel événement**
3. Remplir les champs :

```
Titre : Nom de l'événement
Lieu : 48.9356,2.3539 Nom de la ville, France
Date début : JJ/MM/AAAA
Date fin : JJ/MM/AAAA
Description : (optionnel)
```

4. **Sauvegarder**

---

### **Étape 3 : Vérifier (30 secondes)**

1. Attendre **5 minutes** OU appuyer sur **F5** (actualiser)
2. Ouvrir http://localhost:8000/Événements.html
3. Voir le **nouveau marqueur** sur la carte ! ??

---

## ? **EXEMPLES CONCRETS**

### **Exemple 1 : Convention à Paris**

**Google Maps :**
```
48.8566, 2.3522
```

**Dans Zoho - Champ "Lieu" :**
```
48.8566,2.3522 Paris, France
```

---

### **Exemple 2 : Festival à Lille**

**Google Maps :**
```
50.6292, 3.0573
```

**Dans Zoho - Champ "Lieu" :**
```
50.6292,3.0573 Lille, France
```

---

### **Exemple 3 : Convention furry à Lyon**

**Google Maps :**
```
45.7640, 4.8357
```

**Dans Zoho - Champ "Lieu" :**
```
45.7640,4.8357 Lyon, France
```

Le système détectera automatiquement que c'est un événement furry si le titre contient "furry", "anthro", etc.

---

## ?? **COULEURS AUTOMATIQUES**

Le système attribue automatiquement les couleurs :

| Type | Couleur | Détection automatique |
|------|---------|----------------------|
| ?? **Furry** | Bleu | Titre contient : "furry", "anthro", "canthro", "faun" |
| ?? **Autre** | Orange | Tous les autres événements |
| ? **Passé** | Gris | Date de fin < aujourd'hui |

**Exemples de titres détectés comme furry :**
- "Furry BlackLight 2025" ? ?? Bleu
- "Canthrofur 2026" ? ?? Bleu
- "Anthrocon Europe" ? ?? Bleu
- "Japan Expo" ? ?? Orange
- "Geek Days" ? ?? Orange

---

## ?? **MODIFIER UN ÉVÉNEMENT**

1. Ouvrir l'événement dans **Zoho Calendar**
2. Modifier ce que vous voulez :
   - Titre
   - Date
   - Lieu (nouvelles coordonnées GPS)
   - Description
3. **Sauvegarder**
4. Attendre **5 minutes** OU actualiser (F5)
5. La carte se met à jour automatiquement ! ?

---

## ? **SUPPRIMER UN ÉVÉNEMENT**

1. Ouvrir l'événement dans **Zoho Calendar**
2. Cliquer sur **"Supprimer"**
3. Confirmer
4. Attendre **5 minutes** OU actualiser (F5)
5. Le marqueur disparaît de la carte ! ?

---

## ?? **PROBLÈMES COURANTS**

### **Problème : Marqueur n'apparaît pas**

**Cause :** Pas de coordonnées GPS dans le lieu

**Vérifier :**
1. Ouvrir la **Console** (F12)
2. Chercher : `? Pas de GPS pour: "Nom Événement"`
3. Si vous voyez ça ? Pas de GPS détecté

**Solution :**
1. Modifier l'événement dans Zoho
2. Champ "Lieu" : `48.9356,2.3539 Ville, France`
3. Sauvegarder
4. Actualiser (F5)

---

### **Problème : Marqueur au mauvais endroit**

**Cause :** Coordonnées inversées ou incorrectes

**Vérifier :**
```
? CORRECT : 48.9356,2.3539 Paris
   (latitude, longitude)

? INCORRECT : 2.3539,48.9356 Paris
   (longitude, latitude - INVERSÉ !)
```

**Solution :**
1. Re-copier les coordonnées depuis Google Maps
2. Format : `latitude,longitude`
3. Modifier dans Zoho
4. Actualiser (F5)

---

### **Problème : Carte ne se met pas à jour**

**Cause :** Délai de 5 minutes pas écoulé

**Solution :**
1. Appuyer sur **F5** (actualiser la page)
2. Ou attendre 5 minutes

---

## ?? **VALIDATION AUTOMATIQUE**

Le système valide automatiquement :

| Validation | Critère | Action si invalide |
|------------|---------|-------------------|
| Format GPS | `lat,lng` au début | GPS ignoré |
| Coordonnées France | Lat: 41-51, Lng: -5 à 10 | GPS ignoré |
| Virgule présente | Entre lat et lng | GPS ignoré |

**Si GPS ignoré :**
- L'événement apparaît dans le **calendrier** ?
- Mais PAS sur la **carte** ?

---

## ?? **CHECKLIST AVANT PUBLICATION**

Avant de déployer votre site, vérifiez :

? **Tous les événements ont :**
- [ ] Un titre
- [ ] Des coordonnées GPS dans le champ "Lieu"
- [ ] Une date de début
- [ ] Une date de fin

? **Format du champ "Lieu" :**
- [ ] Format : `48.9356,2.3539 Ville, France`
- [ ] Virgule entre lat et lng
- [ ] Coordonnées AVANT le nom de ville

? **Tester :**
- [ ] Ouvrir Console (F12)
- [ ] Vérifier : `? X/X événements avec GPS`
- [ ] Vérifier : `? X/X marqueurs ajoutés`

---

## ?? **WORKFLOW IDÉAL**

### **Pour chaque nouvel événement :**

```
1. Google Maps ? Copier GPS (30 sec)
   ?
2. Zoho Calendar ? Créer événement avec GPS (1 min)
   ?
3. Sauvegarder ? Attendre 5 min OU F5 (30 sec)
   ?
4. Vérifier la carte ? Marqueur affiché ! (10 sec)

Total : ~2 minutes par événement
```

---

## ?? **ASTUCES PRO**

### **Astuce 1 : Copier-coller rapide**

Gardez un fichier avec vos lieux fréquents :

```
# Mes lieux fréquents
Paris : 48.8566,2.3522
Lille : 50.6292,3.0573
Lyon : 45.7640,4.8357
Caen : 49.1829,-0.3707
```

### **Astuce 2 : Batch création**

Créez plusieurs événements d'un coup dans Zoho, ils apparaîtront tous sur la carte après 5 minutes !

### **Astuce 3 : Template Zoho**

Créez un événement "Template" avec le bon format de lieu, puis dupliquez-le pour chaque nouvel événement.

---

## ?? **VERSION MOBILE**

Le système fonctionne aussi sur mobile :

1. **Google Maps mobile** : Appui long sur le lieu ? Coordonnées s'affichent
2. **Zoho Calendar mobile** : Créer événement ? Coller GPS dans "Lieu"
3. **Site mobile** : Carte interactive + tactile

---

## ?? **RÉSUMÉ**

### **Ce que vous faites :**
1. Copier GPS depuis Google Maps (30 sec)
2. Créer événement dans Zoho avec GPS (1 min)
3. **C'EST TOUT !**

### **Ce que le système fait automatiquement :**
- ? Charge les événements depuis Zoho
- ? Extrait les coordonnées GPS
- ? Crée les marqueurs sur la carte
- ? Détecte le type d'événement (furry/autre)
- ? Attribue les couleurs
- ? Grise les événements passés
- ? Ajoute les popups avec navigation
- ? Met à jour toutes les 5 minutes

**Zéro maintenance, zéro configuration, 100% automatique ! ??**

---

**Document** : `GUIDE_UTILISATION_RAPIDE.md`  
**Version** : 1.0  
**Date** : Novembre 2025  
**Temps par événement** : **~2 minutes** ?
