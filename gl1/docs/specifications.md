# Spécifications — BankingSystem (gl1)

**Version :** 2.0.0  
**Date :** Juin 2026  
**Système :** Application bancaire REST + interface admin EJS  

---

## 1. Besoins Fonctionnels (BF)

### BF-01 — Gestion des utilisateurs (CRUD)

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-01.1 | Un administrateur peut créer un compte utilisateur (`POST /api/users`) avec nom, email, mot de passe et rôle | Haute |
| BF-01.2 | Un administrateur peut consulter la liste de tous les utilisateurs (`GET /api/users`) | Haute |
| BF-01.3 | Un utilisateur ou administrateur peut consulter les détails d'un profil (`GET /api/users/:id`) | Haute |
| BF-01.4 | Un administrateur peut mettre à jour les informations d'un utilisateur (`PUT /api/users/:id`) | Moyenne |
| BF-01.5 | Un administrateur peut supprimer un compte utilisateur (`DELETE /api/users/:id`) | Moyenne |
| BF-01.6 | Le système vérifie l'unicité des emails lors de la création | Haute |

### BF-02 — Authentification et autorisation

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-02.1 | Un utilisateur peut s'authentifier avec son email et mot de passe (`POST /api/auth/login`) | Haute |
| BF-02.2 | Le système génère un JWT signé avec durée d'expiration configurable | Haute |
| BF-02.3 | Les routes protégées refusent les requêtes sans token valide (401) | Haute |
| BF-02.4 | Les routes admin refusent les tokens de rôle client (403) | Haute |
| BF-02.5 | Le mot de passe est haché avec bcrypt avant persistance | Haute |

### BF-03 — Dépôt (admin → compte client)

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-03.1 | **Seul un administrateur** peut effectuer un dépôt sur le compte d'un client | Haute |
| BF-03.2 | Le dépôt crédite le compte du client et débite le solde de la banque | Haute |
| BF-03.3 | Un dépôt est **sans frais** (0 FCFA) pour le client | Haute |
| BF-03.4 | La transaction est atomique : échec = rollback complet | Haute |
| BF-03.5 | Le montant doit être strictement supérieur à 0 | Haute |

### BF-04 — Retrait (client, avec frais)

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-04.1 | Un client authentifié peut retirer des fonds de son compte | Haute |
| BF-04.2 | Des frais de retrait sont prélevés selon le barème : **max(montant × 1%, 500 FCFA)** | Haute |
| BF-04.3 | Le client doit avoir un solde ≥ montant demandé **+ frais** | Haute |
| BF-04.4 | Les frais restent dans la banque ; le montant net quitte le système bancaire | Haute |
| BF-04.5 | La réponse API inclut le montant des frais prélevés | Moyenne |
| BF-04.6 | La transaction est atomique | Haute |

### BF-05 — Virement (client, avec frais différenciés)

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-05.1 | Un client peut virer des fonds vers un autre compte du système (virement interne) | Haute |
| BF-05.2 | Un client peut virer des fonds vers une banque externe (virement externe) | Haute |
| BF-05.3 | Frais virement interne : **max(montant × 0,5%, 200 FCFA)** | Haute |
| BF-05.4 | Frais virement externe : **max(montant × 2%, 1 000 FCFA) + 1 000 FCFA fixe** | Haute |
| BF-05.5 | Les frais externes sont systématiquement plus élevés que les frais internes | Haute |
| BF-05.6 | L'auto-virement (émetteur = destinataire) est interdit | Haute |
| BF-05.7 | Pour un virement interne, deux transactions sont créées (émetteur + destinataire) | Haute |
| BF-05.8 | Pour un virement externe, une seule transaction est enregistrée | Haute |
| BF-05.9 | Le destinataire interne peut être identifié par son UUID ou son email | Moyenne |

### BF-06 — Compte bancaire maître

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-06.1 | La banque possède un compte maître avec un solde initial de 50 000 000 FCFA | Haute |
| BF-06.2 | Chaque dépôt décrémente le solde de la banque | Haute |
| BF-06.3 | Chaque retrait incrémente le solde de la banque du montant des frais | Haute |
| BF-06.4 | Chaque virement incrémente le solde de la banque du montant des frais | Haute |
| BF-06.5 | Le tableau de bord admin affiche le solde de la banque et les frais collectés | Moyenne |

### BF-07 — Interface administrateur (EJS)

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-07.1 | Le tableau de bord affiche KPIs, graphiques Chart.js et transactions récentes | Haute |
| BF-07.2 | L'admin peut consulter, créer, modifier et supprimer des clients | Haute |
| BF-07.3 | L'interface affiche le solde de la banque et les frais collectés | Moyenne |

### BF-08 — Portail client (EJS)

| ID | Besoin | Priorité |
|----|--------|----------|
| BF-08.1 | Un client peut se connecter via le portail web | Haute |
| BF-08.2 | Le portail affiche le solde et l'historique des transactions | Haute |
| BF-08.3 | Le client peut effectuer dépôts, retraits depuis le portail | Haute |
| BF-08.4 | Toutes les devises sont affichées en **FCFA** | Haute |

---

## 2. Besoins Non Fonctionnels (BNF)

### BNF-01 — Sécurité

| ID | Besoin | Critère de validation |
|----|--------|-----------------------|
| BNF-01.1 | Les mots de passe sont hachés avec bcrypt (rounds = 10) | Aucun mot de passe en clair en base |
| BNF-01.2 | Les tokens JWT expirent en 24h (configurable via `.env`) | `JWT_EXPIRES_IN` paramétrable |
| BNF-01.3 | Les tokens sont transmis via `Authorization: Bearer <token>` | Pas de token dans l'URL |
| BNF-01.4 | Toutes les entrées utilisateur sont validées avec `express-validator` | Rejet 400/422 si invalide |
| BNF-01.5 | Les identifiants UUID sont vérifiés avant utilisation | Pas d'injection via UUID malformé |

### BNF-02 — Fiabilité et cohérence des données

| ID | Besoin | Critère de validation |
|----|--------|-----------------------|
| BNF-02.1 | Toutes les opérations financières utilisent des transactions SQL atomiques | Pas de demi-état en cas d'erreur |
| BNF-02.2 | Les lignes utilisateur sont verrouillées (`SELECT FOR UPDATE`) pendant les transactions | Pas de condition de course |
| BNF-02.3 | Les montants sont stockés en `DECIMAL(15, 2)` | Précision garantie |
| BNF-02.4 | Chaque transaction enregistre `balanceBefore`, `balanceAfter` et `fees` | Traçabilité complète |

### BNF-03 — Performances

| ID | Besoin | Critère de validation |
|----|--------|-----------------------|
| BNF-03.1 | Réponses API CRUD simples < 200 ms | Hors latence réseau |
| BNF-03.2 | Le tableau de bord utilise `Promise.all` pour les requêtes parallèles | Pas de requêtes séquentielles inutiles |
| BNF-03.3 | Les agrégations sont effectuées par `DATE_TRUNC` côté SQL | Pas de traitement lourd côté Node.js |

### BNF-04 — Maintenabilité

| ID | Besoin | Critère de validation |
|----|--------|-----------------------|
| BNF-04.1 | Architecture MVC stricte (routes → controllers → services → models) | Séparation des responsabilités |
| BNF-04.2 | Tests automatisés avec **Vitest 1.x** couvrant les 6 fonctionnalités ciblées | `npm test` passe à 100% |
| BNF-04.3 | Variables de configuration dans `.env` | Aucune valeur hardcodée |
| BNF-04.4 | Code containerisé Docker + docker-compose | Déployable en une commande |

### BNF-05 — Utilisabilité

| ID | Besoin | Critère de validation |
|----|--------|-----------------------|
| BNF-05.1 | L'interface admin n'utilise aucun jargon technique | Compréhensible sans formation IT |
| BNF-05.2 | La devise FCFA est affichée partout | Cohérence monétaire totale |
| BNF-05.3 | Les messages d'erreur sont explicites et en français | Pas de codes bruts exposés |

---

## 3. Barème des frais

| Type d'opération | Formule | Minimum | Frais fixe | Exemple (10 000 FCFA) | Exemple (100 000 FCFA) |
|-----------------|---------|---------|-----------|----------------------|----------------------|
| Dépôt (admin)   | Gratuit | 0 FCFA  | 0 FCFA    | **0 FCFA**           | **0 FCFA**           |
| Retrait client  | 1% × montant | 500 FCFA | — | **500 FCFA**     | **1 000 FCFA**       |
| Virement interne| 0,5% × montant | 200 FCFA | — | **200 FCFA**   | **500 FCFA**         |
| Virement externe| 2% × montant | 1 000 FCFA | +1 000 FCFA | **2 000 FCFA** | **3 000 FCFA**    |

---

## 4. Contraintes techniques

| Contrainte | Valeur |
|-----------|--------|
| Langage   | Node.js (≥ 18 pour les tests Vitest) |
| Framework | Express.js 4.x |
| ORM       | Sequelize 6.x |
| Base de données | PostgreSQL 15 |
| Authentification | JWT (jsonwebtoken 9.x) |
| Hachage   | bcrypt 5.x |
| Framework de tests | **Vitest 1.x** |
| Conteneurisation | Docker + docker-compose |
| Interface | EJS + express-ejs-layouts |
| Monnaie   | FCFA uniquement |
