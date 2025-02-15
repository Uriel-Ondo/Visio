document.getElementById('loginForm').addEventListener('submit', (event) => {
	event.preventDefault();
 
	const email = document.getElementById('email').value;
	const password = document.getElementById('password').value;
 
	fetch('/api/users/login', {
  	method: 'POST',
  	headers: { 'Content-Type': 'application/json' },
  	body: JSON.stringify({ email, password })
	})
	.then(response => response.json())
	.then(data => {
  	if (data.token) {
    	console.log('Token received:', data.token); // Vérifiez que le token est reçu
    	localStorage.setItem('token', data.token);
    	window.location.href = '/';
  	} else {
    	alert('Erreur : ' + data.message);
  	}
	})
	.catch(error => console.error('Erreur:', error));
  });
