# Spécifications du Système Bancaire

## 1. Spécifications Fonctionnelles

### 1.1 Gestion des Utilisateurs

#### 1.1.1 Création d'un utilisateur
- **Description** : Le système doit permettre la création d'un nouveau compte utilisateur.
- **Acteurs** : Administrateur, visiteur (auto-inscription)
- **Entrées** : nom, email, mot de passe, solde initial (optionnel, défaut = 0), rôle (optionnel, défaut = `client`)
- **Règles métier** :
  - L'email doit être unique dans le système
  - Le mot de passe doit contenir au minimum 6 caractères
  - Le nom doit comporter entre 2 et 100 caractères
  - Le mot de passe est haché avec bcrypt (salt rounds = 10) avant stockage
  - Le solde initial ne peut pas être négatif
- **Sorties** : Objet utilisateur créé (sans le mot de passe)
- **Codes HTTP** : 201 (succès), 409 (email dupliqué), 400 (validation)

#### 1.1.2 Consultation des utilisateurs
- **Description** : Lister tous les utilisateurs ou consulter le détail d'un utilisateur.
- **Accès** : `GET /api/users` → admin uniquement ; `GET /api/users/:id` → authentifié
- **Sorties** : Liste paginée ou objet utilisateur unique (sans mot de passe)
- **Codes HTTP** : 200, 401, 403, 404

#### 1.1.3 Modification d'un utilisateur
- **Description** : Mettre à jour les informations d'un utilisateur existant.
- **Champs modifiables** : nom, email, mot de passe, rôle, statut actif/inactif
- **Règles métier** :
  - Si l'email est modifié, la nouvelle valeur doit être unique
  - Un nouveau mot de passe suit les mêmes règles de validation
- **Codes HTTP** : 200, 400, 404, 409

#### 1.1.4 Suppression d'un utilisateur
- **Description** : Suppression définitive d'un utilisateur (soft delete non implémenté dans cette version).
- **Accès** : Administrateur uniquement
- **Codes HTTP** : 200, 401, 403, 404

---

### 1.2 Création de Compte Bancaire
- **Description** : Associer un compte bancaire à un utilisateur existant.
- **Endpoint** : `POST /api/users/:id/account`
- **Règle** : Le solde initial du compte est 0 par défaut
- **Consultation** : `GET /api/users/:id/account` retourne le solde actuel
- **Codes HTTP** : 201, 404

---

### 1.3 Transactions

#### 1.3.1 Dépôt
- **Endpoint** : `POST /api/transactions/deposit`
- **Entrées** : `userId`, `amount`, `description` (optionnel)
- **Règles métier** :
  - Le montant doit être strictement positif (> 0)
  - L'utilisateur doit exister
  - Le solde est mis à jour de façon atomique (transaction SQL)
  - `balanceBefore` et `balanceAfter` sont enregistrés pour chaque transaction
  - La transaction est horodatée automatiquement
- **Codes HTTP** : 201, 400, 404

#### 1.3.2 Retrait
- **Endpoint** : `POST /api/transactions/withdraw`
- **Entrées** : `userId`, `amount`, `description` (optionnel)
- **Règles métier** :
  - Le montant doit être strictement positif (> 0)
  - Le solde du compte ne peut pas être amené en dessous de 0
  - Si `solde actuel < montant` → erreur `INSUFFICIENT_FUNDS`
  - Opération atomique (verrou de ligne pour éviter les conditions de course)
- **Codes HTTP** : 201, 400, 404, 422

#### 1.3.3 Historique des Transactions
- `GET /api/transactions` → toutes les transactions (admin uniquement)
- `GET /api/transactions/:userId` → transactions d'un utilisateur spécifique
- Triées par date de création décroissante

---

### 1.4 Authentification et Autorisation

#### 1.4.1 Inscription
- **Endpoint** : `POST /api/auth/register`
- Crée un utilisateur avec le rôle `client`
- **Codes HTTP** : 201, 400, 409

#### 1.4.2 Connexion
- **Endpoint** : `POST /api/auth/login`
- **Entrées** : email, mot de passe
- **Sorties** : objet utilisateur + JWT signé (expiration : 24h)
- **Codes HTTP** : 200, 400, 401, 403

#### 1.4.3 Protection des routes
| Niveau d'accès    | Description                                   |
|-------------------|-----------------------------------------------|
| Public            | `POST /api/auth/*`, `POST /api/users`         |
| Authentifié (JWT) | `GET /api/users/:id`, `POST /api/transactions/*`, `GET /api/transactions/:userId` |
| Admin (JWT+rôle)  | `GET /api/users`, `DELETE /api/users/:id`, `GET /api/transactions`, `/admin/*` |

---

### 1.5 Interface Admin (EJS)

| Page               | Route                      | Description                              |
|--------------------|----------------------------|------------------------------------------|
| Dashboard          | `/admin/dashboard`         | Statistiques globales (KPIs)             |
| Liste utilisateurs | `/admin/users`             | Tableau CRUD des utilisateurs            |
| Créer utilisateur  | `/admin/users/create`      | Formulaire de création                   |
| Modifier utilisateur | `/admin/users/:id/edit`  | Formulaire de modification               |
| Historique         | `/admin/transactions`      | Tableau de toutes les transactions       |
| Connexion          | `/admin/login`             | Formulaire d'authentification admin      |

---

### 1.6 Licences et Rôles

| Rôle    | Droits                                                                          |
|---------|---------------------------------------------------------------------------------|
| `client`| Voir son profil, consulter son solde, effectuer dépôts/retraits, voir ses transactions |
| `admin` | Tous les droits client + gestion complète des utilisateurs, accès à toutes les transactions, interface admin EJS |

---

## 2. Spécifications Non-Fonctionnelles

### 2.1 Performance
- Temps de réponse cible : **< 500ms** pour les opérations de transaction sous charge normale
- Temps de réponse cible : **< 200ms** pour les lectures simples (GET)
- Le pool de connexions PostgreSQL est configuré à **max 10 connexions**
- Les transactions bancaires utilisent des **verrous de ligne** (`SELECT FOR UPDATE`) pour éviter les conditions de course

### 2.2 Sécurité
| Mesure                    | Détail                                             |
|---------------------------|----------------------------------------------------|
| Hachage des mots de passe | bcrypt, salt rounds = 10                           |
| Authentification          | JWT (HS256), expiration 24h                        |
| Validation des entrées    | express-validator sur tous les endpoints publics   |
| Protection CSRF           | Cookies httpOnly pour l'admin                      |
| Séparation des rôles      | Middleware `requireAdmin` sur les routes sensibles |
| Pas de mots de passe exposés | Les réponses API excluent systématiquement `password` |

### 2.3 Disponibilité
- Cible : **99.9% uptime** (< 8.7h d'indisponibilité par an)
- Health check sur le conteneur PostgreSQL (`pg_isready`)
- Redémarrage automatique via Docker `depends_on` avec condition `service_healthy`

### 2.4 Maintenabilité
- Architecture **MVC** stricte : routes → controllers → services → models
- **Séparation des couches** : la logique métier est dans les services, les controllers gèrent uniquement les HTTP
- Fichiers de configuration externalisés (`.env`)
- Nommage cohérent (camelCase pour JS, snake_case pour colonnes SQL)

### 2.5 Portabilité
- Containerisation complète via **Docker + docker-compose**
- Variables d'environnement pour toutes les configurations sensibles
- Compatible Linux, macOS, Windows (via Docker Desktop)
- Node.js 18+ requis (LTS)

### 2.6 Testabilité
- Architecture orientée injection de dépendances (services mockables)
- Tests unitaires indépendants de la base de données
- Tests d'intégration via supertest (sans démarrer le serveur)
- Coverage via Jest avec rapports HTML (`jest-html-reporter`)
