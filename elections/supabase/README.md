# Mise en place de l'outil d'élections

Le site reste 100 % statique (GitHub Pages). Tout ce qui est « vivant » (codes, candidatures, bulletins, résultats) vit dans un projet **Supabase** gratuit. Compte une vingtaine de minutes pour la configuration de base ; le bot Telegram (annonces automatiques) est optionnel. Le taux de participation est calculé sur le nombre de codes distribués.

## Comment ça marche

1. L'admin génère des **codes individuels** (`MEUTE-7K3F-Q9XA`) depuis le panel, un par membre, avec une étiquette (pseudo) pour savoir à qui il a été remis.
2. Il envoie à chaque membre son code, ou directement le **lien de vote pré-rempli** (bouton « 🔗 Lien » dans l'onglet Codes).
3. Le membre saisit son code pour candidater ou voter. Aucun compte, aucun mot de passe. Le code est mémorisé sur son appareil.
4. Un code = un bulletin (modifiable jusqu'à la clôture). L'admin voit qui a voté (étiquette du code, jamais le contenu du bulletin), peut invalider un bulletin ou révoquer un code compromis.

## 1. Projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (région EU de préférence).
2. **SQL Editor** → colle le contenu de [`schema.sql`](schema.sql) → *Run*. Le script est idempotent : tu peux le relancer après une mise à jour. Il supprime les tables de l'ancienne version (connexion Telegram/Discord) si elles existent.
3. **Settings → API** : copie *Project URL* et la clé publique (*anon* / *publishable*) dans [`../assets/config.js`](../assets/config.js).
4. **Database → Extensions** : vérifie que `pg_cron` et `pg_net` sont activés (le script les active, mais certains plans demandent un clic).

## 2. Compte administrateur

1. **Authentication → Users → Add user** : e-mail + mot de passe (coche *Auto confirm*).
2. **SQL Editor** :
   ```sql
   insert into public.admins (user_id, label)
   select id, 'Nitra' from auth.users where email = 'toi@exemple.fr';
   ```
3. Ouvre `https://lameutenormande.fr/elections/admin.html`, connecte-toi. Le lien **⚙️ Admin** apparaît alors dans la navigation.

Dans l'onglet *Scrutins*, édite le brouillon « Élection du staff 2026 » (ou crée-en un), génère les codes dans l'onglet *Codes*, puis utilise les boutons **1️⃣ Ouvrir les candidatures** → **2️⃣ Ouvrir les votes** → **⏹ Clôturer** (ou laisse la date de clôture automatique faire le travail).

## 3. Bot Telegram (optionnel : annonces automatiques)

1. Sur Telegram, parle à [@BotFather](https://t.me/BotFather) : `/newbot` → note le **token**.
2. Ajoute le bot **dans le canal d'annonces** en tant qu'administrateur (pour publier).
3. Récupère l'identifiant du canal : transfère un message du canal au bot puis ouvre `https://api.telegram.org/bot<TOKEN>/getUpdates` et lis `chat.id` (négatif, du type `-1001234567890`).

### Annonces automatiques (nouvelle candidature, rappel J-1, résultats)

Installe la CLI : `npm i -g supabase`, puis `supabase login` et `supabase link --project-ref <ref>` **depuis le dossier `elections/supabase`**.

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=123:abc TELEGRAM_ANNOUNCE_CHAT_ID=-1009876543210 NOTIFY_SECRET=$(openssl rand -hex 24) SITE_URL=https://lameutenormande.fr/elections/
supabase functions deploy telegram-notify --no-verify-jwt
```

Puis dans le panel admin → **Réglages** : renseigne l'URL `https://<ref>.supabase.co/functions/v1/telegram-notify` et la valeur de `NOTIFY_SECRET`.

## Tester sans Supabase (mode démo)

Ajoute `?mock=1` à l'URL d'une page (ex. `elections/voter.html?mock=1`) : `assets/dev-mock.js` remplace la base par des données factices en mémoire, sans aucun appel réseau. Variantes : `&as=anon` (aucun code mémorisé), `&as=member` (défaut, code `MEUTE-TEST-0001`), `&as=admin` (session admin). Ce mode n'a aucun effet sans le paramètre.

## Sécurité, en deux mots

- La clé publique Supabase est visible par tous : toutes les règles sont dans Postgres (RLS + fonctions `security definer`). Sans code valide, aucune écriture n'est possible ; personne ne peut lire le lien code → choix, à part les agrégats publics.
- Les codes ont 8 caractères sur un alphabet de 32 (≈ 40 bits) : impossibles à deviner par tâtonnement à l'échelle d'un scrutin. Un code saisi anormalement souvent est signalé dans l'onglet *Votants*.
- Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY`, le token du bot ou `NOTIFY_SECRET` dans le dépôt.
