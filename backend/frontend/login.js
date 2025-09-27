// login.js
document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('msg');
  msg.textContent = '';

  if (!username || !password) { msg.textContent = 'Enter username & password'; msg.style.color='red'; return; }

  try {
    const res = await fetch('http://127.0.0.1:8000/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.detail || 'Login failed';
      msg.style.color = 'red';
      return;
    }
    localStorage.setItem('token', data.access_token);
    window.location.href = 'index.html';
  } catch (err) {
    msg.textContent = 'Network error: ' + err.message;
    msg.style.color = 'red';
  }
});
