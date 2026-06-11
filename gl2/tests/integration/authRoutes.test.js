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

const clientToken = 'mock_client_token';
const adminToken = 'mock_admin_token';

beforeAll(() => {
  jwt.verify.mockImplementation((token) => {
    if (token === adminToken) return { id: 'admin-uuid', email: 'admin@neobank.test', role: 'admin', name: 'Admin' };
    if (token === clientToken) return { id: 'client-uuid', email: 'alice@neobank.test', role: 'client', name: 'Alice' };
    throw new Error('invalid token');
  });
});

afterEach(() => jest.clearAllMocks());

// ═══════════════════════════════════════════════════════════════════════════
//  GET /login — page de connexion
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /login', () => {
  test('200 — affiche la page de connexion', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('NeoBank');
  });

  test('200 — affiche un message d\'erreur si query error présent', async () => {
    const res = await request(app).get('/login?error=Identifiants+incorrects');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Identifiants');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /register — page d'inscription
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /register', () => {
  test('200 — affiche le formulaire d\'inscription', async () => {
    const res = await request(app).get('/register');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Inscription');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /login — action de connexion
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /login', () => {
  test('302 — redirige vers /app/dashboard si credentials client valides', async () => {
    userService.login.mockResolvedValue({
      user: { id: 'client-uuid', role: 'client', name: 'Alice', email: 'alice@neobank.test' },
      token: clientToken,
    });

    const res = await request(app).post('/login').send({ email: 'alice@neobank.test', password: 'pass123' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/app/dashboard');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('302 — redirige vers /admin/dashboard si credentials admin valides', async () => {
    userService.login.mockResolvedValue({
      user: { id: 'admin-uuid', role: 'admin', name: 'Admin', email: 'admin@neobank.test' },
      token: adminToken,
    });

    const res = await request(app).post('/login').send({ email: 'admin@neobank.test', password: 'adminpass' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/dashboard');
  });

  test('302 — redirige vers /login?error si credentials invalides', async () => {
    userService.login.mockRejectedValue(new Error('INVALID_CREDENTIALS'));

    const res = await request(app).post('/login').send({ email: 'x@test.com', password: 'wrong' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login?error=');
  });

  test('302 — redirige avec message compte suspendu', async () => {
    userService.login.mockRejectedValue(new Error('ACCOUNT_DISABLED'));

    const res = await request(app).post('/login').send({ email: 'alice@neobank.test', password: 'pw' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('suspendu');
  });

  test('302 — redirige si champs manquants', async () => {
    const res = await request(app).post('/login').send({ email: '' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login?error=');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /register — action d'inscription
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /register', () => {
  test('302 — redirige vers /login après inscription réussie', async () => {
    userService.register.mockResolvedValue({ id: 'new-uuid', name: 'Bob', email: 'bob@neobank.test' });

    const res = await request(app).post('/register').send({
      name: 'Bob',
      email: 'bob@neobank.test',
      password: 'secret123',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');
  });

  test('302 — redirige avec erreur si email déjà utilisé', async () => {
    userService.register.mockRejectedValue(new Error('EMAIL_ALREADY_EXISTS'));

    const res = await request(app).post('/register').send({
      name: 'Alice',
      email: 'alice@neobank.test',
      password: 'secret123',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/register?error=');
    expect(decodeURIComponent(res.headers.location)).toContain('email');
  });

  test('302 — redirige si mot de passe trop court', async () => {
    const res = await request(app).post('/register').send({
      name: 'Test',
      email: 'test@neobank.test',
      password: 'abc',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/register?error=');
  });

  test('302 — redirige si champs requis manquants', async () => {
    const res = await request(app).post('/register').send({ name: 'Test' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/register?error=');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /logout
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /logout', () => {
  test('302 — redirige vers /login et supprime le cookie', async () => {
    const res = await request(app).get('/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});
