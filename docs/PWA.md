# Medicare en Progressive Web App

Medicare s’installe depuis le navigateur, sans changer les rôles, les permissions ni les routes existantes.

## Identité

- Nom et nom court : Medicare
- Affichage : `standalone` (sans barre du navigateur une fois installée)
- Couleur : `#0f6e6e`
- Fond de lancement : `#f4fafa`, avec le logo déjà utilisé par l’écran `#boot`
- Icônes : `public/icons/` (192, 512, maskable 512, Apple 180)
- Manifeste : `public/manifest.webmanifest`

## Installation

Le bandeau « Installer Medicare » apparaît tant que l’application n’est pas installée.

- Chrome, Edge et Android : le bouton ouvre la fenêtre native `beforeinstallprompt`.
- iPhone et iPad : Safari n’a pas cette fenêtre. Le bandeau explique : Partager, puis « Sur l’écran d’accueil ».
- Le bandeau disparaît en mode `standalone`, y compris `navigator.standalone` sur iOS.

## Hors connexion

`public/sw.js` met en cache uniquement l’habillage public : page hors connexion, icônes, manifeste, images et fichiers statiques du site. En production, un fichier statique déjà vu peut s’afficher pendant qu’une version plus récente est téléchargée.

Ne sont jamais mis dans le Cache Storage :

- les requêtes autres que GET ;
- tout ce qui commence par `/api` ;
- les requêtes vers un autre domaine (l’API est sur un autre port) ;
- les requêtes qui portent un en-tête `Authorization`.

En développement (`localhost`, `127.0.0.1`), le service worker ne met pas en cache les modules Vite, pour laisser le rechargement à chaud fonctionner. La page `public/offline.html` s’affiche si une navigation échoue. Un bandeau « Hors connexion » suit les événements `online` et `offline`.

Aucune saisie médicale n’est enregistrée hors connexion. Il n’y a pas de file d’attente à synchroniser plus tard.

## Mise à jour

Une nouvelle version du service worker s’active sans recharger la page. Le bouton « Mettre à jour » recharge ensuite, pour ne pas effacer un formulaire en cours. La déconnexion envoie `CLEAR` : les caches locaux sont vidés et l’abonnement push de l’appareil est retiré.

## Notifications

Web Push avec les clés VAPID déjà présentes côté serveur. N’importe quel utilisateur connecté peut activer ou révoquer les notifications dans Profil. Les gardes infirmières utilisent le même abonnement. Le serveur limite le titre à 80 caractères, le texte à 140, et n’accepte qu’une adresse interne. La déconnexion supprime les abonnements de l’utilisateur. Un envoi refusé par le navigateur (404 ou 410) supprime l’abonnement.

Les messages de garde indiquent l’horaire et le service, pas un dossier patient. Le détail clinique reste dans l’application.

## Sécurité

Le HTTPS est déjà imposé en production, pas sur la machine locale. La session reste un jeton JWT dans `localStorage` (`auth_token`) : ce n’est pas un cookie. Les pages privées redirigent vers `/login`. Une session expirée vide le cache installé. Les réponses médicales ne sont pas mises en cache.

## Mobile

La barre du bas, le menu latéral à partir de la tablette, les marges et les fenêtres déjà empilées sur petit écran sont conservés. Ajouts : zone sûre autour de l’encoche, et défilement horizontal des tableaux trop larges. Les fonctions bureau restent en place.

## Contrôles déjà faits en local

Sur `http://127.0.0.1:8080` :

- le manifeste, le service worker, la page hors connexion et les quatre icônes répondent ;
- le service worker est actif et son cache ne contient que l’habillage public listé plus haut ;
- le bandeau hors connexion apparaît puis disparaît quand la connexion revient ;
- avec un navigateur identifié comme iPhone, le guide Safari « Sur l’écran d’accueil » s’affiche ;
- la page d’accueil tient dans une largeur de 390 px sans défilement horizontal ;
- `GET /api/push/key` sans session répond 401 ;
- le contrôle automatique du service worker confirme qu’une réponse `/api` n’est pas mise en cache, et que le texte d’une notification est tronqué.

Lighthouse 13.6.0 n’a plus de catégorie PWA : la commande `--only-categories=pwa` est refusée. Aucune note n’est donc inventée. L’installation réelle sur Android, iPhone, Windows et macOS, ainsi que le plein écran et une notification reçue sur un téléphone, se vérifient sur un site servi en HTTPS.
