# Tracking visiteurs & statistiques admin

Objectif : journaliser tout ce qu'un visiteur fait sur le site (connecté ou non), le rattacher à un
compte quand il se connecte, et exposer dans le panel admin des statistiques par photo, par album,
par visiteur et globales, toutes cliquables / filtrables / rescalables. Rien n'est exposé publiquement.

## 1. Collecte côté site — `assets/js/track.js`

- Chargé sur toutes les pages publiques (`<script src="assets/js/track.js" defer>`) après `account.js`.
- Identifiants : `vid` (visiteur, UUID persistant en `localStorage` `ms_vid`), `sid` (session,
  `sessionStorage` `ms_sid`, renouvelé après 30 min d'inactivité).
- Envoi : file d'attente, flush toutes les 5 s (ou dès 40 événements) ou sur `pagehide`/
  `visibilitychange:hidden` via `navigator.sendBeacon` (repli `fetch keepalive`, `credentials:'include'`
  pour que le cookie de session rattache le compte). Corps JSON `{ vid, sid, ctx, events:[...] }` vers
  `POST /api/public/track` (Content-Type `text/plain` pour sendBeacon, `application/json` accepté aussi ; réponse
  toujours `204`, même sur un lot invalide — un tracker ne doit jamais faire échouer la page).
- Chaque événement : `{ t: <type>, ts, path, page, photoId?, albumId?, meta? }`.
  Le contexte navigateur est envoyé dans l'enveloppe : `ua, lang, langs, screen, viewport, tz,
  ref (document.referrer), platform, touch, dpr, connection`.
- Heartbeat : `heartbeat` toutes les 20 s **uniquement si l'onglet est visible** avec
  `meta.activeMs` (temps actif cumulé depuis le dernier heartbeat). La durée de session est
  calculée côté serveur.
- API JS : `window.MSTrack.event(type, data)`, `MSTrack.identify()` (flush immédiat), `MSTrack.flush()`,
  `MSTrack.vid`, `MSTrack.sid`. `data.photoId`/`data.albumId` deviennent des colonnes, le reste part dans `meta`.
  `account.js` appelle `identify()` dans `applySession()` et envoie l'en-tête `X-MS-Vid` sur tous ses appels
  API ; `register`/`login` écrivent l'événement serveur `signup`/`login` et `linkVisitorToAccount()` rattache
  rétroactivement sessions et événements anonymes du même `vid`. Le lien est décidé sur le journal lui‑même, pas
  sur la ligne visiteur (qui peut déjà porter l'`accountId`), sinon le passé resterait anonyme.
- Pages instrumentées : `photos.html` (`view_change`, `album_view` avec `meta.count`, `photo_view` avec
  `meta.source` grid|nav, `search`, `filter`, `share`, `private_unlock`, `download_click`, `zip_start/done/fail`,
  `cart_add/remove`, `checkout_start`), `account.js` (`account_open` avec `meta.mode`/`reason`), `i18n.js`
  (`lang_change` avec `meta.lang`/`from`). `page_view`/`session_start`/`heartbeat`/`session_end` sont
  automatiques sur toutes les pages.
- Dédoublonnage lecture : `stats.js` compte une seule `photo_view`/`album_view` par visiteur et par cible dans une
  fenêtre de 30 s (le passage grid → lightbox → suivant → précédent ne gonfle pas les vues).
- En‑tête CORS : `X-MS-Vid` est dans `allowedHeaders` (`server.js`), sinon le navigateur bloque le preflight.

### Types d'événements

| type | émis par | données |
|------|----------|---------|
| `session_start` | track.js (nouvelle sid) | `meta.landing`, `ref` |
| `page_view` | track.js (chaque page) | `path`, `page` (index/photos/services…), `meta.title` |
| `heartbeat` | track.js | `meta.activeMs` |
| `session_end` | track.js (pagehide) | `meta.activeMs` |
| `view_change` | photos.html | `meta.view` (timeline/albums/favorites/purchased) |
| `album_view` | photos.html | `albumId` |
| `photo_view` | photos.html (lightbox) | `photoId`, `albumId`, `meta.source` (grid/nav/share) |
| `search` | photos.html | `meta.q`, `meta.results` |
| `filter` | photos.html | `meta.name`, `meta.value` |
| `share` | photos.html | `photoId` |
| `private_unlock` | photos.html | `albumId`, `meta.ok` |
| `download_click` | photos.html | `photoId`, `meta.mode` (watermark/original), `meta.resolution` |
| `zip_start` / `zip_done` / `zip_fail` | photos.html | `albumId`, `meta.mode`, `meta.count`, `meta.selectedOnly` |
| `cart_add` / `cart_remove` / `checkout_start` | photos.html / checkout.html | `photoId`, `meta.total` |
| `lang_change` | i18n.js | `meta.lang` |
| `contact_submit` | contact.html | — |
| `account_open` | account.js (modale ouverte) | `meta.mode` |

### Événements écrits côté serveur (non falsifiables)

`download` (photo), `album_download` (ZIP serveur / URL list), `favorite_add`, `favorite_remove`,
`login`, `signup`, `logout`, `order` (commande payée). Ils portent `accountId` et, si l'appel
transporte `X-MS-Vid` ou le cookie `ms_vid`, le `vid`.

## 2. Stockage — `photo-server/services/tracking.js`

- `db/track-events.json` : journal append-only, cap 60 000 entrées / 180 jours (comme
  `client-events`). Entrée : `{ id, ts, vid, sid, accountId, type, path, page, photoId, albumId,
  meta, ip, ua, lang, ref, tz, screen, device:{type,os,browser} }`.
  L'IP brute est conservée (demande explicite), jamais exposée hors admin.
- `db/track-sessions.json` : une entrée par `sid` : `{ sid, vid, accountId, startAt, lastAt,
  endAt, activeMs, durationMs, pageViews, photoViews, albumViews, downloads, pages:[path…],
  landing, exit, ref, ip, device, lang }`. Mise à jour à chaque lot.
- `db/visitors.json` : une entrée par `vid` : `{ vid, accountId, firstSeenAt, lastSeenAt,
  lastIp, ips:[≤5], ua, device, lang, tz, screen, firstRef, landing, sessions, totalDurationMs,
  lastSessionAt, lastSessionDurationMs, pageViews, photoViews, albumViews, downloads, favorites,
  searches, lastPath }`.
- `linkVisitorToAccount(vid, accountId)` : au login/register — le visiteur anonyme devient le
  compte ; ses sessions et événements passés sont rattachés (`accountId` rempli rétroactivement).
- `online` = `lastSeenAt` < 2 min.

## 3. API admin — `photo-server/routes/adminStats.js` (`/api/admin/stats`, requireAuth)

Paramètres communs de période : `range=7d|30d|90d|12m|all` **ou** `from=YYYY-MM-DD&to=YYYY-MM-DD` ;
`granularity=day|week|month` (défaut auto : jour ≤ 90 j, semaine ≤ 12 mois, mois au-delà).
Toute réponse renvoie `{ range:{from,to,granularity,label}, generatedAt, ... }`.

| Route | Réponse |
|-------|---------|
| `GET /summary` | `totals:{visitors, newVisitors, identified, sessions, avgSessionMs, medianSessionMs, pageViews, photoViews, albumViews, downloads, zipDownloads, favorites, searches, signups, logins, orders, revenue, bounceRate}` + `previous` (même forme, période précédente) + `series:[{key, visitors, sessions, pageViews, photoViews, albumViews, downloads, favorites, orders, revenue, avgSessionMs}]` + `breakdown:{device, browser, os, lang, referrer, page, hour[24], weekday[7]}` (chaque clé : `[{key,label,count,pct}]`) + `top:{photos[10], albums[10], pages[10], searches[10]}` |
| `GET /photos?albumId=&sort=views|downloads|favorites|sales|revenue|recent&search=&page=&pageSize=` | `items:[{id,title,thumb,albumId,albumName,downloadType,price,views,uniqueViewers,downloads,favorites,sales,revenue,shares,lastViewedAt}]`, `total`, `totals` |
| `GET /photos/counts` | `{ [photoId]: {views, downloads, favorites, sales} }` sur la période — pour les badges de la liste photos (léger, cache 30 s) |
| `GET /photos/:id` | `photo:{…}`, `counters`, `previous`, `series[]` (views/downloads/favorites par granularité), `viewers:[{vid, accountId, displayName, ip, device, views, downloads, lastAt}]`, `referrers[]`, `events[]` (50 derniers enrichis) |
| `GET /albums?sort=views|uniqueVisitors|downloads|zip|revenue|recent` | `items:[{id,name,type,thumb,photoCount,views,uniqueVisitors,photoViews,downloads,zipDownloads,favorites,sales,revenue,avgTimeMs,lastViewedAt}]`, `totals` |
| `GET /albums/counts` | `{ [albumId]: {views, uniqueVisitors, downloads, zipDownloads} }` |
| `GET /albums/:id` | `album`, `counters`, `previous`, `series[]`, `topPhotos[]` (même forme que /photos items), `viewers[]`, `events[]` |
| `GET /visitors?segment=all|anonymous|identified|online|new|returning&sort=recent|duration|pageViews|sessions&search=&page=&pageSize=` | `items:[{vid, accountId, displayName, type:'account'|'visitor', online, lastIp, device, browser, os, lang, firstSeenAt, lastSeenAt, sessions, totalDurationMs, lastSessionDurationMs, pageViews, photoViews, albumViews, downloads, favorites, lastPath}]`, `summary`, `total` |
| `GET /visitors/:vid` | `visitor`, `account` (profil public si relié), `sessions:[{sid,startAt,endAt,durationMs,activeMs,pageViews,pages,landing,exit,ref,ip,device}]` (30 dernières), `journey:[événements enrichis, 200 derniers]`, `topAlbums`, `topPhotos`, `counters` |
| `GET /events?type=&photoId=&albumId=&vid=&accountId=&page=&pageSize=&sort=desc` | `items:[{id,ts,type,label,detail,vid,accountId,displayName,ip,device,photo:{id,title,thumb}?,album:{id,name}?,path,meta}]`, `total`, `types:[{key,count}]` — drill-down universel |

Compléments d'implémentation (`services/stats.js`) : `range=all` démarre au premier événement journalisé ;
`/photos` accepte aussi `onlyActive=1` et `sort=viewers`, `/albums` accepte `type=` et `sort=time|photoViews`,
`/visitors` accepte les segments `mobile|desktop` et `sort=downloads|first`, `/events` accepte `type=a,b`
(liste), `ip=`, `sid=`, `device=`, `browser=`, `os=`, `lang=`, `page=`, `referrer=` (hôte ou `direct`), `hour=0-23`,
`weekday=0-6` (lundi = 0), `includeHeartbeat=1` (les heartbeats sont masqués par défaut). `/photos/:id` renvoie aussi
`allTime`. `pageSize` est borné à 5–200. Toutes les réponses ajoutent `range.key` et `range.days`. Les `series[]`
portent aussi `views` (= `photoViews` + `albumViews`, ou seulement les vues de la cible sur `/photos/:id` et `/albums/:id`).

Sécurité : aucune de ces routes n'est publique (`requireAuth` = session admin). L'ingest public n'accepte que les
types clients (`CLIENT_EVENT_TYPES`) ; `download`, `album_download`, `favorite_*`, `login`, `signup`, `logout`,
`order` ne peuvent être écrits que par le serveur (`logServerEvent`), donc un visiteur ne peut pas se fabriquer des
téléchargements.

Libellés français des types (`label`) : fournis par le serveur (`EVENT_LABELS` dans `tracking.js`).

## 4. Vue d'ensemble & Clients

- `GET /api/admin/overview` accepte désormais `from/to/granularity` en plus de `range`, et ajoute
  `kpis.visitors, kpis.sessions, kpis.avgSessionMs, kpis.pageViews` et `breakdown` (device, referrer, lang).
  `series.traffic` est alimenté par le tracking quand il existe, sinon par `analytics-visits`.
- `GET /api/admin/clients` : nouveau segment `visitors` (anonymes), et chaque client porte
  `tracking:{ online, lastSeenAt, lastIp, device, browser, os, lang, sessions, totalDurationMs,
  lastSessionAt, lastSessionDurationMs, pageViews, photoViews, albumViews }`. Les visiteurs
  anonymes ont `type:'visitor'`, `id:'visitor:<vid>'`, `displayName:'Visiteur <ip>'`.
- `GET /api/admin/clients/:id` : ajoute `tracking`, `sessions[]` et `journey[]` (même forme que
  `/api/admin/stats/visitors/:vid`). `journey` est le parcours complet (pages, albums, photos,
  recherches, téléchargements), distinct de `timeline` (compte + commandes).
