const request = require('supertest');

jest.mock('../../src/services/transactionService');
jest.mock('../../src/services/userService');
jest.mock('../../src/models', () => ({
  User: {},
  Transaction: {},
  syncDatabase: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/config/database', () => ({
  define: jest.fn(),
  sync: jest.fn().mockResolvedValue(true),
}));

const app = require('../../src/app');
const transactionService = require('../../src/services/transactionService');

const jwt = require('jsonwebtoken');
jest.mock('jsonwebtoken');

const adminToken = 'mock_admin_token';
const clientToken = 'mock_client_token';

const VALID_USER_UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeAll(() => {
  jwt.verify.mockImplementation((token) => {
    if (token === adminToken) return { id: 'admin-id', email: 'admin@test.com', role: 'admin' };
    if (token === clientToken) return { id: 'user-uuid', email: 'user@test.com', role: 'client' };
    throw new Error('invalid token');
  });
});

afterEach(() => jest.clearAllMocks());

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/transactions/deposit
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/deposit', () => {
  test('201 — effectue un dépôt valide', async () => {
    transactionService.deposit.mockResolvedValue({
      id: 'tx-001',
      type: 'deposit',
      amount: 200,
      balanceBefore: 500,
      balanceAfter: 700,
    });

    const res = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 200, description: 'Salaire' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('deposit');
  });

  test('400 — retourne 400 si montant invalide (0)', async () => {
    transactionService.deposit.mockRejectedValue(new Error('INVALID_AMOUNT'));

    const res = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 0 });

    // La validation express-validator bloque avant le service
    expect([400, 400]).toContain(res.status);
  });

  test('404 — retourne 404 si utilisateur introuvable', async () => {
    transactionService.deposit.mockRejectedValue(new Error('USER_NOT_FOUND'));

    const res = await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 100 });

    expect(res.status).toBe(404);
  });

  test('401 — refuse sans token', async () => {
    const res = await request(app)
      .post('/api/transactions/deposit')
      .send({ userId: VALID_USER_UUID, amount: 100 });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/transactions/withdraw
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/withdraw', () => {
  test('201 — effectue un retrait valide', async () => {
    transactionService.withdraw.mockResolvedValue({
      id: 'tx-002',
      type: 'withdraw',
      amount: 100,
      balanceBefore: 500,
      balanceAfter: 400,
    });

    const res = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('withdraw');
  });

  test('422 — retourne 422 si solde insuffisant', async () => {
    transactionService.withdraw.mockRejectedValue(new Error('INSUFFICIENT_FUNDS'));

    const res = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: 99999 });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Insufficient');
  });

  test('400 — retourne 400 si montant négatif', async () => {
    const res = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ userId: VALID_USER_UUID, amount: -50 });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/transactions
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/transactions', () => {
  test('200 — retourne toutes les transactions (admin)', async () => {
    transactionService.getAllTransactions.mockResolvedValue([
      { id: 'tx-1', type: 'deposit', amount: 100 },
      { id: 'tx-2', type: 'withdraw', amount: 50 },
    ]);

    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.count).toBe(2);
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
      { id: 'tx-1', type: 'deposit', amount: 200 },
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
