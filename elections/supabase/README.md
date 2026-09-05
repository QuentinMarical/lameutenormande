# Mise en place de l'outil d'élections

Le site reste 100 % statique (GitHub Pages). Tout ce qui est « vivant » (codes, candidatures, bulletins, résultats) vit dans un projet **Supabase** gratuit. Compte une vingtaine de minutes pour la configuration de base ; le bot Telegram (annonces automatiques, section 3) est optionnel mais recommandé, notamment pour la programmation automatique des phases (section 4). Le taux de participation est calculé sur le nombre de codes distribués.

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

## 3. Bot Telegram (annonces automatiques)

1. Sur Telegram, parle à [@BotFather](https://t.me/BotFather) : `/newbot` → note le **token**.
2. Ajoute le bot **dans un canal dont tu es toi-même propriétaire/admin** (pour pouvoir l'y promouvoir administrateur) : envoie-lui d'abord `/start` en message privé pour qu'il apparaisse dans la recherche, puis Infos du canal → Administrateurs → Ajouter.
3. Récupère l'identifiant du canal : `curl -H "Authorization: Bearer <clé anon>" https://api.telegram.org/bot<TOKEN>/getChat?chat_id=@nom_du_canal` (canal public) ou transfère un message du canal au bot puis lis `chat.id` via `https://api.telegram.org/bot<TOKEN>/getUpdates` (négatif, du type `-1001234567890`).

### Déploiement de la fonction `telegram-notify`

**Option A — sans rien installer** : Dashboard Supabase → *Edge Functions* → *Via Editor* → colle le contenu de [`functions/telegram-notify/index.ts`](functions/telegram-notify/index.ts) → *Deploy*. Dans l'onglet *Settings* de la fonction, désactive **Verify JWT with legacy secret** (la fonction gère sa propre authentification via l'en-tête `x-notify-secret`, elle ne reçoit jamais de JWT Supabase).

**Option B — avec la CLI** : `npm i -g supabase`, puis `supabase login` et `supabase link --project-ref <ref>` **depuis le dossier `elections/supabase`**, puis `supabase functions deploy telegram-notify --no-verify-jwt`.

Dans les deux cas, renseigne ensuite les secrets de la fonction (Dashboard → *Edge Functions* → *Secrets*, ou `supabase secrets set`) :

```
TELEGRAM_BOT_TOKEN=123:abc
TELEGRAM_ANNOUNCE_CHAT_ID=-1009876543210
NOTIFY_SECRET=<valeur aléatoire, ex. openssl rand -hex 24>
SITE_URL=https://lameutenormande.fr/elections/
```

Puis dans le panel admin → **Réglages** : renseigne l'URL `https://<ref>.supabase.co/functions/v1/telegram-notify` et la **même valeur** de `NOTIFY_SECRET`.

Types d'annonces envoyées automatiquement, toutes avec un rappel qu'elles sont réservées aux membres (code requis) pour candidater/voter :
- **Nouvelle candidature** (immédiat), **rappel J-1** avant chaque échéance programmée (ouverture/fermeture des candidatures, ouverture des votes, clôture des votes), **résultats** dès la clôture du scrutin.

## 4. Programmation automatique des phases (optionnel)

Dans l'onglet *Scrutins* du panel admin, un scrutin peut recevoir jusqu'à 4 dates/heures optionnelles : ouverture et fermeture des candidatures, ouverture et clôture des votes. Un tâche planifiée (`elections_tick`, toutes les 15 min) applique alors automatiquement les transitions à l'heure dite — y compris publier un scrutin encore en brouillon si sa date d'ouverture de candidature arrive. Laisser ces champs vides revient au fonctionnement 100 % manuel (boutons *Ouvrir les candidatures* / *Ouvrir les votes* / *Clôturer*).

## Tester sans Supabase (mode démo)

Ajoute `?mock=1` à l'URL d'une page (ex. `elections/voter.html?mock=1`) : `assets/dev-mock.js` remplace la base par des données factices en mémoire, sans aucun appel réseau. Variantes : `&as=anon` (aucun code mémorisé), `&as=member` (défaut, code `MEUTE-TEST-0001`), `&as=admin` (session admin). Ce mode n'a aucun effet sans le paramètre.

## Sécurité, en deux mots

- La clé publique Supabase est visible par tous : toutes les règles sont dans Postgres (RLS + fonctions `security definer`). Sans code valide, aucune écriture n'est possible ; personne ne peut lire le lien code → choix, à part les agrégats publics.
- Les codes ont 8 caractères sur un alphabet de 32 (≈ 40 bits) : impossibles à deviner par tâtonnement à l'échelle d'un scrutin. Un code saisi anormalement souvent est signalé dans l'onglet *Votants*.
- L'étiquette (pseudo) associée à un code est chiffrée en base (`pgp_sym`, clé dans Supabase Vault) : une copie brute de la table `voter_codes` ne révèle aucun nom, seul le panel admin peut la déchiffrer à la volée.
- Un scrutin ou un code se supprime depuis le panel (cascade complète) ; un code jamais utilisé se supprime directement, un code déjà utilisé doit d'abord être révoqué (avec motif).
- Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY`, le token du bot ou `NOTIFY_SECRET` dans le dépôt.
