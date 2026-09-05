// Configuration publique de l'outil de sondages. Même projet Supabase que l'outil
// d'élections (schéma Postgres séparé "votes") : ces valeurs sont visibles par tout
// le monde, n'y mets JAMAIS de clé service_role ni de token de bot.
window.VOTES_CONFIG = {
  SUPABASE_URL: 'https://ywqfkldlganqytohqmpk.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_bQ7BIs2I88E38a_euD_4aA_LkhWjYz_',
  SITE_URL: 'https://lameutenormande.fr/votes/'
};
