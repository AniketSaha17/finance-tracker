// frontend/login.js
const API_BASE = (
  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') &&
  window.location.port !== '8000'
) ? 'http://127.0.0.1:8000' : window.location.origin;

const form = document.getElementById('loginForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Login failed');
      }

      const data = await res.json();
      const token = data.access_token || data.token;
      if (!token) throw new Error('No token returned from server');

      localStorage.setItem('ft_token', token);
      // go to dashboard
      window.location.href = '/index.html';
    } catch (err) {
      alert('Login error: ' + err.message);
      console.error('Login error', err);
    }
  });
}
