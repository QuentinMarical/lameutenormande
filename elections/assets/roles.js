// Catalogue des rôles (miroir de la table role_catalog dans supabase/schema.sql).
// La table fait foi côté serveur ; ce fichier sert aux icônes, aux descriptions
// et de secours si la base n'est pas joignable.
window.ROLE_CATALOG = [
  { id: 'tete',          label: 'Tête de meute',                   icon: '🐺', seats: 1, max_choices: 1, requires: null,
    description: 'Responsable du groupe : coordination générale, représentation de la meute.' },
  { id: 'patte_gauche',  label: 'Patte gauche',                    icon: '🐾', seats: 1, max_choices: 1, requires: null,
    description: 'Responsable adjoint·e : seconde la Tête de meute.' },
  { id: 'patte_droite',  label: 'Patte droite',                    icon: '🐾', seats: 1, max_choices: 1, requires: null,
    description: 'Responsable adjoint·e : seconde la Tête de meute.' },
  { id: 'communication', label: 'Responsable de la communication', icon: '📣', seats: 1, max_choices: 1, requires: null,
    description: 'Réseaux sociaux, annonces, site et visibilité de la meute.' },
  { id: 'modo_telegram', label: 'Modérateur·ice Telegram',         icon: '✈️', seats: 2, max_choices: 2, requires: 'telegram',
    description: 'Modération des groupes Telegram (2 postes).' },
  { id: 'modo_discord',  label: 'Modérateur·ice Discord',          icon: '🎧', seats: 2, max_choices: 2, requires: 'discord',
    description: 'Modération du serveur Discord (2 postes).' }
];
