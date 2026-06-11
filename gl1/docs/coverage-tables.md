# Tables de Couverture — INF352

> Ces tables documentent les stratégies de test appliquées aux 5 fonctionnalités choisies.
> Fichier source : `tests/unit/userService.test.js`, `tests/unit/transactionService.test.js`

---

## Fonctionnalité 1 : `createUser` (userService)

### Chemins d'exécution identifiés

```
createUser(data)
│
├─ [P1] findOne → null  →  hash(password) → User.create → return user  ✅ Nominal
├─ [P2] findOne → user  →  throw EMAIL_ALREADY_EXISTS                  ❌ Dupliqué
├─ [P3] data.balance fourni → create avec balance != 0                 ✅ Solde initial
└─ [P4] data.role = 'admin' → create avec role = admin                 ✅ Rôle admin
```

### Statement Coverage
Instructions exécutables identifiées :
1. `User.findOne({ where: { email } })`
2. `if (existing) throw ...`
3. `bcrypt.hash(password, SALT_ROUNDS)`
4. `User.create({ name, email, password: hashedPassword, role, balance })`
5. Destructuration pour exclure le mot de passe
6. `return userWithoutPassword`

| Instruction | TC-001 | TC-002 | TC-003 | TC-004 | Couverte ? |
|------------|--------|--------|--------|--------|------------|
| findOne    | ✅     | ✅     | ✅     | ✅     | ✅         |
| if(existing) | ✅   | ✅     | ✅     | ✅     | ✅         |
| bcrypt.hash | ✅    | ❌     | ✅     | ✅     | ✅         |
| User.create | ✅    | ❌     | ✅     | ✅     | ✅         |
| return user | ✅    | ❌     | ✅     | ✅     | ✅         |

**Statement Coverage : 100%**

### Branch Coverage
| Branche | Description | Cas de test | Couvert ? |
|---------|-------------|-------------|-----------|
| B1-true  | Email existant → throw | TC-002 | ✅ |
| B1-false | Email libre → continuer | TC-001 | ✅ |

**Branch Coverage : 100%**

### Path Coverage
| Chemin | Description | Cas de test | Résultat attendu | Couvert ? |
|--------|-------------|-------------|------------------|-----------|
| P1 | Email libre → création réussie | TC-001 | User sans password | ✅ |
| P2 | Email déjà pris → exception | TC-002 | EMAIL_ALREADY_EXISTS | ✅ |
| P3 | Solde initial personnalisé | TC-003 | balance=200 dans create | ✅ |
| P4 | Rôle admin | TC-004 | role=admin dans create | ✅ |

---

## Fonctionnalité 2 : `deposit` (transactionService)

### Chemins d'exécution identifiés

```
deposit(userId, amount, description)
│
├─ [P1] amount <= 0 ou null → throw INVALID_AMOUNT
├─ [P2] amount > 0 → séquence transaction
│   ├─ [P3] User.findByPk → null → throw USER_NOT_FOUND
│   └─ [P4] User trouvé → update balance → Transaction.create → return
└─ [P5] amount null/undefined → throw INVALID_AMOUNT
```

### Statement Coverage
| Instruction | TC-012 | TC-013 | TC-014 | TC-015 | TC-016 | Couverte ? |
|------------|--------|--------|--------|--------|--------|------------|
| if(!amount ‖ amount<=0) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| sequelize.transaction() | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| User.findByPk() | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| if(!user) throw | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| user.update() | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Transaction.create() | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Statement Coverage : 100%**

### Branch Coverage
| Branche | Description | Cas de test | Couvert ? |
|---------|-------------|-------------|-----------|
| B1-true  | amount invalide → early return | TC-013, TC-016 | ✅ |
| B1-false | amount valide → entrer dans tx | TC-012 | ✅ |
| B2-true  | user non trouvé → throw | TC-015 | ✅ |
| B2-false | user trouvé → continuer | TC-012 | ✅ |

**Branch Coverage : 100%**

### Path Coverage
| Chemin | Description | Cas de test | Résultat attendu | Couvert ? |
|--------|-------------|-------------|------------------|-----------|
| P1 | amount = 0 → INVALID_AMOUNT | TC-013 | Error INVALID_AMOUNT | ✅ |
| P2 | amount < 0 → INVALID_AMOUNT | TC-014 | Error INVALID_AMOUNT | ✅ |
| P3 | amount null → INVALID_AMOUNT | TC-016 | Error INVALID_AMOUNT | ✅ |
| P4 | User introuvable → USER_NOT_FOUND | TC-015 | Error USER_NOT_FOUND | ✅ |
| P5 | Dépôt nominal → transaction créée | TC-012 | tx avec balanceAfter=700 | ✅ |

---

## Fonctionnalité 3 : `withdraw` (transactionService)

### Chemins d'exécution identifiés

```
withdraw(userId, amount, description)
│
├─ [P1] amount <= 0 → throw INVALID_AMOUNT
├─ [P2] amount > 0 → transaction SQL
│   ├─ [P3] User non trouvé → throw USER_NOT_FOUND
│   └─ [P4] User trouvé
│       ├─ [P5] balance < amount → throw INSUFFICIENT_FUNDS
│       └─ [P6] balance >= amount → update + create tx → return
```

### Statement Coverage
| Instruction | TC-017 | TC-018 | TC-019 | TC-020 | TC-021 | TC-022 | Couverte ? |
|------------|--------|--------|--------|--------|--------|--------|------------|
| if(!amount‖<=0) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| sequelize.transaction() | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| User.findByPk() | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| if(balance < amount) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| throw INSUFFICIENT_FUNDS | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| user.update() | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Transaction.create() | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |

**Statement Coverage : 100%**

### Branch Coverage
| Branche | Description | Cas de test | Couvert ? |
|---------|-------------|-------------|-----------|
| B1-true  | amount invalide | TC-020 | ✅ |
| B1-false | amount valide | TC-017 | ✅ |
| B2-true  | user non trouvé | TC-021 | ✅ |
| B2-false | user trouvé | TC-017 | ✅ |
| B3-true  | solde insuffisant | TC-018, TC-022 | ✅ |
| B3-false | solde suffisant | TC-017, TC-019 | ✅ |

**Branch Coverage : 100%**

### Path Coverage
| Chemin | Description | Cas de test | Résultat attendu | Couvert ? |
|--------|-------------|-------------|------------------|-----------|
| P1 | amount = 0 → INVALID_AMOUNT | TC-020 | Error INVALID_AMOUNT | ✅ |
| P2 | User introuvable → USER_NOT_FOUND | TC-021 | Error USER_NOT_FOUND | ✅ |
| P3 | Solde insuffisant (50 < 200) | TC-018 | Error INSUFFICIENT_FUNDS | ✅ |
| P4 | Retrait exact du solde (300=300) | TC-019 | balanceAfter = 0 | ✅ |
| P5 | Retrait nominal réussi | TC-017 | balanceAfter = 400 | ✅ |
| P6 | Solde à zéro → refus | TC-022 | Error INSUFFICIENT_FUNDS | ✅ |

---

## Fonctionnalité 4 : `login` (userService)

### Chemins d'exécution identifiés

```
login(email, password)
│
├─ [P1] findOne → null → throw INVALID_CREDENTIALS
├─ [P2] user.isActive === false → throw ACCOUNT_DISABLED
├─ [P3] bcrypt.compare → false → throw INVALID_CREDENTIALS
└─ [P4] tout OK → jwt.sign → return { user, token }
```

### Statement Coverage
| Instruction | TC-005 | TC-006 | TC-007 | TC-008 | Couverte ? |
|------------|--------|--------|--------|--------|------------|
| User.findOne() | ✅ | ✅ | ✅ | ✅ | ✅ |
| if(!user) throw | ✅ | ✅ | ✅ | ✅ | ✅ |
| if(!user.isActive) throw | ✅ | ❌ | ✅ | ✅ | ✅ |
| bcrypt.compare() | ✅ | ❌ | ✅ | ❌ | ✅ |
| if(!isPasswordValid) throw | ✅ | ❌ | ✅ | ❌ | ✅ |
| jwt.sign() | ✅ | ❌ | ❌ | ❌ | ✅ |
| return { user, token } | ✅ | ❌ | ❌ | ❌ | ✅ |

**Statement Coverage : 100%**

### Branch Coverage
| Branche | Description | Cas de test | Couvert ? |
|---------|-------------|-------------|-----------|
| B1-true  | user introuvable | TC-006 | ✅ |
| B1-false | user trouvé | TC-005 | ✅ |
| B2-true  | compte désactivé | TC-008 | ✅ |
| B2-false | compte actif | TC-005 | ✅ |
| B3-true  | mauvais mot de passe | TC-007 | ✅ |
| B3-false | bon mot de passe | TC-005 | ✅ |

**Branch Coverage : 100%**

### Path Coverage
| Chemin | Description | Cas de test | Résultat attendu | Couvert ? |
|--------|-------------|-------------|------------------|-----------|
| P1 | Email inconnu → INVALID_CREDENTIALS | TC-006 | Error INVALID_CREDENTIALS | ✅ |
| P2 | Compte désactivé → ACCOUNT_DISABLED | TC-008 | Error ACCOUNT_DISABLED | ✅ |
| P3 | Mauvais mot de passe → INVALID_CREDENTIALS | TC-007 | Error INVALID_CREDENTIALS | ✅ |
| P4 | Login réussi → user + JWT | TC-005 | { user (sans pw), token } | ✅ |

---

## Fonctionnalité 5 : `getBalance` (userService)

### Chemins d'exécution identifiés

```
getBalance(id)
│
├─ [P1] findByPk → null → throw USER_NOT_FOUND
├─ [P2] user.balance = '0.00' → return 0
└─ [P3] user.balance = '500.00' → return 500
```

### Statement Coverage
| Instruction | TC-009 | TC-010 | TC-011 | Couverte ? |
|------------|--------|--------|--------|------------|
| User.findByPk() | ✅ | ✅ | ✅ | ✅ |
| if(!user) throw | ✅ | ✅ | ✅ | ✅ |
| parseFloat(user.balance) | ✅ | ❌ | ✅ | ✅ |
| return { userId, name, balance } | ✅ | ❌ | ✅ | ✅ |

**Statement Coverage : 100%**

### Branch Coverage
| Branche | Description | Cas de test | Couvert ? |
|---------|-------------|-------------|-----------|
| B1-true  | user non trouvé | TC-010 | ✅ |
| B1-false | user trouvé | TC-009, TC-011 | ✅ |

**Branch Coverage : 100%**

### Path Coverage
| Chemin | Description | Cas de test | Résultat attendu | Couvert ? |
|--------|-------------|-------------|------------------|-----------|
| P1 | User inexistant → USER_NOT_FOUND | TC-010 | Error USER_NOT_FOUND | ✅ |
| P2 | Solde zéro | TC-011 | { balance: 0 } | ✅ |
| P3 | Solde positif | TC-009 | { balance: 500 } | ✅ |

---

## Résumé Global de Couverture

| Fonctionnalité     | Statement | Branch | Path | Cas de test |
|--------------------|-----------|--------|------|-------------|
| createUser         | 100%      | 100%   | 100% | TC-001..004 |
| deposit            | 100%      | 100%   | 100% | TC-012..016 |
| withdraw           | 100%      | 100%   | 100% | TC-017..022 |
| login              | 100%      | 100%   | 100% | TC-005..008 |
| getBalance         | 100%      | 100%   | 100% | TC-009..011 |
| **TOTAL**          | **100%**  | **100%** | **100%** | **22 cas** |
