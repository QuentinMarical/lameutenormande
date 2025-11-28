<?php
// Autorise les requêtes cross-origin
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/calendar; charset=utf-8');

// URL du calendrier Zoho
$ical_url = 'https://calendar.zoho.eu/ical/zz080112301ab3047e81313179c3ee5fd4b00c2a7157b801985735a7b689432472bf947fc87d113e58fdc5e83eea16ec9dc7bc3e4c';

// Récupère le contenu iCal
$ical_content = @file_get_contents($ical_url);

if ($ical_content === false) {
    http_response_code(404);
    echo 'Erreur: Impossible de récupérer le calendrier Zoho';
    exit;
}

// Retourne le contenu
echo $ical_content;
?>
