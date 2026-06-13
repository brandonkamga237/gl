const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const User = require('./User');
const Transaction = require('./Transaction');
const { BankAccount, BANK_MASTER_ID } = require('./BankAccount');

User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const syncDatabase = async () => {
  await sequelize.sync({ alter: true });

  // Initialize bank master account if not present
  const bank = await BankAccount.findByPk(BANK_MASTER_ID);
  if (!bank) {
    await BankAccount.create({
      id: BANK_MASTER_ID,
      balance: 50000000.00,
      totalFeesCollected: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
    });
  }

  // Seed default admin if not present
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@banking.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const existing = await User.findOne({ where: { email: adminEmail } });
  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await User.create({
      name: 'Administrateur',
      email: adminEmail,
      password: hashed,
      role: 'admin',
      balance: 0,
      isActive: true,
    });
    console.log(`Admin créé : ${adminEmail} / ${adminPassword}`);
  }
};

module.exports = { sequelize, User, Transaction, BankAccount, syncDatabase };
