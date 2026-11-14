// Catalogue des rôles (miroir de la table role_catalog dans supabase/schema.sql).
// La table fait foi côté serveur ; ce fichier sert aux icônes (classes Font Awesome,
// cf. assets/common.js E.icon), aux descriptions et de secours si la base n'est pas joignable.
// sort_order : ordre de priorité (le plus bas d'abord) utilisé par E.computeSeatWinners pour
// décider quel poste garder quand une même personne est élue à plusieurs à la fois. Entre patte
// gauche et patte droite (même échelon), patte droite prime.
window.ROLE_CATALOG = [
  { id: 'tete',          label: 'Tête de meute',                   icon: 'crown',   seats: 1, max_choices: 1, sort_order: 10,
    description: 'Responsable du groupe : coordination générale, représentation de la meute.' },
  { id: 'patte_droite',  label: 'Patte droite',                    icon: 'paw',     seats: 1, max_choices: 1, sort_order: 20,
    description: 'Responsable adjoint : seconde la Tête de meute.' },
  { id: 'patte_gauche',  label: 'Patte gauche',                    icon: 'paw',     seats: 1, max_choices: 1, sort_order: 30,
    description: 'Responsable adjoint : seconde la Tête de meute.' },
  { id: 'communication', label: 'Responsable de la communication', icon: 'bullhorn', seats: 1, max_choices: 1, sort_order: 40,
    description: 'Réseaux sociaux, annonces, site et visibilité de la meute.' },
  { id: 'modo_telegram', label: 'Modérateur Telegram',             icon: 'paper-plane', seats: 2, max_choices: 2, sort_order: 50,
    description: 'Modération des groupes Telegram (2 postes).' },
  { id: 'modo_discord',  label: 'Modérateur Discord',              icon: 'headset', seats: 2, max_choices: 2, sort_order: 60,
    description: 'Modération du serveur Discord (2 postes).' }
];
