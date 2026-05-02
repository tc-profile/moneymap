/**
 * Main application controller — wires up navigation, forms, import/export, and rendering.
 * Called by Auth.showApp() after successful Google sign-in.
 */
let _appInitialized = false;
function AppInit() {
  if (_appInitialized) return;
  _appInitialized = true;
  _initApp();
}

function _initApp() {
  'use strict';

  // ─── Navigation ───
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      refresh();
    });
  });

  // ─── Refresh everything ───
  function refresh() {
    const txns = Store.getTransactions();
    const total = txns.reduce((s, t) => s + t.amount, 0);
    console.log(`[Dashboard] Rendering ${txns.length} transactions, total ₹${total.toLocaleString('en-IN')}`);
    renderDashboard(txns);
    renderIncomeReport();
    renderExpenseReport();
    renderTransactions(txns);
    renderBudget();
    populateCategoryDropdowns();
  }

  // ─── Dashboard ───
  function _getDashboardFY() {
    const sel = document.getElementById('dashboard-fy-select');
    return parseInt(sel.value);
  }

  function _filterTxnsByFY(txns, fyStart) {
    if (isNaN(fyStart)) return txns;
    const startMonth = `${fyStart}-04`;
    const endMonth   = `${fyStart + 1}-03`;
    return txns.filter(t => {
      const m = t.date.slice(0, 7);
      return m >= startMonth && m <= endMonth;
    });
  }

  function renderDashboard(allTxns) {
    _populateFYDropdown('dashboard-fy-select');
    const fyStart = _getDashboardFY();
    const txns = _filterTxnsByFY(allTxns, fyStart);

    const total = txns.reduce((s, t) => s + t.amount, 0);

    document.getElementById('total-spend').textContent = formatCurrency(total);
    document.getElementById('total-txn-count').textContent = txns.length + ' transactions';

    const catTotals = {};
    txns.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
    const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCatId) {
      const cat = getCategoryById(topCatId[0]);
      document.getElementById('top-category').textContent = cat.icon + ' ' + cat.name;
      document.getElementById('top-category-pct').textContent =
        total > 0 ? Math.round(topCatId[1] / total * 100) + '%' : '';
    } else {
      document.getElementById('top-category').textContent = '—';
      document.getElementById('top-category-pct').textContent = '';
    }

    Charts.renderIncomeVsExpense('chart-income-expense', txns, fyStart);

    // Group transactions by month, sorted newest first
    const byMonth = {};
    txns.forEach(t => {
      const key = t.date.slice(0, 7);
      (byMonth[key] = byMonth[key] || []).push(t);
    });
    const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

    const container = document.getElementById('top3-by-month');
    container.innerHTML = '';
    months.forEach(month => {
      const top3 = byMonth[month].sort((a, b) => b.amount - a.amount).slice(0, 3);
      const label = new Date(month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      let rows = '';
      top3.forEach((t, i) => {
        const cat = getCategoryById(t.category);
        rows += `
          <tr>
            <td>${i + 1}</td>
            <td>${formatDate(t.date)}</td>
            <td>${escapeHtml(t.description)}</td>
            <td><span class="category-badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
            <td class="align-right">${formatCurrency(t.amount)}</td>
          </tr>`;
      });

      container.innerHTML += `
        <div class="top3-month-block">
          <h4>${label}</h4>
          <table class="txn-table">
            <thead>
              <tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th class="align-right">Amount</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    });
  }

  document.getElementById('dashboard-fy-select').addEventListener('change', () => refresh());

  // ─── Transactions ───
  function renderTransactions(txns) {
    const search = document.getElementById('txn-search').value.toLowerCase();
    const filterCat = document.getElementById('txn-filter-category').value;
    const filterMonth = document.getElementById('txn-filter-month').value;

    let filtered = txns;
    if (search) filtered = filtered.filter(t => t.description.toLowerCase().includes(search));
    if (filterCat) filtered = filtered.filter(t => t.category === filterCat);
    if (filterMonth) filtered = filtered.filter(t => t.date.startsWith(filterMonth));

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    const tbody = document.querySelector('#all-txn-table tbody');
    tbody.innerHTML = '';
    filtered.forEach((t, idx) => {
      const cat = getCategoryById(t.category);
      tbody.innerHTML += `
        <tr>
          <td>${idx + 1}</td>
          <td>${formatDate(t.date)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td><span class="category-badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
          <td class="align-right">${formatCurrency(t.amount)}</td>
          <td>
            <button class="btn-icon" title="Edit" onclick="App.editTxn('${t.id}')">✏️</button>
            <button class="btn-icon" title="Delete" onclick="App.deleteTxn('${t.id}')">🗑️</button>
          </td>
        </tr>`;
    });

    const totalAmt = filtered.reduce((s, t) => s + t.amount, 0);
    document.getElementById('txn-total-amount').innerHTML =
      `<strong>${formatCurrency(totalAmt)}</strong>`;
  }

  document.getElementById('txn-search').addEventListener('input', () => renderTransactions(Store.getTransactions()));
  document.getElementById('txn-filter-category').addEventListener('change', () => renderTransactions(Store.getTransactions()));
  document.getElementById('txn-filter-month').addEventListener('input', () => renderTransactions(Store.getTransactions()));

  // ─── Transaction Modal ───
  const modal = document.getElementById('txn-modal');
  const form = document.getElementById('txn-form');

  document.getElementById('btn-add-txn').addEventListener('click', () => {
    form.reset();
    document.getElementById('txn-edit-id').value = '';
    document.getElementById('modal-title').textContent = 'Add Transaction';
    document.getElementById('txn-date').value = new Date().toISOString().slice(0, 10);
    modal.classList.add('open');
  });

  document.getElementById('btn-cancel-txn').addEventListener('click', () => {
    modal.classList.remove('open');
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const editId = document.getElementById('txn-edit-id').value;
    const data = {
      date: document.getElementById('txn-date').value,
      description: document.getElementById('txn-desc').value.trim(),
      amount: parseFloat(document.getElementById('txn-amount').value),
      category: document.getElementById('txn-category').value
    };

    if (editId) {
      Store.updateTransaction(editId, data);
    } else {
      Store.addTransaction(data);
    }

    modal.classList.remove('open');
    refresh();
  });

  window.App = {
    editTxn(id) {
      const txn = Store.getTransactions().find(t => t.id === id);
      if (!txn) return;
      document.getElementById('txn-edit-id').value = txn.id;
      document.getElementById('txn-date').value = txn.date;
      document.getElementById('txn-desc').value = txn.description;
      document.getElementById('txn-amount').value = txn.amount;
      document.getElementById('txn-category').value = txn.category;
      document.getElementById('modal-title').textContent = 'Edit Transaction';
      modal.classList.add('open');
    },
    deleteTxn(id) {
      if (confirm('Delete this transaction?')) {
        Store.deleteTransaction(id);
        refresh();
      }
    }
  };

  // ─── Category Dropdowns ───
  function populateCategoryDropdowns() {
    ['txn-category', 'txn-filter-category'].forEach(selId => {
      const sel = document.getElementById(selId);
      const current = sel.value;
      const firstOpt = sel.querySelector('option');
      sel.innerHTML = '';
      sel.appendChild(firstOpt);
      CATEGORIES.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.icon + ' ' + c.name;
        sel.appendChild(opt);
      });
      sel.value = current;
    });
  }

  // ─── Budget Planner ───
  function _getSelectedBudgetMonth() {
    const el = document.getElementById('budget-month-select');
    if (el.value) return el.value;
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    el.value = key;
    return key;
  }

  function renderBudget() {
    const month = _getSelectedBudgetMonth();
    const budget = Store.getBudgetForMonth(month);
    const allocations = Store.getAllocationsForMonth(month);
    document.getElementById('budget-total-input').value = budget || '';

    const txns = Store.getTransactions().filter(t => t.date.startsWith(month));
    const actualByCategory = {};
    txns.forEach(t => { actualByCategory[t.category] = (actualByCategory[t.category] || 0) + t.amount; });

    const grid = document.getElementById('budget-grid');
    grid.innerHTML = '';
    let totalSpent = 0;
    let totalPlanned = 0;

    CATEGORIES.forEach(cat => {
      const alloc = allocations[cat.id] || 0;
      const actual = actualByCategory[cat.id] || 0;
      if (alloc === 0 && actual === 0) return;

      totalSpent += actual;
      totalPlanned += alloc;

      const pct = alloc > 0 ? Math.min((actual / alloc) * 100, 100) : (actual > 0 ? 100 : 0);
      const isOver = alloc > 0 && actual > alloc;

      let statusText;
      if (alloc > 0) {
        statusText = isOver
          ? 'Over by ' + formatCurrency(actual - alloc)
          : formatCurrency(alloc - actual) + ' left';
      } else {
        statusText = 'No budget set';
      }

      grid.innerHTML += `
        <div class="budget-card">
          <div class="budget-card-header">
            <span>${cat.icon} ${cat.name}</span>
            <input type="number" value="${alloc || ''}" min="0" step="100"
                   placeholder="₹0" data-cat="${cat.id}" class="alloc-input" />
          </div>
          <div class="budget-bar">
            <div class="budget-bar-fill ${isOver ? 'over' : (alloc === 0 ? 'no-budget' : 'under')}" style="width:${pct}%"></div>
          </div>
          <div class="budget-card-footer">
            <span>Spent: ${formatCurrency(actual)}</span>
            <span>${statusText}</span>
          </div>
        </div>`;
    });

    const summaryEl = document.getElementById('budget-summary');
    summaryEl.innerHTML = `
      <div class="budget-summary-row">
        <span class="budget-summary-label">Total Planned</span>
        <span class="budget-summary-value">${formatCurrency(totalPlanned)}</span>
      </div>
      <div class="budget-summary-row">
        <span class="budget-summary-label">Total Spent</span>
        <span class="budget-summary-value spent">${formatCurrency(totalSpent)}</span>
      </div>
      <div class="budget-summary-row">
        <span class="budget-summary-label">${totalSpent > totalPlanned ? 'Over Budget' : 'Remaining'}</span>
        <span class="budget-summary-value ${totalSpent > totalPlanned ? 'over' : 'remaining'}">${formatCurrency(Math.abs(totalPlanned - totalSpent))}</span>
      </div>`;

    Charts.renderBudgetVsActual('chart-budget-vs-actual', allocations, month);
  }

  document.getElementById('budget-month-select').addEventListener('change', () => renderBudget());

  document.getElementById('btn-save-budget').addEventListener('click', () => {
    const month = _getSelectedBudgetMonth();
    const total = parseFloat(document.getElementById('budget-total-input').value) || 0;

    const alloc = {};
    document.querySelectorAll('.alloc-input').forEach(input => {
      const val = parseFloat(input.value) || 0;
      if (val > 0) alloc[input.dataset.cat] = val;
    });
    Store.saveBudgetForMonth(month, total, alloc);
    refresh();
  });

  // ─── Expense Reports (Crosstab) ───
  const FY_MONTHS = [
    { idx: 3,  label: 'Apr' }, { idx: 4,  label: 'May' }, { idx: 5,  label: 'Jun' },
    { idx: 6,  label: 'Jul' }, { idx: 7,  label: 'Aug' }, { idx: 8,  label: 'Sep' },
    { idx: 9,  label: 'Oct' }, { idx: 10, label: 'Nov' }, { idx: 11, label: 'Dec' },
    { idx: 0,  label: 'Jan' }, { idx: 1,  label: 'Feb' }, { idx: 2,  label: 'Mar' }
  ];

  function _populateFYDropdown(selId, extraYears) {
    const sel = document.getElementById(selId);
    const txns = Store.getTransactions();
    const years = new Set(extraYears || []);
    txns.forEach(t => {
      const d = new Date(t.date + 'T00:00:00');
      const m = d.getMonth(), y = d.getFullYear();
      years.add(m <= 2 ? y - 1 : y);
    });
    // Also include FYs that have income data
    const incomeData = Store.getIncomeData();
    Object.keys(incomeData).forEach(mk => {
      const [y, mStr] = mk.split('-').map(Number);
      years.add(mStr <= 3 ? y - 1 : y);
    });
    const now = new Date();
    years.add(now.getMonth() <= 2 ? now.getFullYear() - 1 : now.getFullYear());
    const sorted = [...years].sort((a, b) => b - a);
    const current = sel.value;
    sel.innerHTML = '';
    if (!sorted.length) {
      sel.innerHTML = '<option value="">No data</option>';
      return;
    }
    sorted.forEach(y => {
      const label = `FY ${y}-${String(y + 1).slice(2)}`;
      sel.innerHTML += `<option value="${y}">${label}</option>`;
    });
    sel.value = current && sorted.includes(parseInt(current)) ? current : sorted[0];
  }

  function renderExpenseReport() {
    _populateFYDropdown('report-fy-select');
    const fyStart = parseInt(document.getElementById('report-fy-select').value);
    if (isNaN(fyStart)) return;

    const txns = Store.getTransactions();

    // Build month keys for the 12 FY months
    const monthKeys = FY_MONTHS.map(m => {
      const year = m.idx <= 2 ? fyStart + 1 : fyStart;
      return `${year}-${String(m.idx + 1).padStart(2, '0')}`;
    });

    // Aggregate: { categoryId: { "2026-04": amount, ... } }
    const data = {};
    txns.forEach(t => {
      const key = t.date.slice(0, 7);
      if (!monthKeys.includes(key)) return;
      if (!data[t.category]) data[t.category] = {};
      data[t.category][key] = (data[t.category][key] || 0) + t.amount;
    });

    // Only show categories that have at least one non-zero cell
    const activeCats = CATEGORIES.filter(c => data[c.id]);

    // Build header
    const thead = document.querySelector('#report-crosstab thead');
    thead.innerHTML = `<tr>
      <th class="report-cat-col">Category</th>
      ${FY_MONTHS.map(m => `<th class="align-right">${m.label}</th>`).join('')}
      <th class="align-right report-total-col">Total</th>
    </tr>`;

    // Build body rows
    const tbody = document.querySelector('#report-crosstab tbody');
    tbody.innerHTML = '';
    const colTotals = new Array(12).fill(0);
    let grandTotal = 0;

    activeCats.forEach(cat => {
      let rowTotal = 0;
      const cells = monthKeys.map((mk, mi) => {
        const val = (data[cat.id] || {})[mk] || 0;
        rowTotal += val;
        colTotals[mi] += val;
        return `<td class="align-right">${val ? formatCurrency(val) : '—'}</td>`;
      });
      grandTotal += rowTotal;

      tbody.innerHTML += `<tr>
        <td><span class="category-badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
        ${cells.join('')}
        <td class="align-right report-total-col"><strong>${formatCurrency(rowTotal)}</strong></td>
      </tr>`;
    });

    // Build footer totals
    const tfoot = document.querySelector('#report-crosstab tfoot');
    tfoot.innerHTML = `<tr>
      <td><strong>Total</strong></td>
      ${colTotals.map(v => `<td class="align-right"><strong>${v ? formatCurrency(v) : '—'}</strong></td>`).join('')}
      <td class="align-right report-total-col"><strong>${formatCurrency(grandTotal)}</strong></td>
    </tr>`;
  }

  document.getElementById('report-fy-select').addEventListener('change', () => renderExpenseReport());

  // ─── Income Reports (Editable Crosstab) ───
  const INCOME_CATEGORIES = [
    { id: 'salary',  name: 'Salary',       icon: '💼' },
    { id: 'farm',    name: 'Farm',          icon: '🌾' },
    { id: 'mf',      name: 'Mutual Funds',  icon: '📈' },
    { id: 'others',  name: 'Others',        icon: '📦' }
  ];

  function _fyMonthKeys(fyStart) {
    return FY_MONTHS.map(m => {
      const year = m.idx <= 2 ? fyStart + 1 : fyStart;
      return `${year}-${String(m.idx + 1).padStart(2, '0')}`;
    });
  }

  function renderIncomeReport() {
    _populateFYDropdown('income-report-fy-select');
    const fyStart = parseInt(document.getElementById('income-report-fy-select').value);
    if (isNaN(fyStart)) return;

    const monthKeys = _fyMonthKeys(fyStart);
    const incomeData = Store.getIncomeData();

    const thead = document.querySelector('#income-report-crosstab thead');
    thead.innerHTML = `<tr>
      <th class="report-cat-col">Source</th>
      ${FY_MONTHS.map(m => `<th class="align-right">${m.label}</th>`).join('')}
      <th class="align-right report-total-col">Total</th>
    </tr>`;

    const tbody = document.querySelector('#income-report-crosstab tbody');
    tbody.innerHTML = '';
    const colTotals = new Array(12).fill(0);
    let grandTotal = 0;

    INCOME_CATEGORIES.forEach(cat => {
      let rowTotal = 0;
      const cells = monthKeys.map((mk, mi) => {
        const val = (incomeData[mk] || {})[cat.id] || 0;
        rowTotal += val;
        colTotals[mi] += val;
        return `<td class="align-right">
          <input type="number" class="income-cell-input" data-cat="${cat.id}" data-month="${mk}"
                 value="${val || ''}" min="0" step="100" placeholder="—" />
        </td>`;
      });
      grandTotal += rowTotal;

      tbody.innerHTML += `<tr>
        <td><span class="income-source-label">${cat.icon} ${cat.name}</span></td>
        ${cells.join('')}
        <td class="align-right report-total-col"><strong>${formatCurrency(rowTotal)}</strong></td>
      </tr>`;
    });

    const tfoot = document.querySelector('#income-report-crosstab tfoot');
    tfoot.innerHTML = `<tr>
      <td><strong>Total</strong></td>
      ${colTotals.map(v => `<td class="align-right"><strong>${v ? formatCurrency(v) : '—'}</strong></td>`).join('')}
      <td class="align-right report-total-col"><strong>${formatCurrency(grandTotal)}</strong></td>
    </tr>`;
  }

  document.getElementById('income-report-fy-select').addEventListener('change', () => renderIncomeReport());

  document.getElementById('btn-save-income-report').addEventListener('click', () => {
    const incomeData = { ...Store.getIncomeData() };
    document.querySelectorAll('.income-cell-input').forEach(input => {
      const month = input.dataset.month;
      const cat   = input.dataset.cat;
      const val   = parseFloat(input.value) || 0;
      if (!incomeData[month]) incomeData[month] = {};
      if (val > 0) {
        incomeData[month][cat] = val;
      } else {
        delete incomeData[month][cat];
      }
      // Clean up empty month entries
      if (Object.keys(incomeData[month]).length === 0) delete incomeData[month];
    });
    Store.saveIncomeData(incomeData);
    renderIncomeReport();
  });

  // ─── Google Drive Import (Expense + Income) ───

  function parseGoogleUrl(url) {
    let match;

    // Google Drive folder: drive.google.com/drive/folders/ID
    match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return { type: 'folder', id: match[1] };

    // Google Sheets: docs.google.com/spreadsheets/d/ID/...
    match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return { type: 'sheet', id: match[1] };

    // Google Drive file link: drive.google.com/file/d/ID/...
    match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return { type: 'drive', id: match[1] };

    // Google Drive open link: drive.google.com/open?id=ID
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return { type: 'drive', id: match[1] };

    // Google Drive sharing link: drive.google.com/uc?id=ID
    match = url.match(/\/uc\?.*id=([a-zA-Z0-9_-]+)/);
    if (match) return { type: 'drive', id: match[1] };

    // Raw ID pasted directly
    if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return { type: 'drive', id: url.trim() };

    return null;
  }

  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    return { headers: parseCSVLine(lines[0]), rows: lines.slice(1).map(parseCSVLine) };
  }

  /**
   * Score a row to see if it looks like a transaction table header.
   * Returns a score — higher means more likely to be the real header.
   */
  function _headerScore(cells) {
    const text = cells.map(c => String(c).toLowerCase().trim()).join(' ');
    const keywords = ['date', 'description', 'details', 'particular', 'narration',
                      'amount', 'debit', 'credit', 'transaction', 'merchant',
                      'reference', 'remark'];
    let score = 0;
    keywords.forEach(kw => { if (text.includes(kw)) score++; });
    return score;
  }

  /**
   * Find the best header row index using keyword scoring.
   * Only searches within the first `limit` rows.
   */
  function _findHeaderRow(rows, limit) {
    let bestIdx = 0, bestScore = 0;
    const n = Math.min(rows.length, limit || 30);
    for (let i = 0; i < n; i++) {
      const score = _headerScore(rows[i]);
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    // Fallback: if no keywords found at all, pick the first row with >= 3 cells
    if (bestScore === 0) {
      for (let i = 0; i < n; i++) {
        const nonEmpty = rows[i].filter(c => String(c).trim()).length;
        if (nonEmpty >= 3) return i;
      }
    }
    return bestIdx;
  }

  function _parseOneSheet(sheet, sheetName) {
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (json.length < 2) return null;

    const stringRows = json.map(r => (Array.isArray(r) ? r : [r]).map(String));

    console.log(`[Excel] Sheet "${sheetName}" — first 5 rows:`, stringRows.slice(0, 5));

    let headerIdx = 0;
    const kwIdx = _findHeaderRow(stringRows, 20);
    if (_headerScore(stringRows[kwIdx]) >= 2) {
      headerIdx = kwIdx;
    } else {
      for (let i = 0; i < Math.min(stringRows.length, 20); i++) {
        if (stringRows[i].filter(c => c.trim()).length >= 3) { headerIdx = i; break; }
      }
    }

    const headers = stringRows[headerIdx];
    const dataRows = stringRows.slice(headerIdx + 1)
      .filter(r => r.some(c => c.trim()));
    console.log(`[Excel] Sheet "${sheetName}" — header at row`, headerIdx, '→', headers, '| Data rows:', dataRows.length);
    if (dataRows.length > 0) console.log(`[Excel] Sheet "${sheetName}" — sample row 0:`, dataRows[0]);
    return dataRows.length ? { headers, rows: dataRows } : null;
  }

  function parseExcelFromBuffer(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetNames = workbook.SheetNames;
    console.log('[Excel] Workbook sheets:', sheetNames);

    if (sheetNames.length === 1) {
      const result = _parseOneSheet(workbook.Sheets[sheetNames[0]], sheetNames[0]);
      return result || { headers: [], rows: [] };
    }

    // Multi-sheet: merge all sheets that contain transaction-like data
    let mergedHeaders = null;
    let mergedRows = [];
    for (const name of sheetNames) {
      const result = _parseOneSheet(workbook.Sheets[name], name);
      if (!result) continue;
      if (!mergedHeaders) {
        mergedHeaders = result.headers;
      }
      // Pad/trim rows to match header length
      result.rows.forEach(r => {
        while (r.length < mergedHeaders.length) r.push('');
        mergedRows.push(r.slice(0, mergedHeaders.length));
      });
    }
    console.log(`[Excel] Merged ${sheetNames.length} sheets → ${mergedRows.length} total rows`);
    return mergedHeaders ? { headers: mergedHeaders, rows: mergedRows } : { headers: [], rows: [] };
  }

  async function parsePDF(buffer) {
    const pdfjsLib = await window.pdfjsReady;
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const allLines = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items.filter(it => it.str.trim());
      if (!items.length) continue;

      const rows = [];
      let currentRow = [items[0]];
      for (let j = 1; j < items.length; j++) {
        const prev = items[j - 1];
        const curr = items[j];
        if (Math.abs(curr.transform[5] - prev.transform[5]) < 3) {
          currentRow.push(curr);
        } else {
          rows.push(currentRow);
          currentRow = [curr];
        }
      }
      rows.push(currentRow);

      rows.forEach(row => {
        row.sort((a, b) => a.transform[4] - b.transform[4]);
        allLines.push(row.map(it => it.str.trim()));
      });
    }

    if (allLines.length < 2) return { headers: [], rows: [] };

    const headerIdx = _findHeaderRow(allLines, allLines.length);
    const headers = allLines[headerIdx];

    // Collect data rows after the header, skipping repeated header rows
    const headerText = headers.join('|').toLowerCase();
    const dataRows = allLines.slice(headerIdx + 1)
      .filter(r => {
        if (r.length < 2) return false;
        // Skip rows that are repeated headers
        if (_headerScore(r) >= 2 && r.join('|').toLowerCase() === headerText) return false;
        return true;
      });

    const padded = dataRows.map(r => {
      while (r.length < headers.length) r.push('');
      return r.slice(0, headers.length);
    });
    console.log('[PDF] Header row index:', headerIdx, '| Headers:', headers,
                '| Data rows:', padded.length);
    return { headers, rows: padded };
  }

  async function fetchSingleFile(fileType, fileId, fileName) {
    const apiKey = firebaseConfig.apiKey;

    if (fileType === 'sheet') {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`Could not fetch "${fileName || fileId}".`);
      const text = await res.text();
      return { ...parseCSVText(text), fileType: 'csv' };
    }

    // Use Drive API v3 media download — reliable for shared files
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      // Fallback to the uc?export=download approach
      const fallbackUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const res2 = await fetch(fallbackUrl);
      if (!res2.ok) throw new Error(`Could not download "${fileName || fileId}" (${res.status}).`);
      return parseFileResponse(res2, fileName);
    }

    return parseFileResponse(res, fileName);
  }

  async function parseFileResponse(res, fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    const contentType = res.headers.get('content-type') || '';

    if (ext === 'pdf' || contentType.includes('pdf')) {
      const buf = await res.arrayBuffer();
      const result = await parsePDF(new Uint8Array(buf));
      return { ...result, fileType: 'pdf' };
    }

    if (ext === 'xlsx' || ext === 'xls' ||
        contentType.includes('spreadsheet') || contentType.includes('excel')) {
      const buf = await res.arrayBuffer();
      return { ...parseExcelFromBuffer(new Uint8Array(buf)), fileType: 'excel' };
    }

    const text = await res.text();
    return { ...parseCSVText(text), fileType: 'csv' };
  }

  async function fetchDriveFolder(folderId, statusElId) {
    const apiKey = firebaseConfig.apiKey;

    // Try multiple query approaches — shared drives need different params
    const queries = [
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false` +
        `&key=${apiKey}&fields=files(id,name,mimeType)&pageSize=100` +
        `&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents` +
        `&key=${apiKey}&fields=files(id,name,mimeType)&pageSize=100` +
        `&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`,
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents` +
        `&key=${apiKey}&fields=files(id,name,mimeType)&pageSize=100`
    ];

    let data = null;
    let lastError = '';
    for (const listUrl of queries) {
      const res = await fetch(listUrl);
      if (!res.ok) {
        try {
          const errJson = await res.json();
          lastError = errJson.error?.message || JSON.stringify(errJson.error || errJson);
        } catch { lastError = `HTTP ${res.status}`; }
        continue;
      }
      const json = await res.json();
      if (json.files && json.files.length > 0) {
        data = json;
        break;
      }
      data = data || json;
    }

    if (!data || !data.files) {
      throw new Error(`Drive API error: ${lastError}`);
    }

    const allFiles = data.files || [];
    // Accept all file types — try to parse whatever is there
    const files = allFiles.length > 0 ? allFiles : [];

    if (!files.length) {
      throw new Error('No files found in this folder. Make sure the folder AND its files are shared as "Anyone with the link".');
    }

    setStatus(statusElId, `Found ${files.length} file(s), reading…`, 'loading');

    let allHeaders = null;
    let allRows = [];
    let skipped = [];
    const perFile = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setStatus(statusElId, `Reading file ${i + 1}/${files.length}: ${f.name}…`, 'loading');

      const fType = f.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'sheet' : 'drive';
      try {
        const result = await fetchSingleFile(fType, f.id, f.name);
        if (result.headers.length) {
          if (!allHeaders) allHeaders = result.headers;
          allRows = allRows.concat(result.rows);
          perFile.push({ name: f.name, headers: result.headers, rows: result.rows, fileType: result.fileType || 'csv' });
        }
      } catch (e) {
        skipped.push(f.name);
        console.warn(`Skipping "${f.name}":`, e.message);
      }
    }

    if (!allHeaders || !allRows.length) {
      const msg = skipped.length
        ? `Could not read files: ${skipped.join(', ')}. Files may not be shared individually.`
        : 'Could not extract data from any files in this folder.';
      throw new Error(msg);
    }
    return { headers: allHeaders, rows: allRows, perFile };
  }

  function fetchGoogleSheet(url, statusElId) {
    const parsed = parseGoogleUrl(url);
    if (!parsed) return Promise.reject(new Error('Invalid URL. Paste a Google Sheets, Drive file, or Drive folder link.'));

    const sourceId = parsed.id;

    if (parsed.type === 'folder') {
      return fetchDriveFolder(parsed.id, statusElId).then(data => ({ ...data, sourceId }));
    }

    return fetchSingleFile(parsed.type, parsed.id).then(data => ({ ...data, sourceId }));
  }

  function setStatus(elId, message, type) {
    const el = document.getElementById(elId);
    el.textContent = message;
    el.className = 'drive-status' + (type ? ' drive-status-' + type : '');
  }

  function renderPreviewTable(tableId, sectionId, countId, headers, rows) {
    const section = document.getElementById(sectionId);
    const table = document.getElementById(tableId);
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    thead.innerHTML = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    tbody.innerHTML = '';

    const displayRows = rows.slice(0, 100);
    displayRows.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach((_, i) => {
        const td = document.createElement('td');
        td.textContent = row[i] || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    document.getElementById(countId).textContent =
      `${rows.length} row${rows.length !== 1 ? 's' : ''}` +
      (rows.length > 100 ? ' (showing first 100)' : '');

    section.hidden = false;
  }

  // Per-file data storage for dropdown switching
  let expenseFileData = { all: null, perFile: [] };
  let incomeFileData  = { all: null, perFile: [] };

  function populateFileDropdown(selectId, perFile) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="__all__">All Files</option>';
    perFile.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = f.name;
      sel.appendChild(opt);
    });
  }

  function renderSelectedFile(selectId, tableId, sectionId, countId, fileData) {
    const sel = document.getElementById(selectId);
    const val = sel.value;
    if (val === '__all__') {
      renderPreviewTable(tableId, sectionId, countId, fileData.all.headers, fileData.all.rows);
    } else {
      const f = fileData.perFile[parseInt(val)];
      renderPreviewTable(tableId, sectionId, countId, f.headers, f.rows);
    }
  }

  document.getElementById('expense-file-select').addEventListener('change', () => {
    renderSelectedFile('expense-file-select', 'expense-preview-table', 'expense-preview-section', 'expense-preview-count', expenseFileData);
  });

  document.getElementById('income-file-select').addEventListener('change', () => {
    renderSelectedFile('income-file-select', 'income-preview-table', 'income-preview-section', 'income-preview-count', incomeFileData);
  });

  // Expense Fetch
  document.getElementById('btn-fetch-expense').addEventListener('click', () => {
    const url = document.getElementById('expense-drive-url').value.trim();
    if (!url) { alert('Please paste a Google Sheets or Drive link.'); return; }

    setStatus('expense-status', 'Fetching…', 'loading');

    fetchGoogleSheet(url, 'expense-status')
      .then(async data => {
        if (!data.headers.length) throw new Error('No data found.');
        setStatus('expense-status', 'Loaded successfully', 'success');

        expenseFileData = {
          all: { headers: data.headers, rows: data.rows },
          perFile: data.perFile || []
        };

        if (data.perFile && data.perFile.length > 1) {
          populateFileDropdown('expense-file-select', data.perFile);
        } else {
          document.getElementById('expense-file-select').innerHTML = '<option value="__all__">All Files</option>';
        }

        renderPreviewTable('expense-preview-table', 'expense-preview-section', 'expense-preview-count', data.headers, data.rows);

        const allTxns = [];
        const fileDetails = [];
        const filesToProcess = data.perFile && data.perFile.length
          ? data.perFile
          : [{ name: 'File', headers: data.headers, rows: data.rows, fileType: data.fileType || 'csv' }];
        filesToProcess.forEach(f => {
          console.log(`\n── Processing [${f.fileType}]: ${f.name || 'File'} ──`);
          const txns = f.fileType === 'pdf'
            ? extractPDFTransactions(f.headers, f.rows)
            : autoExtractTransactions(f.headers, f.rows);
          const fileTotal = txns.reduce((s, t) => s + t.amount, 0);
          fileDetails.push(`${f.name || 'File'} (${f.fileType}): ${txns.length} txns, ₹${Math.round(fileTotal).toLocaleString('en-IN')}`);
          allTxns.push(...txns);
        });

        document.getElementById('import-result').hidden = false;
        if (allTxns.length) {
          setStatus('expense-status', 'Saving to database…', 'loading');
          const count = await Store.importExpenses(allTxns, data.sourceId);
          setStatus('expense-status', `Saved ${count} transactions to database`, 'success');
          const grandTotal = allTxns.reduce((s, t) => s + t.amount, 0);
          document.getElementById('import-msg').innerHTML =
            `<strong>Imported ${count} expense transactions (₹${Math.round(grandTotal).toLocaleString('en-IN')})</strong><br>` +
            fileDetails.map(d => `&nbsp;&nbsp;• ${d}`).join('<br>');
        } else {
          document.getElementById('import-msg').textContent =
            `Data loaded in preview (${data.rows.length} rows) but could not auto-map columns. Headers found: ${data.headers.join(', ')}`;
        }
        refresh();
      })
      .catch(err => {
        setStatus('expense-status', err.message, 'error');
      });
  });

  // Income Fetch
  document.getElementById('btn-fetch-income').addEventListener('click', () => {
    const url = document.getElementById('income-drive-url').value.trim();
    if (!url) { alert('Please paste a Google Sheets or Drive link.'); return; }

    setStatus('income-status', 'Fetching…', 'loading');

    fetchGoogleSheet(url, 'income-status')
      .then(async data => {
        if (!data.headers.length) throw new Error('No data found.');
        setStatus('income-status', 'Loaded successfully', 'success');

        incomeFileData = {
          all: { headers: data.headers, rows: data.rows },
          perFile: data.perFile || []
        };

        if (data.perFile && data.perFile.length > 1) {
          populateFileDropdown('income-file-select', data.perFile);
        } else {
          document.getElementById('income-file-select').innerHTML = '<option value="__all__">All Files</option>';
        }

        renderPreviewTable('income-preview-table', 'income-preview-section', 'income-preview-count', data.headers, data.rows);

        const allItems = [];
        const fileDetails = [];
        const filesToProcess = data.perFile && data.perFile.length
          ? data.perFile
          : [{ name: 'File', headers: data.headers, rows: data.rows, fileType: data.fileType || 'csv' }];
        filesToProcess.forEach(f => {
          console.log(`\n── Processing [${f.fileType}]: ${f.name || 'File'} ──`);
          const items = f.fileType === 'pdf'
            ? extractPDFTransactions(f.headers, f.rows)
            : autoExtractTransactions(f.headers, f.rows);
          const fileTotal = items.reduce((s, t) => s + t.amount, 0);
          fileDetails.push(`${f.name || 'File'} (${f.fileType}): ${items.length} txns, ₹${Math.round(fileTotal).toLocaleString('en-IN')}`);
          allItems.push(...items);
        });

        document.getElementById('import-result').hidden = false;
        if (allItems.length) {
          setStatus('income-status', 'Saving to database…', 'loading');
          const count = await Store.importIncome(allItems, data.sourceId);
          setStatus('income-status', `Saved ${count} records to database`, 'success');
          const grandTotal = allItems.reduce((s, t) => s + t.amount, 0);
          document.getElementById('import-msg').innerHTML =
            `<strong>Imported ${count} income records (₹${Math.round(grandTotal).toLocaleString('en-IN')})</strong><br>` +
            fileDetails.map(d => `&nbsp;&nbsp;• ${d}`).join('<br>');
        } else {
          document.getElementById('import-msg').textContent =
            `Data loaded in preview (${data.rows.length} rows) but could not auto-map columns. Headers found: ${data.headers.join(', ')}`;
        }
        refresh();
      })
      .catch(err => {
        setStatus('income-status', err.message, 'error');
      });
  });

  /**
   * PDF-specific transaction extraction.
   *
   * PDF statements have unique challenges: repeated page headers, footer
   * artifacts, inconsistent column alignment, and more noise rows than
   * Excel files.  This function is called *only* for PDF-sourced data so
   * that tuning it never risks breaking the Excel/CSV path.
   */
  function extractPDFTransactions(headers, rows) {
    if (!rows.length) return [];

    console.log('[PDF-Extract] Headers:', headers.map((h, i) => `[${i}]="${h}"`).join(', '));
    console.log('[PDF-Extract] Total rows to process:', rows.length);

    // ── Step 1: Analyse column content ──
    const sampleSize = Math.min(rows.length, 30);
    const colInfo = headers.map((header, colIdx) => {
      const samples = rows.slice(0, sampleSize).map(r => (r[colIdx] || '').trim()).filter(Boolean);
      const n = samples.length || 1;
      let dateHits = 0, numHits = 0, textLen = 0;
      samples.forEach(s => {
        if (normalizeDate(s)) dateHits++;
        const cleaned = s.replace(/[₹,\s]/g, '').replace(/[CcRrDd.]+$/, '');
        if (/\d/.test(cleaned) && !isNaN(parseFloat(cleaned))) numHits++;
        textLen += s.length;
      });
      return { idx: colIdx, header, dateRatio: dateHits / n, numRatio: numHits / n, avgLen: textLen / n };
    });

    console.log('[PDF-Extract] Column analysis:', colInfo.map(c =>
      `[${c.idx}] "${c.header}" date=${(c.dateRatio * 100).toFixed(0)}% num=${(c.numRatio * 100).toFixed(0)}% avgLen=${c.avgLen.toFixed(0)}`
    ).join(' | '));

    // ── Step 2: Date column — highest date ratio above threshold ──
    const dateCols = colInfo.filter(c => c.dateRatio > 0.3).sort((a, b) => b.dateRatio - a.dateRatio);
    const dateIdx = dateCols.length ? dateCols[0].idx : -1;

    // ── Step 3: Numeric columns ──
    const numCols = colInfo
      .filter(c => c.idx !== dateIdx && c.numRatio > 0.25)
      .sort((a, b) => b.numRatio - a.numRatio);

    // ── Step 4: Tag debit / credit / amount using header keywords ──
    let debitIdx = -1, creditIdx = -1, amtIdx = -1;
    numCols.forEach(nc => {
      const lh = nc.header.toLowerCase();
      if (debitIdx === -1 && /debit|dr\b|spend|charge/i.test(lh) && !/limit|date/i.test(lh))
        debitIdx = nc.idx;
      else if (creditIdx === -1 && /credit|cr\b|refund/i.test(lh) && !/limit|card/i.test(lh))
        creditIdx = nc.idx;
      else if (amtIdx === -1 && /amount|sum|fee|price/i.test(lh) && !/limit|due|balance/i.test(lh))
        amtIdx = nc.idx;
    });

    if (debitIdx === -1 && numCols.length >= 2) {
      debitIdx  = numCols[0].idx;
      creditIdx = numCols[1].idx;
    } else if (debitIdx === -1 && numCols.length === 1) {
      amtIdx = numCols[0].idx;
    }

    const primaryAmtIdx = debitIdx !== -1 ? debitIdx : amtIdx;
    const hasDualCols   = debitIdx !== -1 && creditIdx !== -1;

    if (dateIdx === -1 || primaryAmtIdx === -1) {
      console.warn('[PDF-Extract] FAILED — dateIdx:', dateIdx, 'amtIdx:', primaryAmtIdx);
      if (rows.length) console.warn('[PDF-Extract] Sample row:', rows[0]);
      return [];
    }

    // ── Step 5: Description — remaining column with longest avg text ──
    const taken = new Set([dateIdx, debitIdx, creditIdx, amtIdx].filter(c => c !== -1));
    let descIdx = -1, bestLen = 0;
    colInfo.forEach(c => {
      if (taken.has(c.idx)) return;
      if (c.avgLen > bestLen) { bestLen = c.avgLen; descIdx = c.idx; }
    });
    if (descIdx === -1) return [];

    console.log('[PDF-Extract] Mapping →',
      `Date:[${dateIdx}] "${headers[dateIdx]}"`,
      `| Desc:[${descIdx}] "${headers[descIdx]}" (avg ${bestLen.toFixed(0)} chars)`,
      `| Amt:[${primaryAmtIdx}] "${headers[primaryAmtIdx]}"`,
      hasDualCols ? `| Credit:[${creditIdx}] "${headers[creditIdx]}" → DEBIT-ONLY` : '→ single amount');

    // ── Step 6: Extract rows with PDF-specific noise filtering ──
    // PDF statements carry far more artefacts than Excel — be aggressive
    const noiseRe = new RegExp([
      'total\\s*(amount)?\\s*(due|outstanding|payable)',
      'minimum\\s*(amount)?\\s*(due|payment)',
      'credit\\s*limit', 'available\\s*(credit|cash)?\\s*limit',
      'opening\\s*balance', 'closing\\s*balance', 'outstanding\\s*balance',
      'previous\\s*balance', 'current\\s*balance', 'new\\s*balance',
      'statement\\s*(date|period|summary|balance)',
      'billing\\s*(cycle|period|date)',
      'payment\\s*due\\s*date', 'due\\s*date',
      'reward\\s*point', 'loyalty\\s*point',
      'account\\s*(number|no|summary)',
      'generated\\s*(on|at|date)',
      '\\bpage\\b.*\\bof\\b', '^total$',
      'domestic\\s*transaction', 'international\\s*transaction',
      'sub\\s*total', 'grand\\s*total',
      'continued\\s*(on|from)', 'brought\\s*forward', 'carried\\s*forward',
      '\\btransaction\\s*summary\\b', '^\\s*date\\s*$',
      'finance\\s*charge', 'interest\\s*charge',
      'total\\s*(debit|credit|spend|transaction)',
      'amount\\s*in\\s*(inr|rs|rupee)',
      'card\\s*(number|no|ending)', 'member\\s*since',
      '\\bfees?\\s*(and|&)\\s*charges?\\b'
    ].join('|'), 'i');

    const creditDescRe = new RegExp([
      '\\bpayment\\s*(received|thank|rec[\\w]*)\\b',
      '\\bpayment\\b.*\\b(received|thank|credited)\\b',
      '\\b(received|rec[\\w]*)\\s*(from|payment|towards)\\b',
      '\\brefund\\b', '\\breversal\\b', '\\bcashback\\b',
      '\\bcredit\\s*(received|adjustment|note|entry)\\b',
      '\\breward\\s*(redemption|credit|point)\\b',
      '\\bdispute\\b',
      '\\b(excess|over)\\s*payment\\b',
      '\\bemi\\s*conversion\\b',
      '\\bcr$', '\\bcr\\b'
    ].join('|'), 'i');

    const headerText = headers.map(h => h.toLowerCase().trim()).join('|');

    const txns = [];
    let sk = { noDate: 0, noDesc: 0, noise: 0, creditRow: 0, noAmt: 0, creditDesc: 0, repeatedHeader: 0 };

    rows.forEach(row => {
      const rowJoined = row.map(c => (c || '').toLowerCase().trim()).join('|');
      if (_headerScore(row) >= 2 && rowJoined === headerText) { sk.repeatedHeader++; return; }

      const rawDate = (row[dateIdx] || '').trim();
      const desc    = (row[descIdx] || '').trim();
      const fullRowText = row.map(c => (c || '').trim()).join(' ');

      if (!desc || desc.length < 3) { sk.noDesc++; return; }
      if (noiseRe.test(desc))       { sk.noise++;  return; }
      if (noiseRe.test(fullRowText)) { sk.noise++;  return; }
      if (creditDescRe.test(desc))  { sk.creditDesc++; return; }

      if (hasDualCols) {
        const dv = parseFloat((row[debitIdx] || '').trim().replace(/[₹,\s]/g, ''));
        if (isNaN(dv) || dv <= 0)   { sk.creditRow++; return; }
        const date = normalizeDate(rawDate);
        if (!date)                   { sk.noDate++;    return; }
        txns.push({ date, description: desc, amount: dv, category: classifyTransaction(desc) });
        return;
      }

      // Single amount column
      let raw = (row[primaryAmtIdx] || '').trim();
      if (/cr\.?\s*$/i.test(raw))    { sk.creditRow++;  return; }
      raw = raw.replace(/[₹,\s]/g, '').replace(/dr\.?\s*$/i, '');
      const amt = parseFloat(raw);
      if (isNaN(amt) || amt <= 0)    { sk.noAmt++;      return; }
      const date = normalizeDate(rawDate);
      if (!date)                     { sk.noDate++;      return; }
      txns.push({ date, description: desc, amount: amt, category: classifyTransaction(desc) });
    });

    const total = txns.reduce((s, t) => s + t.amount, 0);
    console.log(`[PDF-Extract] ✓ ${txns.length} txns, ₹${total.toLocaleString('en-IN')}  |  Skipped:`, sk);
    if (txns.length) {
      console.log('[PDF-Extract] First:', txns[0]);
      console.log('[PDF-Extract] Last:', txns[txns.length - 1]);
    }
    return txns;
  }

  /**
   * Content-based column detection — analyses actual cell values
   * instead of relying on header keywords which kept failing.
   * Used for Excel (.xls/.xlsx) and CSV files only.
   */
  function autoExtractTransactions(headers, rows) {
    if (!rows.length) return [];

    console.log('[Extract] Headers:', headers.map((h, i) => `[${i}]="${h}"`).join(', '));

    // ── Step 1: Analyse every column's content ──
    const colInfo = headers.map((header, colIdx) => {
      const samples = rows.slice(0, 20).map(r => (r[colIdx] || '').trim()).filter(Boolean);
      const n = samples.length || 1;
      let dateHits = 0, numHits = 0, textLen = 0;
      samples.forEach(s => {
        if (normalizeDate(s)) dateHits++;
        const cleaned = s.replace(/[₹,\s]/g, '').replace(/[CcRrDd.]+$/, '');
        if (/\d/.test(cleaned) && !isNaN(parseFloat(cleaned))) numHits++;
        textLen += s.length;
      });
      return { idx: colIdx, header, dateRatio: dateHits / n, numRatio: numHits / n, avgLen: textLen / n };
    });

    // ── Step 2: Date column = highest date ratio (> 40 %) ──
    const dateCols = colInfo.filter(c => c.dateRatio > 0.4).sort((a, b) => b.dateRatio - a.dateRatio);
    const dateIdx = dateCols.length ? dateCols[0].idx : -1;

    // ── Step 3: Numeric columns (> 30 % numbers, not date col) ──
    const numCols = colInfo
      .filter(c => c.idx !== dateIdx && c.numRatio > 0.3)
      .sort((a, b) => b.numRatio - a.numRatio);

    // ── Step 4: Among numeric cols, use header keywords to tag debit / credit / amount ──
    let debitIdx = -1, creditIdx = -1, amtIdx = -1;
    numCols.forEach(nc => {
      const lh = nc.header.toLowerCase();
      if (debitIdx === -1 && /debit|dr\b|spend|charge/i.test(lh) && !/limit|date/i.test(lh))
        debitIdx = nc.idx;
      else if (creditIdx === -1 && /credit|cr\b|refund/i.test(lh) && !/limit|card/i.test(lh))
        creditIdx = nc.idx;
      else if (amtIdx === -1 && /amount|sum|fee|price/i.test(lh) && !/limit|due|balance/i.test(lh))
        amtIdx = nc.idx;
    });

    // If keywords didn't match but we have 2 numeric cols → first = debit, second = credit
    if (debitIdx === -1 && numCols.length >= 2) {
      debitIdx  = numCols[0].idx;
      creditIdx = numCols[1].idx;
    } else if (debitIdx === -1 && numCols.length === 1) {
      amtIdx = numCols[0].idx;
    }

    const primaryAmtIdx = debitIdx !== -1 ? debitIdx : amtIdx;
    const hasDualCols   = debitIdx !== -1 && creditIdx !== -1;

    if (dateIdx === -1 || primaryAmtIdx === -1) {
      console.warn('[Extract] FAILED — dateIdx:', dateIdx, 'amtIdx:', primaryAmtIdx);
      if (rows.length) console.warn('[Extract] Sample row:', rows[0]);
      return [];
    }

    // ── Step 5: Description = remaining col with longest average text ──
    const taken = new Set([dateIdx, debitIdx, creditIdx, amtIdx].filter(c => c !== -1));
    let descIdx = -1, bestLen = 0;
    colInfo.forEach(c => {
      if (taken.has(c.idx)) return;
      if (c.avgLen > bestLen) { bestLen = c.avgLen; descIdx = c.idx; }
    });
    if (descIdx === -1) return [];

    console.log('[Extract] Mapping →',
      `Date:[${dateIdx}] "${headers[dateIdx]}"`,
      `| Desc:[${descIdx}] "${headers[descIdx]}" (avg ${bestLen.toFixed(0)} chars)`,
      `| Amt:[${primaryAmtIdx}] "${headers[primaryAmtIdx]}"`,
      hasDualCols ? `| Credit:[${creditIdx}] "${headers[creditIdx]}" → DEBIT-ONLY` : '→ single amount');
    if (rows.length) {
      const r = rows[0];
      console.log(`[Extract] Row 0 → date="${r[dateIdx]}", desc="${r[descIdx]}", amt="${r[primaryAmtIdx]}"` +
        (hasDualCols ? `, credit="${r[creditIdx]}"` : ''));
    }

    // ── Step 6: Detect sign convention ──
    // Amex and some banks show charges as negative amounts.  Sample the
    // primary amount column: if most non-zero values are negative, flip sign.
    let signFlip = 1;
    if (!hasDualCols) {
      let pos = 0, neg = 0;
      rows.slice(0, 40).forEach(row => {
        let raw = (row[primaryAmtIdx] || '').trim()
          .replace(/[₹,\s]/g, '').replace(/dr\.?\s*$/i, '').replace(/cr\.?\s*$/i, '');
        // Handle parenthesized negatives: (123.45) → -123.45
        if (/^\([\d.]+\)$/.test(raw)) raw = '-' + raw.replace(/[()]/g, '');
        const v = parseFloat(raw);
        if (!isNaN(v) && v !== 0) { if (v > 0) pos++; else neg++; }
      });
      if (neg > pos) {
        signFlip = -1;
        console.log(`[Extract] Sign convention: ${neg} negative vs ${pos} positive in sample → flipping sign (Amex-style)`);
      }
    }

    // ── Step 7: Extract rows ──
    const noiseRe = /total\s*(amount)?\s*(due|outstanding|payable)|minimum\s*(amount)?\s*(due|payment)|credit\s*limit|available\s*(credit|cash)?\s*limit|opening\s*balance|closing\s*balance|outstanding|previous\s*balance|statement\s*(date|period|summary)|billing\s*(cycle|period|date)|payment\s*due\s*date|reward\s*point|loyalty\s*point|account\s*(number|no|summary)|generated\s*(on|at|date)|\bpage\b.*\bof\b|^total$/i;
    const creditDescRe = /\bpayment\s*(received|thank|rec\w*)?\b|\brefund\b|\breversal\b|\bcashback\b|\bcredit\s*(received|adjustment|note)\b|\breward\s*(redemption|credit)\b|\bdispute\b/i;

    const txns = [];
    let sk = { noDate: 0, noDesc: 0, noise: 0, creditRow: 0, noAmt: 0, creditDesc: 0 };
    const skippedSamples = [];

    rows.forEach((row, ri) => {
      const rawDate = (row[dateIdx] || '').trim();
      const desc    = (row[descIdx] || '').trim();

      if (!desc || desc.length < 3) { sk.noDesc++; return; }
      if (noiseRe.test(desc))       { sk.noise++;  return; }

      if (hasDualCols) {
        const dv = parseFloat((row[debitIdx]  || '').trim().replace(/[₹,\s]/g, ''));
        if (isNaN(dv) || dv <= 0)   { sk.creditRow++; return; }
        if (creditDescRe.test(desc)) { sk.creditDesc++; return; }
        const date = normalizeDate(rawDate);
        if (!date) { sk.noDate++; if (skippedSamples.length < 5) skippedSamples.push({ ri, reason: 'noDate', rawDate, desc }); return; }
        txns.push({ date, description: desc, amount: dv, category: classifyTransaction(desc) });
        return;
      }

      // Single amount column
      let raw = (row[primaryAmtIdx] || '').trim();
      if (/cr\.?\s*$/i.test(raw))    { sk.creditRow++;  return; }
      raw = raw.replace(/[₹,\s]/g, '').replace(/dr\.?\s*$/i, '');
      // Handle parenthesized amounts: (1,234.56) → 1234.56
      if (/^\([\d.]+\)$/.test(raw)) raw = raw.replace(/[()]/g, '');
      let amt = parseFloat(raw);
      if (isNaN(amt))                { sk.noAmt++;  if (skippedSamples.length < 5) skippedSamples.push({ ri, reason: 'noAmt', raw: (row[primaryAmtIdx] || ''), desc }); return; }
      amt = amt * signFlip;
      if (amt <= 0) {
        // After sign flip, a positive original value becomes negative → it's a credit/payment
        if (creditDescRe.test(desc)) { sk.creditDesc++; return; }
        // In flipped mode, positive original = credit; skip it
        if (signFlip === -1)         { sk.creditRow++;  return; }
        sk.noAmt++; return;
      }
      if (creditDescRe.test(desc))   { sk.creditDesc++; return; }
      const date = normalizeDate(rawDate);
      if (!date) { sk.noDate++; if (skippedSamples.length < 5) skippedSamples.push({ ri, reason: 'noDate', rawDate, desc }); return; }
      txns.push({ date, description: desc, amount: amt, category: classifyTransaction(desc) });
    });

    const total = txns.reduce((s, t) => s + t.amount, 0);
    console.log(`[Extract] ✓ ${txns.length} txns, ₹${total.toLocaleString('en-IN')}  |  Skipped:`, sk);
    if (skippedSamples.length) console.log('[Extract] Sample skipped rows:', skippedSamples);
    if (txns.length) {
      console.log('[Extract] First:', txns[0]);
      console.log('[Extract] Last:', txns[txns.length - 1]);
    }
    return txns;
  }

  // ─── Export ───
  document.getElementById('btn-export-csv').addEventListener('click', () => {
    downloadFile('moneymap-export.csv', Store.exportAsCSV(), 'text/csv');
  });

  document.getElementById('btn-export-json').addEventListener('click', () => {
    downloadFile('moneymap-export.json', Store.exportAsJSON(), 'application/json');
  });

  // ─── Helpers ───
  function formatCurrency(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeDate(raw) {
    if (!raw) return null;
    const s = raw.trim();
    if (s.length < 6) return null;
    if (/^\d+\.?\d*$/.test(s)) return null;
    // ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Numeric date with slashes or dashes: could be DD/MM/YYYY or MM/DD/YYYY
    const parts = s.split(/[/\-]/);
    if (parts.length === 3) {
      const [a, b, y] = parts;
      const ai = parseInt(a), bi = parseInt(b);
      if (y.length === 4 && ai > 0 && bi > 0) {
        // If first part > 12 it must be the day → DD/MM/YYYY
        if (ai > 12 && bi <= 12) return `${y}-${String(bi).padStart(2, '0')}-${String(ai).padStart(2, '0')}`;
        // If second part > 12 it must be the day → MM/DD/YYYY
        if (bi > 12 && ai <= 12) return `${y}-${String(ai).padStart(2, '0')}-${String(bi).padStart(2, '0')}`;
        // Both <= 12: assume DD/MM/YYYY (Indian convention)
        if (ai <= 12 && bi <= 12) return `${y}-${String(bi).padStart(2, '0')}-${String(ai).padStart(2, '0')}`;
      }
    }
    const parsed = new Date(s);
    if (isNaN(parsed)) return null;
    const yr = parsed.getFullYear();
    if (yr < 2000 || yr > 2100) return null;
    return parsed.toISOString().slice(0, 10);
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ─── Init ───
  refresh();
}
