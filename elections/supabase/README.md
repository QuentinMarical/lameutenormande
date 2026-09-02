# Mise en place de l'outil d'élections

L'outil est 100 % statique côté site (GitHub Pages). Tout ce qui est « vivant » (comptes, candidatures, bulletins, résultats) vit dans un projet **Supabase** gratuit. Compte environ une heure pour tout configurer la première fois.

## 1. Projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (région EU de préférence).
2. **SQL Editor** → colle le contenu de [`schema.sql`](schema.sql) → *Run*. Le script est idempotent : tu peux le relancer après une mise à jour.
3. **Settings → API** : copie *Project URL* et *anon public key* dans [`../assets/config.js`](../assets/config.js).
4. **Authentication → URL Configuration** : *Site URL* = `https://lameutenormande.fr/elections/`, ajoute `https://lameutenormande.fr/elections/auth/callback.html` dans *Redirect URLs*.
5. **Database → Extensions** : vérifie que `pg_cron` et `pg_net` sont activés (le script les active, mais certains plans demandent un clic).

## 2. Bot Telegram (connexion + comptage + annonces)

1. Sur Telegram, parle à [@BotFather](https://t.me/BotFather) : `/newbot` → note le **token** et le **nom d'utilisateur** du bot.
2. `/setdomain` → choisis le bot → `lameutenormande.fr` (obligatoire pour le bouton « Se connecter avec Telegram »).
3. Ajoute le bot **dans le groupe principal** (il peut rester simple membre : `getChatMember` et `getChatMemberCount` fonctionnent) et **dans le canal d'annonces** en tant qu'administrateur (pour publier).
4. Récupère les identifiants de chat : envoie un message dans le groupe puis ouvre `https://api.telegram.org/bot<TOKEN>/getUpdates` et lis `chat.id` (négatif, du type `-1001234567890`). Pour un canal, transfère un post du canal au bot ou utilise le même endpoint.
5. Mets `TELEGRAM_BOT_USERNAME` dans `config.js`.

## 3. Application Discord (connexion OAuth)

1. [discord.com/developers](https://discord.com/developers/applications) → *New Application* → onglet **OAuth2** : ajoute la *Redirect* `https://<ref-projet>.supabase.co/auth/v1/callback`.
2. Copie *Client ID* et *Client Secret* dans Supabase → **Authentication → Providers → Discord** (activer).
3. Note l'**ID du serveur** de la Meute (Discord → paramètres → Avancé → Mode développeur, puis clic droit sur le serveur → *Copier l'identifiant*).

## 4. Edge Functions

Installe la CLI : `npm i -g supabase`, puis `supabase login` et `supabase link --project-ref <ref>` **depuis le dossier `elections/supabase`** (le dossier `functions/` doit être à la racine du lien).

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_CHAT_ID=-1001234567890 TELEGRAM_ANNOUNCE_CHAT_ID=-1009876543210 DISCORD_GUILD_ID=112233445566778899 NOTIFY_SECRET=$(openssl rand -hex 24) SITE_URL=https://lameutenormande.fr/elections/
supabase functions deploy telegram-auth --no-verify-jwt
supabase functions deploy verify-discord
supabase functions deploy telegram-notify --no-verify-jwt
```

| Function | Rôle | JWT |
|---|---|---|
| `telegram-auth` | vérifie le Login Widget, contrôle l'appartenance au groupe, crée la session | non (appelée avant connexion) |
| `verify-discord` | après OAuth, contrôle l'appartenance au serveur | oui |
| `telegram-notify` | annonces (candidature, rappel J-1, résultats) | non (secret partagé `x-notify-secret`) |

Pour activer les annonces, va dans le panel admin → **Réglages** et renseigne l'URL de `telegram-notify` (`https://<ref>.supabase.co/functions/v1/telegram-notify`) et la valeur de `NOTIFY_SECRET`.

## 5. GitHub Actions (compteur de membres)

Dans le dépôt GitHub → **Settings → Secrets and variables → Actions** : ajoute `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`. Le workflow [`update-telegram-count.yml`](../../.github/workflows/update-telegram-count.yml) tourne toutes les heures et écrit `elections/telegram.json`, utilisé pour le taux de participation. Lance-le une première fois à la main (onglet *Actions* → *Run workflow*).

## 6. Premier administrateur

Connecte-toi une fois sur `https://lameutenormande.fr/elections/`, puis dans l'éditeur SQL :

```sql
update public.profiles set is_admin = true where username = 'nitrafox';
```

Le lien **⚙️ Admin** apparaît alors dans la navigation. Dans l'onglet *Scrutins*, édite le brouillon « Élection du staff 2026 » (ou crée-en un), puis utilise les boutons **1️⃣ Ouvrir les candidatures** → **2️⃣ Ouvrir les votes** → **⏹ Clôturer** (ou laisse la date de clôture automatique faire le travail).

## Tester sans Supabase (mode démo)

Ajoute `?mock=1` à l'URL d'une page (ex. `elections/voter.html?mock=1`) : `assets/dev-mock.js` remplace la base par des données factices en mémoire, sans aucun appel réseau. Variantes : `&as=anon`, `&as=nonmember`, `&as=member`, `&as=admin` (défaut). Pratique pour retoucher le design ou faire une démo au staff. Ce mode n'a aucun effet sans le paramètre.

## Sécurité, en deux mots

- La clé `anon` est publique : toutes les règles sont dans Postgres (RLS + fonctions `security definer`). Personne ne peut lire le lien votant → candidat, ni écrire un bulletin sans session membre.
- L'identité est l'**id numérique** Telegram/Discord, pas le pseudo. Un compte = un bulletin. Le panel admin signale les comptes récents, hors groupe, ou dont le pseudo existe sur l'autre plateforme, et permet d'invalider un bulletin (réversible, journalisé).
- Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY`, le token du bot ou `NOTIFY_SECRET` dans le dépôt.
