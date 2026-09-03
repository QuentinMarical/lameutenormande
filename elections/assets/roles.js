// Catalogue des rôles (miroir de la table role_catalog dans supabase/schema.sql).
// La table fait foi côté serveur ; ce fichier sert aux icônes (classes Font Awesome,
// cf. assets/common.js E.icon), aux descriptions et de secours si la base n'est pas joignable.
window.ROLE_CATALOG = [
  { id: 'tete',          label: 'Tête de meute',                   icon: 'crown',   seats: 1, max_choices: 1,
    description: 'Responsable du groupe : coordination générale, représentation de la meute.' },
  { id: 'patte_gauche',  label: 'Patte gauche',                    icon: 'paw',     seats: 1, max_choices: 1,
    description: 'Responsable adjoint·e : seconde la Tête de meute.' },
  { id: 'patte_droite',  label: 'Patte droite',                    icon: 'paw',     seats: 1, max_choices: 1,
    description: 'Responsable adjoint·e : seconde la Tête de meute.' },
  { id: 'communication', label: 'Responsable de la communication', icon: 'bullhorn', seats: 1, max_choices: 1,
    description: 'Réseaux sociaux, annonces, site et visibilité de la meute.' },
  { id: 'modo_telegram', label: 'Modérateur·ice Telegram',         icon: 'paper-plane', seats: 2, max_choices: 2,
    description: 'Modération des groupes Telegram (2 postes).' },
  { id: 'modo_discord',  label: 'Modérateur·ice Discord',          icon: 'headset', seats: 2, max_choices: 2,
    description: 'Modération du serveur Discord (2 postes).' }
];
