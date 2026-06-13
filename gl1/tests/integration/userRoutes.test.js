vi.mock('../../src/services/userService', () => ({
  createUser: null, getAllUsers: null, getUserById: null,
  updateUser: null, deleteUser: null, login: null,
  register: null, getBalance: null, createAccount: null,
}));
vi.mock('../../src/services/transactionService', () => ({
  calculateFee: null, deposit: null, withdraw: null, transfer: null,
  getAllTransactions: null, getTransactionsByUserId: null,
  getStats: null, getDashboardStats: null,
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
const userService = require('../../src/services/userService');
const jwt = require('jsonwebtoken');

// Assign proper vi.fn() at module scope (normal execution context)
jwt.verify = vi.fn();
jwt.sign   = vi.fn();

userService.createUser   = vi.fn();
userService.getAllUsers   = vi.fn();
userService.getUserById  = vi.fn();
userService.updateUser   = vi.fn();
userService.deleteUser   = vi.fn();
userService.login        = vi.fn();

const adminToken  = 'mock_admin_token';
const clientToken = 'mock_client_token';
const VALID_UUID  = '550e8400-e29b-41d4-a716-446655440000';

beforeAll(() => {
  jwt.verify.mockImplementation((token) => {
    if (token === adminToken)  return { id: 'admin-id', email: 'admin@test.com',  role: 'admin'  };
    if (token === clientToken) return { id: 'user-id',  email: 'user@test.com',   role: 'client' };
    throw new Error('invalid token');
  });
});

afterEach(() => vi.clearAllMocks());

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/users
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/users', () => {
  test('201 — crée un utilisateur avec les données valides', async () => {
    userService.createUser.mockResolvedValue({ id: 'uuid-1', name: 'Bob', email: 'bob@test.com', role: 'client', balance: 0 });

    const res = await request(app).post('/api/users').send({
      name: 'Bob', email: 'bob@test.com', password: 'Secret@123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('bob@test.com');
  });

  test('409 — retourne Conflict si email déjà utilisé', async () => {
    userService.createUser.mockRejectedValue(new Error('EMAIL_ALREADY_EXISTS'));

    const res = await request(app).post('/api/users').send({
      name: 'Bob', email: 'existing@test.com', password: 'Secret@123',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('400 — retourne erreurs de validation si données invalides', async () => {
    const res = await request(app).post('/api/users').send({ name: '', email: 'not-an-email', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/users
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/users', () => {
  test('200 — retourne la liste des utilisateurs (admin)', async () => {
    userService.getAllUsers.mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@test.com' },
      { id: 'u2', name: 'Bob',   email: 'bob@test.com'   },
    ]);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.count).toBe(2);
  });

  test('401 — retourne 401 sans token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('403 — refuse l\'accès à un utilisateur non-admin', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/users/:id
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /api/users/:id', () => {
  test('200 — retourne les détails d\'un utilisateur existant', async () => {
    userService.getUserById.mockResolvedValue({ id: VALID_UUID, name: 'Alice', email: 'alice@test.com' });
    const res = await request(app).get(`/api/users/${VALID_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(VALID_UUID);
  });

  test('404 — retourne 404 si utilisateur inexistant', async () => {
    userService.getUserById.mockRejectedValue(new Error('USER_NOT_FOUND'));
    const res = await request(app).get(`/api/users/${VALID_UUID}`);
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  PUT /api/users/:id
// ═══════════════════════════════════════════════════════════════════════════
describe('PUT /api/users/:id', () => {
  test('200 — met à jour les données valides', async () => {
    userService.updateUser.mockResolvedValue({ id: VALID_UUID, name: 'Alice Updated', email: 'alice@test.com' });

    const res = await request(app)
      .put(`/api/users/${VALID_UUID}`)
      .send({ name: 'Alice Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Alice Updated');
  });

  test('404 — retourne 404 si l\'utilisateur n\'existe pas', async () => {
    userService.updateUser.mockRejectedValue(new Error('USER_NOT_FOUND'));
    const res = await request(app).put(`/api/users/${VALID_UUID}`).send({ name: 'Unknown User' });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /api/users/:id
// ═══════════════════════════════════════════════════════════════════════════
describe('DELETE /api/users/:id', () => {
  test('200 — supprime un utilisateur existant (admin)', async () => {
    userService.deleteUser.mockResolvedValue({ message: 'User deleted successfully' });

    const res = await request(app)
      .delete(`/api/users/${VALID_UUID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('404 — retourne 404 si utilisateur inexistant', async () => {
    userService.deleteUser.mockRejectedValue(new Error('USER_NOT_FOUND'));

    const res = await request(app)
      .delete(`/api/users/${VALID_UUID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/auth/login
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/login', () => {
  test('200 — retourne token et données utilisateur', async () => {
    userService.login.mockResolvedValue({
      user:  { id: 'uuid-1', email: 'alice@test.com', role: 'client' },
      token: 'jwt_token',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@test.com', password: 'correct_password',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  test('401 — retourne 401 pour credentials invalides', async () => {
    userService.login.mockRejectedValue(new Error('INVALID_CREDENTIALS'));

    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@test.com', password: 'wrong_password',
    });

    expect(res.status).toBe(401);
  });

  test('400 — retourne 400 si email manquant', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'pw' });
    expect(res.status).toBe(400);
  });
});
