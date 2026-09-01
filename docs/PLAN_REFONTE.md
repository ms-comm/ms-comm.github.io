# Plan — Refonte Overview admin, section Clients, comptes visiteurs & Atelier MS Comm'

> Statut : plan d'architecture. Implémentation par phases.
> Rédigé le 2026-08-31. Sources lues : `photo-server/services/analytics.js`, `photo-server/services/db.js`,
> `photo-server/routes/adminPhotos.js` (`/stats`), `photo-server/routes/adminOrders.js`,
> `photo-server/admin/index.html` (section `#page-dashboard`), `photos.html`, `checkout.html`.

---

## 1. État réel du système (constat, pas hypothèse)

| Brique | Existe ? | Détail |
|---|---|---|
| Comptes clients | **Non** | Aucun fichier `accounts`. `requireAuth` ne couvre que l'admin unique (`settings.adminUsername`). |
| Identité client | Partielle | Uniquement `orders[].customer` (email, prénom, nom, téléphone, adresse) saisi au checkout. |
| Favoris | **Non** | Rien côté serveur ni client. |
| Créations / Atelier | **Non** | Le concept n'existe nulle part. |
| Téléchargements | Oui, anonymes | `analytics-downloads.json` stocke `photoId + ts + hash IP tronqué`. Non rattachable à une personne. |
| Visites | Oui, anonymes | `analytics-visits.json`, même contrainte PII. |
| Achats côté visiteur | `localStorage` | `mscomm_tokens`, `mscomm_orders` — perdus au changement d'appareil. |

**Conséquence directe sur la demande.** « Comptes totaux », « nouveaux comptes cette semaine », « clients n'ayant
jamais commandé », « dernière connexion », « photos favorites », « créations » ne sont **pas dérivables** des données
actuelles : ils exigent la brique compte. À l'inverse, « clients ayant déjà commandé », « clients multi-commandes »,
« total dépensé », « nombre de commandes » sont calculables **immédiatement** par agrégation de `orders.json` sur
l'email normalisé.

D'où le découpage : Overview + Clients dérivés des commandes en phase 1 (valeur immédiate, zéro risque), comptes réels
en phase 2, enrichissement de Clients en phase 3, Atelier en phase 4.

---

## 2. Architecture cible

### 2.1 Vue d'ensemble

```
GitHub Pages (statique)                Fly.io — Node/Express
─────────────────────────              ─────────────────────────────────────────
photos.html ─ lightbox photo           /api/public/*          (catalogue, ZIP)
  ├ Favoris          ───────────────▶  /api/account/*         (NOUVEAU, session client)
  ├ Télécharger      ───────────────▶  /api/public/photos/:id/download
  └ Personnaliser    ───────────────▶  atelier.html (NOUVEAU)

compte.html (NOUVEAU)  ─────────────▶  /api/account/session|favorites|creations|orders
atelier.html (NOUVEAU) ─────────────▶  /api/account/creations

admin SPA                              /api/admin/overview    (NOUVEAU, agrégat unique)
  ├ Overview (refonte)  ────────────▶  /api/admin/clients     (NOUVEAU, liste + détail)
  └ Clients (nouvel onglet)
```

### 2.2 Nouveaux fichiers de données (`photo-server/db/`)

`accounts.json`
```json
[{
  "id": "uuid",
  "email": "lois@example.com",
  "emailNormalized": "lois@example.com",
  "firstName": "Loïs", "lastName": "ADAM",
  "passwordHash": "$2b$12$...",
  "status": "active|blocked",
  "createdAt": "ISO", "updatedAt": "ISO",
  "lastLoginAt": "ISO|null",
  "lastSeenAt": "ISO|null",
  "marketingOptIn": false
}]
```

`client-events.json` — journal append-only borné (même stratégie que `analytics.js` : plafond + rétention)
```json
[{ "accountId": "uuid", "type": "login|album_view|photo_view|favorite_add|favorite_remove|download|creation_saved",
   "photoId": null, "albumId": null, "ts": 1756600000000 }]
```

`favorites.json`
```json
[{ "accountId": "uuid", "photoId": "uuid", "createdAt": "ISO" }]
```

`creations.json` (Atelier, phase 4)
```json
[{ "id": "uuid", "accountId": "uuid", "photoId": "uuid", "product": "poster|mug|tirage",
   "config": { "format": "A3", "cadre": "noir", "texte": "..." },
   "previewPath": "storage/creations/<id>.jpg",
   "status": "draft|ordered", "orderId": null, "createdAt": "ISO", "updatedAt": "ISO" }]
```

Tous passent par `db.mutate(name, fn)` (verrou fichier + écriture atomique déjà en place). Aucun nouveau moteur de
stockage : la volumétrie réelle (2233 photos, 23 albums, 3 commandes) ne le justifie pas, et le volume Fly `/data`
reste la source unique.

### 2.3 Sessions client vs session admin

Deux périmètres distincts sur la même `express-session` :

- `req.session.authenticated === true` → admin (inchangé, `requireAuth`).
- `req.session.accountId` → client. Nouveau middleware `photo-server/middleware/requireAccount.js`.

Un client ne doit jamais atteindre `/api/admin/*` : `requireAuth` ne teste que `authenticated`, donc l'isolation est
acquise tant qu'on ne pose pas `authenticated` à la connexion client. Règle inverse : `requireAccount` ne teste que
`accountId`. Rate-limit dédié sur `/api/account/login` et `/api/account/register`, aligné sur `authLimiter`.

### 2.4 Rattachement des commandes existantes

Clé de jointure = **email normalisé**. Une commande passée avant la création du compte est rattachée automatiquement
dès qu'un compte est créé avec le même email. C'est ce qui rend les commandes historiques immédiatement visibles dans
la fiche client, sans migration destructive. `orders[].accountId` est écrit à la création de commande quand une session
client existe et sert de clé prioritaire ; l'email reste le repli.

---

## 3. Contrats API

### 3.1 `GET /api/admin/overview?range=7d|30d|90d|12m`

Agrégat unique qui remplace les appels dispersés du dashboard.

```json
{
  "range": "30d",
  "generatedAt": "ISO",
  "kpis": {
    "revenue":   { "value": 1.5, "previous": 0.5, "deltaPct": 200, "unit": "eur" },
    "orders":    { "value": 3,   "previous": 1,   "deltaPct": 200 },
    "clients":   { "value": 2,   "previous": 1,   "deltaPct": 100 },
    "aov":       { "value": 0.5, "previous": 0.5, "deltaPct": 0, "unit": "eur" },
    "visits":    { "value": 200, "previous": 180, "deltaPct": 11 },
    "uniqueVisitors": { "value": 90, "previous": 84, "deltaPct": 7 },
    "downloads": { "value": 12,  "previous": 9,   "deltaPct": 33 },
    "conversion":{ "value": 1.5, "previous": 0.6, "deltaPct": 150, "unit": "pct" }
  },
  "series": {
    "revenue": [{ "day": "2026-08-01", "revenue": 0, "orders": 0 }],
    "traffic": [{ "day": "2026-08-01", "visits": 0, "unique": 0, "downloads": 0 }],
    "hourly":  [0, 0, 0],
    "photoGrowth": [{ "month": "2026-08", "count": 0 }]
  },
  "top": {
    "photos":  [{ "id": "", "title": "", "thumb": "", "count": 0 }],
    "albums":  [{ "id": "", "name": "", "type": "", "thumb": "", "count": 0 }],
    "sold":    [{ "id": "", "title": "", "thumb": "", "count": 0, "revenue": 0 }],
    "clients": [{ "id": "", "displayName": "", "email": "", "orders": 0, "spent": 0 }]
  },
  "health": {
    "flickr":  { "configured": true, "breakerOpen": false, "secondsUntilOpen": 0 },
    "worker":  { "online": false, "queued": 0, "failed": 0 },
    "storage": { "bytes": 0, "photos": 2233, "albums": 23, "trash": 0 },
    "server":  { "rssMb": 0, "uptimeMin": 0 }
  },
  "attention": [
    { "level": "warn", "code": "photos_without_watermark", "count": 12, "action": "photos?filter=no-watermark" }
  ]
}
```

`deltaPct` compare toujours la période courante à la période précédente de même longueur — sans ça un chiffre isolé
n'informe pas. `attention[]` est ce qui manque le plus au dashboard actuel : il transforme des compteurs passifs en
file de travail (photos sans filigrane, jobs ZIP en échec, breaker Flickr ouvert, commandes `pending` depuis plus de
48 h, albums privés sans code).

### 3.2 `GET /api/admin/clients`

Query : `search`, `segment=all|buyers|prospects|repeat|inactive`, `sort=spent|orders|recent|name`, `page`, `pageSize`.

```json
{
  "summary": {
    "totalAccounts": 0, "newThisWeek": 0, "newThisMonth": 0,
    "withOrders": 0, "withoutOrders": 0, "repeatBuyers": 0,
    "guestBuyers": 3, "activeLast30d": 0,
    "totalRevenue": 1.5, "avgSpentPerBuyer": 0.5, "repeatRate": 0
  },
  "clients": [{
    "id": "uuid|guest:email",
    "type": "account|guest",
    "displayName": "Loïs ADAM", "email": "",
    "createdAt": "ISO|null", "lastLoginAt": "ISO|null", "lastActivityAt": "ISO",
    "albumsViewed": 3, "favorites": 12, "downloads": 4, "creations": 2,
    "orders": 1, "spent": 0.5, "lastOrderAt": "ISO|null"
  }],
  "page": 1, "pageSize": 25, "total": 4
}
```

Le type `guest` est essentiel : il rend visibles les acheteurs historiques sans compte au lieu de les faire disparaître
de la section Clients. Un `guest` bascule en `account` dès qu'un compte partage son email.

### 3.3 `GET /api/admin/clients/:id`

Fiche complète : identité, compteurs, `timeline[]` (30 derniers événements), `orders[]` (lignes photo + miniatures),
`favorites[]`, `creations[]`, `topAlbums[]`.

### 3.4 `/api/account/*` (session client)

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/api/account/register` | email + mot de passe (10 caractères minimum) + prénom/nom ; rattache les commandes existantes |
| `POST` | `/api/account/login` | ouvre la session client, écrit `lastLoginAt` + événement `login` |
| `POST` | `/api/account/logout` | détruit la session client uniquement |
| `GET` | `/api/account/me` | profil + compteurs (favoris, créations, commandes, total dépensé) |
| `GET` / `POST` / `DELETE` | `/api/account/favorites` | liste / ajout / retrait |
| `GET` | `/api/account/orders` | commandes rattachées, remplace la dépendance `localStorage` |
| `GET` / `POST` / `DELETE` | `/api/account/creations` | brouillons Atelier |
| `POST` | `/api/account/events` | journalisation best-effort (vue album/photo) |

---

## 4. Refonte de l'Overview admin

### 4.1 Diagnostic de l'existant

`#page-dashboard` empile aujourd'hui 5 « catégories » et environ 15 blocs de même poids visuel : 8 `stat-card`
identiques, 6 graphiques maison en `<div>` de hauteur proportionnelle, 4 listes. Trois problèmes concrets :

1. **Aucune hiérarchie.** « Mémoire serveur » reçoit exactement le même traitement visuel que « Revenu 30j ».
   L'œil n'a aucun point d'entrée.
2. **Aucun contexte temporel.** Les valeurs sont absolues, jamais comparées à la période précédente.
   « 12 téléchargements » ne dit pas si c'est bien.
3. **Aucune action.** Le dashboard informe mais ne dirige jamais vers une tâche.

### 4.2 Structure cible

```
┌─ En-tête ──────────────────────────────────────────────────────────┐
│ Vue d'ensemble          [7j] [30j] [90j] [12m]    maj il y a 2 min │
└────────────────────────────────────────────────────────────────────┘
┌─ Bandeau « À traiter » (seulement si attention[] non vide) ─────────┐
│ ! Breaker Flickr ouvert · 12 photos sans filigrane · 1 cmd en attente│
└────────────────────────────────────────────────────────────────────┘
┌─ 4 KPI primaires (valeur + delta + sparkline) ─────────────────────┐
│ Revenu   Commandes   Clients actifs   Taux de conversion           │
└────────────────────────────────────────────────────────────────────┘
┌─ Revenu & commandes (graphe principal, 2/3) ─┬─ Top clients (1/3) ─┐
├─ Trafic : visites / uniques / téléchargements ┼─ Top photos vendues ┤
├─ Heures de pointe                             ┼─ Top albums        ┤
└───────────────────────────────────────────────┴────────────────────┘
┌─ Catalogue & système (replié par défaut) ──────────────────────────┐
│ Photos · Albums · Stockage · Mémoire · Flickr · Croissance 12 mois  │
└────────────────────────────────────────────────────────────────────┘
```

Principe : **un seul niveau de lecture par bande**. Les métriques d'infrastructure descendent sous la ligne de
flottaison parce qu'elles ne se consultent qu'en cas de problème — et le bandeau « À traiter » remonte justement le
problème quand il existe.

### 4.3 Contraintes UI (registre `product` d'`$impeccable`)

- Réutiliser les tokens existants de `photo-server/admin/css/admin.css` (`--bg`, `--bg-card`, `--gold`, `--border`).
  Aucune nouvelle identité : le panel a déjà la sienne.
- Une seule famille (Inter), échelle rem fixe, pas de `clamp()`.
- Or (`--gold`) réservé à l'action primaire, la sélection courante et la série principale. Bleu/vert/rouge = sémantique
  d'état seulement.
- `border-radius` plafonné à 12 px sur les cartes. Jamais bordure 1 px et ombre large sur le même élément.
- Transitions 150–250 ms, `prefers-reduced-motion` respecté, aucune chorégraphie au chargement.
- Skeletons au chargement, pas de spinner centré. États vides qui expliquent quoi faire.
- Responsive structurel : 4 → 2 → 1 colonne ; tableau clients en cartes sous 600 px.

### 4.4 Graphiques

On garde du SVG maison, sans dépendance : Chart.js pour six graphes sur un panel déjà chargé (216 ko de JS) n'est pas
justifié. Un module `admin/js/charts.js` expose `lineChart`, `barChart` et `sparkline` avec axes, grille, tooltip au
survol et `aria-label` — ce que l'implémentation actuelle en `<div>` empilés ne permet pas.

---

## 5. Côté client / visiteur

### 5.1 Lightbox photo

Barre d'action unifiée sous la photo :

```
Photo n°142 — Fang ZHU / Yuhua LIU
[Favori]  [Télécharger]  [Personnaliser avec cette photo]
```

- **Favori** : optimiste côté UI, `POST /api/account/favorites`. Sans session, une modale de connexion contextuelle
  s'ouvre et le favori est rejoué après connexion.
- **Télécharger** : logique de droits inchangée (`free`, `free-watermark`, `paid`, `private`).
- **Personnaliser** : ouvre `atelier.html?photo=<id>` avec la photo présélectionnée.

### 5.2 En-tête « Mon espace »

Icône compte en haut à droite de toutes les pages. Déconnecté, « Mon espace » ouvre connexion/inscription. Connecté,
le menu propose : **Mes favoris · Mes créations · Mes commandes · Mes albums privés · Mes informations · Se déconnecter**.

« Mes albums privés » n'était pas demandé mais résout un vrai irritant : aujourd'hui un code d'album privé vit en
`sessionStorage` et disparaît. Rattaché au compte, il devient permanent.

### 5.3 L'Atelier MS Comm' (phase 4)

`atelier.html` : photo sélectionnée à gauche, configurateur à droite (produit, format, cadre, texte), aperçu live,
enregistrement en brouillon (`creations.json`), ajout au panier réutilisant le flux Stripe existant.

Le rendu haute définition reste **serveur** via `sharp` (`services/imageProcessor.js` déjà en place) et n'est déclenché
qu'à la commande payée : le VM Fly est un `shared-cpu-1x` et ne doit pas composer une image à chaque aperçu. L'aperçu
est une composition CSS/canvas côté navigateur.

---

## 6. Phases

| Phase | Contenu | Dépendances | Risque |
|---|---|---|---|
| **1** | `services/insights.js`, `GET /api/admin/overview`, `GET /api/admin/clients(/:id)` dérivés des commandes ; refonte UI Overview + onglet Clients | aucune | faible — lecture seule |
| **2** | `accounts.json`, `/api/account/*`, `requireAccount`, en-tête « Mon espace », favoris | phase 1 | moyen — authentification |
| **3** | Enrichissement Clients (comptes, favoris, dernière connexion, timeline), journal `client-events.json` | phase 2 | faible |
| **4** | Atelier MS Comm', `creations.json`, rendu serveur à la commande | phases 2–3 | moyen — CPU Fly |

La phase 1 ne touche à aucune donnée existante : elle n'ajoute que des routes en lecture et remplace le rendu du
dashboard. C'est ce qui la rend déployable seule.

## 7. Vérification par phase

- Phase 1 : tests unitaires sur `insights.js` (agrégation par email, delta période précédente, segmentation), appel
  réel des deux routes sur le serveur local, contrôle visuel de l'Overview aux trois breakpoints.
- Phase 2 : tests des règles d'auth (un client ne peut pas atteindre `/api/admin/*`, admin non authentifié refusé,
  rattachement des commandes par email).
- Phase 3 : test du plafonnement et de la rétention de `client-events.json`.
- Phase 4 : test du rendu serveur sur une création, mesure CPU sur le VM Fly avant activation.

