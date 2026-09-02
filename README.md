# La Meute Normande

Bienvenue sur le dépôt de **La Meute Normande** ! Nous sommes un groupe de passionnés de la culture furry, basé en Haute-Normandie, qui se retrouvent régulièrement pour participer à des événements ensemble.

## 🌐 Accès au site

Le site web est déployé sur GitHub Pages et est accessible à l'adresse suivante :

**🔗 [lameutenormande.fr](https://lameutenormande.fr)**

## 📱 Nous rejoindre

Retrouvez-nous sur les réseaux sociaux et nos canaux de communication :

| Plateforme | Lien |
|-----------|------|
| 🐦 **Telegram** | [Annonces Meute Normande](http://t.me/Annonces_Meute_Normande) |
| 📸 **Instagram** | [@la.meute_normande](https://www.instagram.com/la.meute_normande) |
| 💬 **Discord** | [Rejoindre le serveur](https://discord.gg/Ejm3J2D3Xc) |

## 📋 Pages principales

Le site propose les sections suivantes :

- **[Accueil](https://lameutenormande.fr/)** - Présentation du groupe
- **[Événements](https://lameutenormande.fr/events.html)** - Calendrier des événements à venir
- **[Actus](https://lameutenormande.fr/actus.html)** - Actualités du groupe
- **[Contact](https://lameutenormande.fr/contact.html)** - Formulaire de contact
- **[Élections](https://lameutenormande.fr/elections/)** - Candidatures, vote et résultats en direct pour le staff (réservé aux membres)

## 🔧 Technologie

- **Générateur** : Site construit avec Mobirise
- **Hébergement** : GitHub Pages
- **Domaine** : lameutenormande.fr
- **Mise à jour du calendrier** : Automatisée via GitHub Actions (toutes les heures)
- **Déploiement** : Automatisé après chaque mise à jour du calendrier

## 🔄 Processus de déploiement

Le site se met à jour automatiquement :

1. Le calendrier Zoho est téléchargé toutes les heures
2. Si des changements sont détectés, le fichier `events.ics` est mis à jour
3. Le site est automatiquement redéployé avec les nouvelles données
4. Les modifications sont disponibles sur le site en quelques minutes

## 🗳️ Élections du staff

Le dossier [`elections/`](elections/) contient un outil de vote complet : connexion Telegram / Discord réservée aux membres du groupe, candidatures libres, un bulletin par compte (modifiable), résultats et participation en direct, panel admin (phases, invalidation des bulletins suspects, journal d'audit, procès-verbal) et annonces automatiques sur Telegram.

- Front : pages statiques dans `elections/` (aucun build)
- Données : projet Supabase (schéma dans `elections/supabase/schema.sql`, Edge Functions dans `elections/supabase/functions/`)
- Compteur de membres Telegram : workflow `update-telegram-count.yml` (bot) → `elections/telegram.json`

👉 Guide d'installation pas à pas : [`elections/supabase/README.md`](elections/supabase/README.md)

## 📄 Licence

Ce dépôt contient le code source et les ressources du site web de La Meute Normande.

---

**Rejoignez-nous et faites partie de la Meute ! 🐺**
