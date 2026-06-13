const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BANK_MASTER_ID = 'BANK-MASTER-001';

const BankAccount = sequelize.define('BankAccount', {
  id: {
    type: DataTypes.STRING(50),
    primaryKey: true,
  },
  balance: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 50000000.00,
    allowNull: false,
  },
  totalFeesCollected: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 0,
  },
  totalDeposited: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 0,
  },
  totalWithdrawn: {
    type: DataTypes.DECIMAL(20, 2),
    defaultValue: 0,
  },
}, {
  tableName: 'bank_accounts',
  timestamps: true,
});

module.exports = { BankAccount, BANK_MASTER_ID };
