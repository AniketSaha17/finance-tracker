// frontend/script.js
// (Requires Chart.js already loaded from your index.html)

// Use local backend if running on localhost, otherwise use current origin
const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:8000'
    : '';


function authHeaders() {
  const token = localStorage.getItem('ft_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': 'Bearer ' + token } : {})
  };
}

// If this page requires login, redirect if not logged in
const token = localStorage.getItem('ft_token');
// If you want the landing page to be public, remove this guard
if (!token && window.location.pathname !== '/login.html' && window.location.pathname !== '/register.html') {
  // user not logged in -> go to login page
  window.location.href = '/login.html';
}

// DOM Elements
const form = document.getElementById('txForm');
const result = document.getElementById('result');
const txTableBody = document.querySelector('#txTable tbody');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const chartCanvas = document.getElementById('incomeExpenseChart')?.getContext?.('2d');
const monthlyCanvas = document.getElementById('monthlyChart')?.getContext?.('2d');
const filter = document.getElementById('filter');
const yearSelect = document.getElementById('yearSelect');

let myPie = null;
let monthlyBarChart = null;

// Utility to download CSV (used by Export)
async function exportCsv() {
  try {
    const res = await fetch(`${API_BASE}/export-csv`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Export failed: ' + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Export error: ' + err.message);
    console.error(err);
  }
}

// Fetch transactions (protected)
async function fetchTransactions() {
  try {
    const res = await fetch(`${API_BASE}/transactions`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401) {
        // token expired/invalid
        alert('Session expired — please login again.');
        localStorage.removeItem('ft_token');
        window.location.href = '/login.html';
        return;
      }
      throw new Error('Failed to fetch transactions: ' + res.status);
    }
    let transactions = await res.json();

    // populate year drop-down from ALL transactions (server returns user's transactions)
    populateYears(transactions);

    // apply filter
    transactions = applyFilter(transactions);

    // clear table
    txTableBody.innerHTML = '';

    let totalIncome = 0;
    let totalExpense = 0;
    const incomePerMonth = Array(12).fill(0);
    const expensePerMonth = Array(12).fill(0);

    transactions.forEach((tx, idx) => {
      // ensure date exists and parse
      const txDate = tx.date ? new Date(tx.date) : new Date();
      const formattedDate = txDate.toLocaleString();

      // displayId per-user (index + 1)
      const displayId = idx + 1;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${displayId}</td>
        <td>${tx.title}</td>
        <td>${Number(tx.amount).toFixed(2)}</td>
        <td>${tx.type}</td>
        <td>${tx.category || ''}</td>
        <td>${formattedDate}</td>
        <td><button class="deleteBtn" data-id="${tx.id}">Delete</button></td>
      `;
      txTableBody.appendChild(row);

      // delete handler
      row.querySelector('.deleteBtn').addEventListener('click', async () => {
        if (!confirm('Delete this transaction?')) return;
        try {
          const del = await fetch(`${API_BASE}/delete-transaction/${tx.id}`, {
            method: 'DELETE',
            headers: authHeaders()
          });
          if (!del.ok) throw new Error('Delete failed');
          await fetchTransactions();
        } catch (err) {
          alert('Delete error: ' + err.message);
        }
      });

      // totals
      if (tx.type === 'income') totalIncome += Number(tx.amount);
      else if (tx.type === 'expense') totalExpense += Number(tx.amount);

      // monthly buckets
      const month = txDate.getMonth();
      if (tx.type === 'income') incomePerMonth[month] += Number(tx.amount);
      else if (tx.type === 'expense') expensePerMonth[month] += Number(tx.amount);
    });

    totalIncomeEl.textContent = totalIncome.toFixed(2);
    totalExpenseEl.textContent = totalExpense.toFixed(2);

    // Pie
    if (myPie) myPie.destroy();
    if (chartCanvas) {
      myPie = new Chart(chartCanvas, {
        type: 'pie',
        data: {
          labels: ['Income','Expense'],
          datasets: [{ data: [totalIncome, totalExpense] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // Monthly bar
    if (monthlyBarChart) monthlyBarChart.destroy();
    if (monthlyCanvas) {
      monthlyBarChart = new Chart(monthlyCanvas, {
        type: 'bar',
        data: {
          labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
          datasets: [
            { label: 'Income', data: incomePerMonth },
            { label: 'Expense', data: expensePerMonth }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
      });
    }

  } catch (err) {
    console.error(err);
    result.innerText = 'Error fetching transactions: ' + err.message;
  }
}

// Populate year dropdown
function populateYears(transactions) {
  const years = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear()))).sort((a,b) => b-a);
  yearSelect.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = 'All';
  yearSelect.appendChild(allOpt);
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  });
  // default select: current year if present
  const nowYear = new Date().getFullYear();
  yearSelect.value = (years.includes(nowYear) ? String(nowYear) : 'all');
  yearSelect.style.display = (filter.value === 'year') ? 'inline-block' : 'none';
}

// Filter function (week, month, year)
function applyFilter(transactions) {
  const now = new Date();
  if (filter.value === 'week') {
    return transactions.filter(tx => (now - new Date(tx.date)) <= 7 * 24*60*60*1000);
  } else if (filter.value === 'month') {
    return transactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (filter.value === 'year') {
    const sel = yearSelect.value;
    if (!sel || sel === 'all') return transactions;
    return transactions.filter(tx => new Date(tx.date).getFullYear() === Number(sel));
  }
  return transactions;
}

// Form submit (add tx)
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('title').value,
      amount: parseFloat(document.getElementById('amount').value),
      type: document.getElementById('type').value,
      category: document.getElementById('category').value || null
    };
    try {
      // POST to protected endpoint /tx/add (fall back to legacy /add-transaction if needed)
      const endpoints = ['/tx/add','/add-transaction'];
      let ok = false, data;
      for (const ep of endpoints) {
        const res = await fetch(API_BASE + ep, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) { data = await res.json(); ok = true; break; }
        if (res.status === 404) continue;
        const txt = await res.text();
        throw new Error(txt || ('Request failed: ' + res.status));
      }
      if (!ok) throw new Error('No transaction endpoint found (404)');
      // refresh
      await fetchTransactions();
      form.reset();
    } catch (err) {
      alert('Add transaction error: ' + err.message);
    }
  });
}

// logout button (if exists)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('ft_token');
    window.location.href = '/login.html';
  });
}

// filters
if (filter) filter.addEventListener('change', fetchTransactions);
if (yearSelect) yearSelect.addEventListener('change', fetchTransactions);

// Export CSV (if you have a button with id exportBtn)
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) exportBtn.addEventListener('click', exportCsv);

// initial load
if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
  fetchTransactions();
}
