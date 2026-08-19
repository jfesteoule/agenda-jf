# Proposition : connexion Google multi-comptes pour l'agenda

## 1. Constat sur l'existant

Aujourd'hui, `index.html` est une page **statique** (probablement servie par GitHub Pages)
sans aucun backend :

- Les événements (`EVT_JF`, `EVT_ANNE`) sont **codés en dur dans le HTML** au moment où la
  page est générée, et dupliqués dans `events.json` à la racine du repo.
- Le bouton "Synchroniser" (`syncbtn`) ne fait *pas* d'appel à l'API Google Calendar : il
  télécharge à nouveau `events.json` depuis jsDelivr/GitHub. C'est donc un rafraîchissement
  d'un export déjà figé, pas une vraie synchronisation.
- Il n'existe **aucune authentification** dans le code : `events.json` est généré en dehors
  de ce repo (export manuel ou script externe) à partir d'un compte Google unique et
  toujours le même. C'est ça, le "tout est en dur" : impossible pour quelqu'un d'autre
  d'ouvrir la page et de voir *son propre* agenda Google.

## 2. Objectif

Permettre à n'importe quel visiteur de la page de :
1. Se connecter avec **son propre compte Google** (bouton "Se connecter").
2. Choisir **ses propres agendas** Google Calendar à afficher.
3. Changer de compte / se déconnecter facilement.

Sans rien committer dans le repo, et sans exposer de secret côté client.

## 3. Deux architectures possibles

### Option A — 100 % côté navigateur (recommandée)

On utilise **Google Identity Services (GIS)**, déjà chargé dans `index.html`
(`accounts.google.com/gsi/client`), avec le flux *token client* (OAuth implicite) :

- Aucun backend, aucun secret à protéger : le "Client ID" OAuth n'est pas confidentiel,
  seule l'origine JavaScript autorisée compte (contrôlée dans Google Cloud Console).
- Colle parfaitement au caractère "site statique gratuit" du repo actuel.
- Chaque visiteur obtient un jeton d'accès **dans son propre navigateur**, qui sert à
  appeler directement `www.googleapis.com/calendar/v3/...` en `fetch()`.
- Limite : le jeton expire au bout d'~1h. Il faut le redemander (silencieusement si la
  session Google du navigateur est encore active, sinon l'utilisateur reclique).
  Pas de synchronisation automatique en tâche de fond quand la page est fermée.

### Option B — avec un petit backend

Flux OAuth "authorization code" classique : un serveur (Cloud Function, Vercel, etc.)
échange le code contre un `refresh_token`, le stocke, et peut ensuite interroger l'API
Google Calendar même quand l'utilisateur n'est pas devant son navigateur.

- Nécessaire seulement si on veut : une synchro automatique en arrière-plan, écrire des
  événements, ou stocker durablement l'accès à plusieurs comptes côté serveur.
- Implique d'héberger une API et une base de données (stockage des refresh tokens par
  utilisateur) → sort du cadre "site statique gratuit" actuel, coûts et maintenance en plus.

### Recommandation

**Option A** répond directement au besoin exprimé ("ne pas avoir un compte figé en dur",
pouvoir changer de compte) sans changer l'hébergement du projet. L'option B ne devient
utile que si un jour on veut une synchro automatique sans interaction utilisateur.

## 4. Mise en place côté Google Cloud Console (à faire par le propriétaire du repo)

Cette étape ne peut pas être faite par un agent : elle nécessite un accès à votre
compte Google Cloud.

1. Créer (ou réutiliser) un projet sur https://console.cloud.google.com/.
2. Activer l'**API Google Calendar** (menu "APIs & Services" → "Library").
3. Configurer l'**écran de consentement OAuth** ("OAuth consent screen") :
   - Type "External" (ou "Internal" si compte Google Workspace).
   - Scope à ajouter : `https://www.googleapis.com/auth/calendar.readonly`.
   - Tant que l'appli n'est pas "publiée", seuls les comptes ajoutés comme "testeurs"
     pourront se connecter — pratique pour tester à deux (JF + Anne) avant publication.
4. Créer un **identifiant OAuth 2.0** de type "Application Web" ("Credentials" →
   "Create Credentials" → "OAuth client ID") :
   - **Origines JavaScript autorisées** : l'URL exacte de la page (ex.
     `https://jfesteoule.github.io`), + `http://localhost:xxxx` pour les tests locaux.
   - Pas besoin d'"URI de redirection" avec le flux token client.
5. Copier le "Client ID" généré (`....apps.googleusercontent.com`).

## 5. Ce qui a été implémenté dans ce prototype

Sur la branche `claude/google-auth-calendar-api-xrvdg5`, `index.html` contient déjà :

- Un bouton **"G"** dans la barre du haut, à côté du bouton de synchro existant.
- Un module JS (`GOOGLE_CLIENT_ID`, `connectGoogleAccount`, `onGoogleTokenReceived`, ...)
  qui initialise le token client GIS et demande le scope `calendar.readonly`.
- Une fenêtre de sélection des agendas (`#gcal-overlay`) : après connexion, l'appli
  appelle `GET /users/me/calendarList` et affiche la liste des agendas du compte connecté,
  avec pour chacun une case à cocher et un choix "JF" (droite) / "Anne" (gauche).
- `syncFromGoogle()` appelle `GET /calendars/{id}/events` (avec pagination) pour chaque
  agenda sélectionné, sur la fenêtre `2023-01-01 → 2023-01-01 + 5 ans` (identique à
  `TOTAL_DAYS`), et remplace `EVT_JF` / `EVT_ANNE` / `ALL_EVENTS` avec les vrais
  événements du compte connecté — exactement comme le fait déjà `syncAllCalendars()`
  pour `events.json`.
- La sélection d'agendas est mémorisée dans `localStorage` (**du navigateur du visiteur**,
  jamais commité dans le repo) : à la revisite, si la session Google du navigateur est
  encore active, la resynchro se fait automatiquement.
- Un bouton "Déconnexion" qui révoque le jeton, efface la sélection locale, et retombe
  sur l'affichage statique (`events.json`) par défaut.

### Ce qu'il reste à faire pour que ça marche réellement

1. **Remplacer `GOOGLE_CLIENT_ID`** (en haut du bloc "CONNEXION GOOGLE" dans `index.html`)
   par le vrai Client ID créé à l'étape 4 ci-dessus. Sans ça, le bouton affiche un message
   d'erreur explicite au lieu de planter.
2. Ajouter l'URL réelle du site (GitHub Pages) dans les origines JS autorisées.
3. Tester avec 2 comptes Google différents (ex. celui de JF et celui d'Anne) pour valider
   que chacun voit bien *ses* agendas, indépendamment de ce qui est commité dans le repo.

### Limites connues de ce prototype

- Le jeton d'accès expire après ~1h ; sans interaction, il faut rouvrir la page ou
  recliquer sur "G" pour resynchroniser (pas de tâche de fond).
- La correspondance "1 agenda Google = 1 côté JF/Anne" est volontairement simple ; on
  peut affiner plus tard (plusieurs agendas par côté, couleurs par agenda plutôt que par
  côté, etc.) — le prototype gère déjà plusieurs agendas par côté.
- Les événements multi-jours ne sont pas encore reliés au rendu spécifique
  `drawMultiDayEvents()` déjà présent dans le fichier (ils sont importés comme un
  événement ponctuel au jour de début).
- `events.json` reste utilisé comme affichage par défaut / démo pour les visiteurs qui ne
  se connectent pas.

## 6. Étapes suivantes suggérées

1. Valider cette proposition et créer le Client ID OAuth (section 4).
2. Le renseigner dans `index.html`, tester en local puis sur GitHub Pages.
3. Décider si `events.json` doit rester comme fallback définitif, ou si on peut le
   supprimer une fois la connexion Google fiable pour tout le monde.
4. Si un besoin de synchro automatique sans interaction apparaît plus tard, réévaluer
   l'option B (backend + refresh token).
