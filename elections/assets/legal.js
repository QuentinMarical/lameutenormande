/* Pages légales de l'outil d'élections (mentions légales, confidentialité, cookies),
   affichées en fenêtre modale depuis le pied de page, comme sur le site principal. */
(function () {
  'use strict';
  const TEXTS = {
    mentions: {
      title: 'Mentions légales — Élections de la Meute',
      html: `
<h4>Éditeur</h4>
<p>Cet outil de vote est édité par <strong>La Meute Normande</strong>, collectif informel de passionnés de la culture furry en Haute-Normandie, pour l'organisation de ses élections internes. Il est accessible à l'adresse <a href="https://lameutenormande.fr/elections/">lameutenormande.fr/elections/</a>.</p>
<p>Responsable de la publication et développement : <strong>Nitra</strong>, joignable sur Telegram (<a href="tg://resolve?domain=NitraFox">@NitraFox</a>) ou via le <a href="https://lameutenormande.fr/contact.html">formulaire de contact du site</a>.</p>
<h4>Hébergement</h4>
<ul>
  <li><strong>Pages web</strong> : GitHub Pages — GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</li>
  <li><strong>Données de vote</strong> (codes, candidatures, bulletins) : Supabase — Supabase, Inc., hébergé sur des serveurs situés dans l'Union européenne.</li>
</ul>
<h4>Propriété</h4>
<p>Le logo et les visuels de La Meute Normande appartiennent au collectif. Le code de l'outil est publié dans le dépôt du site. Toute réutilisation du nom ou des visuels hors du cadre de la Meute nécessite l'accord du staff.</p>
<h4>Usage</h4>
<p>L'outil est réservé aux membres de La Meute Normande munis d'un code individuel remis par le staff. Toute tentative d'utiliser un code qui ne vous a pas été remis, ou de fausser un scrutin, entraîne l'invalidation des bulletins concernés et peut être signalée dans le groupe.</p>
<p><em>Dernière mise à jour : septembre 2026.</em></p>`
    },
    confidentialite: {
      title: 'Politique de confidentialité — Élections de la Meute',
      html: `
<p>Cet outil est conçu pour fonctionner <strong>sans compte ni mot de passe</strong> et en collectant le strict minimum. Voici précisément ce qui est enregistré, pourquoi, et pendant combien de temps.</p>
<h4>Données traitées</h4>
<div class="table-wrap">
<table>
  <thead><tr><th>Donnée</th><th>Finalité</th><th>Qui la voit</th><th>Conservation</th></tr></thead>
  <tbody>
    <tr><td><strong>Code individuel</strong> et son étiquette (pseudo de la personne à qui il a été remis)</td><td>Garantir un bulletin par membre, permettre au staff de savoir qui a reçu un code et qui a voté</td><td>Le staff (administrateurs)</td><td>Jusqu'à la suppression du scrutin après publication des résultats</td></tr>
    <tr><td><strong>Candidature</strong> : nom affiché, présentation</td><td>Présenter les candidats sur le bulletin et les résultats</td><td>Tous les visiteurs de l'outil</td><td>Jusqu'à la suppression du scrutin</td></tr>
    <tr><td><strong>Bulletin</strong> : choix par poste, horodatage, nombre de modifications</td><td>Calculer les résultats</td><td>Personne individuellement : le staff voit qu'un code a voté et quand, <strong>jamais le contenu du bulletin</strong>. Seuls les totaux par candidat sont publiés</td><td>Jusqu'à la suppression du scrutin</td></tr>
    <tr><td><strong>Journal d'activité</strong> : étiquette du code, action (vote, candidature, désistement), date</td><td>Détecter et documenter une fraude, tracer les décisions du staff</td><td>Le staff</td><td>Jusqu'à la suppression du scrutin</td></tr>
    <tr><td><strong>Compte administrateur</strong> : e-mail, mot de passe chiffré</td><td>Accès au panel d'administration</td><td>Supabase et le staff</td><td>Tant que la personne fait partie du staff</td></tr>
  </tbody>
</table>
</div>
<h4>Ce qui n'est pas collecté</h4>
<ul>
  <li>Aucune adresse e-mail ni numéro de téléphone des votants.</li>
  <li>Aucune adresse IP n'est enregistrée par l'outil. L'hébergeur des données peut conserver des journaux techniques temporaires, conformément à sa propre politique.</li>
  <li>Aucun traceur publicitaire, aucune mesure d'audience.</li>
</ul>
<h4>Stockage sur votre appareil</h4>
<p>Votre code de vote est mémorisé dans le stockage local de votre navigateur pour vous éviter de le ressaisir. Il ne quitte pas votre appareil autrement que pour vérifier votre bulletin. Le bouton « changer » dans le menu l'efface. Pensez-y sur un appareil partagé.</p>
<h4>Services tiers</h4>
<ul>
  <li><strong>Supabase</strong> (Union européenne) héberge la base de données.</li>
  <li><strong>GitHub Pages</strong> sert les pages.</li>
  <li><strong>Google Fonts</strong> et <strong>jsDelivr</strong> fournissent la police Inter Tight et les bibliothèques d'affichage ; ces services reçoivent votre adresse IP lors du chargement.</li>
  <li>Si le staff active les annonces automatiques, le nom affiché des candidats et les résultats sont publiés sur le canal Telegram de la Meute.</li>
</ul>
<h4>Vos droits</h4>
<p>Vous pouvez demander à tout moment la révocation de votre code, la modification ou le retrait de votre candidature (possible directement depuis la page « Candidater » tant que le scrutin est ouvert), ou la suppression de vos données après le scrutin. Contactez le staff sur Telegram ou via le <a href="https://lameutenormande.fr/contact.html">formulaire de contact</a>.</p>
<p>Base légale : intérêt légitime du collectif à organiser ses élections internes, et consentement pour la candidature. Aucune donnée n'est vendue ni transmise à des fins commerciales.</p>
<p><em>Dernière mise à jour : septembre 2026.</em></p>`
    },
    cookies: {
      title: 'Politique de cookies — Élections de la Meute',
      html: `
<h4>En bref</h4>
<p>L'outil d'élections <strong>ne dépose aucun cookie</strong> et n'utilise aucun outil de mesure d'audience ou de publicité.</p>
<h4>Stockage local</h4>
<p>Deux informations peuvent être conservées dans le stockage local de votre navigateur (pas des cookies, elles ne sont jamais envoyées automatiquement à un serveur) :</p>
<ul>
  <li><strong>Votre code de vote</strong>, pour ne pas avoir à le ressaisir à chaque visite. Effaçable avec le bouton « changer » du menu.</li>
  <li><strong>La session administrateur</strong>, uniquement pour les membres du staff connectés au panel. Effacée à la déconnexion.</li>
</ul>
<h4>Services tiers</h4>
<p>Les bibliothèques et polices chargées depuis Google Fonts et jsDelivr peuvent être soumises aux politiques de ces services. Aucun d'eux n'est utilisé pour vous suivre.</p>
<h4>Comment tout effacer</h4>
<p>Dans les paramètres de votre navigateur, supprimez les données du site <strong>lameutenormande.fr</strong>. Le prochain vote vous redemandera simplement votre code.</p>
<p><em>Dernière mise à jour : septembre 2026.</em></p>`
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
