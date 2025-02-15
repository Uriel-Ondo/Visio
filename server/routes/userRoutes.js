const express = require('express');
const router = express.Router();
const connection = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const secretKey = 'pI9PNjgm3ElXEl3OfrvGEDnZjWy4T0yb2tHFYroMaEI='; // Remplacez par votre clé secrète pour JWT
const authenticateToken = require('../middleware/authMiddleware');


// Inscription
router.post('/register', (req, res) => {
	const { email, password } = req.body;
	const hashedPassword = bcrypt.hashSync(password, 10);
  
	const query = 'INSERT INTO utilisateurs (email, password, role) VALUES (?, ?, ?)';
	connection.query(query, [email, hashedPassword, 'standard'], (error, results) => {
	  if (error) {
		console.error('Erreur lors de l\'inscription:', error);
		return res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription.' });
	  }
	  res.json({ success: true });
	});
  });
  

// Connexion
router.post('/login', (req, res) => {
	const { email, password } = req.body;
  
	const query = 'SELECT * FROM utilisateurs WHERE email = ?';
	connection.query(query, [email], (error, results) => {
	  if (error) {
		console.error('Erreur lors de la connexion:', error);
		return res.status(500).json({ success: false, message: 'Erreur lors de la connexion.' });
	  }
	  if (results.length === 0) {
		return res.status(401).json({ success: false, message: 'Identifiant ou mot de passe incorrect.' });
	  }
  
	  const user = results[0];
	  const isPasswordValid = bcrypt.compareSync(password, user.password);
  
	  if (!isPasswordValid) {
		return res.status(401).json({ success: false, message: 'Identifiant ou mot de passe incorrect.' });
	  }
  
	  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secretKey, { expiresIn: '1h' });
	  res.json({ token });
	});
  });
  
// Route pour obtenir les détails de l'utilisateur
router.get('/me', authenticateToken, (req, res) => {
	// Retourner les détails de l'utilisateur
	res.json(req.user);
  });
  
module.exports = router;
  