
document.getElementById('registerForm').addEventListener('submit', (event) => {
	event.preventDefault();
 
	const email = document.getElementById('email').value;
	const password = document.getElementById('password').value;
 
	fetch('/api/users/register', {
  	method: 'POST',
  	headers: { 'Content-Type': 'application/json' },
  	body: JSON.stringify({ email, password })
	})
	.then(response => response.json())
	.then(data => {
  	if (data.success) {
    	alert('Inscription réussie !');
    	window.location.href = '/login.html';
  	} else {
    	alert('Erreur : ' + data.message);
  	}
	})
	.catch(error => console.error('Erreur:', error));
  });
 

