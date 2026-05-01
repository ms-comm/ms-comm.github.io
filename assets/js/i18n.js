/* ============================================================================
 *  MS Comm' — Simple FR/EN i18n layer
 *
 *  Works across ALL pages without touching the HTML markup:
 *   - Detects the user language (saved preference > navigator.language).
 *     Default is French. Any other browser language falls back to English.
 *   - Injects a small flag switcher in the top-right of the topbar.
 *   - Walks every text node in <body> and translates matches against a
 *     French → English dictionary. Preserves leading/trailing whitespace.
 *   - Translates the most common attributes (placeholder, aria-label, alt,
 *     title) + the <title> tag + meta description + <html lang>.
 *   - Uses a MutationObserver so dynamically-rendered content (cart,
 *     photo grid, lightbox, etc.) gets translated as it appears.
 *   - Stores original French in a WeakMap so switching back is lossless.
 * ========================================================================= */
(function () {
  'use strict';

  const STORAGE_KEY = 'mscomm_lang';

  /* -----------------------------------------------------------------------
   *  Dictionary: French → English
   *  Keys are the exact trimmed text content as it appears in the DOM.
   *  Matching is done after `.trim()` so leading/trailing whitespace from
   *  the HTML indentation is irrelevant.
   * --------------------------------------------------------------------- */
  const DICT = {
    /* ═══ Navigation / topbar ═══ */
    "Prestataire de services de communication": "Communication services provider",
    "Accueil": "Home",
    "Expériences": "Experience",
    "Services": "Services",
    "Portfolio": "Portfolio",
    "Photographie": "Photography",
    "Contact": "Contact",
    "Demander un devis": "Request a quote",
    "Menu": "Menu",

    /* ═══ Faces tab (photos.html) ═══ */
    "Galerie": "Gallery",
    "Albums": "Albums",
    "Visages": "Faces",
    "Rechercher un nom…": "Search a name…",
    "Chargement…": "Loading…",
    "Aucun visage publié pour l'instant.": "No faces published yet.",
    "Aucun visage ne correspond à cette recherche.": "No face matches this search.",
    "Aucune personne pour l'instant.": "No people yet.",
    "Personne introuvable.": "Person not found.",
    "← Retour aux visages": "← Back to faces",
    "← Précédent": "← Previous",
    "Suivant →": "Next →",

    /* ═══ Footer ═══ */
    "MS Comm' — Melody. Tous droits réservés.": "MS Comm' — Melody. All rights reserved.",
    "MS Comm' — Tous droits réservés": "MS Comm' — All rights reserved",
    "Retour en haut": "Back to top",

    /* ═══ Gold <span> fragments / connectors ═══ */
    "Mes": "My",
    "Mon": "My",
    /* The contact H1 "Me <span class='gold'>Contacter</span>" splits into two
       text nodes. Mapping "Me" → "Contact" and "Contacter" → "me" restores
       the natural English word order while keeping the gold-span styling. */
    "Me": "Contact",
    "Contacter": "me",
    "Ma carte de": "My business",
    "visite": "card",
    "Carte de": "Business",
    "Créations": "Creations",
    "contenu": "content",
    "confiance": "trust",
    "briller": "shine",
    "collaborer": "collaborate",
    "proposent": "offer",
    "propose": "offer",
    "Tarifs": "Pricing",
    "Tennis de Table": "Table Tennis",
    "Pongiste": "Pongiste",
    "Effect": "Effect",
    "Lebrun": "Lebrun",
    "Pongistic": "Pongistic",
    "Réalisations": "Work",
    "à la carte": "à la carte",
    "lancement": "launch",
    "spéciaux": "special",
    "sur mesure": "tailored",

    /* ═══ INDEX.HERO / HERO / ABOUT ═══ */
    "Melody": "Melody",
    "Votre image,": "Your image,",
    "notre mission.": "our mission.",
    "Votre histoire,": "Your story,",
    "notre création.": "our creation.",
    "Réseaux sociaux, montage vidéo, photographie, identité visuelle, événementiel…\n              Je vous accompagne pour faire briller votre univers.":
      "Social media, video editing, photography, visual identity, events… I help you make your world shine.",
    "Découvrir mes services": "Discover my services",
    "Parlons de votre projet": "Let's talk about your project",

    /* Stats */
    "4+": "4+",
    "Années d'expérience": "Years of experience",
    "6": "6",
    "Projets marquants": "Notable projects",
    "24h / 48h": "24h / 48h",
    "Réactivité": "Response time",
    "100%": "100%",
    "Créativité & passion": "Creativity & passion",

    /* About */
    "Bienvenue chez": "Welcome to",
    "Je suis Melody. Depuis 4 ans, j'accompagne marques, clubs de sport, athlètes et entrepreneurs\n              à développer une communication qui leur ressemble et qui attire leur audience.":
      "I'm Melody. For 4 years, I've been helping brands, sports clubs, athletes and entrepreneurs develop communication that reflects who they are and attracts their audience.",
    "Passionnée de création, je mets mon expertise au service de votre image pour vous aider\n              à vous démarquer et à faire grandir vos projets.":
      "Passionate about creation, I put my expertise at the service of your image to help you stand out and grow your projects.",
    "Mon objectif ? Vous faire briller, quel que soit votre univers : sport, musique, restauration, beauté…":
      "My goal? To make you shine, whatever your world: sport, music, food, beauty…",
    "Et j'ai à cœur de construire des collaborations durables, basées sur la confiance et des résultats concrets.":
      "And I'm committed to building lasting collaborations based on trust and concrete results.",

    /* Skills */
    "Réseaux sociaux": "Social media",
    "Montage vidéo": "Video editing",
    "Identité visuelle": "Visual identity",
    "Création de contenu": "Content creation",
    "Événementiel": "Events",

    /* Section headers */
    "4 ans de projets dans le sport, les médias, et l'événementiel.":
      "4 years of projects in sport, media and events.",
    "4 ans de projets marquants dans le sport, les médias et l'événementiel.":
      "4 years of notable projects in sport, media and events.",
    "Affiches, posts, articles, journaux, vidéos — un aperçu de mon travail.":
      "Posters, posts, articles, journals, videos — a glimpse of my work.",
    "Affiches, posts, articles, journaux, vidéos — une sélection de mes réalisations.":
      "Posters, posts, articles, journals, videos — a selection of my work.",
    "Ce que je": "What I",
    "Templates, chartes graphiques, flyers, affiches, photos, réels, gestion de réseaux sociaux…":
      "Templates, brand guidelines, flyers, posters, photos, reels, social media management…",
    "Des solutions adaptées à chaque univers.":
      "Solutions tailored to every world.",
    "Ils m'ont fait": "They trusted",
    "Des retours clients authentiques.": "Authentic client feedback.",
    "Leurs mots, ma plus belle carte de visite.": "Their words, my finest business card.",
    "Avis précédent": "Previous review",
    "Avis suivant": "Next review",
    "Contrôles des avis": "Reviews controls",
    "Avis clients, défilement horizontal": "Customer reviews, horizontal scroll",

    /* Experiences card heads (shared labels on multiple pages) */
    "Auto-entrepreneur": "Freelance",
    "Responsable communication marketing": "Head of marketing communication",
    "Community Manager": "Community Manager",
    "Alternante": "Apprentice",
    "Communication": "Communication",
    "Créatrice et Rédactrice de journal": "Journal founder and editor",
    "Responsable Réseaux sociaux": "Social media manager",
    "Alexis Lebrun": "Alexis Lebrun",
    "Alexis Lebrun · Top 20 mondial": "Alexis Lebrun · Top 20 world",
    "Paris 13 Tennis de Table": "Paris 13 Table Tennis",
    "Ping Pang Paris": "Ping Pang Paris",
    "Le Journal du Pongiste": "Le Journal du Pongiste",
    "French Ping": "French Ping",
    "août 2025 — aujourd'hui": "August 2025 — today",
    "juin 2024 — aujourd'hui · 1 an 10 mois": "June 2024 — today · 1 year 10 months",
    "sept. 2023 — août 2025 · 2 ans": "Sept. 2023 — Aug. 2025 · 2 years",
    "janv. 2023 — mars 2024 · 1 an 3 mois": "Jan. 2023 — March 2024 · 1 year 3 months",
    "août 2022 — juil. 2023 · 1 an": "Aug. 2022 — July 2023 · 1 year",
    "févr. 2022 — août 2023 · 1 an 7 mois": "Feb. 2022 — Aug. 2023 · 1 year 7 months",
    "oct. 2021 — août 2023 · 1 an 11 mois": "Oct. 2021 — Aug. 2023 · 1 year 11 months",
    "oct. 2021 — août 2023": "Oct. 2021 — Aug. 2023",

    "Prestations de communication : templates, chartes graphiques, réseaux sociaux, photos et vidéos.":
      "Communication services: templates, brand guidelines, social media, photos and videos.",
    "Pilotage de la communication digitale et globale du club : gestion des réseaux sociaux, création de contenus engageants (matchs, compétitions, événements). Développement de partenariats et actions de sponsoring.":
      "Leading the club's digital and overall communication: social media management, engaging content creation (matches, competitions, events). Developing partnerships and sponsorship actions.",
    "Page professionnelle d'un pongiste de haut niveau. Création de contenu, photographie, rédaction.":
      "Professional page of a top-level table tennis player. Content creation, photography, writing.",

    /* Exp tags (tags also on experiences page) */
    "Production photo/vidéo": "Photo/video production",
    "Sponsoring": "Sponsoring",
    "Couverture sportive": "Sports coverage",
    "Community management": "Community management",
    "Image de marque": "Brand image",
    "Prestation de service de communication": "Communication service",
    "Interviews": "Interviews",
    "Couverture événementielle": "Event coverage",
    "Création vidéo": "Video creation",
    "Rédaction d'articles": "Article writing",
    "Mise en page": "Layout",
    "Ligne éditoriale": "Editorial line",
    "Gestion de diffusion": "Distribution management",
    "Production de contenu": "Content production",

    /* Voir ... links */
    "Voir toutes mes expériences →": "See all my experience →",
    "Voir tout le portfolio →": "See full portfolio →",
    "Voir mes réalisations": "See my work",
    "Voir mes services": "See my services",
    "Voir la galerie photo complète →": "See the full photo gallery →",

    /* Service preview cards on index */
    "À la carte": "À la carte",
    "dès 10€": "from €10",
    "par prestation": "per service",
    "Template Story / Publication": "Story / Post template",
    "Création d'affiches": "Poster creation",
    "En savoir plus": "Learn more",
    "Packs de lancement": "Launch packs",
    "dès 95€": "from €95",
    "par pack": "per pack",
    "Pack Réseaux Sociaux Starter": "Social Media Starter Pack",
    "Pack Réseaux Sociaux Boost": "Social Media Boost Pack",
    "Pack Identité Visuelle": "Visual Identity Pack",
    "Packs spéciaux": "Special packs",
    "dès 170€": "from €170",
    "par univers": "per world",
    "Pack Sportif": "Sports Pack",
    "Pack Beauté / Bien-être": "Beauty / Wellness Pack",
    "Pack Restaurant": "Restaurant Pack",
    "Pack Événement": "Event Pack",

    /* Index CTA final */
    "Prêt·e à": "Ready to",
    "Décrivez votre projet et je vous répondrai rapidement. Ensemble, faisons rayonner votre image.":
      "Describe your project and I'll reply quickly. Together, let's make your image shine.",
    "Me contacter": "Contact me",
    "Suivre sur Instagram": "Follow on Instagram",

    /* ═══ Services page ═══ */
    "Des solutions adaptées à chaque univers — sport, musique, restauration, beauté et plus encore.":
      "Solutions tailored to every world — sport, music, food, beauty and more.",
    "Prestations": "Services",
    "Des créations rapides et accessibles, en toute cohérence visuelle.":
      "Quick and accessible creations, with full visual consistency.",

    "Template Story*": "Story Template*",
    "Template Publication*": "Post Template*",
    "Template Story": "Story Template",
    "Template Publication": "Post Template",
    "Montage vidéo (type réels)": "Video editing (reels)",
    "Montage vidéo": "Video editing",
    "Charte graphique": "Brand guidelines",
    "Carte de visite recto": "Business card front",
    "+ verso": "+ back",
    "Supports à imprimer": "Print materials",
    "Création d'affiches / flyers": "Poster / flyer creation",
    "Carte de restaurant ou de prestations": "Restaurant / services menu",
    "Carte de fidélité": "Loyalty card",
    "Roll up": "Roll-up",
    "Photographies": "Photography",
    "Toutes les photos sont livrées retouchées": "All photos are delivered retouched",
    "1 photo": "1 photo",
    "10 photos": "10 photos",
    "20 photos ou plus": "20 photos or more",
    "10€ / unité": "€10 / unit",

    "*Personnalisation par MS Comm' en supplément.": "*Additional customisation by MS Comm' at extra cost.",
    "Tarifs indiqués hors frais d'impression et de déplacement — voir CGV.":
      "Prices exclude printing and travel fees — see T&Cs.",
    "Personnalisation de packs possible : remplacez un élément du pack par un autre service équivalent.":
      "Packs can be customised: swap any pack item for another equivalent service.",

    "Plus d'impact, moins de budget — démarrez fort.":
      "More impact, less budget — start strong.",
    "pack complet": "complete pack",
    "1 template story*": "1 story template*",
    "1 template publication": "1 post template",
    "1 montage vidéo type réel": "1 reel-style video edit",
    "3 templates story*": "3 story templates*",
    "2 templates publications*": "2 post templates*",
    "2 montages vidéo type réels": "2 reel-style video edits",
    "Carte de visite recto": "Business card front",
    "Charte graphique complète": "Complete brand guidelines",
    "Choisir ce pack": "Choose this pack",
    "Votre univers, sur mesure — faites briller chaque projet.":
      "Your world, tailored — make every project shine.",
    "1 template story* Compétition": "1 Competition story template*",
    "1 template Story Matchs": "1 Match Story template",
    "1 Publication Récap": "1 Recap post",
    "3 montages type réel": "3 reel-style edits",
    "Pack Beauté & Bien-être": "Beauty & Wellness Pack",
    "Carte de prestations": "Services menu",
    "2 templates Story": "2 Story templates",
    "1 Publication": "1 Post",
    "1 Montage vidéo type réel": "1 reel-style video edit",
    "Pack Restauration": "Restaurant Pack",
    "Carte de restaurant": "Restaurant menu",
    "1 carte de fidélité": "1 loyalty card",
    "1 Template Story*": "1 Story Template*",
    "Affiche ou flyer": "Poster or flyer",
    "1 Story vidéo ou réel": "1 video Story or reel",

    "Accompagnement": "Premium",
    "Gestion de réseaux sociaux, stratégie de contenu, reporting mensuel.":
      "Social media management, content strategy, monthly reporting.",
    "Accompagnement Premium": "Premium Support",
    "Sur devis": "On request",
    "engagement mensuel": "monthly engagement",
    "Gestion complète des réseaux sociaux": "Complete social media management",
    "Stratégie éditoriale mensuelle": "Monthly editorial strategy",
    "Création de contenus (posts, stories, réels)": "Content creation (posts, stories, reels)",
    "Accompagnement & conseils personnalisés": "Personalised support & advice",
    "Disponibilité et réactivité": "Availability and responsiveness",
    "Demander un devis personnalisé": "Request a personalised quote",

    "Une question ?": "A question?",
    "Tarifs indicatifs et personnalisables — contactez-moi pour un devis sur mesure.":
      "Indicative and customisable pricing — contact me for a tailored quote.",

    /* ═══ Portfolio page ═══ */
    "Print": "Print",
    "Affiches de matchs, stories, contenus jour de compétition et réseaux sociaux.":
      "Match posters, stories, competition-day content and social media.",
    "Communication digitale, vidéos, visuels et couverture sportive d'un athlète olympique.":
      "Digital communication, videos, visuals and sports coverage of an Olympic athlete.",
    "Affiches, flyers, cartes de visite et identité visuelle pour divers clients.":
      "Posters, flyers, business cards and visual identities for various clients.",
    "Affiches, flyers, cartes de visite, identité visuelle.":
      "Posters, flyers, business cards, visual identity.",
    "Création visuelle": "Visual creation",
    "Affiche": "Poster",
    "Publication Interview": "Interview post",
    "Création": "Creation",
    "Réels": "Reels",
    "Tournage & montage vidéo": "Shooting & video editing",
    "Entrainement": "Training",
    "Trickshot": "Trickshot",
    "Compétition": "Competition",
    "Interview": "Interview",
    "Interview Bénévoles": "Volunteers Interview",
    "Tournage et montage": "Shooting and editing",
    "Réel": "Reel",
    "Immersion compétition": "Competition immersion",
    "Community management pour un pongiste pro — médaillé olympique.":
      "Community management for a pro table tennis player — Olympic medalist.",
    "Affiches de matchs, stories, contenus jour de compétition.":
      "Match posters, stories, competition-day content.",
    "Affiche de match": "Match poster",
    "Roll-up": "Roll-up",
    "Temps forts": "Highlights",
    "Créatrice de": "Content",
    "Lifestyle, beauté & matcha • Création de contenu & collaborations.":
      "Lifestyle, beauty & matcha • Content creation & collaborations.",
    "Tiktok:": "TikTok:",
    "Collaboration commerciale": "Commercial collaboration",
    "Inviation": "Invitation",
    "Le 19ème (brunch à Montpellier)": "Le 19ème (brunch in Montpellier)",
    "Tournage et montage vidéo, contenus dynamiques pour les réseaux.":
      "Shooting and video editing, dynamic content for social media.",
    "Championnats de France": "French Championships",
    "Articles, posts historiques, contenu éditorial et rédaction.":
      "Articles, historical posts, editorial content and writing.",
    "Article - Alexis Lebrun, 1er français à remporter 2 titres de Champion d'Europe sur la même édition":
      "Article - Alexis Lebrun, first Frenchman to win 2 European Champion titles in the same edition",
    "Article - La France candidate pour accueillir les Championnats du Monde 2027":
      "Article - France bids to host the 2027 World Championships",
    "Interview - L'inspirante histoire de Tigran Tsitoghdzyan":
      "Interview - The inspiring story of Tigran Tsitoghdzyan",
    "Aperçu posts Ping Pang": "Ping Pang posts preview",
    "Posts Ping Pang 7 à 12": "Ping Pang posts 7 to 12",
    "Posts Ping Pang c3": "Ping Pang posts c3",
    "Journal mensuel récapitulant l'actualité du tennis de table français.":
      "Monthly journal recapping the French table tennis news.",
    "→ Lire les 12 éditions": "→ Read the 12 editions",
    "Couverture - Janvier 2023": "Cover - January 2023",
    "Extrait": "Extract",
    "Découvrez mes photos et retouches.": "Discover my photos and retouching.",
    "Sport": "Sport",
    "Paysage": "Landscape",
    "Fermer": "Close",

    /* ═══ Experiences page ═══ */
    "Templates, cartes de visite, cartes de fidélité, chartes graphiques, flyers, affiches,\n              carte de restaurant, photos, réels…":
      "Templates, business cards, loyalty cards, brand guidelines, flyers, posters, restaurant menus, photos, reels…",
    "Projets d'accompagnement sur le long terme comme la gestion de réseaux sociaux":
      "Long-term support projects such as social media management",
    "Vous faire briller, quel que soit votre univers : sport, musique,\n              restauration, beauté…":
      "Making you shine, whatever your world: sport, music, food, beauty…",
    "Pilotage de la communication digitale et globale du club : gestion des réseaux sociaux, création de contenus engageants (matchs, compétitions, événements)":
      "Leading the club's digital and overall communication: social media management, engaging content creation (matches, competitions, events)",
    "Développement de partenariats et actions de sponsoring":
      "Developing partnerships and sponsorship actions",
    "Contribution à l'organisation d'événements et mise en place d'une stratégie de communication pour renforcer la visibilité et l'image du club":
      "Contributing to event organisation and putting in place a communication strategy to strengthen the club's visibility and image",
    "Production de contenus à forte valeur ajoutée : interviews, montage vidéo et couverture des compétitions sportives":
      "High-value content production: interviews, video editing and sports competition coverage",
    "Suivi des événements internationaux et création de contenus adaptés pour valoriser les performances et l'image du club":
      "Following international events and creating tailored content to showcase performances and the club's image",
    "Contribution à une communication réactive et immersive autour des temps forts sportifs":
      "Contributing to reactive and immersive communication around key sports moments",
    "Couverture terrain d'événements et compétitions telles que les Championnats de France avec production de contenus en temps réel":
      "On-the-ground coverage of events and competitions such as the French Championships with real-time content production",
    "Création de formats vidéo engageants (Reels Instagram) et montage dynamique adapté aux réseaux sociaux":
      "Creation of engaging video formats (Instagram Reels) and dynamic editing tailored to social media",
    "Mise en place d'une communication réactive visant à valoriser les moments clés et renforcer l'impact des événements":
      "Setting up reactive communication to highlight key moments and strengthen event impact",
    "Conception et développement d'un journal mensuel dédié à l'actualité du tennis de table français":
      "Design and development of a monthly journal dedicated to French table tennis news",
    "Production de contenus à forte valeur ajoutée : rédaction d'articles, interviews et mise en page éditoriale":
      "High-value content production: article writing, interviews and editorial layout",
    "Pilotage de la diffusion et gestion de la ligne éditoriale pour assurer cohérence et qualité des contenus":
      "Leading distribution and managing the editorial line to ensure content consistency and quality",
    "Lire les articles →": "Read the articles →",
    "Gestion et animation de la page Instagram": "Instagram page management and animation",
    "Création de contenus visuels et vidéos (montage, photographie) adaptés aux réseaux sociaux":
      "Creation of visual and video content (editing, photography) tailored to social media",
    "Contribution au développement de la visibilité et de l'engagement de la communauté":
      "Contributing to the development of visibility and community engagement",
    "Pilotage de la communication digitale d'un athlète de haut niveau, médaillé olympique":
      "Leading the digital communication of a top-level athlete, Olympic medalist",
    "Production de contenus : vidéos, visuels…": "Content production: videos, visuals…",
    "Couverture des compétitions et gestion de la communauté, avec un objectif de valorisation de l'image et des performances sportives":
      "Competition coverage and community management, to showcase image and sports performance",
    "Envie de": "Want to",
    "Découvrez mes services ou contactez-moi pour discuter de votre projet.":
      "Discover my services or contact me to discuss your project.",

    /* ═══ Contact page ═══ */
    "Et si on écrivait la suite ensemble ?": "Shall we write the next chapter together?",
    "Décrivez votre projet et je vous répondrai rapidement.":
      "Describe your project and I'll reply quickly.",
    "Discutons de votre": "Let's talk about your",
    "projet": "project",
    "Que vous ayez besoin d'un visuel ponctuel, d'un pack complet ou d'un accompagnement\n              sur le long terme, je suis là pour vous aider à briller.":
      "Whether you need a one-off visual, a full pack or long-term support, I'm here to help you shine.",
    "N'hésitez pas à me contacter !": "Feel free to get in touch!",
    "Paris · Montpellier · France": "Paris · Montpellier · France",
    "MS Comm' — Facebook": "MS Comm' — Facebook",
    "MS Comm' — LinkedIn": "MS Comm' — LinkedIn",
    "Envoyer un message": "Send a message",
    "Nom": "Name",
    "Email": "Email",
    "Sujet": "Subject",
    "Message": "Message",
    "Votre nom": "Your name",
    "votre@email.com": "your@email.com",
    "Ex : Demande de devis Pack Sportif": "E.g. Sports Pack quote request",
    "Décrivez votre projet, vos objectifs, délais et budget estimé...":
      "Describe your project, goals, deadlines and estimated budget...",
    "Envoyer le message": "Send message",
    "Suivez": "Follow",
    "Retrouvez mes dernières créations et actualités sur les réseaux sociaux.":
      "Find my latest creations and news on social media.",
    "Instagram — MS Comm'": "Instagram — MS Comm'",
    "Instagram — Melody Sok": "Instagram — Melody Sok",
    "Instagram — Paris 13 TT": "Instagram — Paris 13 TT",
    "Instagram — Ping Pang": "Instagram — Ping Pang",
    "Facebook — MS Comm'": "Facebook — MS Comm'",
    "Carte de visite recto": "Business card front",
    "Carte de visite verso": "Business card back",

    /* ═══ Photos page ═══ */
    "Galerie": "Gallery",
    "Photo": "Photo",
    "Photographies sportives, portraits et moments d'exception.":
      "Sports photography, portraits and exceptional moments.",
    "Galerie": "Gallery",
    "Albums": "Albums",
    "Album privé": "Private album",
    "Rechercher une photo ou un album...": "Search for a photo or an album...",
    "Tous les albums": "All albums",
    "Sans album": "No album",
    "Filtrer par album": "Filter by album",
    "Aucun album disponible.": "No album available.",
    "Aucune photo publique pour l'instant.": "No public photos yet.",
    "Aucune photo dans cet album.": "No photo in this album.",
    "Entrez le code reçu par email pour accéder à votre galerie.":
      "Enter the code received by email to access your gallery.",
    "Annuler": "Cancel",
    "Accéder": "Access",
    "Commander une impression": "Order a print",
    "Cette fonctionnalité est en cours de développement. Pour commander, contactez-nous en précisant la photo souhaitée.":
      "This feature is being developed. To order, contact us with the photo you'd like.",
    "Contacter MS Comm'": "Contact MS Comm'",
    "Partager": "Share",
    "Télécharger": "Download",
    "Panier": "Cart",
    "Votre panier est vide": "Your cart is empty",
    "Code promo": "Promo code",
    "Appliquer": "Apply",
    "Sous-total": "Subtotal",
    "Total": "Total",
    "Procéder au paiement": "Proceed to payment",
    "Privé": "Private",
    "Payant": "Paid",
    "Public": "Public",
    "Gratuit": "Free",
    "Aperçu": "Preview",
    "Acheté": "Purchased",
    "Original": "Original",
    "Pleine résolution": "Full resolution",
    "Télécharger avec filigrane — gratuit :": "Download with watermark — free:",
    "Acheter sans filigrane": "Buy without watermark",
    "Débloque toutes les résolutions sans filigrane :": "Unlocks all resolutions without watermark:",
    "Imprimer": "Print",
    "Lien copié !": "Link copied!",
    "Erreur réseau": "Network error",
    "Code promo": "Promo code",

    /* ═══ Checkout page ═══ */
    "Récapitulatif & Paiement": "Summary & Payment",
    "Récapitulatif &": "Summary &",
    "Paiement": "Payment",
    "Retour à la galerie": "Back to gallery",
    "← Retour à la galerie": "← Back to gallery",
    "Commande reçue !": "Order received!",
    "Un email contenant votre lien de téléchargement vous a été envoyé.":
      "An email with your download link has been sent to you.",
    "Télécharger mes photos (.zip)": "Download my photos (.zip)",
    "Vos coordonnées": "Your details",
    "Prénom": "First name",
    "Nom": "Last name",
    "Email *": "Email *",
    "Téléphone": "Phone",
    "Marie": "Marie",
    "Dupont": "Doe",
    "marie.dupont@email.com": "marie.doe@email.com",
    "+33 6 12 34 56 78": "+33 6 12 34 56 78",
    "Mode DEBUG activé": "DEBUG mode enabled",
    "— aucun paiement réel ne sera effectué. Les photos seront téléchargeables gratuitement.":
      "— no real payment will be processed. Photos will be downloadable for free.",
    "Carte bancaire": "Credit card",
    "Payer": "Pay",
    "Paiement sécurisé — Stripe, chiffrement SSL 256 bits": "Secure payment — Stripe, 256-bit SSL encryption",
    "Votre sélection": "Your selection",
    "Aucun article.": "No item.",

    /* Offline banner (photos.html) */
    "Le serveur photo n'est pas disponible — démarrez": "The photo server is not available — start",
    "dans": "in",

    /* ═══ Page <title> tags ═══ */
    "MS Comm' | Communication Sportive, Média & Événementiel Paris | Melody":
      "MS Comm' | Sports, Media & Events Communication in Paris | Melody",
    "Services & Tarifs Communication Sportive | MS Comm' Paris | Melody":
      "Services & Pricing — Sports Communication | MS Comm' Paris | Melody",
    "Portfolio Communication Sportive | MS Comm' Paris | Créations Sport & Média":
      "Sports Communication Portfolio | MS Comm' Paris | Sport & Media Creations",
    "Expériences Communication Sportive | MS Comm' Paris | Melody":
      "Sports Communication Experience | MS Comm' Paris | Melody",
    "Contact Communication Sportive Paris | MS Comm' | Melody":
      "Contact — Sports Communication Paris | MS Comm' | Melody",
    "MS Comm' | Galerie Photo — Photographie Sportive & Événementielle":
      "MS Comm' | Photo Gallery — Sports & Event Photography",
    "MS Comm' — Récapitulatif & Paiement": "MS Comm' — Summary & Payment",

    /* ═══ Meta descriptions ═══ */
    "MS Comm' - Spécialiste en communication sportive, média et événementiel à Paris. Création de contenu, réseaux sociaux, photographie sportive, vidéo événementielle, identité visuelle pour clubs sportifs, athlètes et marques.":
      "MS Comm' — Sports, media and events communication specialist in Paris. Content creation, social media, sports photography, event video, visual identity for sports clubs, athletes and brands.",
    "Services MS Comm' Paris : templates réseaux sociaux sportifs, charte graphique club, photographie sportive, vidéo événementielle, accompagnement communication sportive. Tarifs compétitifs pour clubs et athlètes.":
      "MS Comm' Paris services: sports social media templates, club brand guidelines, sports photography, event video, sports communication support. Competitive pricing for clubs and athletes.",
    "Portfolio MS Comm' Paris : affiches sportives, posts réseaux sociaux sportifs, articles médias sportifs, photographie événementielle, vidéo sportive. Créations pour clubs, athlètes et événements sportifs.":
      "MS Comm' Paris portfolio: sports posters, sports social media posts, sports media articles, event photography, sports video. Creations for clubs, athletes and sports events.",
    "Parcours professionnel de Melody — 4 ans d'expériences en communication sport, média et événementiel à Paris. Alexis Lebrun, Paris 13 TT, Pongistic, Ping Pang Effect.":
      "Melody's professional journey — 4 years of experience in sports, media and events communication in Paris. Alexis Lebrun, Paris 13 TT, Pongistic, Ping Pang Effect.",
    "Contactez MS Comm' Paris pour vos projets de communication sportive, média et événementiel. Services pour clubs sportifs, athlètes, événements sportifs. Devis personnalisé.":
      "Contact MS Comm' Paris for your sports, media and event communication projects. Services for sports clubs, athletes, sporting events. Tailored quote.",
    "Découvrez la galerie photo de MS Comm' : photographies sportives, portraits, événements. Téléchargement disponible. Accès galerie privée pour les clients.":
      "Discover MS Comm's photo gallery: sports photography, portraits, events. Download available. Private gallery access for clients.",

    /* ═══ A few tiny stragglers ═══ */
    "Créatrice de contenu": "Content Creator",
    "Couverture": "Coverage",
    "Le serveur photo n'est pas disponible — démarrez node server.js dans photo-server/.":
      "The photo server is not available — start node server.js in photo-server/.",
    "MS Comm' logo": "MS Comm' logo",
    "MS": "MS"
  };

  /* -----------------------------------------------------------------------
   *  Flag SVG icons (inline so the switcher works offline).
   *  22×14 aspect (simple rectangles). `viewBox 0 0 3 2` keeps it tidy.
   * --------------------------------------------------------------------- */
  const FLAGS = {
    fr:
      '<svg viewBox="0 0 3 2" width="22" height="14" aria-hidden="true">' +
        '<rect width="1" height="2" fill="#0055a4"/>' +
        '<rect x="1" width="1" height="2" fill="#fff"/>' +
        '<rect x="2" width="1" height="2" fill="#ef4135"/>' +
      '</svg>',
    en:
      '<svg viewBox="0 0 60 30" width="22" height="14" aria-hidden="true">' +
        '<clipPath id="lang-uk-clip"><rect width="60" height="30"/></clipPath>' +
        '<rect width="60" height="30" fill="#012169"/>' +
        '<g clip-path="url(#lang-uk-clip)">' +
          '<path d="M0,0 60,30 M60,0 0,30" stroke="#fff" stroke-width="6"/>' +
          '<path d="M0,0 60,30 M60,0 0,30" stroke="#C8102E" stroke-width="4"/>' +
          '<path d="M30,0 V30 M0,15 H60" stroke="#fff" stroke-width="10"/>' +
          '<path d="M30,0 V30 M0,15 H60" stroke="#C8102E" stroke-width="6"/>' +
        '</g>' +
      '</svg>'
  };

  /* -----------------------------------------------------------------------
   *  State
   * --------------------------------------------------------------------- */
  /* Pre-normalised dictionary (whitespace collapsed to single spaces) so the
     DOM-walker doesn't have to care about HTML indentation / line breaks. */
  const normWS = (s) => s.replace(/\s+/g, ' ').trim();
  const DICT_NORM = Object.create(null);
  for (const k in DICT) DICT_NORM[normWS(k)] = DICT[k];
  function lookup(original) {
    const trimmed = original.trim();
    if (DICT[trimmed] !== undefined) return DICT[trimmed];
    const normalised = normWS(original);
    if (DICT_NORM[normalised] !== undefined) return DICT_NORM[normalised];
    return undefined;
  }

  const nodeOriginals   = new WeakMap(); /* Text-node → original FR value */
  const attrOriginals   = new WeakMap(); /* Element  → { attrName: origValue } */
  /* Last value we wrote to a given attribute — lets the observer tell our
     own writes apart from external updates (e.g. main.js flipping the
     menuBtn aria-label between "Menu" and "Fermer"). */
  const selfSetAttrs    = new WeakMap(); /* Element  → { attrName: lastValueWeSet } */
  const ATTRS_TO_TRANSLATE = ['placeholder', 'aria-label', 'alt', 'title'];
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'svg']);
  let currentLang = 'fr';
  let originalDocTitle = null;
  let originalMetaDesc = null;
  let switchTarget = null; /* DOM element whose UI we update on lang change */
  let _translating = false; /* true while setLang is mutating the DOM */

  function detectInitialLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'fr' || stored === 'en') return stored;
    } catch (_) { /* localStorage may be blocked */ }
    const nav = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
    return nav.startsWith('fr') ? 'fr' : 'en';
  }

  /* -----------------------------------------------------------------------
   *  DOM walking + translation
   * --------------------------------------------------------------------- */
  function shouldSkip(node) {
    /* `node` is a text node; check its parent chain for excluded tags. */
    let p = node.parentNode;
    while (p && p.nodeType === 1) {
      if (SKIP_TAGS.has(p.tagName)) return true;
      /* SVG elements have tagName like 'svg' (lowercase in HTML but
         uppercase when HTML element). We uppercase-compare above; also
         handle namespaced SVG text by checking namespace. */
      if (p.namespaceURI && p.namespaceURI.indexOf('svg') !== -1) return true;
      p = p.parentNode;
    }
    return false;
  }

  function translateTextNode(node, lang) {
    if (shouldSkip(node)) return;
    if (!nodeOriginals.has(node)) nodeOriginals.set(node, node.nodeValue);
    const orig = nodeOriginals.get(node);
    const trimmed = orig.trim();
    if (!trimmed) return;
    if (lang === 'fr') {
      if (node.nodeValue !== orig) node.nodeValue = orig;
      return;
    }
    const translation = lookup(orig);
    let target;
    if (translation !== undefined) {
      const leadMatch  = orig.match(/^\s*/);
      const trailMatch = orig.match(/\s*$/);
      const lead  = leadMatch  ? leadMatch[0]  : '';
      const trail = trailMatch ? trailMatch[0] : '';
      target = lead + translation + trail;
    } else {
      /* No translation available → keep the French original. */
      target = orig;
    }
    /* Skip the assignment when the DOM already holds the desired string.
       Avoids firing redundant MutationObserver characterData records
       (which would otherwise re-enter this function in a tight loop). */
    if (node.nodeValue !== target) node.nodeValue = target;
  }

  function translateAttributes(el, lang) {
    if (!el || el.nodeType !== 1) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    let store = attrOriginals.get(el);
    for (const attr of ATTRS_TO_TRANSLATE) {
      if (!el.hasAttribute(attr)) continue;
      if (!store) { store = {}; attrOriginals.set(el, store); }
      if (!(attr in store)) store[attr] = el.getAttribute(attr);
      const orig = store[attr];
      const trimmed = (orig || '').trim();
      if (!trimmed) continue;
      if (lang === 'fr') {
        if (el.getAttribute(attr) !== orig) el.setAttribute(attr, orig);
        continue;
      }
      const translation = lookup(orig);
      let target;
      if (translation !== undefined) {
        const leadMatch  = orig.match(/^\s*/);
        const trailMatch = orig.match(/\s*$/);
        target = (leadMatch ? leadMatch[0] : '') + translation + (trailMatch ? trailMatch[0] : '');
      } else {
        target = orig;
      }
      if (el.getAttribute(attr) !== target) {
        let self = selfSetAttrs.get(el);
        if (!self) { self = {}; selfSetAttrs.set(el, self); }
        self[attr] = target;
        el.setAttribute(attr, target);
      }
    }
  }

  function walkAndTranslate(root, lang) {
    if (!root) return;
    if (root.nodeType === 3) { /* text node */
      translateTextNode(root, lang);
      return;
    }
    if (root.nodeType !== 1) return;
    if (SKIP_TAGS.has(root.tagName)) return;
    translateAttributes(root, lang);
    /* Use a TreeWalker for speed on large trees. */
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.nodeType === 1 && SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n = walker.nextNode();
    while (n) {
      if (n.nodeType === 3) translateTextNode(n, lang);
      else if (n.nodeType === 1) translateAttributes(n, lang);
      n = walker.nextNode();
    }
  }

  /* -----------------------------------------------------------------------
   *  Document-level bits: <title>, meta description, html lang
   * --------------------------------------------------------------------- */
  function translateDocumentChrome(lang) {
    if (originalDocTitle === null) originalDocTitle = document.title;
    if (lang === 'en') {
      const t = lookup(originalDocTitle);
      document.title = (t !== undefined) ? t : originalDocTitle;
    } else {
      document.title = originalDocTitle;
    }

    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (originalMetaDesc === null) originalMetaDesc = meta.getAttribute('content') || '';
      if (lang === 'en') {
        const t = lookup(originalMetaDesc);
        meta.setAttribute('content', (t !== undefined) ? t : originalMetaDesc);
      } else {
        meta.setAttribute('content', originalMetaDesc);
      }
    }

    document.documentElement.setAttribute('lang', lang);
  }

  /* -----------------------------------------------------------------------
   *  Language switcher UI — injected into the topbar.
   *
   *  Design: two pills "FR · EN" side by side. The active language is
   *  highlighted in gold, the inactive one is dimmed. Clicking an inactive
   *  pill switches to that language. Clicking the active one is a no-op.
   * --------------------------------------------------------------------- */
  function buildSwitcher() {
    if (document.getElementById('lang-switch')) return;
    const wrap = document.createElement('div');
    wrap.id = 'lang-switch';
    wrap.className = 'lang-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Language');
    wrap.innerHTML = [
      '<button type="button" class="lang-opt" data-lang="fr" aria-label="Français">FR</button>',
      '<span class="lang-sep" aria-hidden="true">·</span>',
      '<button type="button" class="lang-opt" data-lang="en" aria-label="English">EN</button>'
    ].join('');
    wrap.addEventListener('click', (e) => {
      const target = e.target.closest('[data-lang]');
      if (!target) return;
      const lang = target.getAttribute('data-lang');
      if (lang && lang !== currentLang) setLang(lang);
    });

    switchTarget = wrap;
    positionSwitcher();

    /* Re-position on resize because the desktop/mobile layouts differ. */
    let _rz;
    window.addEventListener('resize', () => {
      clearTimeout(_rz);
      _rz = setTimeout(positionSwitcher, 120);
    });
  }

  /* Desktop: the switcher lives as a direct child of `.topbar` (the outer
     <header>), not `.topbar-inner`. That way it can be absolutely
     positioned against the viewport's right edge — well outside the
     centred `.container` — so it sits clearly isolated from the rest of
     the header.
     Mobile: we re-parent it inside the CTA wrapper, next to the hamburger,
     keeping the header compact. */
  function positionSwitcher() {
    if (!switchTarget) return;
    const topbar = document.querySelector('.topbar');
    const inner  = document.querySelector('.topbar-inner');
    if (!topbar || !inner) { document.body.appendChild(switchTarget); return; }
    const isMobile = window.matchMedia('(max-width: 960px)').matches;
    const menuBtn = document.getElementById('menuBtn');
    if (isMobile && menuBtn && menuBtn.parentNode) {
      if (switchTarget.parentNode !== menuBtn.parentNode
          || switchTarget.nextElementSibling !== menuBtn) {
        menuBtn.parentNode.insertBefore(switchTarget, menuBtn);
      }
    } else {
      if (switchTarget.parentNode !== topbar
          || topbar.lastElementChild !== switchTarget) {
        topbar.appendChild(switchTarget);
      }
    }
  }

  function updateSwitcherUI() {
    if (!switchTarget) return;
    switchTarget.querySelectorAll('.lang-opt').forEach((btn) => {
      const active = btn.getAttribute('data-lang') === currentLang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  /* -----------------------------------------------------------------------
   *  Public entry point
   * --------------------------------------------------------------------- */
  function setLang(lang) {
    currentLang = (lang === 'en') ? 'en' : 'fr';
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (_) {}
    /* Suspend the MutationObserver while we translate the DOM: otherwise
       each nodeValue assignment below would trigger a characterData record
       that we'd re-process on the next microtask, producing a visible
       flicker and — worse — a runaway feedback loop on some browsers. */
    _translating = true;
    try {
      translateDocumentChrome(currentLang);
      if (document.body) walkAndTranslate(document.body, currentLang);
    } finally {
      _translating = false;
    }
    updateSwitcherUI();
  }

  /* -----------------------------------------------------------------------
   *  MutationObserver: re-translate dynamically injected content.
   * --------------------------------------------------------------------- */
  function setupObserver() {
    if (!('MutationObserver' in window) || !document.body) return;
    const obs = new MutationObserver((mutations) => {
      /* While `setLang` is mutating the DOM on purpose, ignore the records
         it generates — we're already translating everything synchronously. */
      if (_translating) return;
      if (currentLang === 'fr') return; /* Nothing to do in FR mode */
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => walkAndTranslate(n, currentLang));
        } else if (m.type === 'characterData') {
          translateTextNode(m.target, currentLang);
        } else if (m.type === 'attributes' && m.target && ATTRS_TO_TRANSLATE.indexOf(m.attributeName) !== -1) {
          const el = m.target;
          const attr = m.attributeName;
          const currentVal = el.getAttribute(attr);
          const self = selfSetAttrs.get(el);
          /* Ignore the mutation we triggered ourselves. */
          if (self && self[attr] === currentVal) continue;
          /* External update → treat this as the fresh French original so
             switching back to FR will restore it faithfully. */
          let store = attrOriginals.get(el);
          if (!store) { store = {}; attrOriginals.set(el, store); }
          store[attr] = currentVal == null ? '' : currentVal;
          translateAttributes(el, currentLang);
        }
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS_TO_TRANSLATE
    });
  }

  /* -----------------------------------------------------------------------
   *  Boot
   * --------------------------------------------------------------------- */
  function boot() {
    currentLang = detectInitialLang();
    buildSwitcher();
    setupObserver();
    setLang(currentLang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Expose a tiny API for debugging / manual override from console. */
  window.MSCommI18n = {
    setLang,
    getLang: () => currentLang,
    dict: DICT
  };
})();
