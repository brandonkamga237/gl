const request = require('supertest');

jest.mock('../../src/services/userService');
jest.mock('../../src/services/transactionService');
jest.mock('../../src/models', () => ({
  User: {},
  Transaction: {},
  syncDatabase: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/config/database', () => ({
  define: jest.fn(),
  sync: jest.fn().mockResolvedValue(true),
  transaction: jest.fn(),
  fn: jest.fn(),
  col: jest.fn(),
}));

const jwt = require('jsonwebtoken');
jest.mock('jsonwebtoken');

const app = require('../../src/app');
const userService = require('../../src/services/userService');
const transactionService = require('../../src/services/transactionService');

const clientToken = 'mock_client_token';

const mockProfile = {
  id: 'client-uuid',
  name: 'Alice',
  email: 'alice@neobank.test',
  accountNumber: '1234567890',
  balance: '25000.00',
  role: 'client',
  isActive: true,
};

beforeAll(() => {
  jwt.verify.mockImplementation((token) => {
    if (token === clientToken) return { id: 'client-uuid', email: 'alice@neobank.test', role: 'client', name: 'Alice' };
    throw new Error('invalid token');
  });
});

afterEach(() => jest.clearAllMocks());

// Cookie helper
const authCookie = () => `token=${clientToken}`;

// ═══════════════════════════════════════════════════════════════════════════
//  Accès sans authentification
// ═══════════════════════════════════════════════════════════════════════════
describe('Protection des routes /app', () => {
  test('redirige vers /login sans cookie', async () => {
    const res = await request(app).get('/app/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('donne accès au dashboard avec un cookie valide', async () => {
    userService.getProfile.mockResolvedValue(mockProfile);
    transactionService.getHistory.mockResolvedValue([]);

    const res = await request(app).get('/app/dashboard').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.text).toContain('Solde disponible');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /app/dashboard
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /app/dashboard', () => {
  test('200 — affiche le solde et le numéro de compte', async () => {
    userService.getProfile.mockResolvedValue(mockProfile);
    transactionService.getHistory.mockResolvedValue([]);

    const res = await request(app).get('/app/dashboard').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.text).toContain('1234567890');
    expect(res.text).toContain('25');
  });

  test('200 — affiche les transactions récentes si présentes', async () => {
    userService.getProfile.mockResolvedValue(mockProfile);
    transactionService.getHistory.mockResolvedValue([
      { id: 'tx-1', type: 'deposit', amount: '5000.00', balanceBefore: '20000.00', balanceAfter: '25000.00', description: 'Salaire', createdAt: new Date() },
    ]);

    const res = await request(app).get('/app/dashboard').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.text).toContain('Dépôt');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /app/deposit
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /app/deposit', () => {
  test('200 — affiche le formulaire de dépôt avec le solde actuel', async () => {
    userService.getProfile.mockResolvedValue(mockProfile);

    const res = await request(app).get('/app/deposit').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.text).toContain('Dépôt');
    expect(res.text).toContain('FCFA');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /app/deposit
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /app/deposit', () => {
  test('302 — redirige avec succès après un dépôt valide', async () => {
    transactionService.deposit.mockResolvedValue({ id: 'tx-new', type: 'deposit', amount: 10000 });

    const res = await request(app)
      .post('/app/deposit')
      .set('Cookie', authCookie())
      .send({ amount: '10000', description: 'Salaire' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/app/deposit?success=');
  });

  test('302 — redirige avec erreur si montant < 100', async () => {
    const res = await request(app)
      .post('/app/deposit')
      .set('Cookie', authCookie())
      .send({ amount: '50' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/app/deposit?error=');
  });

  test('302 — redirige avec erreur si montant absent', async () => {
    const res = await request(app)
      .post('/app/deposit')
      .set('Cookie', authCookie())
      .send({ amount: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/app/deposit?error=');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /app/withdraw
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /app/withdraw', () => {
  test('302 — redirige avec succès après un retrait valide', async () => {
    transactionService.withdraw.mockResolvedValue({ id: 'tx-w1', type: 'withdraw', amount: 5000 });

    const res = await request(app)
      .post('/app/withdraw')
      .set('Cookie', authCookie())
      .send({ amount: '5000', description: 'Loyer' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/app/withdraw?success=');
  });

  test('302 — redirige avec message solde insuffisant', async () => {
    transactionService.withdraw.mockRejectedValue(new Error('INSUFFICIENT_FUNDS'));

    const res = await request(app)
      .post('/app/withdraw')
      .set('Cookie', authCookie())
      .send({ amount: '9999999' });

    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.location)).toContain('insuffisant');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /app/transfer
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /app/transfer', () => {
  test('200 — affiche le formulaire de virement', async () => {
    userService.getProfile.mockResolvedValue(mockProfile);

    const res = await request(app).get('/app/transfer').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.text).toContain('Virement');
    expect(res.text).toContain('1234567890');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /app/transfer
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /app/transfer', () => {
  test('302 — redirige avec succès après un virement réussi', async () => {
    transactionService.transfer.mockResolvedValue({
      txOut: { id: 'tx-out' },
      recipient: { name: 'Bob', accountNumber: '9876543210' },
    });

    const res = await request(app)
      .post('/app/transfer')
      .set('Cookie', authCookie())
      .send({ to: '9876543210', amount: '5000', description: 'Remboursement' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/app/transfer?success=');
    expect(decodeURIComponent(res.headers.location)).toContain('Bob');
  });

  test('302 — redirige avec erreur si destinataire introuvable', async () => {
    transactionService.transfer.mockRejectedValue(new Error('RECIPIENT_NOT_FOUND'));

    const res = await request(app)
      .post('/app/transfer')
      .set('Cookie', authCookie())
      .send({ to: '9999999999', amount: '1000' });

    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.location)).toContain('introuvable');
  });

  test('302 — redirige avec erreur si auto-virement', async () => {
    transactionService.transfer.mockRejectedValue(new Error('SELF_TRANSFER'));

    const res = await request(app)
      .post('/app/transfer')
      .set('Cookie', authCookie())
      .send({ to: '1234567890', amount: '1000' });

    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.location)).toContain('vous-m');
  });

  test('302 — redirige si destinataire manquant', async () => {
    const res = await request(app)
      .post('/app/transfer')
      .set('Cookie', authCookie())
      .send({ to: '', amount: '1000' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/app/transfer?error=');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /app/history
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /app/history', () => {
  test('200 — affiche l\'historique complet', async () => {
    userService.getProfile.mockResolvedValue(mockProfile);
    transactionService.getHistory.mockResolvedValue([
      { id: 'tx-1', type: 'deposit', amount: '5000.00', balanceBefore: '0.00', balanceAfter: '5000.00', description: '', createdAt: new Date() },
      { id: 'tx-2', type: 'transfer_out', amount: '1000.00', balanceBefore: '5000.00', balanceAfter: '4000.00', description: 'Bob', createdAt: new Date() },
    ]);

    const res = await request(app).get('/app/history').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.text).toContain('Historique');
    expect(res.text).toContain('Dépôt');
    expect(res.text).toContain('Virement émis');
  });

  test('200 — affiche message vide si aucune opération', async () => {
    userService.getProfile.mockResolvedValue(mockProfile);
    transactionService.getHistory.mockResolvedValue([]);

    const res = await request(app).get('/app/history').set('Cookie', authCookie());

    expect(res.status).toBe(200);
    expect(res.text).toContain('Aucune op');
  });
});
