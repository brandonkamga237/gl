jest.mock('../../src/models', () => ({
  User: { findByPk: jest.fn(), count: jest.fn(), findAll: jest.fn() },
  Transaction: { create: jest.fn(), findAll: jest.fn(), count: jest.fn() },
}));

// Mock sequelize transaction
jest.mock('../../src/config/database', () => ({
  transaction: jest.fn(),
  fn: jest.fn(),
  col: jest.fn(),
}));

const sequelize = require('../../src/config/database');
const { User, Transaction } = require('../../src/models');
const transactionService = require('../../src/services/transactionService');

// ─── Helper ────────────────────────────────────────────────────────────────
const makeUser = (balance = 500) => ({
  id: 'uuid-user-001',
  name: 'Alice',
  balance: balance.toFixed(2),
  update: jest.fn().mockResolvedValue(true),
});

const setupTransaction = (userBalance = 500) => {
  const user = makeUser(userBalance);
  sequelize.transaction.mockImplementation(async (cb) => cb({ lock: true }));
  User.findByPk.mockResolvedValue(user);
  return user;
};

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 2 : deposit
// ═══════════════════════════════════════════════════════════════════════════
describe('deposit', () => {
  beforeEach(() => jest.clearAllMocks());

  // TC-012 : chemin nominal — dépôt réussi
  test('TC-012 | P1 | effectue un dépôt et retourne la transaction', async () => {
    const user = setupTransaction(500);
    const expectedTx = { id: 'tx-001', type: 'deposit', amount: 200, balanceBefore: 500, balanceAfter: 700 };
    Transaction.create.mockResolvedValue(expectedTx);

    const result = await transactionService.deposit('uuid-user-001', 200, 'Salaire');

    expect(user.update).toHaveBeenCalledWith({ balance: 700 }, expect.any(Object));
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'deposit', amount: 200, balanceBefore: 500, balanceAfter: 700 }),
      expect.any(Object)
    );
    expect(result).toEqual(expectedTx);
  });

  // TC-013 : montant invalide — zéro
  test('TC-013 | P2 | lève INVALID_AMOUNT si amount est 0', async () => {
    await expect(transactionService.deposit('uuid-001', 0)).rejects.toThrow('INVALID_AMOUNT');
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  // TC-014 : montant négatif
  test('TC-014 | P3 | lève INVALID_AMOUNT si amount est négatif', async () => {
    await expect(transactionService.deposit('uuid-001', -50)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-015 : utilisateur inexistant
  test('TC-015 | P4 | lève USER_NOT_FOUND si userId inconnu', async () => {
    sequelize.transaction.mockImplementation(async (cb) => cb({}));
    User.findByPk.mockResolvedValue(null);
    await expect(transactionService.deposit('bad-id', 100)).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-016 : montant null/undefined
  test('TC-016 | P5 | lève INVALID_AMOUNT si amount est null', async () => {
    await expect(transactionService.deposit('uuid-001', null)).rejects.toThrow('INVALID_AMOUNT');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 3 : withdraw
// ═══════════════════════════════════════════════════════════════════════════
describe('withdraw', () => {
  beforeEach(() => jest.clearAllMocks());

  // TC-017 : chemin nominal — retrait réussi
  test('TC-017 | P1 | effectue un retrait quand le solde est suffisant', async () => {
    const user = setupTransaction(500);
    const expectedTx = { id: 'tx-002', type: 'withdraw', amount: 100, balanceBefore: 500, balanceAfter: 400 };
    Transaction.create.mockResolvedValue(expectedTx);

    const result = await transactionService.withdraw('uuid-user-001', 100, 'Loyer');

    expect(user.update).toHaveBeenCalledWith({ balance: 400 }, expect.any(Object));
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'withdraw', amount: 100, balanceBefore: 500, balanceAfter: 400 }),
      expect.any(Object)
    );
    expect(result).toEqual(expectedTx);
  });

  // TC-018 : solde insuffisant
  test('TC-018 | P2 | lève INSUFFICIENT_FUNDS si solde < montant', async () => {
    setupTransaction(50);
    await expect(transactionService.withdraw('uuid-user-001', 200)).rejects.toThrow('INSUFFICIENT_FUNDS');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  // TC-019 : retrait exactement égal au solde
  test('TC-019 | P3 | autorise le retrait exact du solde total', async () => {
    const user = setupTransaction(300);
    Transaction.create.mockResolvedValue({ type: 'withdraw', amount: 300, balanceBefore: 300, balanceAfter: 0 });

    await transactionService.withdraw('uuid-user-001', 300);

    expect(user.update).toHaveBeenCalledWith({ balance: 0 }, expect.any(Object));
  });

  // TC-020 : montant invalide
  test('TC-020 | P4 | lève INVALID_AMOUNT si amount est 0', async () => {
    await expect(transactionService.withdraw('uuid-001', 0)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-021 : utilisateur inexistant
  test('TC-021 | P5 | lève USER_NOT_FOUND si userId inconnu', async () => {
    sequelize.transaction.mockImplementation(async (cb) => cb({}));
    User.findByPk.mockResolvedValue(null);
    await expect(transactionService.withdraw('bad-id', 100)).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-022 : solde à zéro — retrait impossible
  test('TC-022 | P6 | refuse un retrait sur un compte à solde zéro', async () => {
    setupTransaction(0);
    await expect(transactionService.withdraw('uuid-user-001', 1)).rejects.toThrow('INSUFFICIENT_FUNDS');
  });
});
