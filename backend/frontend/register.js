// register.js
document.getElementById('registerBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('msg');
  msg.textContent = '';

  if (!username || !password) { msg.textContent = 'Enter username & password'; msg.style.color='red'; return; }

  try {
    const res = await fetch('http://127.0.0.1:8000/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.detail || 'Registration failed';
      msg.style.color = 'red';
      return;
    }
    msg.textContent = 'Registered. Redirecting to login...';
    msg.style.color = 'green';
    setTimeout(()=> location.href = 'login.html', 1200);
  } catch (err) {
    msg.textContent = 'Network error: ' + err.message;
    msg.style.color = 'red';
  }
});
