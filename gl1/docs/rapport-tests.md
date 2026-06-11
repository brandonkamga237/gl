# Rapport de Tests — BankingSystem (gl1)

**Projet :** BankingSystem  
**Version :** 1.0.0  
**Date :** Juin 2026  
**Environnement :** Node.js 12 / Jest 27.5.1 / Supertest 6.3.4  
**Résultat global : 49 tests — 49 réussis — 0 échoués**

---

## 1. Stratégie de test

Les tests du projet BankingSystem suivent la méthodologie **INF352** qui combine trois niveaux de couverture :

| Niveau | Description | Objectif |
|--------|-------------|----------|
| **Statement Coverage** (couverture d'instructions) | S'assurer que chaque ligne de code est exécutée au moins une fois | ≥ 70 % |
| **Branch Coverage** (couverture de branches) | S'assurer que chaque branche conditionnelle (`if/else`, `switch`) est testée dans les deux sens | ≥ 60 % |
| **Path Coverage** (couverture de chemins) | Tester les combinaisons de chemins logiques d'une fonction | Chemins critiques couverts |

Les tests sont divisés en deux catégories :

- **Tests unitaires** (`tests/unit/`) : testent chaque fonction de service de façon isolée, avec des mocks pour la base de données, bcrypt et JWT. Ces tests sont rapides et déterministes.
- **Tests d'intégration** (`tests/integration/`) : testent les routes HTTP complètes via Supertest, en mockant les services pour éviter les connexions réelles à la base de données.

---

## 2. Architecture des tests

```
tests/
├── unit/
│   ├── userService.test.js          (11 tests — 5 fonctions couvertes)
│   └── transactionService.test.js   (11 tests — 2 fonctions couvertes)
└── integration/
    ├── userRoutes.test.js           (15 tests — routes /api/users)
    └── transactionRoutes.test.js    (12 tests — routes /api/transactions)
```

### Mocking strategy

Les tests unitaires isolent complètement les dépendances :
```js
jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn(), ... },
  Transaction: { create: jest.fn(), findAll: jest.fn(), ... },
}));
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
```

Les tests d'intégration mockent les services et la base de données :
```js
jest.mock('../../src/services/userService');
jest.mock('../../src/models', () => ({
  User: {}, Transaction: {}, syncDatabase: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/config/database', () => ({
  define: jest.fn(), sync: jest.fn().mockResolvedValue(true),
}));
```
**Important :** les mocks de base de données sont déclarés **avant** le `require('../../src/app')` car Jest hisse (`hoists`) les `jest.mock()` en haut du fichier, mais l'ordre de déclaration influence la résolution des modules.

---

## 3. Tests unitaires

### 3.1 userService.test.js

#### Fonctionnalité 1 — `createUser`

La fonction `createUser` gère la création d'un utilisateur. Elle doit : vérifier l'unicité de l'email, hacher le mot de passe, et retourner l'utilisateur sans le mot de passe.

| ID | Cas de test | Entrée | Résultat attendu | Couverture | Statut |
|----|-------------|--------|-----------------|------------|--------|
| TC-001 | Création réussie (chemin nominal) | `{name:'Bob', email:'bob@test.com', password:'secret123'}` | Utilisateur créé, `password` absent du retour | Statement P1 | ✅ PASS |
| TC-002 | Email déjà existant | `email:'alice@test.com'` (déjà en base) | Exception `EMAIL_ALREADY_EXISTS` | Branch P2 | ✅ PASS |
| TC-003 | Solde initial fourni | `{balance: 200}` | `User.create` appelé avec `balance: 200` | Branch P3 | ✅ PASS |
| TC-004 | Rôle admin explicite | `{role:'admin'}` | `User.create` appelé avec `role:'admin'` | Branch P4 | ✅ PASS |

**Graphe de flux — createUser :**
```
START
  │
  ▼
[findOne(email)]──existe?──YES──→ throw EMAIL_ALREADY_EXISTS ──→ END
  │
  NO
  ▼
[bcrypt.hash(password)]
  │
  ▼
[User.create({...data})]
  │
  ▼
[retirer password du résultat]
  │
  ▼
RETURN user_safe ──→ END
```

Chemins testés : P1 (succès complet), P2 (email dupliqué), P3 (avec balance), P4 (rôle admin)

---

#### Fonctionnalité 4 — `login`

La fonction `login` authentifie un utilisateur et génère un JWT. Elle vérifie l'existence de l'email, que le compte est actif, et que le mot de passe correspond.

| ID | Cas de test | Entrée | Résultat attendu | Couverture | Statut |
|----|-------------|--------|-----------------|------------|--------|
| TC-005 | Login réussi (chemin nominal) | Email valide + bon mot de passe | `{token, user}` retourné, `password` absent | Statement P1 | ✅ PASS |
| TC-006 | Email inconnu | Email inexistant en base | Exception `INVALID_CREDENTIALS` | Branch P2 | ✅ PASS |
| TC-007 | Mauvais mot de passe | Bon email, mauvais mot de passe | Exception `INVALID_CREDENTIALS` | Branch P3 | ✅ PASS |
| TC-008 | Compte désactivé | `isActive: false` | Exception `ACCOUNT_DISABLED`, `bcrypt.compare` non appelé | Branch P4 | ✅ PASS |

**Graphe de flux — login :**
```
START
  │
  ▼
[findOne(email)]──null?──YES──→ throw INVALID_CREDENTIALS ──→ END
  │
  NO
  ▼
[user.isActive?]──false──→ throw ACCOUNT_DISABLED ──→ END
  │
  true
  ▼
[bcrypt.compare(password)]──false──→ throw INVALID_CREDENTIALS ──→ END
  │
  true
  ▼
[jwt.sign({id, email, role})]
  │
  ▼
RETURN {user_safe, token} ──→ END
```

Chemins testés : P1 (succès), P2 (email inconnu), P3 (mauvais mdp), P4 (compte inactif)

---

#### Fonctionnalité 5 — `getBalance`

La fonction `getBalance` retourne le solde d'un utilisateur par son UUID.

| ID | Cas de test | Entrée | Résultat attendu | Couverture | Statut |
|----|-------------|--------|-----------------|------------|--------|
| TC-009 | Solde retourné (chemin nominal) | UUID valide | `{userId, name, balance: 500}` | Statement P1 | ✅ PASS |
| TC-010 | Utilisateur inexistant | UUID inconnu | Exception `USER_NOT_FOUND` | Branch P2 | ✅ PASS |
| TC-011 | Compte vide | UUID valide, balance '0.00' | `{balance: 0}` | Branch P3 | ✅ PASS |

---

### 3.2 transactionService.test.js

#### Fonctionnalité 2 — `deposit`

La fonction `deposit` effectue un dépôt atomique (via `sequelize.transaction`) : vérifie le montant, charge l'utilisateur avec un verrou, met à jour le solde, crée la transaction.

| ID | Cas de test | Entrée | Résultat attendu | Couverture | Statut |
|----|-------------|--------|-----------------|------------|--------|
| TC-012 | Dépôt réussi (chemin nominal) | userId valide, amount=200 | Solde → 700, transaction créée | Statement P1 | ✅ PASS |
| TC-013 | Montant zéro | amount=0 | Exception `INVALID_AMOUNT` | Branch P2 | ✅ PASS |
| TC-014 | Montant négatif | amount=-50 | Exception `INVALID_AMOUNT` | Branch P3 | ✅ PASS |
| TC-015 | Utilisateur inexistant | userId='bad-id' | Exception `USER_NOT_FOUND` | Branch P4 | ✅ PASS |
| TC-016 | Montant null | amount=null | Exception `INVALID_AMOUNT` | Branch P5 | ✅ PASS |

**Graphe de flux — deposit :**
```
START
  │
  ▼
[amount <= 0 || !amount]──true──→ throw INVALID_AMOUNT ──→ END
  │
  false
  ▼
[sequelize.transaction(async (t) => {
  │
  ▼
  [User.findByPk(userId, {lock})]──null?──YES──→ throw USER_NOT_FOUND ──→ END
  │
  NO
  ▼
  [balanceAfter = balanceBefore + amount]
  │
  ▼
  [user.update({balance: balanceAfter})]
  │
  ▼
  [Transaction.create({type:'deposit', ...})]
  │
  ▼
  RETURN transaction
})]
  │
  ▼
END
```

Chemins : P1 (succès), P2-P3-P5 (montant invalide), P4 (user absent)

---

#### Fonctionnalité 3 — `withdraw`

La fonction `withdraw` effectue un retrait atomique avec vérification de solde suffisant.

| ID | Cas de test | Entrée | Résultat attendu | Couverture | Statut |
|----|-------------|--------|-----------------|------------|--------|
| TC-017 | Retrait réussi (chemin nominal) | userId valide, amount=100, balance=500 | Solde → 400, transaction créée | Statement P1 | ✅ PASS |
| TC-018 | Solde insuffisant | amount=200, balance=50 | Exception `INSUFFICIENT_FUNDS`, pas de transaction | Branch P2 | ✅ PASS |
| TC-019 | Retrait du solde exact | amount=300, balance=300 | Solde → 0, autorisé | Branch P3 | ✅ PASS |
| TC-020 | Montant zéro | amount=0 | Exception `INVALID_AMOUNT` | Branch P4 | ✅ PASS |
| TC-021 | Utilisateur inexistant | userId='bad-id' | Exception `USER_NOT_FOUND` | Branch P5 | ✅ PASS |
| TC-022 | Compte à solde nul | amount=1, balance=0 | Exception `INSUFFICIENT_FUNDS` | Branch P6 | ✅ PASS |

**Graphe de flux — withdraw :**
```
START
  │
  ▼
[amount <= 0 || !amount]──true──→ throw INVALID_AMOUNT ──→ END
  │
  false
  ▼
[sequelize.transaction(async (t) => {
  │
  ▼
  [User.findByPk(userId, {lock})]──null?──YES──→ throw USER_NOT_FOUND ──→ END
  │
  NO
  ▼
  [balance < amount?]──YES──→ throw INSUFFICIENT_FUNDS ──→ END
  │
  NO (balance >= amount)
  ▼
  [user.update({balance: balance - amount})]
  │
  ▼
  [Transaction.create({type:'withdraw', ...})]
  │
  ▼
  RETURN transaction
})]
  │
  ▼
END
```

Chemins : P1 (succès), P2/P6 (solde insuffisant), P3 (retrait exact), P4 (montant invalide), P5 (user absent)

---

## 4. Tests d'intégration

Les tests d'intégration vérifient le comportement des routes HTTP de bout en bout, des middlewares de validation et d'authentification, jusqu'aux réponses JSON.

### 4.1 userRoutes.test.js — Routes `/api/users`

| # | Méthode | Route | Scénario | Statut HTTP attendu | Résultat |
|---|---------|-------|----------|---------------------|---------|
| 1 | POST | `/api/users` | Données valides → création | 201 | ✅ PASS |
| 2 | POST | `/api/users` | Email dupliqué → conflit | 409 | ✅ PASS |
| 3 | POST | `/api/users` | Email invalide → validation | 422 | ✅ PASS |
| 4 | POST | `/api/users` | Mot de passe trop court | 422 | ✅ PASS |
| 5 | GET | `/api/users` | Sans token → non autorisé | 401 | ✅ PASS |
| 6 | GET | `/api/users` | Token admin → liste utilisateurs | 200 | ✅ PASS |
| 7 | GET | `/api/users` | Token client → accès refusé | 403 | ✅ PASS |
| 8 | GET | `/api/users/:id` | UUID valide + admin | 200 | ✅ PASS |
| 9 | GET | `/api/users/:id` | UUID invalide → 400 | 400 | ✅ PASS |
| 10 | GET | `/api/users/:id` | UUID non trouvé → 404 | 404 | ✅ PASS |
| 11 | PUT | `/api/users/:id` | Mise à jour valide (admin) | 200 | ✅ PASS |
| 12 | PUT | `/api/users/:id` | Champs vides → validation | 422 | ✅ PASS |
| 13 | DELETE | `/api/users/:id` | Suppression (admin) | 200 | ✅ PASS |
| 14 | DELETE | `/api/users/:id` | UUID invalide | 400 | ✅ PASS |
| 15 | POST | `/api/auth/login` | Login réussi → token JWT | 200 | ✅ PASS |

### 4.2 transactionRoutes.test.js — Routes `/api/transactions`

| # | Méthode | Route | Scénario | Statut HTTP attendu | Résultat |
|---|---------|-------|----------|---------------------|---------|
| 1 | POST | `/api/users/:id/account` | Création de compte (admin) | 201 | ✅ PASS |
| 2 | POST | `/api/users/:id/account` | Sans token → 401 | 401 | ✅ PASS |
| 3 | POST | `/api/transactions/deposit` | Dépôt réussi | 200 | ✅ PASS |
| 4 | POST | `/api/transactions/deposit` | Montant manquant → 400 | 400 | ✅ PASS |
| 5 | POST | `/api/transactions/deposit` | Utilisateur inexistant | 404 | ✅ PASS |
| 6 | POST | `/api/transactions/withdraw` | Retrait réussi | 200 | ✅ PASS |
| 7 | POST | `/api/transactions/withdraw` | Solde insuffisant → 400 | 400 | ✅ PASS |
| 8 | GET | `/api/transactions` | Toutes les transactions (admin) | 200 | ✅ PASS |
| 9 | GET | `/api/transactions/:userId` | Transactions d'un utilisateur | 200 | ✅ PASS |
| 10 | GET | `/api/transactions/:userId` | UUID invalide → 400 | 400 | ✅ PASS |
| 11 | GET | `/api/stats` | Statistiques (admin) | 200 | ✅ PASS |
| 12 | GET | `/api/stats` | Sans token → 401 | 401 | ✅ PASS |

---

## 5. Résultats de couverture de code

```
File                       | Stmts  | Branch | Funcs  | Lines  |
---------------------------|--------|--------|--------|--------|
All files                  | 44.82% | 29.18% | 32.30% | 45.88% |
 validationMiddleware.js   |   100% |   100% |   100% |   100% |
 transactionController.js  | 77.77% | 41.66% |   100% | 77.77% |
 userController.js         | 58.20% |   25%  | 66.66% | 58.20% |
 authMiddleware.js         | 48.64% | 31.81% |   60%  | 48.64% |
 transactionService.js     | 46.15% | 39.02% | 23.52% | 48.64% |
 userService.js            | 49.31% | 43.18% | 33.33% | 52.17% |
```

**Note sur la couverture globale :** La couverture de couverture totale est de ~45% car le projet inclut de nombreuses fonctionnalités non testées (dashboard EJS, client portal, admin panel) qui ne sont pas dans le scope des tests INF352. Les 5 fonctionnalités ciblées (`createUser`, `deposit`, `withdraw`, `login`, `getBalance`) sont couvertes à 100% des chemins critiques dans les tests unitaires.

---

## 6. Tableau de couverture INF352

Ce tableau résume la couverture pour les 5 fonctions imposées par le cours :

### `createUser` (userService.js)

| Instruction | Couverte | TC-IDs |
|-------------|----------|--------|
| `findOne(email)` | ✅ | TC-001, TC-002 |
| `throw EMAIL_ALREADY_EXISTS` | ✅ | TC-002 |
| `bcrypt.hash(password)` | ✅ | TC-001, TC-003, TC-004 |
| `User.create({...})` | ✅ | TC-001, TC-003, TC-004 |
| `delete result.password` | ✅ | TC-001 |

| Branche | Couverte | TC-IDs |
|---------|----------|--------|
| email existe → erreur | ✅ | TC-002 |
| email libre → création | ✅ | TC-001 |
| balance fournie / non fournie | ✅ | TC-001, TC-003 |
| role admin / client | ✅ | TC-001, TC-004 |

### `login` (userService.js)

| Instruction | Couverte | TC-IDs |
|-------------|----------|--------|
| `findOne(email)` | ✅ | TC-005 à TC-008 |
| `throw INVALID_CREDENTIALS` (user null) | ✅ | TC-006 |
| `throw ACCOUNT_DISABLED` | ✅ | TC-008 |
| `bcrypt.compare` | ✅ | TC-005, TC-007 |
| `throw INVALID_CREDENTIALS` (mdp faux) | ✅ | TC-007 |
| `jwt.sign({...})` | ✅ | TC-005 |
| `return {user, token}` | ✅ | TC-005 |

| Branche | Couverte | TC-IDs |
|---------|----------|--------|
| user introuvable | ✅ | TC-006 |
| compte inactif | ✅ | TC-008 |
| mot de passe incorrect | ✅ | TC-007 |
| connexion réussie | ✅ | TC-005 |

### `getBalance` (userService.js)

| Instruction | Couverte | TC-IDs |
|-------------|----------|--------|
| `findByPk(userId)` | ✅ | TC-009 à TC-011 |
| `throw USER_NOT_FOUND` | ✅ | TC-010 |
| `return {userId, name, balance}` | ✅ | TC-009, TC-011 |

### `deposit` (transactionService.js)

| Instruction | Couverte | TC-IDs |
|-------------|----------|--------|
| Vérification `amount <= 0` | ✅ | TC-013, TC-014, TC-016 |
| `sequelize.transaction(...)` | ✅ | TC-012, TC-015 |
| `User.findByPk(userId, {lock})` | ✅ | TC-012, TC-015 |
| `throw USER_NOT_FOUND` | ✅ | TC-015 |
| `user.update({balance})` | ✅ | TC-012 |
| `Transaction.create(...)` | ✅ | TC-012 |

### `withdraw` (transactionService.js)

| Instruction | Couverte | TC-IDs |
|-------------|----------|--------|
| Vérification `amount <= 0` | ✅ | TC-020 |
| `User.findByPk(userId, {lock})` | ✅ | TC-017, TC-021 |
| `throw USER_NOT_FOUND` | ✅ | TC-021 |
| `throw INSUFFICIENT_FUNDS` | ✅ | TC-018, TC-022 |
| `user.update({balance})` | ✅ | TC-017, TC-019 |
| `Transaction.create(...)` | ✅ | TC-017 |

---

## 7. Synthèse

| Métrique | Valeur |
|----------|--------|
| Total tests | **49** |
| Tests réussis | **49** |
| Tests échoués | **0** |
| Taux de succès | **100%** |
| Suites de tests | 4 |
| Tests unitaires | 22 |
| Tests d'intégration | 27 |
| Durée d'exécution | ~9 secondes |
| Fonctionnalités couvertes (INF352) | 5/5 |

### Commandes pour reproduire

```bash
# Tous les tests
npm test

# Tests unitaires seulement
npm run test:unit

# Tests d'intégration seulement
npm run test:integration

# Rapport de couverture HTML (ouvrir coverage/lcov-report/index.html)
npm test
```
