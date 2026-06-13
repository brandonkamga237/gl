vi.mock('../../src/models', () => ({ User: {} }));
vi.mock('bcrypt', () => ({ hash: null, compare: null }));
vi.mock('jsonwebtoken', () => ({ sign: null, verify: null }));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../../src/models');
const userService = require('../../src/services/userService');

// Assign proper vi.fn() at module scope (normal execution context, not factory)
User.findOne  = vi.fn();
User.findByPk = vi.fn();
User.findAll  = vi.fn();
User.create   = vi.fn();
bcrypt.hash    = vi.fn();
bcrypt.compare = vi.fn();
jwt.sign   = vi.fn();
jwt.verify = vi.fn();

// ─── Helper ────────────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  id: 'uuid-001',
  name: 'Alice',
  email: 'alice@test.com',
  password: 'hashed_pw',
  role: 'client',
  balance: '500.00',
  isActive: true,
  toJSON: () => ({
    id: 'uuid-001', name: 'Alice', email: 'alice@test.com',
    password: 'hashed_pw', role: 'client', balance: '500.00',
    isActive: true, ...overrides,
  }),
  update:  vi.fn().mockResolvedValue(true),
  destroy: vi.fn().mockResolvedValue(true),
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 1 — createUser
// ═══════════════════════════════════════════════════════════════════════════
describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bcrypt.hash.mockResolvedValue('hashed_password');
    process.env.JWT_SECRET = 'test_secret';
  });

  // TC-001 : chemin nominal — création réussie
  test('TC-001 | P1 | crée un utilisateur avec les données valides', async () => {
    User.findOne.mockResolvedValue(null);
    const userData = { id: 'uuid-new', name: 'Bob', email: 'bob@test.com', password: 'hashed_password', role: 'client', balance: '0.00', isActive: true };
    User.create.mockResolvedValue({ ...userData, toJSON: () => userData });

    const result = await userService.createUser({ name: 'Bob', email: 'bob@test.com', password: 'secret123' });

    expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'bob@test.com' } });
    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
    expect(User.create).toHaveBeenCalled();
    expect(result).not.toHaveProperty('password');
  });

  // TC-002 : email déjà existant
  test('TC-002 | P2 | lève EMAIL_ALREADY_EXISTS si email pris', async () => {
    User.findOne.mockResolvedValue(makeUser());
    await expect(
      userService.createUser({ name: 'Bob', email: 'alice@test.com', password: 'secret123' })
    ).rejects.toThrow('EMAIL_ALREADY_EXISTS');
    expect(User.create).not.toHaveBeenCalled();
  });

  // TC-003 : solde initial fourni
  test('TC-003 | P3 | accepte un solde initial personnalisé', async () => {
    User.findOne.mockResolvedValue(null);
    const userData = { id: 'uuid-2', name: 'Carol', email: 'carol@test.com', password: 'h', role: 'client', balance: '200.00', isActive: true };
    User.create.mockResolvedValue({ ...userData, toJSON: () => userData });

    await userService.createUser({ name: 'Carol', email: 'carol@test.com', password: 'pass123', balance: 200 });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ balance: 200 }));
  });

  // TC-004 : rôle admin explicite
  test('TC-004 | P4 | crée un utilisateur avec rôle admin', async () => {
    User.findOne.mockResolvedValue(null);
    const userData = { id: 'uuid-3', name: 'Admin', email: 'admin@test.com', password: 'h', role: 'admin', balance: '0.00', isActive: true };
    User.create.mockResolvedValue({ ...userData, toJSON: () => userData });

    await userService.createUser({ name: 'Admin', email: 'admin@test.com', password: 'pass123', role: 'admin' });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 4 — login
// ═══════════════════════════════════════════════════════════════════════════
describe('login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret';
  });

  // TC-005 : chemin nominal — login réussi
  test('TC-005 | P1 | retourne user + token si credentials valides', async () => {
    const user = makeUser();
    User.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('jwt_token_mock');

    const result = await userService.login('alice@test.com', 'correct_password');

    expect(result).toHaveProperty('token', 'jwt_token_mock');
    expect(result.user).not.toHaveProperty('password');
  });

  // TC-006 : utilisateur introuvable
  test('TC-006 | P2 | lève INVALID_CREDENTIALS si email inconnu', async () => {
    User.findOne.mockResolvedValue(null);
    await expect(userService.login('unknown@test.com', 'pw')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  // TC-007 : mauvais mot de passe
  test('TC-007 | P3 | lève INVALID_CREDENTIALS si mot de passe incorrect', async () => {
    User.findOne.mockResolvedValue(makeUser());
    bcrypt.compare.mockResolvedValue(false);
    await expect(userService.login('alice@test.com', 'wrong_password')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  // TC-008 : compte désactivé
  test('TC-008 | P4 | lève ACCOUNT_DISABLED si compte inactif', async () => {
    User.findOne.mockResolvedValue(makeUser({ isActive: false, toJSON: () => ({ isActive: false }) }));
    await expect(userService.login('alice@test.com', 'correct_password')).rejects.toThrow('ACCOUNT_DISABLED');
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 5 — getBalance
// ═══════════════════════════════════════════════════════════════════════════
describe('getBalance', () => {
  beforeEach(() => vi.clearAllMocks());

  // TC-009 : chemin nominal
  test('TC-009 | P1 | retourne le solde de l\'utilisateur', async () => {
    User.findByPk.mockResolvedValue({ id: 'uuid-001', name: 'Alice', email: 'alice@test.com', balance: '500.00' });
    const result = await userService.getBalance('uuid-001');
    expect(result).toEqual({ userId: 'uuid-001', name: 'Alice', balance: 500 });
  });

  // TC-010 : utilisateur inexistant
  test('TC-010 | P2 | lève USER_NOT_FOUND si l\'id est inconnu', async () => {
    User.findByPk.mockResolvedValue(null);
    await expect(userService.getBalance('non-existent-id')).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-011 : solde à zéro
  test('TC-011 | P3 | retourne 0 pour un compte vide', async () => {
    User.findByPk.mockResolvedValue({ id: 'uuid-002', name: 'Empty', email: 'e@test.com', balance: '0.00' });
    const result = await userService.getBalance('uuid-002');
    expect(result.balance).toBe(0);
  });
});
