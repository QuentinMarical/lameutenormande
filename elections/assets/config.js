// Configuration publique de l'outil d'élections.
// Ces valeurs sont visibles par tout le monde : n'y mets JAMAIS de clé service_role ni de token de bot.
window.ELECTIONS_CONFIG = {
  // Projet Supabase (Settings > API)
  SUPABASE_URL: 'https://ywqfkldlganqytohqmpk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bQ7BIs2I88E38a_euD_4aA_LkhWjYz_',

  // Lien vers lequel renvoyer les personnes qui n'ont pas reçu de code (contact du staff)
  TELEGRAM_INVITE: 'https://t.me/+ukmbtqMqWYU1ZWNk',

  // URL publique de l'outil (partage, QR code, liens dans les annonces)
  SITE_URL: 'https://lameutenormande.fr/elections/',

  // Fichier écrit par le workflow GitHub Actions (nombre de membres du groupe Telegram, pour le taux de participation)
  TELEGRAM_JSON: 'telegram.json'
};
