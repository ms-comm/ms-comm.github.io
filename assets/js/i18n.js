/* =========================================================================
 *  MS Comm' — Internationalization (i18n)
 *  -----------------------------------------------------------------------
 *  Strategy:
 *   - Default language: French (fr).
 *   - If user has no saved preference AND browser language ≠ French → English.
 *   - Persistence: localStorage `mscomm_lang`.
 *   - Translation hooks in markup:
 *       <x data-i18n="key">                  → sets textContent from dict
 *       <x data-i18n-html="key">             → sets innerHTML (keeps <span class="gold"> etc.)
 *       <x data-i18n-attr="placeholder:key"> → sets an attribute (comma-separated
 *                                              list allowed: "placeholder:k1,title:k2")
 *   - A small flag switcher is auto-injected into the top-right of the
 *     navbar (before the mobile menu button on every page).
 *   - `window.i18n.t('key')` can be called from other scripts.
 *   - `lang-switch:change` CustomEvent fires on `window` after every switch.
 * =======================================================================*/
(function () {
  'use strict';

  const LS_KEY = 'mscomm_lang';

  const DICT = {
    fr: {
      /* ---------- NAV & SHARED ---------- */
      'brand.sub': 'Prestataire de services de communication',
      'nav.home': 'Accueil',
      'nav.experiences': 'Expériences',
      'nav.services': 'Services',
      'nav.portfolio': 'Portfolio',
      'nav.photos': 'Photographie',
      'nav.contact': 'Contact',
      'nav.cta': 'Demander un devis',
      'nav.menu_aria': 'Menu',
      'footer.copy': '© {year} MS Comm\' — Melody. Tous droits réservés.',
      'footer.copy_short': '© {year} MS Comm\' — Tous droits réservés',
      'scroll_top.aria': 'Retour en haut',
      'lang.switch_to': 'Switch to English',

      /* ---------- INDEX ---------- */
      'home.hero.label': 'Melody',
      'home.hero.quote': '<span class="gold">Votre image,</span> notre mission.<br><span class="gold">Votre histoire,</span> notre création.',
      'home.hero.sub': 'Réseaux sociaux, montage vidéo, photographie, identité visuelle, événementiel… Je vous accompagne pour faire briller votre univers.',
      'home.hero.btn_services': 'Découvrir mes services',
      'home.hero.btn_contact': 'Parlons de votre projet',
      'home.stat1.n': '4+',
      'home.stat1.l': 'Années d\'expérience',
      'home.stat2.n': '6',
      'home.stat2.l': 'Projets marquants',
      'home.stat3.n': '24h / 48h',
      'home.stat3.l': 'Réactivité',
      'home.stat4.n': '100%',
      'home.stat4.l': 'Créativité & passion',
      'home.about.title': 'Bienvenue chez <span class="gold">MS Comm\'</span>',
      'home.about.p1': 'Je suis Melody. Depuis 4 ans, j\'accompagne marques, clubs de sport, athlètes et entrepreneurs à développer une communication qui leur ressemble et qui attire leur audience.',
      'home.about.p2': 'Passionnée de création, je mets mon expertise au service de votre image pour vous aider à vous démarquer et à faire grandir vos projets.',
      'home.about.p3': 'Mon objectif ? Vous faire briller, quel que soit votre univers : sport, musique, restauration, beauté…',
      'home.about.p4': 'Et j\'ai à cœur de construire des collaborations durables, basées sur la confiance et des résultats concrets.',
      'home.skill1': 'Réseaux sociaux',
      'home.skill2': 'Montage vidéo',
      'home.skill3': 'Photographie',
      'home.skill4': 'Identité visuelle',
      'home.skill5': 'Création de contenu',
      'home.skill6': 'Événementiel',
      'home.exp.title': 'Mes <span class="gold">Expériences</span>',
      'home.exp.sub': '4 ans de projets dans le sport, les médias, et l\'événementiel.',
      'home.exp1.role': 'Auto-entrepreneur',
      'home.exp1.company': 'MS Comm\'',
      'home.exp1.dates': 'août 2025 — aujourd\'hui',
      'home.exp1.desc': 'Prestations de communication : templates, chartes graphiques, réseaux sociaux, photos et vidéos.',
      'home.exp2.role': 'Responsable communication marketing',
      'home.exp2.company': 'Paris 13 Tennis de Table',
      'home.exp2.dates': 'juin 2024 — aujourd\'hui · 1 an 10 mois',
      'home.exp2.desc': 'Pilotage de la communication digitale et globale du club : gestion des réseaux sociaux, création de contenus engageants (matchs, compétitions, événements). Développement de partenariats et actions de sponsoring.',
      'home.exp3.role': 'Community Manager',
      'home.exp3.company': 'Alexis Lebrun · Top 20 mondial',
      'home.exp3.dates': 'oct. 2021 — août 2023',
      'home.exp3.desc': 'Page professionnelle d\'un pongiste de haut niveau. Création de contenu, photographie, rédaction.',
      'tag.social_media': 'Réseaux sociaux',
      'tag.visual_identity': 'Identité visuelle',
      'tag.content_creation': 'Création de contenu',
      'tag.photo_video_prod': 'Production photo/vidéo',
      'tag.events': 'Événementiel',
      'tag.sponsoring': 'Sponsoring',
      'tag.video_editing': 'Montage vidéo',
      'tag.sport_coverage': 'Couverture sportive',
      'tag.community_mgmt': 'Community management',
      'tag.brand_image': 'Image de marque',
      'tag.interviews': 'Interviews',
      'tag.event_coverage': 'Couverture événementielle',
      'tag.video_creation': 'Création vidéo',
      'tag.article_writing': 'Rédaction d\'articles',
      'tag.layout': 'Mise en page',
      'tag.editorial_line': 'Ligne éditoriale',
      'tag.distribution': 'Gestion de diffusion',
      'tag.content_prod': 'Production de contenu',
      'tag.photography': 'Photographie',
      'tag.comm_service': 'Prestation de service de communication',
      'home.exp.view_all': 'Voir toutes mes expériences →',
      'home.portfolio.title': 'Mes <span class="gold">Réalisations</span>',
      'home.portfolio.sub': 'Affiches, posts, articles, journaux, vidéos — un aperçu de mon travail.',
      'home.preview1.title': 'Paris 13 Tennis de Table',
      'home.preview1.desc': 'Affiches de matchs, stories, contenus jour de compétition et réseaux sociaux.',
      'home.preview2.title': 'Alexis Lebrun',
      'home.preview2.desc': 'Communication digitale, vidéos, visuels et couverture sportive d\'un athlète olympique.',
      'home.preview3.title': 'MS Comm\' — Créations',
      'home.preview3.desc': 'Affiches, flyers, cartes de visite et identité visuelle pour divers clients.',
      'home.preview.link': 'Voir le projet →',
      'home.portfolio.view_all': 'Voir tout le portfolio →',
      'home.services.title': 'Ce que je <span class="gold">propose</span>',
      'home.services.sub': 'Templates, chartes graphiques, flyers, affiches, photos, réels, gestion de réseaux sociaux… <br>Des solutions adaptées à chaque univers.',
      'home.service1.name': 'À la carte',
      'home.service1.price': 'dès 10€',
      'home.service1.note': 'par prestation',
      'home.service1.l1': 'Template Story / Publication',
      'home.service1.l2': 'Photographie',
      'home.service1.l3': 'Montage vidéo',
      'home.service1.l4': 'Création d\'affiches',
      'home.service2.name': 'Packs de lancement',
      'home.service2.price': 'dès 95€',
      'home.service2.note': 'par pack',
      'home.service2.l1': 'Pack Réseaux Sociaux Starter',
      'home.service2.l2': 'Pack Réseaux Sociaux Boost',
      'home.service2.l3': 'Pack Identité Visuelle',
      'home.service3.name': 'Packs spéciaux',
      'home.service3.price': 'dès 170€',
      'home.service3.note': 'par univers',
      'home.service3.l1': 'Pack Sportif',
      'home.service3.l2': 'Pack Beauté / Bien-être',
      'home.service3.l3': 'Pack Restaurant',
      'home.service3.l4': 'Pack Événement',
      'btn.learn_more': 'En savoir plus',
      'home.testimonials.title': 'Ils m\'ont fait <span class="gold">confiance</span>',
      'home.testimonials.sub1': 'Des retours clients authentiques.',
      'home.testimonials.sub2': 'Leurs mots, ma plus belle carte de visite.',
      'home.testimonials.controls_aria': 'Contrôles des avis',
      'home.testimonials.prev_aria': 'Avis précédent',
      'home.testimonials.next_aria': 'Avis suivant',
      'home.testimonials.rail_aria': 'Avis clients, défilement horizontal',
      'home.cta.title': 'Prêt·e à <span class="gold">briller</span> ?',
      'home.cta.sub': 'Décrivez votre projet et je vous répondrai rapidement. Ensemble, faisons rayonner votre image.',
      'btn.contact_me': 'Me contacter',
      'btn.follow_instagram': 'Suivre sur Instagram',

      /* ---------- SERVICES ---------- */
      'services.page.title': 'Services & <span class="gold">Tarifs</span>',
      'services.page.sub': 'Des solutions adaptées à chaque univers — sport, musique, restauration, beauté et plus encore.',
      'services.carte.title': 'Prestations <span class="gold">à la carte</span>',
      'services.carte.sub': 'Des créations rapides et accessibles, en toute cohérence visuelle.',
      'services.card.social': 'Réseaux Sociaux',
      'services.card.identity': 'Identité Visuelle',
      'services.card.print': 'Supports à imprimer',
      'services.card.photos': 'Photographies',
      'services.photos.note': 'Toutes les photos sont livrées retouchées',
      'services.tpl_story': 'Template Story*',
      'services.tpl_pub': 'Template Publication*',
      'services.reel': 'Montage vidéo (type réels)',
      'services.charter': 'Charte graphique',
      'services.bcard_front': 'Carte de visite recto',
      'services.bcard_back': '+ verso',
      'services.poster': 'Création d\'affiches / flyers',
      'services.menu_card': 'Carte de restaurant ou de prestations',
      'services.loyalty': 'Carte de fidélité',
      'services.rollup': 'Roll up',
      'services.photos1': '1 photo',
      'services.photos10': '10 photos',
      'services.photos20': '20 photos ou plus',
      'services.photos20_price': '10€ / unité',
      'services.footnote_1': '*Personnalisation par MS Comm\' en supplément.<br>Tarifs indiqués hors frais d\'impression et de déplacement — voir CGV.',
      'services.launch.title': 'Packs de <span class="gold">lancement</span>',
      'services.launch.sub': 'Plus d\'impact, moins de budget — démarrez fort.',
      'services.pack_full': 'pack complet',
      'services.pack_starter': 'Pack Réseaux Sociaux Starter',
      'services.pack_starter_l1': '1 template story*',
      'services.pack_starter_l2': '1 template publication',
      'services.pack_starter_l3': '1 montage vidéo type réel',
      'services.pack_boost': 'Pack Réseaux Sociaux Boost',
      'services.pack_boost_l1': '3 templates story*',
      'services.pack_boost_l2': '2 templates publications*',
      'services.pack_boost_l3': '2 montages vidéo type réels',
      'services.pack_identity': 'Pack Identité Visuelle',
      'services.pack_identity_l1': 'Carte de visite recto',
      'services.pack_identity_l2': '1 template publication',
      'services.pack_identity_l3': 'Charte graphique complète',
      'services.btn.choose': 'Choisir ce pack',
      'services.special.title': 'Packs <span class="gold">spéciaux</span>',
      'services.special.sub': 'Votre univers, sur mesure — faites briller chaque projet.',
      'services.per_pack': 'par pack',
      'services.pack_sport': 'Pack Sportif',
      'services.pack_sport_l1': '1 template story* Compétition',
      'services.pack_sport_l2': '1 template Story Matchs',
      'services.pack_sport_l3': '1 Publication Récap',
      'services.pack_sport_l4': '3 montages type réel',
      'services.pack_beauty': 'Pack Beauté & Bien-être',
      'services.pack_beauty_l1': 'Carte de prestations',
      'services.pack_beauty_l2': '2 templates Story',
      'services.pack_beauty_l3': '1 Publication',
      'services.pack_beauty_l4': '1 Montage vidéo type réel',
      'services.pack_resto': 'Pack Restauration',
      'services.pack_resto_l1': 'Carte de restaurant',
      'services.pack_resto_l2': '1 carte de fidélité',
      'services.pack_resto_l3': '1 Template Story*',
      'services.pack_event': 'Pack Événement',
      'services.pack_event_l1': 'Affiche ou flyer',
      'services.pack_event_l2': '1 Story vidéo ou réel',
      'services.footnote_2': '*Personnalisation par MS Comm\' en supplément.<br>Personnalisation de packs possible : remplacez un élément du pack par un autre service équivalent.<br>Tarifs indiqués hors frais d\'impression et de déplacement — voir CGV.',
      'services.premium.title': 'Accompagnement <span class="gold">sur mesure</span>',
      'services.premium.sub': 'Gestion de réseaux sociaux, stratégie de contenu, reporting mensuel.',
      'services.premium.name': 'Accompagnement Premium',
      'services.premium.price': 'Sur devis',
      'services.premium.note': 'engagement mensuel',
      'services.premium.l1': 'Gestion complète des réseaux sociaux',
      'services.premium.l2': 'Stratégie éditoriale mensuelle',
      'services.premium.l3': 'Création de contenus (posts, stories, réels)',
      'services.premium.l4': 'Accompagnement & conseils personnalisés',
      'services.premium.l5': 'Disponibilité et réactivité',
      'services.premium.btn': 'Demander un devis personnalisé',
      'services.q.title': 'Une question ?',
      'services.q.sub': 'Tarifs indicatifs et personnalisables — contactez-moi pour un devis sur mesure.',
      'btn.view_portfolio': 'Voir mes réalisations',

      /* ---------- EXPERIENCES ---------- */
      'exp.page.title': 'Mes <span class="gold">Expériences</span>',
      'exp.page.sub': '4 ans de projets marquants dans le sport, les médias et l\'événementiel.',
      'exp.mscomm.role': 'Auto-entrepreneur',
      'exp.mscomm.dates': 'août 2025 — aujourd\'hui',
      'exp.mscomm.l1': 'Templates, cartes de visite, cartes de fidélité, chartes graphiques, flyers, affiches, carte de restaurant, photos, réels…',
      'exp.mscomm.l2': 'Projets d\'accompagnement sur le long terme comme la gestion de réseaux sociaux',
      'exp.mscomm.l3': 'Vous faire briller, quel que soit votre univers : sport, musique, restauration, beauté…',
      'exp.p13.role': 'Responsable communication marketing',
      'exp.p13.dates': 'juin 2024 — aujourd\'hui · 1 an 10 mois',
      'exp.p13.l1': 'Pilotage de la communication digitale et globale du club : gestion des réseaux sociaux, création de contenus engageants (matchs, compétitions, événements)',
      'exp.p13.l2': 'Développement de partenariats et actions de sponsoring',
      'exp.p13.l3': 'Contribution à l\'organisation d\'événements et mise en place d\'une stratégie de communication pour renforcer la visibilité et l\'image du club',
      'exp.pp.role': 'Alternante',
      'exp.pp.company': 'Ping Pang Paris',
      'exp.pp.dates': 'sept. 2023 — août 2025 · 2 ans',
      'exp.pp.l1': 'Production de contenus à forte valeur ajoutée : interviews, montage vidéo et couverture des compétitions sportives',
      'exp.pp.l2': 'Suivi des événements internationaux et création de contenus adaptés pour valoriser les performances et l\'image du club',
      'exp.pp.l3': 'Contribution à une communication réactive et immersive autour des temps forts sportifs',
      'exp.pongi.role': 'Communication',
      'exp.pongi.dates': 'janv. 2023 — mars 2024 · 1 an 3 mois',
      'exp.pongi.l1': 'Couverture terrain d\'événements et compétitions telles que les Championnats de France avec production de contenus en temps réel',
      'exp.pongi.l2': 'Création de formats vidéo engageants (Reels Instagram) et montage dynamique adapté aux réseaux sociaux',
      'exp.pongi.l3': 'Mise en place d\'une communication réactive visant à valoriser les moments clés et renforcer l\'impact des événements',
      'exp.jdp.role': 'Créatrice et Rédactrice de journal',
      'exp.jdp.company': 'Le Journal du Pongiste',
      'exp.jdp.dates': 'août 2022 — juil. 2023 · 1 an',
      'exp.jdp.l1': 'Conception et développement d\'un journal mensuel dédié à l\'actualité du tennis de table français',
      'exp.jdp.l2': 'Production de contenus à forte valeur ajoutée : rédaction d\'articles, interviews et mise en page éditoriale',
      'exp.jdp.l3': 'Pilotage de la diffusion et gestion de la ligne éditoriale pour assurer cohérence et qualité des contenus',
      'exp.jdp.read': 'Lire les articles →',
      'exp.fp.role': 'Responsable Réseaux sociaux',
      'exp.fp.company': 'French Ping',
      'exp.fp.dates': 'févr. 2022 — août 2023 · 1 an 7 mois',
      'exp.fp.l1': 'Gestion et animation de la page Instagram',
      'exp.fp.l2': 'Création de contenus visuels et vidéos (montage, photographie) adaptés aux réseaux sociaux',
      'exp.fp.l3': 'Contribution au développement de la visibilité et de l\'engagement de la communauté',
      'exp.al.role': 'Community Manager',
      'exp.al.company': 'Alexis Lebrun',
      'exp.al.dates': 'oct. 2021 — août 2023 · 1 an 11 mois',
      'exp.al.l1': 'Pilotage de la communication digitale d\'un athlète de haut niveau, médaillé olympique',
      'exp.al.l2': 'Production de contenus : vidéos, visuels…',
      'exp.al.l3': 'Couverture des compétitions et gestion de la communauté, avec un objectif de valorisation de l\'image et des performances sportives',
      'exp.cta.title': 'Envie de <span class="gold">collaborer</span> ?',
      'exp.cta.sub': 'Découvrez mes services ou contactez-moi pour discuter de votre projet.',
      'btn.view_services': 'Voir mes services',

      /* ---------- PORTFOLIO ---------- */
      'pf.page.title': 'Mon <span class="gold">Portfolio</span>',
      'pf.page.sub': 'Affiches, posts, articles, journaux, vidéos — une sélection de mes réalisations.',
      'pf.mscomm.title': 'MS Comm\' — <span class="gold">Créations</span>',
      'pf.mscomm.sub': 'Affiches, flyers, cartes de visite, identité visuelle.',
      'pf.tag.visual': 'Création visuelle',
      'pf.tag.template_pub': 'Template Publication',
      'pf.tag.poster': 'Affiche',
      'pf.bcard.title': 'Carte de <span class="gold">visite</span>',
      'pf.alexis.title': 'Alexis <span class="gold">Lebrun</span>',
      'pf.alexis.sub': 'Community management pour un pongiste pro — médaillé olympique.',
      'pf.tag.template_story': 'Template Story',
      'pf.tag.creation': 'Création',
      'pf.tag.interview_pub': 'Publication Interview',
      'pf.reels.title': 'Réels',
      'pf.tag.shoot_edit': 'Tournage & montage vidéo',
      'pf.sub.training': 'Entrainement',
      'pf.sub.trickshot': 'Trickshot',
      'pf.tag.video_edit': 'Montage vidéo',
      'pf.sub.competition': 'Compétition',
      'pf.p13.title': 'Paris 13 <span class="gold">Tennis de Table</span>',
      'pf.p13.sub': 'Affiches de matchs, stories, contenus jour de compétition.',
      'pf.tag.match_poster': 'Affiche de match',
      'pf.tag.rollup': 'Roll-up',
      'pf.sub.highlights': 'Temps forts',
      'pf.creator.title': 'Créatrice de <span class="gold">contenu</span>',
      'pf.creator.sub': 'Lifestyle, beauté & matcha • Création de contenu & collaborations.',
      'pf.tag.collab': 'Collaboration commerciale',
      'pf.tag.invitation': 'Invitation',
      'pf.sub.19': 'Le 19ème (brunch à Montpellier)',
      'pf.pongi.title': '<span class="gold">Pongistic</span>',
      'pf.pongi.sub': 'Tournage et montage vidéo, contenus dynamiques pour les réseaux.',
      'pf.tag.interview': 'Interview',
      'pf.sub.cdf': 'Championnats de France',
      'pf.tag.interview_vol': 'Interview Bénévoles',
      'pf.sub.shoot_edit': 'Tournage et montage',
      'pf.tag.reel': 'Réel',
      'pf.sub.comp_immersion': 'Immersion compétition',
      'pf.pingpang.title': 'Ping Pang <span class="gold">Effect</span>',
      'pf.pingpang.sub': 'Articles, posts historiques, contenu éditorial et rédaction.',
      'pf.pingpang.article1': 'Article - Alexis Lebrun, 1er français à remporter 2 titres de Champion d\'Europe sur la même édition',
      'pf.pingpang.article2': 'Article - La France candidate pour accueillir les Championnats du Monde 2027',
      'pf.pingpang.article3': 'Interview - L\'inspirante histoire de Tigran Tsitoghdzyan',
      'pf.jdp.title': 'Le Journal du <span class="gold">Pongiste</span>',
      'pf.jdp.sub': 'Journal mensuel récapitulant l\'actualité du tennis de table français.',
      'pf.jdp.read': '→ Lire les 12 éditions',
      'pf.tag.cover_jan': 'Couverture - Janvier 2023',
      'pf.tag.excerpt': 'Extrait',
      'pf.photo.title': '<span class="gold">Photographie</span>',
      'pf.photo.sub': 'Découvrez mes photos et retouches.',
      'pf.tag.photography': 'Photographie',
      'pf.sub.sport': 'Sport',
      'pf.sub.landscape': 'Paysage',
      'pf.photo.see_gallery': 'Voir la galerie photo complète →',

      /* ---------- CONTACT ---------- */
      'contact.page.title': 'Me <span class="gold">Contacter</span>',
      'contact.page.sub': 'Et si on écrivait la suite ensemble ? <br>Décrivez votre projet et je vous répondrai rapidement.',
      'contact.info.title': 'Discutons de votre <span class="gold">projet</span>',
      'contact.info.text': 'Que vous ayez besoin d\'un visuel ponctuel, d\'un pack complet ou d\'un accompagnement sur le long terme, je suis là pour vous aider à briller. <br>N\'hésitez pas à me contacter !',
      'contact.form.title': 'Envoyer un message',
      'contact.form.name': 'Nom',
      'contact.form.name_ph': 'Votre nom',
      'contact.form.email': 'Email',
      'contact.form.subject': 'Sujet',
      'contact.form.subject_ph': 'Ex : Demande de devis Pack Sportif',
      'contact.form.message': 'Message',
      'contact.form.message_ph': 'Décrivez votre projet, vos objectifs, délais et budget estimé...',
      'contact.form.send': 'Envoyer le message',
      'contact.bcard.title': 'Ma carte de <span class="gold">visite</span>',
      'contact.social.title': 'Suivez <span class="gold">MS Comm\'</span>',
      'contact.social.sub': 'Retrouvez mes dernières créations et actualités sur les réseaux sociaux.',

      /* ---------- PHOTOS ---------- */
      'photos.page.title': 'Galerie <span class="gold">Photo</span>',
      'photos.page.sub': 'Photographies sportives, portraits et moments d\'exception.',
      'photos.tab.gallery': 'Galerie',
      'photos.tab.albums': 'Albums',
      'photos.private': 'Album privé',
      'photos.search_ph': 'Rechercher une photo ou un album...',
      'photos.all_albums': 'Tous les albums',
      'photos.no_album': 'Sans album',
      'photos.back_albums': 'Tous les albums',
      'photos.empty_albums': 'Aucun album disponible.',
      'photos.empty_timeline': 'Aucune photo publique pour l\'instant.',
      'photos.modal.title': 'Album privé',
      'photos.modal.help': 'Entrez le code reçu par email pour accéder à votre galerie.',
      'photos.modal.cancel': 'Annuler',
      'photos.modal.access': 'Accéder',
      'photos.lb.share': 'Partager',
      'photos.lb.download': 'Télécharger',
      'photos.cart.title': 'Panier',
      'photos.print.title': 'Commander une impression',
      'photos.print.note': 'Cette fonctionnalité est en cours de développement. Pour commander, contactez-nous en précisant la photo souhaitée.',
      'photos.print.contact': 'Contacter MS Comm\'',
      'photos.offline': 'Le serveur photo n\'est pas disponible — démarrez node server.js dans photo-server/.',

      /* ---------- CHECKOUT ---------- */
      'co.back': 'Retour à la galerie',
      'co.title': 'Récapitulatif & <span class="gold">Paiement</span>',
      'co.success.title': 'Commande reçue !',
      'co.success.email': 'Un email contenant votre lien de téléchargement vous a été envoyé.',
      'co.success.download': 'Télécharger mes photos (.zip)',
      'co.success.back': '← Retour à la galerie',
      'co.form.contact': 'Vos coordonnées',
      'co.form.first': 'Prénom',
      'co.form.last': 'Nom',
      'co.form.email': 'Email *',
      'co.form.phone': 'Téléphone',
      'co.pay.title': 'Paiement',
      'co.pay.card': 'Carte bancaire',
      'co.pay.secure': 'Paiement sécurisé — Stripe, chiffrement SSL 256 bits',
      'co.pay.btn': 'Payer',
      'co.summary': 'Votre sélection'
    },

    en: {
      /* ---------- NAV & SHARED ---------- */
      'brand.sub': 'Communication services provider',
      'nav.home': 'Home',
      'nav.experiences': 'Experience',
      'nav.services': 'Services',
      'nav.portfolio': 'Portfolio',
      'nav.photos': 'Photography',
      'nav.contact': 'Contact',
      'nav.cta': 'Request a quote',
      'nav.menu_aria': 'Menu',
      'footer.copy': '© {year} MS Comm\' — Melody. All rights reserved.',
      'footer.copy_short': '© {year} MS Comm\' — All rights reserved',
      'scroll_top.aria': 'Back to top',
      'lang.switch_to': 'Passer en français',

      /* ---------- INDEX ---------- */
      'home.hero.label': 'Melody',
      'home.hero.quote': '<span class="gold">Your image,</span> our mission.<br><span class="gold">Your story,</span> our creation.',
      'home.hero.sub': 'Social media, video editing, photography, visual identity, events… I help you bring your world to life.',
      'home.hero.btn_services': 'Discover my services',
      'home.hero.btn_contact': 'Let\'s talk about your project',
      'home.stat1.n': '4+',
      'home.stat1.l': 'Years of experience',
      'home.stat2.n': '6',
      'home.stat2.l': 'Flagship projects',
      'home.stat3.n': '24h / 48h',
      'home.stat3.l': 'Turnaround time',
      'home.stat4.n': '100%',
      'home.stat4.l': 'Creativity & passion',
      'home.about.title': 'Welcome to <span class="gold">MS Comm\'</span>',
      'home.about.p1': 'I\'m Melody. For 4 years I\'ve been helping brands, sports clubs, athletes and entrepreneurs build a communication that truly reflects them and attracts their audience.',
      'home.about.p2': 'Passionate about creation, I put my expertise at the service of your image to help you stand out and grow your projects.',
      'home.about.p3': 'My goal? To make you shine, whatever your field: sport, music, food, beauty…',
      'home.about.p4': 'And I love building long-lasting collaborations, based on trust and concrete results.',
      'home.skill1': 'Social media',
      'home.skill2': 'Video editing',
      'home.skill3': 'Photography',
      'home.skill4': 'Visual identity',
      'home.skill5': 'Content creation',
      'home.skill6': 'Events',
      'home.exp.title': 'My <span class="gold">Experience</span>',
      'home.exp.sub': '4 years of projects in sport, media and events.',
      'home.exp1.role': 'Founder — Freelance',
      'home.exp1.company': 'MS Comm\'',
      'home.exp1.dates': 'Aug 2025 — present',
      'home.exp1.desc': 'Communication services: templates, brand guidelines, social media, photos and videos.',
      'home.exp2.role': 'Head of Marketing Communication',
      'home.exp2.company': 'Paris 13 Tennis de Table',
      'home.exp2.dates': 'Jun 2024 — present · 1 yr 10 mo',
      'home.exp2.desc': 'Driving the club\'s digital and global communication: social media management, engaging content (matches, competitions, events). Partnership & sponsorship development.',
      'home.exp3.role': 'Community Manager',
      'home.exp3.company': 'Alexis Lebrun · World Top 20',
      'home.exp3.dates': 'Oct 2021 — Aug 2023',
      'home.exp3.desc': 'Pro account of a top-level table tennis player. Content creation, photography, copywriting.',
      'tag.social_media': 'Social media',
      'tag.visual_identity': 'Visual identity',
      'tag.content_creation': 'Content creation',
      'tag.photo_video_prod': 'Photo/video production',
      'tag.events': 'Events',
      'tag.sponsoring': 'Sponsorship',
      'tag.video_editing': 'Video editing',
      'tag.sport_coverage': 'Sports coverage',
      'tag.community_mgmt': 'Community management',
      'tag.brand_image': 'Brand image',
      'tag.interviews': 'Interviews',
      'tag.event_coverage': 'Event coverage',
      'tag.video_creation': 'Video creation',
      'tag.article_writing': 'Article writing',
      'tag.layout': 'Layout design',
      'tag.editorial_line': 'Editorial direction',
      'tag.distribution': 'Distribution management',
      'tag.content_prod': 'Content production',
      'tag.photography': 'Photography',
      'tag.comm_service': 'Communication services',
      'home.exp.view_all': 'View all my experience →',
      'home.portfolio.title': 'My <span class="gold">Work</span>',
      'home.portfolio.sub': 'Posters, posts, articles, magazines, videos — a glimpse of my work.',
      'home.preview1.title': 'Paris 13 Tennis de Table',
      'home.preview1.desc': 'Match posters, stories, match-day content and social media.',
      'home.preview2.title': 'Alexis Lebrun',
      'home.preview2.desc': 'Digital communication, videos, visuals and sports coverage of an Olympic athlete.',
      'home.preview3.title': 'MS Comm\' — Creations',
      'home.preview3.desc': 'Posters, flyers, business cards and visual identity for various clients.',
      'home.preview.link': 'View project →',
      'home.portfolio.view_all': 'View full portfolio →',
      'home.services.title': 'What I <span class="gold">offer</span>',
      'home.services.sub': 'Templates, brand guidelines, flyers, posters, photos, reels, social media management… <br>Solutions tailored to every field.',
      'home.service1.name': 'À la carte',
      'home.service1.price': 'from €10',
      'home.service1.note': 'per service',
      'home.service1.l1': 'Story / Post template',
      'home.service1.l2': 'Photography',
      'home.service1.l3': 'Video editing',
      'home.service1.l4': 'Poster design',
      'home.service2.name': 'Launch packs',
      'home.service2.price': 'from €95',
      'home.service2.note': 'per pack',
      'home.service2.l1': 'Social Media Starter Pack',
      'home.service2.l2': 'Social Media Boost Pack',
      'home.service2.l3': 'Visual Identity Pack',
      'home.service3.name': 'Themed packs',
      'home.service3.price': 'from €170',
      'home.service3.note': 'per field',
      'home.service3.l1': 'Sports Pack',
      'home.service3.l2': 'Beauty / Wellness Pack',
      'home.service3.l3': 'Restaurant Pack',
      'home.service3.l4': 'Event Pack',
      'btn.learn_more': 'Learn more',
      'home.testimonials.title': 'They trust <span class="gold">my work</span>',
      'home.testimonials.sub1': 'Authentic client feedback.',
      'home.testimonials.sub2': 'Their words, my finest business card.',
      'home.testimonials.controls_aria': 'Reviews controls',
      'home.testimonials.prev_aria': 'Previous review',
      'home.testimonials.next_aria': 'Next review',
      'home.testimonials.rail_aria': 'Client reviews, horizontal scroll',
      'home.cta.title': 'Ready to <span class="gold">shine</span>?',
      'home.cta.sub': 'Tell me about your project and I\'ll reply quickly. Together, let\'s make your image radiate.',
      'btn.contact_me': 'Contact me',
      'btn.follow_instagram': 'Follow on Instagram',

      /* ---------- SERVICES ---------- */
      'services.page.title': 'Services & <span class="gold">Rates</span>',
      'services.page.sub': 'Solutions tailored to every field — sport, music, food, beauty and more.',
      'services.carte.title': 'À la carte <span class="gold">services</span>',
      'services.carte.sub': 'Quick, accessible creations — always on brand.',
      'services.card.social': 'Social Media',
      'services.card.identity': 'Visual Identity',
      'services.card.print': 'Print materials',
      'services.card.photos': 'Photography',
      'services.photos.note': 'All photos are delivered retouched',
      'services.tpl_story': 'Story template*',
      'services.tpl_pub': 'Post template*',
      'services.reel': 'Video edit (reel-style)',
      'services.charter': 'Brand guidelines',
      'services.bcard_front': 'Business card (front)',
      'services.bcard_back': '+ back',
      'services.poster': 'Poster / flyer design',
      'services.menu_card': 'Restaurant or services menu',
      'services.loyalty': 'Loyalty card',
      'services.rollup': 'Roll up',
      'services.photos1': '1 photo',
      'services.photos10': '10 photos',
      'services.photos20': '20 photos or more',
      'services.photos20_price': '€10 / unit',
      'services.footnote_1': '*Customization by MS Comm\' is an add-on.<br>Prices exclude printing and travel expenses — see T&Cs.',
      'services.launch.title': 'Launch <span class="gold">packs</span>',
      'services.launch.sub': 'More impact, less budget — start strong.',
      'services.pack_full': 'complete pack',
      'services.pack_starter': 'Social Media Starter Pack',
      'services.pack_starter_l1': '1 story template*',
      'services.pack_starter_l2': '1 post template',
      'services.pack_starter_l3': '1 reel-style video edit',
      'services.pack_boost': 'Social Media Boost Pack',
      'services.pack_boost_l1': '3 story templates*',
      'services.pack_boost_l2': '2 post templates*',
      'services.pack_boost_l3': '2 reel-style video edits',
      'services.pack_identity': 'Visual Identity Pack',
      'services.pack_identity_l1': 'Business card (front)',
      'services.pack_identity_l2': '1 post template',
      'services.pack_identity_l3': 'Full brand guidelines',
      'services.btn.choose': 'Choose this pack',
      'services.special.title': 'Themed <span class="gold">packs</span>',
      'services.special.sub': 'Your world, tailor-made — let every project shine.',
      'services.per_pack': 'per pack',
      'services.pack_sport': 'Sports Pack',
      'services.pack_sport_l1': '1 Competition story template*',
      'services.pack_sport_l2': '1 Match-day story template',
      'services.pack_sport_l3': '1 Recap post',
      'services.pack_sport_l4': '3 reel-style edits',
      'services.pack_beauty': 'Beauty & Wellness Pack',
      'services.pack_beauty_l1': 'Services menu',
      'services.pack_beauty_l2': '2 story templates',
      'services.pack_beauty_l3': '1 post',
      'services.pack_beauty_l4': '1 reel-style video edit',
      'services.pack_resto': 'Restaurant Pack',
      'services.pack_resto_l1': 'Restaurant menu',
      'services.pack_resto_l2': '1 loyalty card',
      'services.pack_resto_l3': '1 Story template*',
      'services.pack_event': 'Event Pack',
      'services.pack_event_l1': 'Poster or flyer',
      'services.pack_event_l2': '1 video story or reel',
      'services.footnote_2': '*Customization by MS Comm\' is an add-on.<br>Pack customization possible: swap an item for another equivalent service.<br>Prices exclude printing and travel expenses — see T&Cs.',
      'services.premium.title': 'Tailor-made <span class="gold">support</span>',
      'services.premium.sub': 'Social media management, content strategy, monthly reporting.',
      'services.premium.name': 'Premium Support',
      'services.premium.price': 'Custom quote',
      'services.premium.note': 'monthly engagement',
      'services.premium.l1': 'Full social media management',
      'services.premium.l2': 'Monthly editorial strategy',
      'services.premium.l3': 'Content creation (posts, stories, reels)',
      'services.premium.l4': 'Personalized advice & support',
      'services.premium.l5': 'Availability & responsiveness',
      'services.premium.btn': 'Request a custom quote',
      'services.q.title': 'Any question?',
      'services.q.sub': 'Prices are indicative and customizable — contact me for a tailor-made quote.',
      'btn.view_portfolio': 'View my work',

      /* ---------- EXPERIENCES ---------- */
      'exp.page.title': 'My <span class="gold">Experience</span>',
      'exp.page.sub': '4 years of standout projects in sport, media and events.',
      'exp.mscomm.role': 'Founder — Freelance',
      'exp.mscomm.dates': 'Aug 2025 — present',
      'exp.mscomm.l1': 'Templates, business cards, loyalty cards, brand guidelines, flyers, posters, restaurant menus, photos, reels…',
      'exp.mscomm.l2': 'Long-term support projects such as social media management',
      'exp.mscomm.l3': 'Making you shine, whatever your field: sport, music, food, beauty…',
      'exp.p13.role': 'Head of Marketing Communication',
      'exp.p13.dates': 'Jun 2024 — present · 1 yr 10 mo',
      'exp.p13.l1': 'Driving the club\'s digital and global communication: social media management, engaging content (matches, competitions, events)',
      'exp.p13.l2': 'Partnership development and sponsorship initiatives',
      'exp.p13.l3': 'Contributing to event organization and setting up a communication strategy to boost the club\'s visibility and image',
      'exp.pp.role': 'Apprentice',
      'exp.pp.company': 'Ping Pang Paris',
      'exp.pp.dates': 'Sep 2023 — Aug 2025 · 2 yrs',
      'exp.pp.l1': 'High-value content production: interviews, video editing and sports competition coverage',
      'exp.pp.l2': 'Monitoring international events and creating tailored content to showcase performance and the club\'s image',
      'exp.pp.l3': 'Contributing to reactive, immersive communication around key sporting moments',
      'exp.pongi.role': 'Communication',
      'exp.pongi.dates': 'Jan 2023 — Mar 2024 · 1 yr 3 mo',
      'exp.pongi.l1': 'On-site event coverage (French Championships) with real-time content production',
      'exp.pongi.l2': 'Creating engaging video formats (Instagram Reels) with dynamic editing tailored to social media',
      'exp.pongi.l3': 'Setting up reactive communication to highlight key moments and amplify event impact',
      'exp.jdp.role': 'Creator & Editor',
      'exp.jdp.company': 'Le Journal du Pongiste',
      'exp.jdp.dates': 'Aug 2022 — Jul 2023 · 1 yr',
      'exp.jdp.l1': 'Designed and developed a monthly magazine dedicated to French table tennis news',
      'exp.jdp.l2': 'High-value content: article writing, interviews and editorial layout',
      'exp.jdp.l3': 'Managed distribution and the editorial line to ensure consistency and quality',
      'exp.jdp.read': 'Read articles →',
      'exp.fp.role': 'Social Media Lead',
      'exp.fp.company': 'French Ping',
      'exp.fp.dates': 'Feb 2022 — Aug 2023 · 1 yr 7 mo',
      'exp.fp.l1': 'Managing and running the Instagram page',
      'exp.fp.l2': 'Creating visual and video content (editing, photography) tailored to social media',
      'exp.fp.l3': 'Contributing to community growth and engagement',
      'exp.al.role': 'Community Manager',
      'exp.al.company': 'Alexis Lebrun',
      'exp.al.dates': 'Oct 2021 — Aug 2023 · 1 yr 11 mo',
      'exp.al.l1': 'Driving the digital communication of a top-level athlete and Olympic medalist',
      'exp.al.l2': 'Content production: videos, visuals…',
      'exp.al.l3': 'Competition coverage and community management, highlighting image and sports performance',
      'exp.cta.title': 'Want to <span class="gold">collaborate</span>?',
      'exp.cta.sub': 'Explore my services or contact me to discuss your project.',
      'btn.view_services': 'View my services',

      /* ---------- PORTFOLIO ---------- */
      'pf.page.title': 'My <span class="gold">Portfolio</span>',
      'pf.page.sub': 'Posters, posts, articles, magazines, videos — a selection of my work.',
      'pf.mscomm.title': 'MS Comm\' — <span class="gold">Creations</span>',
      'pf.mscomm.sub': 'Posters, flyers, business cards, visual identity.',
      'pf.tag.visual': 'Visual design',
      'pf.tag.template_pub': 'Post template',
      'pf.tag.poster': 'Poster',
      'pf.bcard.title': 'Business <span class="gold">card</span>',
      'pf.alexis.title': 'Alexis <span class="gold">Lebrun</span>',
      'pf.alexis.sub': 'Community management for a pro table tennis player — Olympic medalist.',
      'pf.tag.template_story': 'Story template',
      'pf.tag.creation': 'Creation',
      'pf.tag.interview_pub': 'Interview post',
      'pf.reels.title': 'Reels',
      'pf.tag.shoot_edit': 'Filming & video editing',
      'pf.sub.training': 'Training',
      'pf.sub.trickshot': 'Trickshot',
      'pf.tag.video_edit': 'Video editing',
      'pf.sub.competition': 'Competition',
      'pf.p13.title': 'Paris 13 <span class="gold">Tennis de Table</span>',
      'pf.p13.sub': 'Match posters, stories, match-day content.',
      'pf.tag.match_poster': 'Match poster',
      'pf.tag.rollup': 'Roll-up',
      'pf.sub.highlights': 'Highlights',
      'pf.creator.title': 'Content <span class="gold">creator</span>',
      'pf.creator.sub': 'Lifestyle, beauty & matcha • Content creation & collaborations.',
      'pf.tag.collab': 'Brand collaboration',
      'pf.tag.invitation': 'Invitation',
      'pf.sub.19': 'Le 19ème (brunch in Montpellier)',
      'pf.pongi.title': '<span class="gold">Pongistic</span>',
      'pf.pongi.sub': 'Filming and video editing, dynamic content for social media.',
      'pf.tag.interview': 'Interview',
      'pf.sub.cdf': 'French Championships',
      'pf.tag.interview_vol': 'Volunteer interviews',
      'pf.sub.shoot_edit': 'Filming & editing',
      'pf.tag.reel': 'Reel',
      'pf.sub.comp_immersion': 'Competition immersion',
      'pf.pingpang.title': 'Ping Pang <span class="gold">Effect</span>',
      'pf.pingpang.sub': 'Articles, feature posts, editorial content and writing.',
      'pf.pingpang.article1': 'Article - Alexis Lebrun, 1st French player to win 2 European Championship titles in the same edition',
      'pf.pingpang.article2': 'Article - France bids to host the 2027 World Championships',
      'pf.pingpang.article3': 'Interview - The inspiring story of Tigran Tsitoghdzyan',
      'pf.jdp.title': 'Le Journal du <span class="gold">Pongiste</span>',
      'pf.jdp.sub': 'Monthly magazine recapping French table tennis news.',
      'pf.jdp.read': '→ Read the 12 editions',
      'pf.tag.cover_jan': 'Cover - January 2023',
      'pf.tag.excerpt': 'Excerpt',
      'pf.photo.title': '<span class="gold">Photography</span>',
      'pf.photo.sub': 'Discover my photos and retouching.',
      'pf.tag.photography': 'Photography',
      'pf.sub.sport': 'Sport',
      'pf.sub.landscape': 'Landscape',
      'pf.photo.see_gallery': 'See the full photo gallery →',

      /* ---------- CONTACT ---------- */
      'contact.page.title': '<span class="gold">Contact</span> me',
      'contact.page.sub': 'Shall we write the next chapter together? <br>Tell me about your project and I\'ll reply quickly.',
      'contact.info.title': 'Let\'s talk about your <span class="gold">project</span>',
      'contact.info.text': 'Whether you need a one-off visual, a full pack or long-term support, I\'m here to help you shine. <br>Feel free to get in touch!',
      'contact.form.title': 'Send a message',
      'contact.form.name': 'Name',
      'contact.form.name_ph': 'Your name',
      'contact.form.email': 'Email',
      'contact.form.subject': 'Subject',
      'contact.form.subject_ph': 'e.g. Sports Pack quote request',
      'contact.form.message': 'Message',
      'contact.form.message_ph': 'Describe your project, goals, deadlines and estimated budget...',
      'contact.form.send': 'Send message',
      'contact.bcard.title': 'My business <span class="gold">card</span>',
      'contact.social.title': 'Follow <span class="gold">MS Comm\'</span>',
      'contact.social.sub': 'Find my latest creations and news on social media.',

      /* ---------- PHOTOS ---------- */
      'photos.page.title': 'Photo <span class="gold">Gallery</span>',
      'photos.page.sub': 'Sports photography, portraits and special moments.',
      'photos.tab.gallery': 'Gallery',
      'photos.tab.albums': 'Albums',
      'photos.private': 'Private album',
      'photos.search_ph': 'Search a photo or album...',
      'photos.all_albums': 'All albums',
      'photos.no_album': 'No album',
      'photos.back_albums': 'All albums',
      'photos.empty_albums': 'No album available.',
      'photos.empty_timeline': 'No public photo yet.',
      'photos.modal.title': 'Private album',
      'photos.modal.help': 'Enter the code received by email to access your gallery.',
      'photos.modal.cancel': 'Cancel',
      'photos.modal.access': 'Access',
      'photos.lb.share': 'Share',
      'photos.lb.download': 'Download',
      'photos.cart.title': 'Cart',
      'photos.print.title': 'Order a print',
      'photos.print.note': 'This feature is in development. To order, contact us specifying the photo you want.',
      'photos.print.contact': 'Contact MS Comm\'',
      'photos.offline': 'Photo server offline — run node server.js inside photo-server/.',

      /* ---------- CHECKOUT ---------- */
      'co.back': 'Back to gallery',
      'co.title': 'Summary & <span class="gold">Payment</span>',
      'co.success.title': 'Order received!',
      'co.success.email': 'An email with your download link has been sent.',
      'co.success.download': 'Download my photos (.zip)',
      'co.success.back': '← Back to gallery',
      'co.form.contact': 'Your details',
      'co.form.first': 'First name',
      'co.form.last': 'Last name',
      'co.form.email': 'Email *',
      'co.form.phone': 'Phone',
      'co.pay.title': 'Payment',
      'co.pay.card': 'Credit card',
      'co.pay.secure': 'Secure payment — Stripe, 256-bit SSL encryption',
      'co.pay.btn': 'Pay',
      'co.summary': 'Your selection'
    }
  };

  /* -------- Language resolution -------- */
  function detectInitialLang() {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
    const nav = (navigator.language || navigator.userLanguage || 'fr').toLowerCase();
    return nav.startsWith('fr') ? 'fr' : 'en';
  }

  let currentLang = detectInitialLang();

  function t(key, vars) {
    const pack = DICT[currentLang] || DICT.fr;
    let val = pack[key];
    if (val == null) val = DICT.fr[key];
    if (val == null) return key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        val = val.replace(new RegExp('{' + k + '}', 'g'), vars[k]);
      });
    }
    return val;
  }

  /* -------- Apply translations to DOM -------- */
  function applyTranslations(root) {
    const scope = root || document;

    // textContent
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });

    // innerHTML (keeps <span class="gold">…</span> markup)
    scope.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      el.innerHTML = t(key);
    });

    // attribute translations: data-i18n-attr="placeholder:key,title:key2"
    scope.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    // Year token in footer copyright keys
    if (scope === document) {
      document.querySelectorAll('[data-i18n-copy]').forEach(el => {
        const key = el.getAttribute('data-i18n-copy');
        el.innerHTML = t(key, { year: new Date().getFullYear() });
      });
      document.documentElement.lang = currentLang;
    }
  }

  /* -------- Flag switcher injection -------- */
  function flagSVG(lang) {
    if (lang === 'fr') {
      // French tricolor (swap to EN)
      return '<svg viewBox="0 0 3 2" aria-hidden="true"><rect width="1" height="2" x="0" fill="#0055A4"/><rect width="1" height="2" x="1" fill="#FFFFFF"/><rect width="1" height="2" x="2" fill="#EF4135"/></svg>';
    }
    // Union Jack (swap to FR)
    return '<svg viewBox="0 0 60 30" aria-hidden="true"><rect width="60" height="30" fill="#012169"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="6"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="4"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#C8102E" stroke-width="4"/></svg>';
  }

  function injectSwitcher() {
    const topbar = document.querySelector('.topbar-inner');
    if (!topbar) return;
    if (document.getElementById('lang-switcher')) return;

    const btn = document.createElement('button');
    btn.id = 'lang-switcher';
    btn.className = 'lang-switcher';
    btn.setAttribute('aria-label', t('lang.switch_to'));
    btn.title = t('lang.switch_to');
    btn.innerHTML = flagSVG(currentLang);
    btn.addEventListener('click', () => {
      const newLang = currentLang === 'fr' ? 'en' : 'fr';
      setLang(newLang);
    });

    // Insert before the mobile menu button
    const mobileToggle = topbar.querySelector('.mobile-toggle');
    if (mobileToggle && mobileToggle.parentElement) {
      mobileToggle.parentElement.insertBefore(btn, mobileToggle);
    } else {
      topbar.appendChild(btn);
    }
  }

  function setLang(lang) {
    if (lang !== 'fr' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem(LS_KEY, lang);
    applyTranslations();
    const btn = document.getElementById('lang-switcher');
    if (btn) {
      btn.innerHTML = flagSVG(lang);
      btn.setAttribute('aria-label', t('lang.switch_to'));
      btn.title = t('lang.switch_to');
    }
    window.dispatchEvent(new CustomEvent('lang-switch:change', { detail: { lang } }));
  }

  /* -------- Public API -------- */
  window.i18n = {
    t: t,
    setLang: setLang,
    getLang: () => currentLang,
    apply: applyTranslations
  };

  /* -------- Init -------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyTranslations();
      injectSwitcher();
    });
  } else {
    applyTranslations();
    injectSwitcher();
  }
})();
