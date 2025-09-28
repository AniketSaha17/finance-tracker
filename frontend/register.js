// frontend/register.js
const API_BASE = (
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') &&
  window.location.port !== '8000'
) ? 'http://127.0.0.1:8000' : window.location.origin;

const regForm = document.getElementById('registerForm');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Registration failed');
      }

      alert('Registration successful — please login.');
      window.location.href = '/login.html';
    } catch (err) {
      alert('Register error: ' + err.message);
      console.error('Register error', err);
    }
  });
}
