const sequelize = require('../config/database');
const User = require('./User');
const Transaction = require('./Transaction');

User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const syncDatabase = async () => {
  await sequelize.sync({ alter: true });
};

module.exports = { sequelize, User, Transaction, syncDatabase };
