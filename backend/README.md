# API MediCare

Backend de la phase fondations : établissements, comptes, authentification et isolation des données. Les modules cliniques du frontend (rendez-vous, consultations, examens, pharmacie, factures) ne sont pas encore branchés.

## Démarrage

```sh
cd backend
npm install
cp .env.example .env
# Renseigner MONGODB_URI et un JWT_SECRET d'au moins 32 caractères.
npm run dev
```

L'API écoute sur `http://localhost:3001/api`.

Création du premier superadmin, sans mot de passe par défaut dans le code :

```sh
SUPERADMIN_EMAIL="vous@exemple.fr" SUPERADMIN_PASSWORD="un-mot-de-passe-long" SUPERADMIN_FIRST_NAME="Ada" SUPERADMIN_LAST_NAME="Martin" npm run create-superadmin
```

Le mot de passe doit contenir au moins 12 caractères. La commande refuse de créer un second superadmin. Ne placez pas ce mot de passe dans `.env` versionné.

Sous PowerShell :

```powershell
$env:SUPERADMIN_EMAIL="vous@exemple.fr"
$env:SUPERADMIN_PASSWORD="un-mot-de-passe-long"
$env:SUPERADMIN_FIRST_NAME="Ada"
$env:SUPERADMIN_LAST_NAME="Martin"
npm run create-superadmin
```

## Variables

| Variable | Rôle |
|---|---|
| `PORT` | Port HTTP, 3001 par défaut |
| `MONGODB_URI` | Base partagée |
| `JWT_SECRET` | Signature HS256, 32 caractères minimum |
| `JWT_EXPIRES_IN` | Durée du jeton, 8h par défaut |
| `CORS_ORIGIN` | Origine du frontend Vite, `http://localhost:8080` |
| `BCRYPT_ROUNDS` | Coût bcrypt, 12 en dehors des tests |
| `LOGIN_RATE_LIMIT_MAX` | Tentatives de connexion par 15 minutes |

Le frontend lit `VITE_API_URL=http://localhost:3001/api`.

## Règle d'isolation

Chaque document d'établissement porte `organizationId`. Ce champ n'est jamais pris dans le corps envoyé par un utilisateur d'hôpital. Le middleware `requireTenant` le copie depuis l'utilisateur rechargé en base à chaque requête. Le jeton ne contient que l'identifiant de compte et un numéro de version : le rôle et l'hôpital viennent de MongoDB.

Le superadmin n'a pas d'hôpital. Il crée les établissements, les suspend et crée leur premier administrateur. Les routes patients répondent 403 pour ce rôle : il ne lit pas les dossiers médicaux.

Le champ `plan` est réservé aux futurs abonnements. Aucune limite n'est appliquée.

## Endpoints de cette phase

Préfixe `/api`.

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/health` | Public |
| POST | `/auth/login` | Public, limité en débit |
| POST | `/auth/register` | Public, crée uniquement un patient de l'établissement `organizationSlug` |
| GET | `/auth/me` | Connecté |
| PUT | `/auth/profile` | Connecté, sans rôle ni hôpital |
| POST | `/auth/change-password` | Connecté, invalide les autres sessions |
| POST | `/auth/logout` | Connecté, invalide le jeton |
| GET, POST | `/organizations` | SUPERADMIN |
| GET, PATCH | `/organizations/:id` | SUPERADMIN |
| POST | `/organizations/:id/users` | SUPERADMIN, premier compte de l'établissement |
| GET, POST | `/users` | HOSPITAL_ADMIN, hôpital de la session |
| PATCH | `/users/:id/role` | HOSPITAL_ADMIN, pas son propre rôle, pas SUPERADMIN |
| PATCH | `/users/:id/status` | HOSPITAL_ADMIN |
| GET, POST | `/patients` | Lecture : admin, médecin, réception, infirmier, patient. Création : admin, réception |
| GET, PUT, DELETE | `/patients/:id` | Même périmètre. Le médecin ne voit que les dossiers dont il est responsable. DELETE archive, réservé à l'admin |

Les réponses utilisateur ne contiennent ni hash ni mot de passe. Les journaux d'audit masquent les mots de passe et les champs cliniques.

## Tests

```sh
npm test
```

Les tests vérifient l'isolation entre deux hôpitaux, l'accès médecin, l'impossibilité de s'attribuer un rôle, les jetons forgés et la suspension d'un établissement.
