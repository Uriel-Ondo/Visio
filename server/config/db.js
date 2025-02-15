const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'admin',
  password: 'admin',
  database: 'visio_db'
});

connection.connect((error) => {
  if (error) {
	console.error('Erreur de connexion à la base de données:', error);
	return;
  }
  console.log('Connecté à la base de données MariaDB.');
});

module.exports = connection;
