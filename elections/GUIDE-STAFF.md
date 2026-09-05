# Guide du staff — Organiser un scrutin

Ce guide s'adresse à un membre du staff qui doit créer et faire vivre un scrutin (élection ou vote) depuis le panel admin, sans avoir besoin de toucher au code. Pour la mise en place technique du projet (une seule fois), voir [`supabase/README.md`](supabase/README.md).

Panel admin : **lameutenormande.fr/elections/admin.html** (connexion avec ton compte Supabase — demande à Nitra si tu n'en as pas).

## 1. Créer le scrutin

Onglet **Scrutins** → **+ Nouveau scrutin**.

- **Titre**, **description**, **postes à pourvoir** (coche ceux concernés — un scrutin "vote simple" sans candidature peut décocher les postes qui ne servent pas).
- **Statut** : laisse sur *Brouillon* tant que tu prépares le scrutin — il reste invisible du public. Passe-le sur *Ouvert* quand tu es prêt à le publier (ou laisse la programmation automatique le faire, voir §3).
- Clique **Créer**.

## 2. Générer les codes

Onglet **Codes**, une fois ton scrutin sélectionné en haut de la page.

- **Nombre** de codes + **Étiquettes** (un pseudo par ligne, dans l'ordre — le 1ᵉʳ code ira au 1ᵉʳ pseudo listé). Si tu remplis les étiquettes, le nombre de codes se cale automatiquement dessus.
- **Générer**. Chaque code apparaît en carte, avec un bouton **Lien** : ce lien pré-rempli le code, à envoyer directement en message privé à la personne (Telegram/Discord) — elle n'a rien à recopier.
- Coche **remis** une fois le code effectivement transmis, pour t'y retrouver.
- Un code déjà utilisé ne peut plus être supprimé directement : il faut d'abord le **révoquer** (avec un motif) si besoin, ce qui invalide aussi son éventuel bulletin/candidature.

## 3. Programmer les phases (optionnel)

Toujours dans l'onglet **Scrutins**, en éditant ton scrutin, la section **Programmation automatique** propose 4 dates/heures facultatives : ouverture et fermeture des candidatures, ouverture et clôture des votes.

- Laisser vide = tout se fait à la main avec les boutons **Ouvrir les candidatures** / **Ouvrir les votes** / **Clôturer**.
- Remplir une date = le scrutin passe automatiquement à l'étape suivante à l'heure dite (vérifié toutes les 15 min), y compris publier un scrutin encore en brouillon si sa date d'ouverture de candidature arrive.
- Si le bot Telegram est configuré : un rappel est envoyé 24 h avant chaque échéance programmée, et les résultats sont publiés automatiquement dans le canal dès la clôture.
- Pour un **vote simple sans candidature** (ex. "qui vient à l'événement ?") : laisse les 2 champs "candidatures" vides et ne coche pas *Candidatures ouvertes* — seule la partie vote s'applique.

## 4. Suivre le scrutin

- Onglet **Candidatures** : voir/retirer une candidature si besoin.
- Onglet **Votants** : qui a voté, jamais pour qui — le contenu d'un bulletin n'est jamais visible, même pour toi. Des drapeaux signalent les codes suspects (saisi anormalement souvent, étiquette en double, etc.).
- Onglet **Audit** : journal détaillé de toutes les actions (qui a voté, quand, IP/navigateur) — jamais le contenu du vote. Le bouton **▶ Actualisation auto** rafraîchit la liste toutes les 15 s si tu veux suivre en direct.
- Page publique **résultats.html** : participation et scores en direct, partageable avec tout le monde pendant le vote (sauf si tu décoches *Scores publics pendant le vote*, auquel cas ils n'apparaissent qu'à la clôture).

## 5. Clôturer et publier

Bouton **Clôturer** (ou laisse la date de clôture automatique faire le travail). Une fois clôturé :
- Les résultats sont définitifs et publiés sur Telegram si le bot est configuré.
- L'onglet **Procès-verbal** génère un document imprimable (PDF via *Imprimer*) avec les élus, à faire signer par le staff si besoin.

## Après le scrutin

Un scrutin, ses codes, candidatures et bulletins peuvent être supprimés entièrement depuis l'onglet Scrutins (**Supprimer ce scrutin**) une fois que tu n'en as plus besoin — irréversible, donc à ne faire qu'après avoir exporté ce dont tu as besoin (CSV codes/résultats, procès-verbal).
