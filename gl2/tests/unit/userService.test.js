const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
}));

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const { User } = require('../../src/models');
const userService = require('../../src/services/userService');

const makeUser = (overrides = {}) => {
  const base = {
    id: 'uuid-001',
    name: 'Alice',
    email: 'alice@neobank.test',
    password: 'hashed_pw',
    role: 'client',
    balance: '500.00',
    accountNumber: '1234567890',
    isActive: true,
  };
  return {
    ...base,
    ...overrides,
    toJSON: () => ({ ...base, ...overrides }),
    update: jest.fn().mockResolvedValue(true),
  };
};

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 1 : register (auto-inscription)
// ═══════════════════════════════════════════════════════════════════════════
describe('register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue('hashed_pw');
  });

  // TC-001 : chemin nominal — inscription réussie
  test('TC-001 | P1 | crée un compte client avec les données valides', async () => {
    User.findOne.mockResolvedValue(null);
    const userData = { id: 'uuid-new', name: 'Bob', email: 'bob@neobank.test', password: 'hashed_pw', role: 'client', balance: '0.00', accountNumber: '9876543210', isActive: true };
    User.create.mockResolvedValue({ ...userData, toJSON: () => userData });

    const result = await userService.register({ name: 'Bob', email: 'bob@neobank.test', password: 'secret123' });

    expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'bob@neobank.test' } });
    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', expect.any(Number));
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'client', balance: 0 }));
    expect(result).not.toHaveProperty('password');
  });

  // TC-002 : email déjà utilisé
  test('TC-002 | P2 | lève EMAIL_ALREADY_EXISTS si l\'email est déjà pris', async () => {
    User.findOne.mockResolvedValue(makeUser());

    await expect(
      userService.register({ name: 'Bob', email: 'alice@neobank.test', password: 'secret123' })
    ).rejects.toThrow('EMAIL_ALREADY_EXISTS');

    expect(User.create).not.toHaveBeenCalled();
  });

  // TC-003 : avec numéro de téléphone optionnel
  test('TC-003 | P3 | crée un compte avec téléphone optionnel', async () => {
    User.findOne.mockResolvedValue(null);
    const userData = { id: 'uuid-3', name: 'Carol', email: 'carol@neobank.test', password: 'h', role: 'client', balance: '0.00', phone: '+237600000000', accountNumber: '1111111111', isActive: true };
    User.create.mockResolvedValue({ ...userData, toJSON: () => userData });

    const result = await userService.register({ name: 'Carol', email: 'carol@neobank.test', password: 'pass123', phone: '+237600000000' });

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ phone: '+237600000000' }));
    expect(result).not.toHaveProperty('password');
  });

  // TC-004 : le mot de passe ne doit pas apparaître dans le résultat
  test('TC-004 | P4 | le champ password est absent du résultat', async () => {
    User.findOne.mockResolvedValue(null);
    const userData = { id: 'uuid-4', name: 'Dave', email: 'dave@neobank.test', password: 'hashed_pw', role: 'client', balance: '0.00', accountNumber: '2222222222', isActive: true };
    User.create.mockResolvedValue({ ...userData, toJSON: () => userData });

    const result = await userService.register({ name: 'Dave', email: 'dave@neobank.test', password: 'pass123' });
    expect(result).not.toHaveProperty('password');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 2 : login
// ═══════════════════════════════════════════════════════════════════════════
describe('login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test_secret';
  });

  // TC-005 : chemin nominal — connexion réussie
  test('TC-005 | P1 | retourne user + token JWT si credentials valides', async () => {
    const user = makeUser();
    User.findOne.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('jwt_mock_token');

    const result = await userService.login('alice@neobank.test', 'correct_pw');

    expect(result).toHaveProperty('token', 'jwt_mock_token');
    expect(result.user).not.toHaveProperty('password');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'uuid-001', role: 'client' }),
      expect.any(String),
      expect.any(Object)
    );
  });

  // TC-006 : email inconnu
  test('TC-006 | P2 | lève INVALID_CREDENTIALS si l\'email est inconnu', async () => {
    User.findOne.mockResolvedValue(null);
    await expect(userService.login('ghost@neobank.test', 'pw')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  // TC-007 : mauvais mot de passe
  test('TC-007 | P3 | lève INVALID_CREDENTIALS si le mot de passe est incorrect', async () => {
    User.findOne.mockResolvedValue(makeUser());
    bcrypt.compare.mockResolvedValue(false);
    await expect(userService.login('alice@neobank.test', 'wrong')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  // TC-008 : compte suspendu
  test('TC-008 | P4 | lève ACCOUNT_DISABLED si le compte est suspendu', async () => {
    User.findOne.mockResolvedValue(makeUser({ isActive: false }));
    await expect(userService.login('alice@neobank.test', 'correct_pw')).rejects.toThrow('ACCOUNT_DISABLED');
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  FONCTIONNALITÉ 3 : getProfile
// ═══════════════════════════════════════════════════════════════════════════
describe('getProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  // TC-009 : chemin nominal — profil retourné
  test('TC-009 | P1 | retourne le profil sans mot de passe', async () => {
    User.findByPk.mockResolvedValue({ id: 'uuid-001', name: 'Alice', email: 'alice@neobank.test', balance: '500.00', accountNumber: '1234567890' });

    const result = await userService.getProfile('uuid-001');

    expect(result).toHaveProperty('accountNumber', '1234567890');
    expect(result).not.toHaveProperty('password');
  });

  // TC-010 : utilisateur inexistant
  test('TC-010 | P2 | lève USER_NOT_FOUND si l\'id est inconnu', async () => {
    User.findByPk.mockResolvedValue(null);
    await expect(userService.getProfile('inexistant-id')).rejects.toThrow('USER_NOT_FOUND');
  });

  // TC-011 : solde à zéro
  test('TC-011 | P3 | retourne un solde à 0.00 pour un nouveau compte', async () => {
    User.findByPk.mockResolvedValue({ id: 'uuid-002', name: 'Nouveau', email: 'new@neobank.test', balance: '0.00', accountNumber: '0000000001' });
    const result = await userService.getProfile('uuid-002');
    expect(result.balance).toBe('0.00');
  });
});
