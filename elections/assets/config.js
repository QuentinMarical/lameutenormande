// Configuration publique de l'outil d'élections.
// Ces valeurs sont visibles par tout le monde : n'y mets JAMAIS de clé service_role ni de token de bot.
window.ELECTIONS_CONFIG = {
  // Projet Supabase (Settings > API)
  SUPABASE_URL: 'https://ywqfkldlganqytohqmpk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bQ7BIs2I88E38a_euD_4aA_LkhWjYz_',

  // Nom d'utilisateur du bot Telegram créé avec @BotFather (sans @). Domaine à déclarer via /setdomain.
  TELEGRAM_BOT_USERNAME: 'MeuteNormandeBot',

  // Liens d'invitation affichés aux personnes qui ne sont pas encore membres
  TELEGRAM_INVITE: 'https://t.me/+ukmbtqMqWYU1ZWNk',
  DISCORD_INVITE: 'https://discord.gg/Ejm3J2D3Xc',

  // URL publique de l'outil (partage, QR code, redirections OAuth)
  SITE_URL: 'https://lameutenormande.fr/elections/',

  // Fichier écrit par le workflow GitHub Actions (nombre de membres du groupe Telegram)
  TELEGRAM_JSON: 'telegram.json'
};
