require('dotenv').config();
const app = require('./app');
const { syncDatabase } = require('./models');

const PORT = process.env.PORT || 3001;

syncDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log('NeoBank démarré sur http://localhost:' + PORT);
    });
  })
  .catch((err) => {
    console.error('Erreur démarrage :', err.message);
    process.exit(1);
  });
