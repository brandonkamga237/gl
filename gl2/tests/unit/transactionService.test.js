jest.mock('../../src/models', () => ({
  User: { findByPk: jest.fn(), findOne: jest.fn(), count: jest.fn(), findAll: jest.fn() },
  Transaction: { create: jest.fn(), findAll: jest.fn(), count: jest.fn() },
}));

jest.mock('../../src/config/database', () => ({
  transaction: jest.fn(),
  fn: jest.fn(),
  col: jest.fn(),
}));

const sequelize = require('../../src/config/database');
const { User, Transaction } = require('../../src/models');
const transactionService = require('../../src/services/transactionService');

const makeUser = (id, balance = 500) => ({
  id,
  name: 'Alice',
  email: 'alice@neobank.test',
  accountNumber: '1234567890',
  balance: balance.toFixed(2),
  update: jest.fn().mockResolvedValue(true),
});

const setupTx = (balance = 500) => {
  const user = makeUser('uuid-sender', balance);
  sequelize.transaction.mockImplementation(async (cb) => cb({ lock: true }));
  User.findByPk.mockResolvedValue(user);
  return user;
};

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 4 : deposit
// ═══════════════════════════════════════════════════════════════════════════
describe('deposit', () => {
  beforeEach(() => jest.clearAllMocks());

  // TC-012 : chemin nominal
  test('TC-012 | P1 | crédite le solde et crée une transaction deposit', async () => {
    const user = setupTx(500);
    const expectedTx = { id: 'tx-001', type: 'deposit', amount: 200, balanceBefore: 500, balanceAfter: 700 };
    Transaction.create.mockResolvedValue(expectedTx);

    const result = await transactionService.deposit('uuid-sender', 200, 'Salaire');

    expect(user.update).toHaveBeenCalledWith({ balance: 700 }, expect.any(Object));
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'deposit', amount: 200, balanceBefore: 500, balanceAfter: 700 }),
      expect.any(Object)
    );
    expect(result).toEqual(expectedTx);
  });

  // TC-013 : montant zéro
  test('TC-013 | P2 | lève INVALID_AMOUNT si amount est 0', async () => {
    await expect(transactionService.deposit('uuid-sender', 0)).rejects.toThrow('INVALID_AMOUNT');
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  // TC-014 : montant négatif
  test('TC-014 | P3 | lève INVALID_AMOUNT si amount est négatif', async () => {
    await expect(transactionService.deposit('uuid-sender', -100)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-015 : utilisateur inexistant
  test('TC-015 | P4 | lève USER_NOT_FOUND si l\'utilisateur n\'existe pas', async () => {
    sequelize.transaction.mockImplementation(async (cb) => cb({}));
    User.findByPk.mockResolvedValue(null);
    await expect(transactionService.deposit('bad-id', 100)).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-016 : montant null
  test('TC-016 | P5 | lève INVALID_AMOUNT si amount est null', async () => {
    await expect(transactionService.deposit('uuid-sender', null)).rejects.toThrow('INVALID_AMOUNT');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 5 : withdraw
// ═══════════════════════════════════════════════════════════════════════════
describe('withdraw', () => {
  beforeEach(() => jest.clearAllMocks());

  // TC-017 : chemin nominal
  test('TC-017 | P1 | débite le solde et crée une transaction withdraw', async () => {
    const user = setupTx(500);
    const expectedTx = { id: 'tx-002', type: 'withdraw', amount: 100, balanceBefore: 500, balanceAfter: 400 };
    Transaction.create.mockResolvedValue(expectedTx);

    const result = await transactionService.withdraw('uuid-sender', 100, 'Loyer');

    expect(user.update).toHaveBeenCalledWith({ balance: 400 }, expect.any(Object));
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'withdraw', amount: 100, balanceBefore: 500, balanceAfter: 400 }),
      expect.any(Object)
    );
    expect(result).toEqual(expectedTx);
  });

  // TC-018 : solde insuffisant
  test('TC-018 | P2 | lève INSUFFICIENT_FUNDS si le solde est insuffisant', async () => {
    setupTx(50);
    await expect(transactionService.withdraw('uuid-sender', 200)).rejects.toThrow('INSUFFICIENT_FUNDS');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  // TC-019 : retrait exact du solde
  test('TC-019 | P3 | autorise le retrait du solde total (compte à zéro)', async () => {
    const user = setupTx(300);
    Transaction.create.mockResolvedValue({ type: 'withdraw', amount: 300, balanceBefore: 300, balanceAfter: 0 });

    await transactionService.withdraw('uuid-sender', 300);
    expect(user.update).toHaveBeenCalledWith({ balance: 0 }, expect.any(Object));
  });

  // TC-020 : montant zéro
  test('TC-020 | P4 | lève INVALID_AMOUNT si amount est 0', async () => {
    await expect(transactionService.withdraw('uuid-sender', 0)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-021 : utilisateur inexistant
  test('TC-021 | P5 | lève USER_NOT_FOUND si l\'utilisateur n\'existe pas', async () => {
    sequelize.transaction.mockImplementation(async (cb) => cb({}));
    User.findByPk.mockResolvedValue(null);
    await expect(transactionService.withdraw('bad-id', 100)).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-022 : compte à zéro
  test('TC-022 | P6 | refuse le retrait sur un compte à solde nul', async () => {
    setupTx(0);
    await expect(transactionService.withdraw('uuid-sender', 1)).rejects.toThrow('INSUFFICIENT_FUNDS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 6 : transfer (UNIQUE à NeoBank)
// ═══════════════════════════════════════════════════════════════════════════
describe('transfer', () => {
  const sender = makeUser('uuid-sender', 1000);
  const recipient = makeUser('uuid-recipient', 200);

  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (cb) => cb({ lock: true }));
  });

  // TC-023 : chemin nominal — virement réussi
  test('TC-023 | P1 | transfère le montant et crée deux transactions atomiques', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: jest.fn() });
    User.findOne.mockResolvedValue({ ...recipient, update: jest.fn() });
    Transaction.create.mockResolvedValue({ id: 'tx-out', type: 'transfer_out' });

    const result = await transactionService.transfer('uuid-sender', '9876543210', 300, 'Remboursement');

    expect(Transaction.create).toHaveBeenCalledTimes(2);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer_out', amount: 300 }),
      expect.any(Object)
    );
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer_in', amount: 300 }),
      expect.any(Object)
    );
  });

  // TC-024 : destinataire introuvable
  test('TC-024 | P2 | lève RECIPIENT_NOT_FOUND si le destinataire n\'existe pas', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: jest.fn() });
    User.findOne.mockResolvedValue(null);

    await expect(transactionService.transfer('uuid-sender', 'bad-account', 100)).rejects.toThrow('RECIPIENT_NOT_FOUND');
  });

  // TC-025 : auto-virement interdit
  test('TC-025 | P3 | lève SELF_TRANSFER si l\'émetteur et le destinataire sont identiques', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: jest.fn() });
    User.findOne.mockResolvedValue({ ...sender, id: 'uuid-sender', update: jest.fn() });

    await expect(transactionService.transfer('uuid-sender', '1234567890', 100)).rejects.toThrow('SELF_TRANSFER');
  });

  // TC-026 : solde insuffisant pour le virement
  test('TC-026 | P4 | lève INSUFFICIENT_FUNDS si le solde émetteur est insuffisant', async () => {
    User.findByPk.mockResolvedValue({ ...makeUser('uuid-sender', 50), update: jest.fn() });
    User.findOne.mockResolvedValue({ ...recipient, update: jest.fn() });

    await expect(transactionService.transfer('uuid-sender', '9876543210', 200)).rejects.toThrow('INSUFFICIENT_FUNDS');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  // TC-027 : montant invalide
  test('TC-027 | P5 | lève INVALID_AMOUNT si amount est 0 ou négatif', async () => {
    await expect(transactionService.transfer('uuid-sender', '9876543210', 0)).rejects.toThrow('INVALID_AMOUNT');
    await expect(transactionService.transfer('uuid-sender', '9876543210', -50)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-028 : destinataire requis
  test('TC-028 | P6 | lève RECIPIENT_REQUIRED si le destinataire est vide', async () => {
    await expect(transactionService.transfer('uuid-sender', '', 100)).rejects.toThrow('RECIPIENT_REQUIRED');
  });
});
