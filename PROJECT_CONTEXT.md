# PROJECT CONTEXT — MS Comm' Website

> **⚠️ À lire au début de chaque session.** Ce fichier doit être mis à jour dès qu'un changement significatif est apporté au projet.  
> Dernière mise à jour : **24 avril 2026**

---

## 1. Présentation du projet

### Identité
- **Nom du projet** : Site vitrine MS Comm'
- **Propriétaire / client** : Melody (Melody Sok)
- **Entité** : MS Comm' — auto-entrepreneur, prestataire de services de communication
- **Email de contact** : mscomm.contact@gmail.com
- **Localisation** : Paris · Montpellier · France

### Objectif du site
Présenter les services de Melody et lui permettre d'attirer des clients (clubs sportifs, athlètes, entreprises) via :
- Un portfolio visuel de ses réalisations
- Une page de services avec tarifs détaillés
- Une page d'expériences professionnelles
- Un formulaire de contact / devis

### Cible
Clubs sportifs, athlètes, événements sportifs, restaurants, beautés, musique — principalement Paris et Île-de-France.

---

## 2. Déploiement & infrastructure

| Élément | Valeur |
|---|---|
| **Hébergement** | GitHub Pages |
| **Dépôt GitHub** | `ms-comm/ms-comm.github.io` |
| **URL live** | `https://ms-comm.github.io/` |
| **Branche** | `main` |
| **Dossier local** | `c:\Users\lolol\Documents\Code\Web\Melody` |
| **Serveur local** | Python `http.server` sur port `8080` → `http://localhost:8080` |
| **Déploiement** | `git add .` puis `git commit -m "..."` puis `git push origin main` |
| **⚠️ PowerShell** | Ne pas utiliser `&&` entre commandes git — exécuter séparément |

---

## 3. Structure des fichiers

### Site vitrine principal (racine)

```
Melody/
├── index.html              # Page d'accueil (héro, stats, expériences aperçu, portfolio aperçu, services aperçu, témoignages, CTA)
├── services.html           # Tarifs détaillés (à la carte, packs lancement, packs spéciaux, accompagnement)
├── portfolio.html          # Portfolio complet (print, réseaux sociaux, vidéos, photos, articles)
├── experiences.html        # Parcours professionnel complet
├── contact.html            # Formulaire de contact + infos + carte de visite 3D + réseaux
├── photos.html             # Galerie photo publique (albums, timeline, lightbox, téléchargement)
├── checkout.html           # Page de paiement Stripe (panier, promo, validation)
├── sitemap.xml             # Sitemap SEO (5 URLs, dernière MAJ 27/03/2026)
├── robots.txt              # Autorise tout sauf *.tmp et *.log
├── manifest.json           # PWA manifest (thème or #c69b00, fond #0d0d0d)
├── google4c806c32fa34b2b8.html  # Vérification Google Search Console
├── assets/
│   ├── css/
│   │   └── style.css       # Feuille de style unique (~2157 lignes)
│   ├── js/
│   │   └── main.js         # JS unique (~399 lignes)
│   └── data/               # Tous les médias (images, vidéos)
├── photo-server/           # Serveur galerie photo + panel admin (voir section 3.2)
└── PROJECT_CONTEXT.md      # Ce fichier
```

### Serveur galerie photo (photo-server/)

```
photo-server/
├── server.js               # Point d'entrée Express (session, CORS, routes)
├── package.json            # Dépendances Node.js
├── nodemon.json            # Config nodemon (ignore db/, storage/)
├── fly.toml                # Config Fly.io (déploiement production)
├── .gitignore              # Ignore db/, storage/, node_modules/
├── .env.example            # Template variables d'environnement
├── README.md               # Documentation déploiement
├── FLICKR_INTEGRATION_CONTEXT.md  # Documentation complète intégration Flickr
│
├── routes/                 # Routes API Express
│   ├── auth.js             # POST /login, /logout, /check, /change-password
│   ├── adminPhotos.js      # CRUD photos + upload Flickr/local (multer + sharp)
│   ├── adminAlbums.js      # CRUD albums + sync photosets Flickr
│   ├── adminPromoCodes.js  # CRUD codes promo
│   ├── adminSettings.js    # Réglages (prix, filigrane, SMTP, clés Flickr)
│   ├── adminOrders.js      # Gestion commandes + tokens download
│   └── publicApi.js        # API publique (albums, photos, verify-code, download-zip)
│
├── services/               # Services métier
│   ├── db.js               # Lecture/écriture JSON (photos.json, albums.json, settings.json, orders.json, promo-codes.json)
│   ├── imageProcessor.js   # Sharp : preview 1200px + watermark SVG/image + resize
│   ├── emailService.js     # Nodemailer : envoi code accès client
│   └── flickrService.js    # OAuth 1.0a + Flickr API (upload, download, photoset, delete)
│
├── middleware/             # Middleware Express
│   └── requireAuth.js      # Vérification session admin (401 JSON pour API)
│
├── db/                     # Bases de données JSON
│   ├── photos.json         # Base photos (id, title, flickr*Id, albumId, downloadType, price, etc.)
│   ├── albums.json         # Base albums (id, name, type, code, flickrSetId, coverId, maxDownload, etc.)
│   ├── settings.json       # Config (prix défaut, SMTP, filigrane, clés Flickr, discountTiers, etc.)
│   ├── orders.json         # Commandes (id, items, total, promo, tokens, createdAt)
│   └── promo-codes.json    # Codes promo (id, code, type, value, maxUses, uses, active)
│
├── storage/                # Stockage local (gitignored)
│   ├── originals/          # Photos HD originales (si Flickr non configuré)
│   ├── previews/           # Miniatures 1200px
│   └── watermarked/        # Versions avec filigrane
│
└── admin/                  # Panel admin (SPA)
    ├── index.html          # Interface admin (dashboard, photos, albums, réglages)
    ├── css/
    │   └── admin.css       # Styles admin (thème dark MS Comm')
    └── js/
        └── admin.js        # Logique admin (CRUD, upload, Flickr config, autosave)
```

---

## 4. Design system (style.css)

### Couleurs CSS variables
```css
--bg: #0a0a0a          /* fond principal, quasi-noir */
--bg-2: #111111        /* fond alternatif sections */
--bg-card: #141414     /* fond des cartes */
--text: #f0f0f0        /* texte principal */
--muted: rgba(255,255,255,0.6)  /* texte secondaire / sous-titres */
--gold: #c69b00        /* or principal */
--gold-2: #ffd25a      /* or lumineux / liens */
--gold-glow: rgba(198,155,0,0.35)
```

### Typographie
- **Display** : `Playfair Display` (titres élégants)
- **Heading** : `Poppins` (titres sections)
- **Body** : `Inter` (texte courant)
- **Accent** : `Dancing Script` (décoratif)

### Classes CSS importantes
| Classe | Rôle |
|---|---|
| `.section-header p` | Sous-titres de sections — `font-size: 16px`, `white-space: normal`, `max-width: 56ch` |
| `.services-intro-line` | Texte intro services — 2 lignes desktop, wrapping mobile — breakpoints 960px et 600px |
| `.page-header p` | Sous-titres pages internes — `font-size: 16px`, `max-width: 56ch` |
| `.reveal` / `.reveal-left` / `.reveal-right` | Animations au scroll (IntersectionObserver) |
| `.stagger` | Animation en cascade |
| `.gold` | Span en couleur or dans les titres |
| `.btn-gold` | Bouton doré principal |
| `.btn-outline-gold` | Bouton doré outline |
| `.exp-card` | Carte d'expérience |
| `.tarif-card` | Carte de tarif (à la carte) |
| `.service-card` | Carte de service/pack |
| `.testimonial-card` | Carte d'avis client |
| `.preview-card` | Carte aperçu portfolio |

### Effets visuels
- Fond étoilé animé (`body::before` avec radial-gradients dorés + `starsTwinkle` animation)
- Étincelles canvas dynamiques (`#sparkle-canvas`, géré dans `main.js`)
- Glows dorés sur sections `.has-glow`

---

## 5. Navigation

Toutes les pages ont la même barre de navigation :
- **Logo** : `assets/data/logo_black-removebg.png` (s'adapte au thème)
- **Liens** : Accueil · Expériences · Services · Portfolio · Contact
- **CTA** : "Demander un devis" → `contact.html`
- **Mobile** : burger button `#menuBtn` → drawer `#drawer`

---

## 6. Contenu des pages

### `index.html` — Accueil
- **Hero** : photo Melody (`Melody_detour_rmbg_image_2.png`), titre "Votre image, notre mission.", CTA services + contact
- **Stats** : 4+ ans expérience · 6 projets marquants · 24h/48h réactivité · 100% créativité
- **À propos** : présentation Melody, skills tags
- **Aperçu expériences** : 3 cartes (MS Comm', Paris 13 TT, Alexis Lebrun)
- **Aperçu portfolio** : 3 preview cards (Paris 13 TT, Alexis Lebrun, MS Comm')
- **Services aperçu** : 3 cartes tarifaires (à la carte dès 10€, packs lancement dès 95€→80€, packs spéciaux dès 170€→150€)
- **Témoignages** : carrousel auto-défilant draggable (16 témoignages : Alexis Lebrun, Félix Lebrun, Léa Maniak, Thomas Salle, Harry Leng, Oumehani Hosenally, Jeremy Tan, Thomas Guignat, Arno Brotons, Mélina Pheng, Loïs Adam, Arnaud Nicolazzi, Roseline Luong, Florian Bourrassaud, Victor Huygues-Lacour, Léo Cohen, Sophie Pheng)
- **CTA final** : "Prêt·e à briller ?" → contact + Instagram

### `services.html` — Services & Tarifs
**Prestations à la carte :**
| Service | Prix |
|---|---|
| Story | 15€ |
| Publication | 20€ |
| Template Story* | 30€ |
| Template Publication* | 35€ |
| Montage vidéo (réels) | 30€ |
| Charte graphique | 150€ |
| Carte de visite recto | 50€ |
| Carte de visite + verso | +10€ |
| Affiche / flyer | 60€ |
| Carte restaurant / prestations | 60€ |
| Carte de fidélité | 40€ |
| Roll up | 110€ |
| 1 photo retouchée | 20€ |
| 10 photos retouchées | 150€ |
| 20+ photos | 10€/unité |

**Packs de lancement :**
- Pack Réseaux Sociaux Starter : ~~95€~~ **80€**
- Pack Réseaux Sociaux Boost : ~~220€~~ **190€**
- Pack Identité Visuelle : ~~235€~~ **200€**

**Packs spéciaux :**
- Pack Sportif : ~~170€~~ **150€**
- Pack Beauté & Bien-être : ~~170€~~ **140€**
- Pack Restauration : ~~130€~~ **100€**
- Pack Événement : ~~90€~~ **70€**

**Accompagnement Premium** : sur devis (gestion réseaux sociaux, stratégie, contenu)

*Note : `*Personnalisation par MS Comm' en supplément. Tarifs hors frais impression et déplacement.`*

### `portfolio.html` — Portfolio
Sections avec galeries images + vidéos :
- **Print** : affiches, flyers, cartes de visite, identité visuelle (`MsComm_affiche_*.jpeg`, `visit_card_*.png`)
- **Réseaux sociaux sport** (Ping Pang Effect) : posts `ping_pang_post_c1/c2/c3_*.jpeg`
- **Vidéos** : réels Pongistic (`pongistic_reel*.mp4`), Paris 13 TT (`reel_paris13_*.mp4`), Alexis Lebrun (`Alexis_video_reels*.mp4`), Content creator (`reels_content_creator_*.mp4`)
- **Photographies** : `image_photo_*.jpg`, `Alexis_image_*.jpeg`, `Melody_image_*.jpeg`
- **Articles** : Le Journal du Pongiste (`le_journal_du_pongiste_*.png`), lien Google Drive
- Lightbox intégré pour images

### `experiences.html` — Expériences
Chronologie (7 expériences) :
1. **MS Comm'** — Auto-entrepreneur · août 2025 — aujourd'hui
2. **Paris 13 Tennis de Table** — Responsable communication marketing · juin 2024 — aujourd'hui (1 an 10 mois)
3. **Ping Pang Paris** — Alternante · sept. 2023 — août 2025 (2 ans)
4. **Pongistic** — Communication · janv. 2023 — mars 2024 (1 an 3 mois)
5. **Le Journal du Pongiste** — Créatrice et Rédactrice · août 2022 — juil. 2023 (1 an)
6. **French Ping** — Responsable Réseaux sociaux · févr. 2022 — août 2023 (1 an 7 mois)
7. **Alexis Lebrun** (Top 20 mondial) — Community Manager · oct. 2021 — août 2023 (1 an 11 mois)

### `contact.html` — Contact
- Formulaire (nom, email, sujet, message)
- Infos : email `mscomm.contact@gmail.com`, Instagram, Facebook, LinkedIn, localisation Paris/Montpellier
- Carte de visite 3D (flip recto/verso) : `visit_card_recto.png` / `visit_card_verso.png`
- CTA réseaux sociaux : Instagram MS Comm', Instagram Melody Sok, Paris 13 TT, Ping Pang, Facebook

---

## 7. SEO — État actuel

### Meta tags (toutes les pages)
- `title`, `description`, `keywords`, `author`, `robots`, geo tags (FR-75, Paris, 48.8566/2.3522)
- Open Graph (og:type, og:url, og:title, og:description, og:image, og:locale, og:site_name)
- Twitter Cards (summary_large_image)
- `<link rel="canonical">` sur chaque page

### Fichiers SEO
- `sitemap.xml` : 5 URLs, changefreq définis, dernière MAJ 2026-03-27
- `robots.txt` : `Allow: /`, `Disallow: /*.tmp$`, `Disallow: /*.log$` (pas de blocage images)
- `manifest.json` : nom "MS Comm'", thème or, icône logo

### JSON-LD Schema.org (par page)
- `index.html` → `ProfessionalService` (adresse Paris, GPS, services, sameAs Instagram)
- `services.html` → `Service` (provider, offers dès 10€)
- `portfolio.html` → `CollectionPage`
- `contact.html` → `ContactPage` + `ProfessionalService`
- `experiences.html` → `ProfilePage` + `Person`

### Favicon
- `<link rel="icon" type="image/png" href="assets/data/logo_white-removebg.png" />`
- `<link rel="apple-touch-icon" href="assets/data/logo_white-removebg.png" />`

### Keywords cibles
`communication sportive`, `agence communication sport`, `média sportif`, `événementiel sportif Paris`, `réseaux sociaux sport`, `photographie sportive`, `community manager sport Paris`, `Melody MS Comm`, `Paris`, `Île-de-France`

### Réseaux sociaux
- Instagram : `@ms_communication_france` → `https://www.instagram.com/ms_communication_france/`
- Instagram perso : `@melododo2001`
- Facebook : `https://www.facebook.com/share/1CMyp7KkkU/`
- LinkedIn : `https://www.linkedin.com/company/ms-comm%E2%80%99/`

---

## 8. JavaScript (main.js)

Fonctionnalités :
- **Année automatique** : `#year` mis à jour dynamiquement
- **Drawer mobile** : toggle `#menuBtn` → `#drawer` avec classe `is-open`
- **Scroll reveal** : IntersectionObserver sur `.reveal`, `.reveal-left`, `.reveal-right`, `.stagger`
- **Carrousel témoignages** : auto-défilement CSS animé (55s), drag-to-scroll, prev/next buttons, clonage pour boucle infinie
- **Lightbox** : ouverture images portfolio en plein écran
- **Étincelles** : canvas animé `#sparkle-canvas` (particules dorées au survol)
- **Formulaire contact** : lecture du paramètre `?pack=` dans l'URL pour pré-remplir le sujet (`#packBanner`)
- **Carte de visite 3D** : effet tilt/flip sur `#card3d`
- **Scroll-top** : bouton `#scrollTop`

---

## 9. Règles de développement

### CSS
- Ne **jamais** utiliser `white-space: nowrap` sur les sous-titres → cause débordement mobile
- Sous-titres : `font-size: 16px` fixe desktop, breakpoints `@media (max-width: 960px)` et `@media (max-width: 600px)`
- Spécificité CSS : utiliser `.section-header p.services-intro-line` (pas juste `.services-intro-line`) pour garantir la priorité
- Ne pas utiliser `clamp()` agressif sur les textes sous-titres
- Conserver le thème sombre (dark mode par défaut via `meta name="color-scheme" content="dark"`)

### HTML
- Toutes les images doivent avoir un attribut `alt` descriptif
- Liens externes : toujours `target="_blank" rel="noopener"`
- Pas d'inline styles excessifs — préférer des classes CSS

### Git
- Commandes séparées en PowerShell (pas de `&&`)
- Commit messages en français descriptifs

### Priorités UX
- Réactivité mobile obligatoire sur toutes les pages
- Textes sous-titres : wrap naturel sur mobile, jamais de coupure/overflow
- CTA "Demander un devis" toujours visible dans la navigation

---

## 10. Historique des décisions importantes

| Date | Décision |
|---|---|
| 2026-03 | Refonte des sous-titres : `white-space: normal` partout, `font-size: 16px` fixe |
| 2026-03 | `.services-intro-line` avec sélecteur haute spécificité + breakpoints explicites |
| 2026-03 | Favicon : suppression `media="prefers-color-scheme"` → `<link rel="icon">` standard |
| 2026-03 | Suppression `Disallow: /assets/data/` dans robots.txt (bloquait crawl images Google) |
| 2026-04 | Ajout JSON-LD Schema.org sur toutes les pages + canonical URLs + manifest.json |
| 2026-04 | SEO complet `experiences.html` (manquait OG, Twitter, keywords, geo) |
| 2026-04 | Ajout i18n FR/EN (`assets/js/i18n.js`) — drapeau langue dans la topbar à droite, détection auto (`navigator.language` `fr*` → FR, sinon EN), préférence stockée dans `localStorage['mscomm_lang']`. Dictionnaire intégré, traduit les text nodes + attributs `placeholder/alt/aria-label/title` + `<title>` + meta description. MutationObserver pour contenu dynamique (galerie photos, panier). |

---

## 11. Galerie Photo & Panel Admin (ajouté 2026-04)

### Infrastructure
- **Serveur photo** : `photo-server/` — Node.js + Express sur port `3000`
- **Démarrage** : `node server.js` (ou `npm run dev` avec nodemon) dans `photo-server/`
- **Panel admin** : `http://localhost:3000/admin` — identifiants stockés hors du repo (voir `photo-server/db/settings.json`, gitignored)
- **API publique** : `http://localhost:3000/api/public/...`

### Structure photo-server/
```
photo-server/
├── server.js               # Point d'entrée Express
├── package.json
├── routes/
│   ├── auth.js             # POST /login, /logout, /check, /change-password
│   ├── adminPhotos.js      # CRUD photos + upload (multer + sharp)
│   ├── adminAlbums.js      # CRUD albums + envoi email code
│   ├── adminSettings.js    # Réglages (prix, filigrane, SMTP)
│   └── publicApi.js        # API publique (albums, photos, verify-code, download-zip)
├── services/
│   ├── db.js               # Lecture/écriture JSON (photos.json, albums.json, settings.json)
│   ├── imageProcessor.js   # Sharp : preview 1200px + watermark SVG/image
│   └── emailService.js     # Nodemailer : envoi code accès client
├── middleware/
│   └── requireAuth.js      # Vérification session admin
├── db/
│   ├── photos.json         # Base photos
│   ├── albums.json         # Base albums
│   └── settings.json       # Config (prix défaut, SMTP, filigrane)
├── storage/
│   ├── originals/          # Photos HD originales (gitignored)
│   ├── previews/           # Miniatures 1200px (gitignored)
│   └── watermarked/        # Versions avec filigrane (gitignored)
└── admin/
    ├── index.html          # SPA panel admin (YouTube Studio-like)
    ├── css/admin.css       # Styles admin (thème dark MS Comm')
    └── js/admin.js         # Logique admin (dashboard, photos, albums, upload, réglages)
```

### Page publique photos.html
- Vue Albums (timeline par année) / Timeline (toutes photos) / Grille
- **Galerie justifiée** (`flex` + `flex-grow`) — zéro trou noir entre photos orientées verticalement / horizontalement
- **Rendu progressif** par batch (~200 photos / mois, sentinel `IntersectionObserver` en bas) + **lazy-loading** des `<img data-src>` → tient 2000+ photos sans jank
- Sidebar de dates sticky, cliquable pour sauter à un mois (force le rendu des batches intermédiaires avant le scroll)
- Barre de recherche par titre ou album
- Accès albums privés par code (modal)
- Interface de sélection + téléchargement ZIP
- Bannière d'erreur si serveur hors ligne
- Lightbox pour photos avec filigrane

### Types de téléchargement

| Type              | Upload Flickr                                                        | Download public                                                                         |
|-------------------|----------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `free`            | 1× public original (AUCUNE copie filigranée)                         | Original sans filigrane (pas de re-processing serveur)                                  |
| `free-watermark`  | 1× privé original + 1× public copie filigranée `__wm`                 | Copie filigranée Flickr telle quelle (filigrane cuit à l'upload, jamais re-appliqué)    |
| `paid`            | 1× privé original (parké dans `__MSCOMM_ORIGINALS__`) + 1× public `__wm` | Sans token → copie filigranée ; avec token valide → original sans filigrane             |
| Album `private`   | N’importe quel type ci-dessus                                        | Accès code → sélection max N photos → ZIP HD                                            |

> **Principe clé** : le filigrane est appliqué **une seule fois à l'upload** et stocké comme copie publique distincte sur Flickr. Les downloads ne passent **jamais** par `sharp.applyWatermark` en temps réel (sauf fallback legacy pour les anciennes photos qui n'ont qu'un `flickrOriginalId`). Conséquence : ce que l'utilisateur télécharge est bit-pour-bit identique à l'aperçu affiché.

---

## 12. À faire / idées futures

> Mettre à jour cette section selon les échanges avec Melody.

- [ ] Domaine personnalisé (ex: `ms-comm.fr`) pour supprimer le branding "github.io" dans Google
- [ ] Ajouter des favicons ICO/SVG pour meilleure compatibilité navigateurs
- [ ] Page CGV (mentionnée dans les footnotes des tarifs)
- [ ] Intégration Google Analytics ou Plausible pour suivi trafic
- [ ] Formulaire contact → backend (actuellement statique, pas d'envoi réel)
- [ ] Configurer SMTP Gmail dans Réglages admin pour l'envoi des codes clients
- [ ] Mettre à jour l'URL du site dans l'email d'envoi de code (contact.html → URL de prod)
