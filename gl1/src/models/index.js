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
};

module.exports = { sequelize, User, Transaction, BankAccount, syncDatabase };
