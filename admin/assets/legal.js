/* Pages légales (mentions légales, confidentialité, cookies) génériques du site — copie de
   actus/sondages/assets/legal.js sur le namespace E (au lieu de V) : les pages transversales de
   l'espace admin (hub, Utilisateurs, comparaison XMB) chargent elections/assets/common.js pour
   leurs autres aides (E.h, E.icon…) et ont donc besoin de la même API sur E, mais avec un contenu
   qui parle du site dans son ensemble plutôt que d'un outil précis (elections/assets/legal.js
   décrit spécifiquement l'outil élections — approprié sur son propre panel, pas ici). */
(function () {
  'use strict';
  const TEXTS = {
    mentions: {
      title: 'Mentions légales',
      html: `
<h4>Éditeur du site</h4>
<p>Ce site est édité par <strong>La Meute Normande</strong>, groupe informel à but non lucratif, basé en Haute-Normandie.</p>
<p>Responsable de la publication : <strong>Nitra</strong></p>
<p>Contact : via Telegram <a href="tg://resolve?domain=NitraFox" target="_blank" rel="noopener">@NitraFox</a></p>
<h4>Hébergement</h4>
<p>Ce site est hébergé par <strong>GitHub Pages</strong> — GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</p>
<p>Le nom de domaine <strong>lameutenormande.fr</strong> est enregistré auprès d'<strong>OVH</strong> — OVHcloud, 2 rue Kellermann, 59100 Roubaix, France.</p>
<p>La base de données utilisée par les sondages est hébergée par <strong>Supabase</strong> (Supabase Inc.), sur une infrastructure Amazon Web Services située à <strong>Francfort, Allemagne (Union européenne)</strong>.</p>
<h4>Conception du site</h4>
<p>Site conçu avec <strong>Mobirise</strong> (générateur de sites statiques).</p>
<p>Développement et intégration : <strong>Nitra</strong> — calendrier des événements : <strong>Spyro the bat</strong>.</p>
<h4>Propriété intellectuelle</h4>
<p>L'ensemble du contenu de ce site (textes, images, logos, illustrations) est la propriété de La Meute Normande ou de ses contributeurs respectifs (artistes référencés sur la page Artistes). Toute reproduction sans autorisation préalable est interdite.</p>
<p>Les logos et marques de services tiers (Telegram, Discord, Instagram, Google Maps, Waze, Apple Plans, FurAffinity, Furzo) restent la propriété de leurs détenteurs respectifs.</p>
<h4>Responsabilité</h4>
<p>La Meute Normande s'efforce de fournir des informations à jour mais ne saurait être tenue responsable d'éventuelles erreurs, omissions ou indisponibilités. Les liens externes (sites d'événements, réseaux sociaux, cartes) sont fournis à titre indicatif et n'engagent pas la responsabilité de La Meute Normande quant à leur contenu.</p>
<h4>Formulaire de contact</h4>
<p>Les données saisies dans le formulaire de contact (nom/pseudo, identifiant ou e-mail, préférence de contact, message et pièce jointe éventuelle) sont transmises via le service <strong>UseBasin</strong> et reçues uniquement par le responsable de la publication. Elles ne sont utilisées que pour répondre à votre demande et ne sont jamais revendues ni partagées avec des tiers.</p>`
    },
    confidentialite: {
      title: 'Politique de confidentialité (RGPD)',
      html: `
<h4>Introduction</h4>
<p>La Meute Normande s'engage à protéger la vie privée de ses visiteurs, conformément au <strong>Règlement Général sur la Protection des Données (RGPD — UE 2016/679)</strong> et à la <strong>loi Informatique et Libertés</strong>.</p>
<h4>Responsable du traitement</h4>
<p>Responsable : <strong>Nitra</strong> — Contact : <a href="tg://resolve?domain=NitraFox" target="_blank" rel="noopener">@NitraFox sur Telegram</a></p>
<h4>Données collectées via le formulaire de contact</h4>
<p>Le formulaire de la page Contact collecte les données suivantes :</p>
<ul>
  <li><strong>Nom / Prénom / Pseudo</strong> (obligatoire)</li>
  <li><strong>Identifiant ou e-mail</strong> (obligatoire)</li>
  <li><strong>Préférence de contact</strong> : Discord, Telegram, Twitter/X ou Email (obligatoire)</li>
  <li><strong>Message</strong> (obligatoire)</li>
  <li><strong>Pièce jointe</strong> (optionnel — formats : jpg, png, gif, webp, pdf, doc, docx, zip, txt)</li>
</ul>
<p>Ces données sont transmises via <strong>UseBasin</strong> (sous-traitant, basé aux États-Unis — <a href="https://usebasin.com/privacy" target="_blank" rel="noopener">politique de confidentialité UseBasin</a>). Le consentement explicite est recueilli avant l'envoi via une case à cocher obligatoire.</p>
<p><strong>Base légale :</strong> consentement de l'utilisateur (article 6.1.a du RGPD).</p>
<p><strong>Finalité :</strong> répondre à votre demande de contact uniquement.</p>
<p><strong>Durée de conservation :</strong> les données sont conservées le temps nécessaire au traitement de la demande, puis supprimées.</p>
<h4>Données NON collectées</h4>
<p>En dehors du formulaire de contact et des réponses volontaires aux sondages (voir ci-dessous), ce site <strong>ne collecte aucune donnée personnelle</strong>. Il n'y a pas de compte utilisateur, pas de newsletter, pas de système de commentaires.</p>
<h4>Sondages</h4>
<p>Cet outil propose parfois des <strong>sondages ponctuels</strong> liés à un événement (ex. « viens-tu ? », covoiturage). Y répondre est entièrement <strong>volontaire</strong> et ne nécessite ni compte ni code d'accès.</p>
<p>En répondant à un sondage, vous transmettez :</p>
<ul>
  <li>Un <strong>pseudo</strong> de votre choix (déclaratif, non vérifié)</li>
  <li>Vos réponses aux questions du sondage</li>
  <li>La date et l'heure de votre réponse</li>
</ul>
<p><strong>Base légale :</strong> consentement de l'utilisateur, exprimé par l'envoi volontaire du formulaire (article 6.1.a du RGPD).</p>
<p>Ce pseudo et ces réponses sont <strong>visibles publiquement</strong> par toute personne consultant le sondage, aussi longtemps qu'il reste ouvert. Vous pouvez à tout moment <strong>modifier ou supprimer votre réponse</strong> en reprenant le même pseudo sur le formulaire — y compris depuis un autre appareil, l'identification reposant uniquement sur le pseudo choisi, et non sur l'appareil utilisé.</p>
<p><strong>Attention :</strong> ce fonctionnement sans compte ni code implique qu'une personne reprenant le même pseudo que vous sur un même sondage peut modifier ou supprimer votre réponse. Choisissez un pseudo suffisamment distinctif si cela vous préoccupe.</p>
<p>Ces données sont hébergées par <strong>Supabase</strong>, sur une base de données PostgreSQL dont l'infrastructure est basée dans l'Union européenne (Francfort, Allemagne).</p>
<p><strong>Durée de conservation :</strong> les réponses sont conservées tant que le sondage existe, ou jusqu'à leur suppression par leur auteur ou par le staff.</p>
<h4>Stockage local (localStorage)</h4>
<p>Le site utilise le <strong>localStorage</strong> de votre navigateur pour :</p>
<ul>
  <li>Sauvegarder vos préférences de filtres du calendrier (type d'événement, région, département)</li>
  <li>Mémoriser si vous avez activé la sauvegarde automatique des filtres</li>
  <li>Mémoriser le pseudo utilisé pour répondre à un sondage, afin de pré-remplir le formulaire</li>
</ul>
<p>Ces données restent <strong>exclusivement sur votre appareil</strong> et ne sont jamais transmises à un serveur. Vous pouvez les supprimer à tout moment via les paramètres de votre navigateur.</p>
<h4>Données de navigation (hébergeur)</h4>
<p><strong>GitHub Pages</strong> peut collecter automatiquement des données techniques de connexion (adresse IP, type de navigateur, pages visitées) conformément à sa propre <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">politique de confidentialité</a>. La Meute Normande n'a pas accès à ces données.</p>
<h4>Services tiers</h4>
<p>Le site fait appel aux services tiers suivants, qui peuvent recevoir des données techniques (adresse IP, en-têtes de requête) :</p>
<div class="table-wrap">
<table>
  <thead><tr><th>Service</th><th>Usage</th><th>Données potentielles</th></tr></thead>
  <tbody>
    <tr><td><strong>Google Fonts</strong></td><td>Chargement de la police Inter Tight</td><td>Adresse IP, en-tête Referer</td></tr>
    <tr><td><strong>jsDelivr</strong></td><td>Chargement des bibliothèques d'affichage (client Supabase)</td><td>Adresse IP</td></tr>
    <tr><td><strong>UseBasin</strong></td><td>Traitement du formulaire de contact</td><td>Données du formulaire (voir ci-dessus)</td></tr>
    <tr><td><strong>GitHub Raw</strong></td><td>Récupération du fichier calendrier ICS (suggestions de sondages)</td><td>Adresse IP</td></tr>
    <tr><td><strong>Supabase</strong></td><td>Hébergement de la base de données des sondages (infrastructure Francfort, UE)</td><td>Pseudo et réponses soumis volontairement</td></tr>
  </tbody>
</table>
</div>
<h4>Tracking et publicité</h4>
<p>Ce site <strong>n'utilise aucun outil de tracking, d'analyse ou de publicité</strong> (pas de Google Analytics, pas de Facebook Pixel, pas de Matomo, pas de publicité ciblée).</p>
<h4>Vos droits</h4>
<p>Conformément au RGPD, vous disposez des droits suivants :</p>
<ul>
  <li><strong>Droit d'accès</strong> — obtenir une copie de vos données</li>
  <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
  <li><strong>Droit à l'effacement</strong> — demander la suppression de vos données</li>
  <li><strong>Droit d'opposition</strong> — vous opposer au traitement</li>
  <li><strong>Droit à la portabilité</strong> — récupérer vos données dans un format structuré</li>
</ul>
<p>Vous pouvez également introduire une réclamation auprès de la <strong>CNIL</strong> (<a href="https://www.cnil.fr" target="_blank" rel="noopener">www.cnil.fr</a>).</p>
<h4>Mise à jour</h4>
<p>Cette politique peut être modifiée à tout moment. La date de dernière mise à jour est indiquée ci-dessous.</p>
<p><em>Dernière mise à jour : septembre 2026</em></p>`
    },
    cookies: {
      title: 'Politique de cookies',
      html: `
<h4>Qu'est-ce qu'un cookie ?</h4>
<p>Un cookie est un petit fichier texte déposé sur votre appareil lors de la visite d'un site web. Il permet de stocker des informations relatives à votre navigation. Le <strong>localStorage</strong> est un mécanisme similaire, propre à votre navigateur, qui stocke des données localement sans les transmettre automatiquement aux serveurs.</p>
<h4>Stockage utilisé par ce site</h4>
<div class="table-wrap">
<table>
  <thead><tr><th>Type</th><th>Origine</th><th>Finalité</th><th>Durée</th></tr></thead>
  <tbody>
    <tr><td>localStorage<br><code>calendarFilterSettings</code></td><td>Ce site (lameutenormande.fr)</td><td>Sauvegarde de vos filtres du calendrier (type, région, département)</td><td>Jusqu'à suppression manuelle</td></tr>
    <tr><td>localStorage<br><code>calendarFilterSave</code></td><td>Ce site (lameutenormande.fr)</td><td>Mémorise si vous avez activé la sauvegarde des filtres</td><td>Jusqu'à suppression manuelle</td></tr>
    <tr><td>localStorage<br><code>votes.pseudo</code></td><td>Ce site (lameutenormande.fr)</td><td>Mémorise le pseudo utilisé pour répondre à un sondage, afin de pré-remplir le formulaire</td><td>Jusqu'à suppression manuelle</td></tr>
    <tr><td>localStorage<br><code>votes.device</code></td><td>Ce site (lameutenormande.fr)</td><td>Identifiant technique de l'appareil, conservé à titre informatif uniquement (il n'est plus utilisé pour identifier vos réponses, voir la politique de confidentialité)</td><td>Jusqu'à suppression manuelle</td></tr>
  </tbody>
</table>
</div>
<h4>Cookies pouvant être déposés par des tiers</h4>
<div class="table-wrap">
<table>
  <thead><tr><th>Service</th><th>Type</th><th>Finalité</th><th>Durée</th></tr></thead>
  <tbody>
    <tr><td>GitHub Pages</td><td>Cookie technique</td><td>Fonctionnement de l'hébergement</td><td>Session</td></tr>
    <tr><td>Google Fonts (fonts.googleapis.com)</td><td>Cookie technique</td><td>Chargement de la police Inter Tight</td><td>Variable</td></tr>
    <tr><td>jsDelivr (cdn.jsdelivr.net)</td><td>Cookie technique</td><td>Chargement des bibliothèques d'affichage</td><td>Variable</td></tr>
    <tr><td>Supabase (supabase.co)</td><td>Cookie technique</td><td>Chargement des sondages et enregistrement des réponses</td><td>Session</td></tr>
  </tbody>
</table>
</div>
<h4>Cookies analytiques ou publicitaires</h4>
<p>Ce site <strong>n'utilise aucun cookie publicitaire, de tracking ou d'analyse</strong> (pas de Google Analytics, pas de Facebook Pixel, pas de Matomo, pas de publicité ciblée).</p>
<h4>Gérer vos cookies</h4>
<p>Vous pouvez à tout moment configurer votre navigateur pour refuser les cookies ou supprimer ceux déjà déposés :</p>
<ul>
  <li><strong>Chrome :</strong> Paramètres → Confidentialité et sécurité → Cookies et autres données de site</li>
  <li><strong>Firefox :</strong> Paramètres → Vie privée et sécurité → Cookies et données de sites</li>
  <li><strong>Safari :</strong> Préférences → Confidentialité → Gérer les données de site web</li>
  <li><strong>Edge :</strong> Paramètres → Cookies et autorisations de site</li>
</ul>
<h4>Effacer le localStorage</h4>
<p>Pour supprimer les préférences enregistrées par ce site :</p>
<ul>
  <li>Ouvrez les outils développeur de votre navigateur (<strong>F12</strong>)</li>
  <li>Allez dans l'onglet <strong>Application</strong> (Chrome/Edge) ou <strong>Stockage</strong> (Firefox)</li>
  <li>Sélectionnez <strong>localStorage</strong> → <strong>lameutenormande.fr</strong></li>
  <li>Supprimez les entrées souhaitées ou cliquez sur « Tout effacer »</li>
</ul>
<p>Vous pouvez aussi effacer les données de navigation de votre navigateur, ce qui supprimera à la fois les cookies et le localStorage.</p>
<p><em>Dernière mise à jour : septembre 2026</em></p>`
    }
  };

  window.E = window.E || {};
  E.LEGAL = TEXTS;
  E.openLegal = function (key) {
    const t = TEXTS[key]; if (!t) return;
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const bg = E.h('div', { class: 'legal-modal-bg', onClick: (e) => { if (e.target === bg) close(); } },
      E.h('div', { class: 'legal-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title },
        E.h('div', { class: 'legal-modal-header' }, E.h('h3', { class: 'legal-modal-title' }, t.title),
          E.h('button', { class: 'legal-modal-close', type: 'button', 'aria-label': 'Fermer', onClick: close }, '×')),
        E.h('div', { class: 'legal-modal-body', html: t.html })));
    document.body.appendChild(bg);
    document.addEventListener('keydown', onKey);
    const first = bg.querySelector('.legal-modal-close'); if (first) first.focus();
  };
})();
