#!/bin/bash

# ?? Script de Réinjection des Optimisations (version Bash)
# À exécuter après chaque export depuis Mobirise
# Compatible Mac/Linux

echo "?? La Meute Normande - Script de Réinjection des Optimisations"
echo "================================================================"
echo ""

PROJECT_PATH="$(cd "$(dirname "$0")" && pwd)"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Fonction pour insérer du contenu avant une balise
insert_before_tag() {
    local file_path="$1"
    local search_tag="$2"
    local content_to_insert="$3"
    
    if [ -f "$file_path" ]; then
        if ! grep -qF "$content_to_insert" "$file_path"; then
            # Échapper les caractères spéciaux pour sed
            local escaped_content=$(printf '%s\n' "$content_to_insert" | sed 's/[&/\]/\\&/g')
            local escaped_tag=$(printf '%s\n' "$search_tag" | sed 's/[&/\]/\\&/g')
            
            sed -i.bak "s|$escaped_tag|$escaped_content\\n$escaped_tag|" "$file_path"
            rm "${file_path}.bak"
            echo -e "${GREEN}? Modifié: $file_path${NC}"
            return 0
        else
            echo -e "${YELLOW}??  Déjà présent dans: $file_path${NC}"
            return 1
        fi
    else
        echo -e "${RED}? Fichier non trouvé: $file_path${NC}"
        return 1
    fi
}

# Fonction pour remplacer du texte
replace_text() {
    local file_path="$1"
    local old_text="$2"
    local new_text="$3"
    
    if [ -f "$file_path" ]; then
        if grep -qF "$old_text" "$file_path"; then
            # Échapper les caractères spéciaux
            local escaped_old=$(printf '%s\n' "$old_text" | sed 's/[&/\]/\\&/g')
            local escaped_new=$(printf '%s\n' "$new_text" | sed 's/[&/\]/\\&/g')
            
            sed -i.bak "s|$escaped_old|$escaped_new|g" "$file_path"
            rm "${file_path}.bak"
            echo -e "${GREEN}? Remplacé dans: $file_path${NC}"
            return 0
        else
            echo -e "${YELLOW}??  Texte déjà correct dans: $file_path${NC}"
            return 1
        fi
    else
        echo -e "${RED}? Fichier non trouvé: $file_path${NC}"
        return 1
    fi
}

echo -e "${CYAN}?? Étape 1/6 : Ajout des meta tags SEO...${NC}"

META_TAGS='  <link rel="manifest" href="manifest.json">
  <meta name="keywords" content="furry, haute-normandie, normandie, conventions, communauté, groupe, événements">
  <meta name="author" content="La Meute Normande">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="La Meute Normande - Communauté Furry Haute-Normandie">
  <meta property="og:description" content="Un groupe de furry déjanté en Haute-Normandie! Rejoignez notre communauté.">
  <meta property="og:image" content="assets/images/logo-206x86.png">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="La Meute Normande">
  <meta name="twitter:description" content="Un groupe de furry déjanté en Haute-Normandie!">'

insert_before_tag "$PROJECT_PATH/index.html" "<title>" "$META_TAGS"
insert_before_tag "$PROJECT_PATH/Événements.html" "<title>" "$META_TAGS"

echo ""
echo -e "${CYAN}?? Étape 2/6 : Ajout des liens CSS et JS personnalisés...${NC}"

CUSTOM_CSS='  <link rel="stylesheet" href="assets/css/custom-optimizations.css">'
insert_before_tag "$PROJECT_PATH/index.html" "</head>" "$CUSTOM_CSS"
insert_before_tag "$PROJECT_PATH/Événements.html" "</head>" "$CUSTOM_CSS"

# Ajouter le CSS du système de cartes défilantes pour la page Événements
EVENTS_SWIPER_CSS='  <link rel="stylesheet" href="assets/css/events-swiper.css">'
insert_before_tag "$PROJECT_PATH/Événements.html" "</head>" "$EVENTS_SWIPER_CSS"

CUSTOM_JS='<script src="assets/js/init.js"></script>'
insert_before_tag "$PROJECT_PATH/index.html" "</body>" "$CUSTOM_JS"
insert_before_tag "$PROJECT_PATH/Événements.html" "</body>" "$CUSTOM_JS"

# Ajouter le JS du système de cartes défilantes pour la page Événements
EVENTS_SWIPER_JS='<script src="assets/js/events-swiper.js"></script>'
insert_before_tag "$PROJECT_PATH/Événements.html" "</body>" "$EVENTS_SWIPER_JS"

SKIP_LINK='  <!-- Skip to main content for accessibility -->
  <a href="#main-content" class="skip-to-content">Aller au contenu principal</a>'
insert_before_tag "$PROJECT_PATH/index.html" "<body>" "$SKIP_LINK"
insert_before_tag "$PROJECT_PATH/Événements.html" "<body>" "$SKIP_LINK"

echo ""
echo -e "${CYAN}?? Étape 3/6 : Correction des liens placeholder...${NC}"

# Corrections dans index.html
replace_text "$PROJECT_PATH/index.html" 'href="https://mobiri.se" aria-expanded="false">photos' 'href="#photos">Photos'
replace_text "$PROJECT_PATH/index.html" 'href="https://mobiri.se">contact' 'href="#contact">Contact'
replace_text "$PROJECT_PATH/index.html" 'href="https://mobiri.se">rejoignez-nous' 'href="https://t.me/+Kv0RM5JpSJw4NzRk" target="_blank" rel="noopener noreferrer">Rejoignez-nous'

# Corrections dans Événements.html
replace_text "$PROJECT_PATH/Événements.html" 'href="https://mobiri.se" aria-expanded="false">photos' 'href="index.html#photos">Photos'
replace_text "$PROJECT_PATH/Événements.html" 'href="https://mobiri.se">contact' 'href="index.html#contact">Contact'

echo ""
echo -e "${CYAN}?? Étape 4/6 : Correction des fautes d'orthographe...${NC}"

replace_text "$PROJECT_PATH/index.html" 'auquel on participe' 'auxquels on participe'
replace_text "$PROJECT_PATH/index.html" 'passé et future' 'passés et futurs'
replace_text "$PROJECT_PATH/index.html" 'Où somme-nous' 'Où sommes-nous'
replace_text "$PROJECT_PATH/index.html" 'alt="OwO"' 'alt="Logo La Meute Normande"'

replace_text "$PROJECT_PATH/Événements.html" 'alt="OwO"' 'alt="Logo La Meute Normande"'

echo ""
echo -e "${CYAN}?? Étape 5/6 : Ajout des attributs de sécurité...${NC}"

# Ajouter rel="noopener noreferrer" sur les liens externes
replace_text "$PROJECT_PATH/index.html" 'href="https://t.me/+Kv0RM5JpSJw4NzRk" target="_blank">' 'href="https://t.me/+Kv0RM5JpSJw4NzRk" target="_blank" rel="noopener noreferrer" aria-label="Rejoignez-nous sur Telegram">'
replace_text "$PROJECT_PATH/index.html" 'href="https://www.instagram.com/la.meute_normande" target="_blank">' 'href="https://www.instagram.com/la.meute_normande" target="_blank" rel="noopener noreferrer" aria-label="Suivez-nous sur Instagram">'

replace_text "$PROJECT_PATH/Événements.html" 'href="https://t.me/+Kv0RM5JpSJw4NzRk" target="_blank">' 'href="https://t.me/+Kv0RM5JpSJw4NzRk" target="_blank" rel="noopener noreferrer" aria-label="Rejoignez-nous sur Telegram">'
replace_text "$PROJECT_PATH/Événements.html" 'href="https://www.instagram.com/la.meute_normande" target="_blank">' 'href="https://www.instagram.com/la.meute_normande" target="_blank" rel="noopener noreferrer" aria-label="Suivez-nous sur Instagram">'

echo ""
echo -e "${CYAN}?? Étape 6/6 : Amélioration des titres sémantiques...${NC}"

replace_text "$PROJECT_PATH/index.html" '<h6 class="mbr-section-subtitle' '<h2 class="mbr-section-subtitle'
replace_text "$PROJECT_PATH/index.html" '</h6>' '</h2>'
replace_text "$PROJECT_PATH/index.html" '<h5 class="card-title' '<h3 class="card-title'
replace_text "$PROJECT_PATH/index.html" '</h5>' '</h3>'

echo ""
echo "================================================================"
echo -e "${GREEN}? Script terminé avec succès!${NC}"
echo ""
echo -e "${YELLOW}?? Résumé des modifications:${NC}"
echo "  • Meta tags SEO ajoutés"
echo "  • CSS/JS personnalisés liés"
echo "  • Liens placeholder corrigés"
echo "  • Fautes d'orthographe corrigées"
echo "  • Attributs de sécurité ajoutés"
echo "  • Structure HTML améliorée"
echo ""
echo -e "${CYAN}?? Conseil: Testez votre site après avoir exécuté ce script!${NC}"
echo ""
