vi.mock('../../src/services/transactionService', () => ({
  calculateFee: null, deposit: null, withdraw: null, transfer: null,
  getAllTransactions: null, getTransactionsByUserId: null,
  getStats: null, getDashboardStats: null,
}));
vi.mock('../../src/services/userService', () => ({
  createUser: null, getAllUsers: null, getUserById: null,
  updateUser: null, deleteUser: null, login: null,
  register: null, getBalance: null, createAccount: null,
}));
vi.mock('../../src/models', () => ({
  User: {}, Transaction: {}, BankAccount: {},
  syncDatabase: () => Promise.resolve(),
}));
vi.mock('../../src/config/database', () => ({
  define: () => {}, sync: () => Promise.resolve(),
}));
vi.mock('../../src/models/BankAccount', () => ({
  BANK_MASTER_ID: 'BANK-MASTER-001',
}));
vi.mock('jsonwebtoken', () => ({ verify: null, sign: null }));

const request = require('supertest');
const app = require('../../src/app');
const transactionService = require('../../src/services/transactionService');
const jwt = require('jsonwebtoken');

// Assign proper vi.fn() at module scope (normal execution context)
jwt.verify = vi.fn();
jwt.sign   = vi.fn();

transactionService.deposit                = vi.fn();
transactionService.withdraw               = vi.fn();
transactionService.transfer               = vi.fn();
transactionService.getAllTransactions      = vi.fn();
transactionService.getTransactionsByUserId = vi.fn();

const adminToken  = 'mock_admin_token';
const clientToken = 'mock_client_token';
const VALID_USER_UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeAll(() => {
  jwt.verify.mockImplementation((token) => {
    if (token === adminToken)  return { id: 'admin-id',  email: 'admin@test.com',  role: 'admin'  };
    if (token === clientToken) return { id: 'user-uuid', email: 'user@test.com',   role: 'client' };
    throw new Error('invalid token');
  });
});

afterEach(() => vi.clearAllMocks());

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/transactions/deposit — ADMIN uniquement
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/deposit', () => {
  test('201 — admin effectue un dépôt valide', async () => {
    transactionService.deposit.mockResolvedValue({
      id: 'tx-001', type: 'deposit', amount: 5000, fees: 0, balanceBefore: 0, balanceAfter: 5000,
    });

    const res = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: VALID_USER_UUID, amount: 5000, description: 'Ouverture compte' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('deposit');
  });

  test('403 — refuse si l\'émetteur n\'est pas admin', async () => {
    const res = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 5000 });

    expect(res.status).toBe(403);
  });

  test('401 — refuse sans token', async () => {
    const res = await request(app)
      .post('/api/transactions/deposit')
      .send({ userId: VALID_USER_UUID, amount: 5000 });
    expect(res.status).toBe(401);
  });

  test('400 — retourne 400 si montant est 0', async () => {
    const res = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: VALID_USER_UUID, amount: 0 });
    expect(res.status).toBe(400);
  });

  test('404 — retourne 404 si utilisateur cible introuvable', async () => {
    transactionService.deposit.mockRejectedValue(new Error('USER_NOT_FOUND'));

    const res = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: VALID_USER_UUID, amount: 1000 });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/transactions/withdraw — avec frais
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/withdraw', () => {
  test('201 — retrait réussi avec information des frais', async () => {
    transactionService.withdraw.mockResolvedValue({
      id: 'tx-002', type: 'withdraw', amount: 1000, fees: 500, balanceBefore: 2000, balanceAfter: 500,
    });

    const res = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 1000 });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('withdraw');
    expect(res.body.fees).toBe(500);
    expect(res.body.message).toContain('frais');
  });

  test('422 — retourne 422 si solde insuffisant (montant + frais)', async () => {
    transactionService.withdraw.mockRejectedValue(new Error('INSUFFICIENT_FUNDS'));

    const res = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 99999 });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('frais');
  });

  test('400 — retourne 400 si montant négatif (validation)', async () => {
    const res = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: -50 });
    expect(res.status).toBe(400);
  });

  test('401 — refuse sans token', async () => {
    const res = await request(app)
      .post('/api/transactions/withdraw')
      .send({ userId: VALID_USER_UUID, amount: 100 });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/transactions/transfer
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/transfer', () => {
  test('201 — virement interne réussi', async () => {
    transactionService.transfer.mockResolvedValue({
      transaction: { id: 'tx-003', type: 'transfer_internal', amount: 2000, fees: 200 },
      fees: 200,
      isExternal: false,
    });

    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toIdentifier: 'bob@test.com', amount: 2000, isExternal: false });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.fees).toBe(200);
    expect(res.body.message).toContain('frais');
  });

  test('201 — virement externe avec frais plus élevés', async () => {
    transactionService.transfer.mockResolvedValue({
      transaction: { id: 'tx-004', type: 'transfer_external', amount: 2000, fees: 2000 },
      fees: 2000,
      isExternal: true,
    });

    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toIdentifier: 'UBA-Cameroun', amount: 2000, isExternal: true });

    expect(res.status).toBe(201);
    expect(res.body.fees).toBe(2000);
    expect(res.body.isExternal).toBe(true);
  });

  test('404 — retourne 404 si destinataire introuvable', async () => {
    transactionService.transfer.mockRejectedValue(new Error('RECIPIENT_NOT_FOUND'));

    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toIdentifier: 'ghost@test.com', amount: 500 });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('introuvable');
  });

  test('422 — retourne 422 si solde insuffisant', async () => {
    transactionService.transfer.mockRejectedValue(new Error('INSUFFICIENT_FUNDS'));

    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toIdentifier: 'bob@test.com', amount: 99999 });

    expect(res.status).toBe(422);
  });

  test('422 — retourne 422 pour auto-virement', async () => {
    transactionService.transfer.mockRejectedValue(new Error('SELF_TRANSFER'));

    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toIdentifier: 'user@test.com', amount: 100 });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('interdit');
  });

  test('400 — retourne 400 si destinataire absent (validation)', async () => {
    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ toIdentifier: '', amount: 100 });
    expect(res.status).toBe(400);
  });

  test('401 — refuse sans token', async () => {
    const res = await request(app)
      .post('/api/transactions/transfer')
      .send({ toIdentifier: 'bob@test.com', amount: 100 });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/transactions
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/transactions', () => {
  test('200 — retourne toutes les transactions (admin)', async () => {
    transactionService.getAllTransactions.mockResolvedValue([
      { id: 'tx-1', type: 'deposit',   amount: 5000, fees: 0   },
      { id: 'tx-2', type: 'withdraw',  amount: 1000, fees: 500 },
      { id: 'tx-3', type: 'transfer_internal', amount: 2000, fees: 200 },
    ]);

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.count).toBe(3);
  });

  test('401 — refuse sans token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.status).toBe(401);
  });

  test('403 — refuse pour un non-admin', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/transactions/:userId
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/transactions/:userId', () => {
  test('200 — retourne les transactions d\'un utilisateur', async () => {
    transactionService.getTransactionsByUserId.mockResolvedValue([
      { id: 'tx-1', type: 'deposit', amount: 5000, fees: 0 },
    ]);

    const res = await request(app)
      .get(`/api/transactions/${VALID_USER_UUID}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('404 — retourne 404 si l\'utilisateur n\'existe pas', async () => {
    transactionService.getTransactionsByUserId.mockRejectedValue(new Error('USER_NOT_FOUND'));

    const res = await request(app)
      .get(`/api/transactions/${VALID_USER_UUID}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
  });
});
