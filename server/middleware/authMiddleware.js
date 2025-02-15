const jwt = require('jsonwebtoken');
const secretKey = 'pI9PNjgm3ElXEl3OfrvGEDnZjWy4T0yb2tHFYroMaEI='; 
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
 
  if (!token) return res.sendStatus(401); // Si pas de token, renvoie une erreur 401

  jwt.verify(token, secretKey, (err, user) => {
	if (err) return res.sendStatus(403); // Si le token est invalide, renvoie une erreur 403
    
	// Assurez-vous que l'utilisateur a bien un ID
	if (!user.id) return res.status(400).json({ error: "L'ID de l'utilisateur est manquant dans le token." });

	req.user = user; // Ajoute les informations de l'utilisateur à la requête
	next();
  });
};

module.exports = authenticateToken;

