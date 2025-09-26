// script.js (frontend)
const token = localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

// elements
const form = document.getElementById('txForm');
const result = document.getElementById('result');
const txTableBody = document.querySelector('#txTable tbody');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const chartCanvas = document.getElementById('incomeExpenseChart').getContext('2d');
const monthlyCanvas = document.getElementById('monthlyChart').getContext('2d');
const filter = document.getElementById('filter');
const yearSelect = document.getElementById('yearSelect');
const logoutBtn = document.getElementById('logoutBtn');
const exportBtn = document.getElementById('exportBtn');

function parseDateSafe(s){ try{ return new Date(s); }catch{ return new Date(); } }
document.getElementById('incomeExpenseChart').style.width = '360px';
document.getElementById('incomeExpenseChart').style.height = '260px';
document.getElementById('monthlyChart').style.width = '520px';
document.getElementById('monthlyChart').style.height = '260px';

async function fetchTransactions(){
  try{
    const res = await fetch('http://127.0.0.1:8000/transactions', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 401) { alert('Session expired. Please login again.'); logout(); return; }
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const allTransactions = await res.json();
    populateYears(allTransactions);
    const transactions = applyFilter(allTransactions);
    txTableBody.innerHTML = '';
    let totalIncome = 0, totalExpense = 0;
    const incomePerMonth = Array(12).fill(0), expensePerMonth = Array(12).fill(0);
    transactions.forEach(tx => {
      const txDate = parseDateSafe(tx.date);
      const formatted = txDate.toLocaleString();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${tx.id}</td>
        <td>${tx.title}</td>
        <td>${Number(tx.amount).toFixed(2)}</td>
        <td>${tx.type}</td>
        <td>${tx.category || ''}</td>
        <td>${formatted}</td>
        <td><button class="deleteBtn" data-id="${tx.id}">Delete</button></td>
      `;
      txTableBody.appendChild(row);
      row.querySelector('.deleteBtn').addEventListener('click', async () => {
        if (!confirm('Delete this transaction?')) return;
        await fetch(`http://127.0.0.1:8000/delete-transaction/${tx.id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
        await fetchTransactions();
      });
      if (tx.type === 'income') totalIncome += Number(tx.amount);
      else if (tx.type === 'expense') totalExpense += Number(tx.amount);
      const m = txDate.getMonth();
      if (tx.type === 'income') incomePerMonth[m] += Number(tx.amount);
      else if (tx.type === 'expense') expensePerMonth[m] += Number(tx.amount);
    });
    totalIncomeEl.textContent = totalIncome.toFixed(2);
    totalExpenseEl.textContent = totalExpense.toFixed(2);
    renderPieChart(totalIncome, totalExpense);
    renderMonthlyBar(incomePerMonth, expensePerMonth);
  } catch (err) {
    console.error(err);
    result.innerText = 'Error: ' + (err.message || err);
    txTableBody.innerHTML = '<tr><td colspan="7">Could not load transactions</td></tr>';
    totalIncomeEl.textContent = '0.00'; totalExpenseEl.textContent = '0.00';
    renderPieChart(0,0); renderMonthlyBar(Array(12).fill(0), Array(12).fill(0));
  }
}

function populateYears(transactions){
  const years = new Set(transactions.map(t => parseDateSafe(t.date).getFullYear()));
  years.add(new Date().getFullYear());
  const arr = Array.from(years).sort((a,b) => b-a);
  yearSelect.innerHTML = '<option value="all">All</option>';
  arr.forEach(y => { const o = document.createElement('option'); o.value = String(y); o.textContent = String(y); yearSelect.appendChild(o); });
  yearSelect.style.display = (filter.value === 'year') ? 'inline-block' : 'none';
  yearSelect.value = String(new Date().getFullYear());
}

function applyFilter(transactions){
  const now = new Date(); let list = transactions.slice();
  if (filter.value === 'week') list = list.filter(tx => (now - parseDateSafe(tx.date)) <= 7*24*60*60*1000);
  else if (filter.value === 'month') list = list.filter(tx => { const d = parseDateSafe(tx.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  else if (filter.value === 'year') {
    const sel = yearSelect.value; if (!sel || sel === 'all') return list;
    const y = parseInt(sel,10); list = list.filter(tx => parseDateSafe(tx.date).getFullYear() === y);
  }
  return list;
}

function renderPieChart(inc, exp){
  const a = inc || 0.0001, b = exp || 0.00009;
  if (window.myChart) window.myChart.destroy();
  window.myChart = new Chart(chartCanvas, { type:'pie', data:{ labels:['Income','Expense'], datasets:[{ data:[a,b], backgroundColor:['#4caf50','#f44336'] }] }, options:{ responsive:false, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }});
}

function renderMonthlyBar(incArr, expArr){
  if (window.monthlyBarChart) window.monthlyBarChart.destroy();
  window.monthlyBarChart = new Chart(monthlyCanvas, { type:'bar', data:{ labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], datasets:[{ label:'Income', data:incArr, backgroundColor:'#4caf50' },{ label:'Expense', data:expArr, backgroundColor:'#f44336' }] }, options:{ responsive:false, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } }, plugins:{ legend:{ position:'bottom' } } }});
}

// event listeners
filter.addEventListener('change', ()=>{ yearSelect.style.display = (filter.value === 'year') ? 'inline-block' : 'none'; fetchTransactions(); });
yearSelect.addEventListener('change', fetchTransactions);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    amount: parseFloat(document.getElementById('amount').value),
    type: document.getElementById('type').value,
    category: document.getElementById('category').value || null
  };
  try {
    const res = await fetch('http://127.0.0.1:8000/tx/add', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + token }, body: JSON.stringify(payload) });
    if (res.status === 401) { alert('Session expired. Please login again.'); logout(); return; }
    if (!res.ok) throw new Error('Add failed');
    form.reset(); await fetchTransactions();
  } catch (err) {
    result.innerText = 'Error: ' + (err.message||err);
  }
});

// logout
function logout(){ localStorage.removeItem('token'); window.location.href = 'login.html'; }
logoutBtn.addEventListener('click', logout);

// export csv
exportBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('http://127.0.0.1:8000/export-csv', { headers:{ 'Authorization':'Bearer ' + token } });
    if (res.status === 401) { alert('Session expired. Please login again.'); logout(); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (err) { alert('Export failed: ' + err.message); }
});

// initial load
fetchTransactions();
