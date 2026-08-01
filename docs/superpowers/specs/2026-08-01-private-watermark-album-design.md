# Album privé avec filigrane uniquement

## Objectif

Ajouter un cinquième type d'accès d'album, `private-watermark`, accessible par code comme `private`, mais ne permettant jamais de télécharger une photo originale sans filigrane.

Le type `private` existant reste inchangé et continue d'autoriser les téléchargements avec ou sans filigrane après validation du code.

## Expérience administrateur

La modale de création et de modification d'album ajoute l'option :

> Privé — accès par code, filigrane uniquement

Ce type affiche les mêmes champs que `private` : code d'accès, génération du code, emails clients et envoi du code. Les badges et le lien de partage l'identifient comme un album privé. Le lien partagé reste `photos.html?private=1` et ne contient jamais le code.

Les photos importées ou déplacées dans cet album suivent les règles privées existantes : elles sont absentes des API publiques et leurs copies Flickr restent privées.

## Expérience visiteur

Le code d'un album `private-watermark` se saisit dans la modale privée existante. Après validation, l'album et toutes ses photos deviennent visibles pour cette session, comme un album `private`.

Le téléchargement expose uniquement la version filigranée :

- le menu d'une photo ne propose que « Avec filigrane » ;
- les téléchargements groupés, sélectionnés ou complets, ne proposent que « Avec filigrane » ;
- aucun bouton « Sans filigrane » ou « Original » n'est rendu.

La réponse de validation du code transmet le type d'accès de l'album afin que le frontend choisisse les actions autorisées.

## Sécurité serveur

Tous les endpoints de téléchargement contrôlent le type réel de l'album, indépendamment du bouton utilisé : téléchargement individuel, vérification ZIP, ZIP groupé et liste d'URLs.

Pour `private-watermark` :

- le code valide reste obligatoire ;
- toute demande `mode=original`, `wm=0` ou équivalente reçoit `403` ;
- la source doit être une copie filigranée existante ou un flux auquel le serveur applique effectivement le filigrane ;
- une copie originale brute ne sert jamais de secours à une demande filigranée ;
- si aucune version filigranée sûre n'est disponible, la requête échoue avec un message clair invitant à réparer le filigrane depuis l'admin.

Les albums `private`, `private-nocode`, `public` et `paid` conservent leurs règles actuelles.

## Données et compatibilité

Le nouveau type est stocké dans le champ `album.type`; aucune migration de schéma n'est nécessaire. Aucun album existant n'est converti automatiquement. Modifier un album vers ou depuis `private-watermark` conserve ou supprime le code selon les mêmes règles que les autres types avec ou sans code.

Toutes les fonctions qui déterminent si un album est privé doivent reconnaître `private-watermark` : masquage de la galerie publique, validation par code, import/déplacement de photos, visibilité Flickr, partage et email.

## Erreurs et cas limites

- Code absent ou incorrect : `401`, comportement existant.
- Original demandé dans `private-watermark` : `403`, même avec un code valide.
- Filigrane absent ou illisible : aucun original brut envoyé ; erreur explicite.
- Ancien album `private` : téléchargement original toujours disponible.
- Changement de type d'un album : les photos restent privées et les champs code/email restent disponibles pour les deux types privés par code.

## Validation

Tests ciblés :

1. création et modification d'un album `private-watermark` avec conservation du code et des emails ;
2. album absent des listes publiques avant validation du code ;
3. code valide retournant l'album, ses photos et son type ;
4. frontend affichant uniquement les actions filigranées ;
5. téléchargement individuel filigrané autorisé ;
6. ZIP filigrané autorisé ;
7. demandes directes d'original refusées par chaque endpoint ;
8. absence de copie filigranée ne provoquant jamais la fuite de l'original ;
9. non-régression du mode `private` existant.

