vi.mock('../../src/models', () => ({
  User:        {},
  Transaction: {},
  BankAccount: {},
}));
vi.mock('../../src/config/database', () => ({ default: {} }));
vi.mock('../../src/models/BankAccount', () => ({
  BANK_MASTER_ID: 'BANK-MASTER-001',
}));

const sequelize = require('../../src/config/database');
const { User, Transaction, BankAccount } = require('../../src/models');
const transactionService = require('../../src/services/transactionService');

// Assign proper vi.fn() at module scope (normal execution context, not factory)
User.findByPk     = vi.fn();
User.findOne      = vi.fn();
User.count        = vi.fn();
User.findAll      = vi.fn();
Transaction.create  = vi.fn();
Transaction.findAll = vi.fn();
Transaction.count   = vi.fn();
BankAccount.findByPk = vi.fn();
BankAccount.create   = vi.fn();
sequelize.transaction = vi.fn();
sequelize.fn  = vi.fn();
sequelize.col = vi.fn();

// ─── Helpers ───────────────────────────────────────────────────────────────
const makeUser = (id, balance = 1000) => ({
  id,
  name: 'Alice',
  email: 'alice@test.com',
  balance: balance.toFixed(2),
  update: vi.fn().mockResolvedValue(true),
});

const makeBank = (balance = 50000000) => ({
  id: 'BANK-MASTER-001',
  balance: balance.toFixed(2),
  totalFeesCollected: '0.00',
  totalDeposited: '0.00',
  totalWithdrawn: '0.00',
  update: vi.fn().mockResolvedValue(true),
});

const setupTx = (userBalance = 1000) => {
  const user = makeUser('uuid-user-001', userBalance);
  const bank = makeBank();
  sequelize.transaction.mockImplementation(async (cb) => cb({ lock: true }));
  User.findByPk.mockResolvedValue(user);
  BankAccount.findByPk.mockResolvedValue(bank);
  return { user, bank };
};

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 0 — calculateFee
// ═══════════════════════════════════════════════════════════════════════════
describe('calculateFee', () => {
  // TC-F01 : retrait petit montant (minimum s'applique)
  test('TC-F01 | retrait 10 000 FCFA → frais = 500 (min)', () => {
    expect(transactionService.calculateFee(10000, 'withdraw')).toBe(500);
  });

  // TC-F02 : retrait grand montant (taux s'applique)
  test('TC-F02 | retrait 100 000 FCFA → frais = 1 000 (1%)', () => {
    expect(transactionService.calculateFee(100000, 'withdraw')).toBe(1000);
  });

  // TC-F03 : virement interne petit montant (minimum)
  test('TC-F03 | virement interne 10 000 FCFA → frais = 200 (min)', () => {
    expect(transactionService.calculateFee(10000, 'transfer_internal')).toBe(200);
  });

  // TC-F04 : virement interne grand montant (taux)
  test('TC-F04 | virement interne 100 000 FCFA → frais = 500 (0.5%)', () => {
    expect(transactionService.calculateFee(100000, 'transfer_internal')).toBe(500);
  });

  // TC-F05 : virement externe petit montant
  test('TC-F05 | virement externe 10 000 FCFA → frais = 2 000 (min+fixe)', () => {
    expect(transactionService.calculateFee(10000, 'transfer_external')).toBe(2000);
  });

  // TC-F06 : virement externe grand montant
  test('TC-F06 | virement externe 200 000 FCFA → frais = 5 000 (2%+fixe)', () => {
    expect(transactionService.calculateFee(200000, 'transfer_external')).toBe(5000);
  });

  // TC-F07 : frais virement externe > frais virement interne (même montant)
  test('TC-F07 | frais externe > frais interne pour un même montant', () => {
    const feeInternal = transactionService.calculateFee(50000, 'transfer_internal');
    const feeExternal = transactionService.calculateFee(50000, 'transfer_external');
    expect(feeExternal).toBeGreaterThan(feeInternal);
  });

  // TC-F08 : type inconnu → 0
  test('TC-F08 | type inconnu → 0 FCFA de frais', () => {
    expect(transactionService.calculateFee(50000, 'deposit')).toBe(0);
    expect(transactionService.calculateFee(50000, 'unknown')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 2 — deposit (admin → utilisateur)
// ═══════════════════════════════════════════════════════════════════════════
describe('deposit', () => {
  beforeEach(() => vi.clearAllMocks());

  // TC-D01 : chemin nominal — dépôt réussi
  test('TC-D01 | P1 | crédite l\'utilisateur et débite la banque', async () => {
    const { user, bank } = setupTx(500);
    const expectedTx = { id: 'tx-001', type: 'deposit', amount: 200, fees: 0, balanceBefore: 500, balanceAfter: 700 };
    Transaction.create.mockResolvedValue(expectedTx);

    const result = await transactionService.deposit('uuid-user-001', 200, 'Salaire mensuel');

    expect(user.update).toHaveBeenCalledWith({ balance: 700 }, expect.any(Object));
    expect(bank.update).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeposited: 200 }),
      expect.any(Object)
    );
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'deposit', amount: 200, fees: 0 }),
      expect.any(Object)
    );
    expect(result).toEqual(expectedTx);
  });

  // TC-D02 : montant invalide — zéro
  test('TC-D02 | P2 | lève INVALID_AMOUNT si amount est 0', async () => {
    await expect(transactionService.deposit('uuid-001', 0)).rejects.toThrow('INVALID_AMOUNT');
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  // TC-D03 : montant négatif
  test('TC-D03 | P3 | lève INVALID_AMOUNT si amount est négatif', async () => {
    await expect(transactionService.deposit('uuid-001', -100)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-D04 : utilisateur inexistant
  test('TC-D04 | P4 | lève USER_NOT_FOUND si le compte cible n\'existe pas', async () => {
    sequelize.transaction.mockImplementation(async (cb) => cb({}));
    User.findByPk.mockResolvedValue(null);
    BankAccount.findByPk.mockResolvedValue(makeBank());
    await expect(transactionService.deposit('bad-id', 100)).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-D05 : montant null
  test('TC-D05 | P5 | lève INVALID_AMOUNT si amount est null', async () => {
    await expect(transactionService.deposit('uuid-001', null)).rejects.toThrow('INVALID_AMOUNT');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 3 — withdraw (avec frais)
// ═══════════════════════════════════════════════════════════════════════════
describe('withdraw', () => {
  beforeEach(() => vi.clearAllMocks());

  // TC-W01 : chemin nominal — retrait avec frais
  test('TC-W01 | P1 | débite montant+frais et crédite la banque des frais', async () => {
    const { user, bank } = setupTx(2000);
    const expectedTx = { id: 'tx-002', type: 'withdraw', amount: 1000, fees: 500 };
    Transaction.create.mockResolvedValue(expectedTx);

    const result = await transactionService.withdraw('uuid-user-001', 1000, 'Loyer');

    expect(user.update).toHaveBeenCalledWith({ balance: 500 }, expect.any(Object));
    expect(bank.update).toHaveBeenCalledWith(
      expect.objectContaining({ totalFeesCollected: 500 }),
      expect.any(Object)
    );
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'withdraw', amount: 1000, fees: 500 }),
      expect.any(Object)
    );
    expect(result.fees).toBe(500);
  });

  // TC-W02 : solde couvre le montant mais pas les frais
  test('TC-W02 | P2 | lève INSUFFICIENT_FUNDS quand le solde couvre le montant mais pas les frais', async () => {
    setupTx(1000);
    await expect(transactionService.withdraw('uuid-user-001', 1000)).rejects.toThrow('INSUFFICIENT_FUNDS');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  // TC-W03 : solde insuffisant
  test('TC-W03 | P3 | lève INSUFFICIENT_FUNDS si solde < montant+frais', async () => {
    setupTx(200);
    await expect(transactionService.withdraw('uuid-user-001', 500)).rejects.toThrow('INSUFFICIENT_FUNDS');
  });

  // TC-W04 : retrait exact (balance = montant + frais)
  test('TC-W04 | P4 | autorise le retrait quand balance = montant + frais exactement', async () => {
    const { user } = setupTx(1500);
    Transaction.create.mockResolvedValue({ type: 'withdraw', amount: 1000, fees: 500 });

    await transactionService.withdraw('uuid-user-001', 1000);
    expect(user.update).toHaveBeenCalledWith({ balance: 0 }, expect.any(Object));
  });

  // TC-W05 : montant zéro
  test('TC-W05 | P5 | lève INVALID_AMOUNT si amount est 0', async () => {
    await expect(transactionService.withdraw('uuid-001', 0)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-W06 : utilisateur inexistant
  test('TC-W06 | P6 | lève USER_NOT_FOUND si l\'utilisateur n\'existe pas', async () => {
    sequelize.transaction.mockImplementation(async (cb) => cb({}));
    User.findByPk.mockResolvedValue(null);
    BankAccount.findByPk.mockResolvedValue(makeBank());
    await expect(transactionService.withdraw('bad-id', 100)).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-W07 : compte à solde zéro
  test('TC-W07 | P7 | refuse le retrait sur un compte vide', async () => {
    setupTx(0);
    await expect(transactionService.withdraw('uuid-user-001', 1)).rejects.toThrow('INSUFFICIENT_FUNDS');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 6 — transfer (interne et externe)
// ═══════════════════════════════════════════════════════════════════════════
describe('transfer', () => {
  const sender    = makeUser('uuid-sender', 5000);
  const recipient = makeUser('uuid-recipient', 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    sequelize.transaction.mockImplementation(async (cb) => cb({ lock: true }));
  });

  // TC-T01 : virement interne réussi
  test('TC-T01 | P1 | virement interne : frais faibles, destinataire crédité', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: vi.fn().mockResolvedValue(true) });
    BankAccount.findByPk.mockResolvedValue(makeBank());
    User.findOne.mockResolvedValue({ ...recipient, update: vi.fn().mockResolvedValue(true) });
    Transaction.create.mockResolvedValue({ id: 'tx-out', type: 'transfer_internal', amount: 1000, fees: 200 });

    const result = await transactionService.transfer('uuid-sender', 'uuid-recipient', 1000, false, 'Remboursement');

    expect(Transaction.create).toHaveBeenCalledTimes(2);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer_internal', fees: 200 }),
      expect.any(Object)
    );
    expect(result.isExternal).toBe(false);
  });

  // TC-T02 : virement externe — frais plus élevés
  test('TC-T02 | P2 | virement externe : frais plus élevés, 1 seule transaction', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: vi.fn().mockResolvedValue(true) });
    BankAccount.findByPk.mockResolvedValue(makeBank());
    Transaction.create.mockResolvedValue({ id: 'tx-ext', type: 'transfer_external', amount: 1000, fees: 2000 });

    const result = await transactionService.transfer('uuid-sender', 'UBA-Cameroun', 1000, true, 'Virement OrangeM');

    expect(Transaction.create).toHaveBeenCalledTimes(1);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer_external', fees: 2000 }),
      expect.any(Object)
    );
    expect(result.isExternal).toBe(true);
  });

  // TC-T03 : frais externe > frais interne (même montant)
  test('TC-T03 | P3 | frais virement externe supérieurs aux frais internes', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: vi.fn().mockResolvedValue(true) });
    BankAccount.findByPk.mockResolvedValue(makeBank());
    User.findOne.mockResolvedValue({ ...recipient, update: vi.fn().mockResolvedValue(true) });
    let capturedFeeInternal = 0;
    let capturedFeeExternal = 0;

    Transaction.create.mockImplementation(async (data) => {
      if (data.type === 'transfer_internal') capturedFeeInternal = data.fees;
      if (data.type === 'transfer_external') capturedFeeExternal = data.fees;
      return { ...data, id: 'tx-mock' };
    });

    await transactionService.transfer('uuid-sender', 'uuid-recipient', 1000, false);
    await transactionService.transfer('uuid-sender', 'BankEXT', 1000, true);

    expect(capturedFeeExternal).toBeGreaterThan(capturedFeeInternal);
  });

  // TC-T04 : destinataire introuvable (interne)
  test('TC-T04 | P4 | lève RECIPIENT_NOT_FOUND si le destinataire est absent', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: vi.fn() });
    BankAccount.findByPk.mockResolvedValue(makeBank());
    User.findOne.mockResolvedValue(null);

    await expect(transactionService.transfer('uuid-sender', 'unknown@test.com', 100, false)).rejects.toThrow('RECIPIENT_NOT_FOUND');
  });

  // TC-T05 : auto-virement interdit
  test('TC-T05 | P5 | lève SELF_TRANSFER si émetteur = destinataire', async () => {
    User.findByPk.mockResolvedValue({ ...sender, update: vi.fn() });
    BankAccount.findByPk.mockResolvedValue(makeBank());
    User.findOne.mockResolvedValue({ ...sender, id: 'uuid-sender', update: vi.fn() });

    await expect(transactionService.transfer('uuid-sender', 'uuid-sender', 100, false)).rejects.toThrow('SELF_TRANSFER');
  });

  // TC-T06 : solde insuffisant (montant + frais)
  test('TC-T06 | P6 | lève INSUFFICIENT_FUNDS si solde < montant + frais', async () => {
    User.findByPk.mockResolvedValue({ ...makeUser('uuid-sender', 1000), update: vi.fn() });
    BankAccount.findByPk.mockResolvedValue(makeBank());
    User.findOne.mockResolvedValue({ ...recipient, update: vi.fn() });

    await expect(transactionService.transfer('uuid-sender', 'uuid-recipient', 1000, false)).rejects.toThrow('INSUFFICIENT_FUNDS');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  // TC-T07 : montant invalide
  test('TC-T07 | P7 | lève INVALID_AMOUNT si amount ≤ 0', async () => {
    await expect(transactionService.transfer('uuid-sender', 'uuid-recipient', 0)).rejects.toThrow('INVALID_AMOUNT');
    await expect(transactionService.transfer('uuid-sender', 'uuid-recipient', -50)).rejects.toThrow('INVALID_AMOUNT');
  });

  // TC-T08 : destinataire vide
  test('TC-T08 | P8 | lève RECIPIENT_REQUIRED si toIdentifier est vide', async () => {
    await expect(transactionService.transfer('uuid-sender', '', 100)).rejects.toThrow('RECIPIENT_REQUIRED');
    await expect(transactionService.transfer('uuid-sender', null, 100)).rejects.toThrow('RECIPIENT_REQUIRED');
  });
});
