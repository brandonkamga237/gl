require('dotenv').config();
const app = require('./app');
const { syncDatabase } = require('./models');

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    await syncDatabase();
    console.log('Database synchronized successfully');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Admin panel: http://localhost:${PORT}/admin`);
      console.log(`API docs: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
