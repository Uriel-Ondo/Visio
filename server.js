express = require('express');
const https = require('https'); // Remplacer http par https
const fs = require('fs');
const socketIo = require('socket.io');
const { ExpressPeerServer } = require('peer');
const path = require('path');
const cors = require('cors');

// Charger les certificats SSL
const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app); // Utiliser HTTPS ici
const io = socketIo(server);
const creators = {}; // Stocker le créateur de chaque salle

// Configuration des CORS
app.use(cors({
  origin: 'https://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true
}));

// Importation des routes
const conferenceRoutes = require('./server/routes/conferenceRoutes');
const userRoutes = require('./server/routes/userRoutes');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use('/api/conferences', conferenceRoutes);
app.use('/api/users', userRoutes);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Route par défaut
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Configuration de PeerJS
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});
app.use('/peerjs', peerServer);

// Gestion des connexions Socket.IO
const participants = {}; // Dictionnaire pour stocker les participants par salle

io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté.');

  socket.on('join-room', (roomCode, userEmail) => {
    // Stocker le roomCode et l'email de l'utilisateur dans l'objet socket
    socket.roomCode = roomCode;  
    socket.userEmail = userEmail;

    // Ajouter l'utilisateur à la liste des participants de la salle
    if (!participants[roomCode]) {
      participants[roomCode] = [];
    }
    participants[roomCode].push(userEmail);
    socket.join(roomCode);

    console.log(`Utilisateur (${userEmail}) s'est connecté à la salle ${roomCode}.`);
    
    // Notifier tous les utilisateurs de la salle que quelqu'un est connecté
    io.to(roomCode).emit('user-connected', userEmail);

    // Envoyer la liste mise à jour des participants à tous les utilisateurs de la salle
    io.to(roomCode).emit('participants-update', participants[roomCode]);
  });

  socket.on('chat message', (msg) => {
    const roomCode = socket.roomCode; // Récupérer le roomCode stocké dans le socket
    if (roomCode) {
      console.log(`Message reçu dans la salle ${roomCode}: ${msg}`);
      io.to(roomCode).emit('chat message', msg);
    } else {
      console.log('Erreur: roomCode non défini');
    }
  });
  

  socket.on('disconnect', () => {
    const roomCode = socket.roomCode; // Récupérer le roomCode stocké dans le socket
    const userEmail = socket.userEmail; // Récupérer l'email de l'utilisateur stocké dans le socket
    if (roomCode) {
      console.log(`Utilisateur (${userEmail}) s'est déconnecté de la salle ${roomCode}.`);

      // Retirer l'utilisateur de la liste des participants de la salle
      if (participants[roomCode]) {
        participants[roomCode] = participants[roomCode].filter(email => email !== userEmail);
        
        // Notifier les autres utilisateurs de la salle de la déconnexion
        io.to(roomCode).emit('participants-update', participants[roomCode]);
        io.to(roomCode).emit('user-disconnected', userEmail);
      }
    }
  });
});



// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur HTTPS démarré sur le port ${PORT}`);
});
