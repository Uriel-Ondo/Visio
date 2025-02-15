// Fonction pour obtenir le token depuis le stockage local
const getToken = () => localStorage.getItem('token');

// Vérification de l'authentification
const checkAuth = () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
  } else {
    fetch('/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(user => {
      const welcomeMessageElement = document.getElementById('welcomeMessage');
      if (welcomeMessageElement) {
        welcomeMessageElement.textContent = `Bienvenue ${user.email}`;
      } else {
        console.error('Élément welcomeMessage non trouvé');
      }
    })
    .catch(error => {
      console.error('Erreur lors de la récupération des informations utilisateur:', error);
    });
  }
};

// Appeler la fonction checkAuth au chargement de la page
window.onload = checkAuth;

// Création d'une salle
const createRoomForm = document.getElementById('createRoomForm');
if (createRoomForm) {
  createRoomForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const roomName = document.getElementById('roomName').value;

    fetch('/api/conferences/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ roomName })
    })
      .then(response => response.json())
      .then(data => {
        window.location.href = `/conference.html?roomCode=${data.roomCode}`;
      })
      .catch(error => console.error('Erreur:', error));
  });
}

// Rejoindre une salle
const joinRoomForm = document.getElementById('joinRoomForm');
if (joinRoomForm) {
  joinRoomForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const roomCode = document.getElementById('roomCode').value;

    fetch(`/api/conferences/join/${roomCode}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    })
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Salle non trouvée.');
        }
      })
      .then(data => {
        window.location.href = `/conference.html?roomCode=${data.room.room_code}`;
      })
      .catch(error => {
        console.error('Erreur:', error);
        alert('Salle non trouvée. Veuillez vérifier le code.');
      });
  });
}

// Fonction pour gérer la déconnexion de la page index vers login
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    // Afficher une boîte de dialogue de confirmation
    const confirmLogout = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
    if (confirmLogout) {
      // Supprimer le token d'authentification du stockage local
      localStorage.removeItem('token');
      
      // Rediriger vers la page de connexion
      window.location.href = '/login.html';
    }
  });
}

// Gestion de la conférence
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('roomCode');

if (roomCode) {
  const videoGrid = document.getElementById('video-grid');
  const myVideo = document.createElement('video');
  myVideo.muted = true;  // L'audio de sa propre vidéo est souvent muet pour éviter l'écho

  const peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: 3000, // Port HTTPS
    secure: true, // Pour HTTPS
    config: {
      iceServers: [
          // Serveur STUN public gratuit 

        { url: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }    
           
      ]
    }


  });

  const socket = io(); // Assurez-vous que Socket.IO est initialisé
  const peers = {};
  let myVideoStream;
  let screenStream;

  // Accès à la caméra et au micro
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  }).then((stream) => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    // Gestion du microphone
    const muteButton = document.getElementById('muteButton');
    let audioEnabled = true;
    
    muteButton.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      myVideoStream.getAudioTracks()[0].enabled = audioEnabled;
      const icon = muteButton.querySelector('i');
      if (audioEnabled) {
        icon.classList.remove('fa-microphone-slash');
        icon.classList.add('fa-microphone');
      } else {
        icon.classList.remove('fa-microphone');
        icon.classList.add('fa-microphone-slash');
      }
    });

    // Gestion de la caméra
    const videoButton = document.getElementById('videoButton');
    let videoEnabled = true;

    videoButton.addEventListener('click', () => {
      videoEnabled = !videoEnabled;
      myVideoStream.getVideoTracks()[0].enabled = videoEnabled;
      const icon = videoButton.querySelector('i');
      if (videoEnabled) {
        icon.classList.remove('fa-video-slash');
        icon.classList.add('fa-video');
      } else {
        icon.classList.remove('fa-video');
        icon.classList.add('fa-video-slash');
      }
    });

    // Implementation du partage d'écran
    const shareScreenButton = document.getElementById('shareScreen');
    shareScreenButton.addEventListener('click', async () => {
      try {
        // Demander l'accès au partage d'écran
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always"
          },
          audio: true
        });

        // Créer un élément vidéo pour afficher le partage d'écran
        const screenVideo = document.createElement('video');
        screenVideo.srcObject = screenStream;
        
        screenVideo.addEventListener('loadedmetadata', () => {
          screenVideo.play();
        });

        screenVideo.classList.add('shared-screen');

        // Effacer la grille des vidéos et ajouter la vidéo de partage d'écran
        videoGrid.innerHTML = ''; 
        videoGrid.append(screenVideo);

        // Remplacer la piste vidéo pour chaque utilisateur connecté
        for (let userEmail in peers) {
          const call = peers[userEmail];
          if (call && call.peerConnection) { // Vérifie si call et peerConnection existent
            const sender = call.peerConnection.getSenders()
              .find(sender => sender.track.kind === 'video');
            if (sender) { // Vérifie si un sender vidéo est trouvé
              sender.replaceTrack(screenStream.getVideoTracks()[0]);
            }
          }
        }

        // Gérer la fin du partage d'écran
        screenStream.getVideoTracks()[0].onended = () => {
          const originalVideoTrack = myVideoStream.getVideoTracks()[0];
          for (let userEmail in peers) {
            const call = peers[userEmail];
            if (call && call.peerConnection) { // Vérifie si call et peerConnection existent
              const sender = call.peerConnection.getSenders()
                .find(sender => sender.track.kind === 'video');
              if (sender) { // Vérifie si un sender vidéo est trouvé
                sender.replaceTrack(originalVideoTrack);
              }
            }
          }

          // Effacer la grille des vidéos et réafficher la vidéo de la caméra
          videoGrid.innerHTML = '';
          addVideoStream(myVideo, myVideoStream);
        };
        
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          alert("Le partage d'écran a été refusé. Veuillez accorder la permission pour continuer.");
        } else {
          console.error('Erreur lors du partage d\'écran:', error);
        }
      }
    });

  });

// Sélectionner le bouton d'invitation
const inviteButton = document.getElementById('inviteParticipant');

// Fonction pour obtenir l'adresse IP locale
function getLocalIP(callback) {
  const pc = new RTCPeerConnection({iceServers: []});
  pc.createDataChannel('');
  pc.createOffer().then(sdp => pc.setLocalDescription(sdp));
  pc.onicecandidate = (ice) => {
    if (ice && ice.candidate && ice.candidate.candidate) {
      const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
      const ipMatch = ice.candidate.candidate.match(ipRegex);
      if (ipMatch) {
        callback(ipMatch[1]);
        pc.close();
      }
    }
  };
}

// Ajouter un écouteur d'événements au bouton
inviteButton.addEventListener('click', () => {
  getLocalIP((ipAddress) => {
    const inviteLink = `https://${ipAddress}:3000/conference.html?roomCode=${roomCode}`;

    // Copier le lien dans le presse-papier
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        alert('Lien d\'invitation copié dans le presse-papier : ' + inviteLink);
      })
      .catch(err => {
        console.error('Erreur lors de la copie du lien : ', err);
      });
  });
});



  peer.on('open', (id) => {
    socket.emit('join-room', roomCode, id);
  });

  socket.on('user-connected', userEmail => {
    connectToNewUser(userEmail, myVideoStream);
  });

  socket.on('user-disconnected', (userEmail) => {
    if (peers[userEmail]) peers[userEmail].close();
  });

  // Connexion à d'autres utilisateurs
  peer.on('call', (call) => {
    console.log("Receiving a call from: ", call.peer);
    call.answer(myVideoStream); // Répondre à l'appel avec le flux vidéo local
  
    const video = document.createElement('video');
  
    // Lorsque le flux vidéo de l'appelant est reçu
    call.on('stream', (userVideoStream) => {
        console.log("Receiving video stream from: ", call.peer);
        addVideoStream(video, userVideoStream); // Ajouter le flux vidéo du nouvel utilisateur
    });
  
    call.on('close', () => {
        console.log("Call closed with: ", call.peer);
        video.remove(); // Supprimer la vidéo si l'appel est fermé
    });
  
    peers[call.peer] = call; // Stocker l'appel dans le tableau 'peers'
  });

  function connectToNewUser(userEmail, stream) {
    const call = peer.call(userEmail, stream); // Appeler l'utilisateur avec l'email
    const video = document.createElement('video');

    // Lorsque le flux vidéo de l'utilisateur appelé est reçu
    call.on('stream', (userVideoStream) => {
        console.log("Receiving video stream from user: ", userEmail);
        addVideoStream(video, userVideoStream); // Ajouter le flux vidéo à l'écran
    });

    call.on('close', () => {
        video.remove(); // Supprimer la vidéo si l'appel est terminé
    });

    peers[userEmail] = call; // Enregistrer l'appel dans le tableau des pairs
  }

  function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
      video.play();
    });
    video.classList.add('participant-video');
    videoGrid.append(video);
  }

  // Implementation de la liste des participants
  socket.on('participants-update', (participants) => {
    console.log('Participants reçus:', participants);
    const participantList = document.querySelector('.list-group');
    participantList.innerHTML = '';

    participants.forEach(userEmail => {
      // Filtrer les UUIDs s'ils apparaissent encore
      if (!userEmail || /^[0-9a-fA-F-]{36}$/.test(userEmail)) {
        console.warn('Nom d\'utilisateur ignoré:', userEmail);
        return;
      }

      const listItem = document.createElement('li');
      listItem.className = 'list-group-item'; // Utilisez 'list-group-item' pour les éléments de liste Bootstrap
      listItem.textContent = userEmail;
      participantList.appendChild(listItem);
      
    });
  });

  // Sélectionner le bouton "Terminer l'appel"
  const endCallButton = document.getElementById('endCallButton');

  // Ajouter un écouteur d'événements pour terminer l'appel
  endCallButton.addEventListener('click', () => {
    // Fermer les connexions PeerJS et Socket.IO
    peer.destroy();
    socket.disconnect();

    // Arrêter les flux de la caméra et du micro
    if (myVideoStream) {
      myVideoStream.getTracks().forEach(track => track.stop());
    }

    // Rediriger vers la page d'accueil après avoir terminé l'appel
    window.location.href = '/index.html';
  });

  // Ajout de l'événement au bouton
  const fullScreenButton = document.getElementById('toggleFullScreen');
  fullScreenButton.addEventListener('click', toggleFullScreen);
}

// Définir userEmail globalement
let userEmail;

// Appel des informations concernant nos adresses email via une API
const fetchUserEmail = async () => {
  try {
    const response = await fetch('/api/users/me', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération de l\'email utilisateur');
    }
    const data = await response.json();
    return data.email;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'email utilisateur:', error);
    return null;
  }
};

const init = async () => {
  const userEmail = await fetchUserEmail();
  const roomCode = ''; // Exemple de roomCode

  if (userEmail) {
    socket.emit('join-room', roomCode, userEmail);
  } else {
    console.error('Impossible de récupérer l\'email utilisateur.');
  }
};

init();

// Implementation du chat
const initChat = async () => {
  try {
    const userEmail = await fetchUserEmail();
    
    const socket = io();
    
    if (userEmail) {
      socket.emit('join-room', roomCode, userEmail);
    } else {
      console.error('Impossible de récupérer l\'email utilisateur.');
    }
    
    document.getElementById('chat-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      if (input.value.trim() !== '') {
        socket.emit('chat message', { email: userEmail, message: input.value });
        input.value = '';
      }
    });
    
    socket.on('chat message', function(data) {
      const chatBox = document.getElementById('chat-box');
      const messageElement = document.createElement('div');
      messageElement.textContent = `${data.email}: ${data.message}`;
      chatBox.appendChild(messageElement);
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du chat:', error);
  }
};

initChat(); // Appel de la fonction asynchrone

