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
    renderDashboard(txns);
    renderTransactions(txns);
    renderBudget();
    populateCategoryDropdowns();
  }

  // ─── Dashboard ───
  function renderDashboard(txns) {
    const total = txns.reduce((s, t) => s + t.amount, 0);
    const budget = Store.getBudget();

    document.getElementById('total-spend').textContent = formatCurrency(total);
    document.getElementById('total-txn-count').textContent = txns.length + ' transactions';
    document.getElementById('monthly-budget').textContent = formatCurrency(budget);
    document.getElementById('budget-remaining').textContent =
      budget > 0 ? formatCurrency(budget - total) + ' remaining' : 'Not set';

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

    Charts.renderCategoryDoughnut('chart-category', txns);
    Charts.renderMonthlyTrend('chart-trend', txns);

    const tbody = document.querySelector('#recent-table tbody');
    tbody.innerHTML = '';
    const recent = [...txns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    recent.forEach(t => {
      const cat = getCategoryById(t.category);
      tbody.innerHTML += `
        <tr>
          <td>${formatDate(t.date)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td><span class="category-badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.name}</span></td>
          <td class="align-right">${formatCurrency(t.amount)}</td>
        </tr>`;
    });
  }

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
    filtered.forEach(t => {
      const cat = getCategoryById(t.category);
      tbody.innerHTML += `
        <tr>
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
  function renderBudget() {
    const budget = Store.getBudget();
    const allocations = Store.getAllocations();
    document.getElementById('budget-total-input').value = budget || '';

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const txns = Store.getTransactions().filter(t => t.date.startsWith(currentMonth));
    const actualByCategory = {};
    txns.forEach(t => { actualByCategory[t.category] = (actualByCategory[t.category] || 0) + t.amount; });

    const grid = document.getElementById('budget-grid');
    grid.innerHTML = '';
    CATEGORIES.filter(c => c.id !== 'other').forEach(cat => {
      const alloc = allocations[cat.id] || 0;
      const actual = actualByCategory[cat.id] || 0;
      const pct = alloc > 0 ? Math.min((actual / alloc) * 100, 100) : 0;
      const isOver = actual > alloc && alloc > 0;

      grid.innerHTML += `
        <div class="budget-card">
          <div class="budget-card-header">
            <span>${cat.icon} ${cat.name}</span>
            <input type="number" value="${alloc || ''}" min="0" step="100"
                   placeholder="₹0" data-cat="${cat.id}" class="alloc-input" />
          </div>
          <div class="budget-bar">
            <div class="budget-bar-fill ${isOver ? 'over' : 'under'}" style="width:${pct}%"></div>
          </div>
          <div class="budget-card-footer">
            <span>Spent: ${formatCurrency(actual)}</span>
            <span>${alloc > 0 ? (isOver ? 'Over by ' + formatCurrency(actual - alloc) : formatCurrency(alloc - actual) + ' left') : '—'}</span>
          </div>
        </div>`;
    });

    Charts.renderBudgetVsActual('chart-budget-vs-actual', allocations);
  }

  document.getElementById('btn-save-budget').addEventListener('click', () => {
    const total = parseFloat(document.getElementById('budget-total-input').value) || 0;
    Store.saveBudget(total);

    const alloc = {};
    document.querySelectorAll('.alloc-input').forEach(input => {
      const val = parseFloat(input.value) || 0;
      if (val > 0) alloc[input.dataset.cat] = val;
    });
    Store.saveAllocations(alloc);
    refresh();
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

  function parseExcelFromBuffer(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (json.length < 2) return { headers: [], rows: [] };
    return { headers: json[0].map(String), rows: json.slice(1).map(r => r.map(String)) };
  }

  function fetchSingleFile(fileType, fileId, fileName) {
    if (fileType === 'sheet' || (fileName && fileName.match(/\.gsheet$/i))) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
      return fetch(csvUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Could not fetch "${fileName || fileId}".`);
          return res.text();
        })
        .then(text => parseCSVText(text));
    }

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    return fetch(downloadUrl)
      .then(res => {
        if (!res.ok) throw new Error(`Could not fetch "${fileName || fileId}".`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('octet-stream')) {
          return res.arrayBuffer().then(buf => parseExcelFromBuffer(new Uint8Array(buf)));
        }
        return res.text().then(text => parseCSVText(text));
      });
  }

  async function fetchDriveFolder(folderId, statusElId) {
    const apiKey = firebaseConfig.apiKey;
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false` +
      `&key=${apiKey}&fields=files(id,name,mimeType)&pageSize=100`;

    const res = await fetch(listUrl);
    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 403 || res.status === 400) {
        throw new Error('Google Drive API not enabled. Please enable it in your Google Cloud Console (APIs & Services > Enable "Google Drive API").');
      }
      throw new Error('Could not list folder. Make sure it is shared as "Anyone with the link".');
    }

    const data = await res.json();
    const files = (data.files || []).filter(f =>
      f.mimeType === 'application/vnd.google-apps.spreadsheet' ||
      f.mimeType === 'text/csv' ||
      f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      f.mimeType === 'application/vnd.ms-excel' ||
      f.name.match(/\.(csv|xlsx|xls)$/i)
    );

    if (!files.length) throw new Error('No spreadsheet or CSV files found in this folder.');

    setStatus(statusElId, `Found ${files.length} file(s), reading…`, 'loading');

    let allHeaders = null;
    let allRows = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setStatus(statusElId, `Reading file ${i + 1}/${files.length}: ${f.name}…`, 'loading');

      const fType = f.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'sheet' : 'drive';
      try {
        const result = await fetchSingleFile(fType, f.id, f.name);
        if (result.headers.length) {
          if (!allHeaders) {
            allHeaders = result.headers;
          }
          allRows = allRows.concat(result.rows);
        }
      } catch (e) {
        console.warn(`Skipping "${f.name}":`, e.message);
      }
    }

    if (!allHeaders || !allRows.length) throw new Error('Could not extract data from any files in this folder.');
    return { headers: allHeaders, rows: allRows };
  }

  function fetchGoogleSheet(url, statusElId) {
    const parsed = parseGoogleUrl(url);
    if (!parsed) return Promise.reject(new Error('Invalid URL. Paste a Google Sheets, Drive file, or Drive folder link.'));

    if (parsed.type === 'folder') {
      return fetchDriveFolder(parsed.id, statusElId);
    }

    return fetchSingleFile(parsed.type, parsed.id);
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

  // Expense Fetch
  document.getElementById('btn-fetch-expense').addEventListener('click', () => {
    const url = document.getElementById('expense-drive-url').value.trim();
    if (!url) { alert('Please paste a Google Sheets or Drive link.'); return; }

    setStatus('expense-status', 'Fetching…', 'loading');

    fetchGoogleSheet(url, 'expense-status')
      .then(data => {
        if (!data.headers.length) throw new Error('No data found.');
        setStatus('expense-status', 'Loaded successfully', 'success');
        renderPreviewTable('expense-preview-table', 'expense-preview-section', 'expense-preview-count', data.headers, data.rows);

        const transactions = autoExtractTransactions(data.headers, data.rows);
        if (transactions.length) {
          const count = Store.importTransactions(transactions);
          document.getElementById('import-result').hidden = false;
          document.getElementById('import-msg').textContent = `Imported ${count} expense transactions.`;
          refresh();
        }
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
      .then(data => {
        if (!data.headers.length) throw new Error('No data found.');
        setStatus('income-status', 'Loaded successfully', 'success');
        renderPreviewTable('income-preview-table', 'income-preview-section', 'income-preview-count', data.headers, data.rows);

        const items = autoExtractTransactions(data.headers, data.rows);
        if (items.length) {
          const count = Store.importIncome(items);
          document.getElementById('import-result').hidden = false;
          document.getElementById('import-msg').textContent = `Imported ${count} income records.`;
          refresh();
        }
      })
      .catch(err => {
        setStatus('income-status', err.message, 'error');
      });
  });

  function autoExtractTransactions(headers, rows) {
    let dateIdx = -1, descIdx = -1, amtIdx = -1;
    headers.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (dateIdx === -1 && lower.includes('date')) dateIdx = i;
      if (descIdx === -1 && (lower.includes('desc') || lower.includes('narration') || lower.includes('particular') || lower.includes('source')))
        descIdx = i;
      if (amtIdx === -1 && (lower.includes('amount') || lower.includes('debit') || lower.includes('credit') || lower.includes('salary') || lower.includes('total')))
        amtIdx = i;
    });

    if (dateIdx === -1 || amtIdx === -1) return [];
    if (descIdx === -1) {
      // Fallback: use the column right after date
      descIdx = dateIdx + 1 < headers.length ? dateIdx + 1 : -1;
    }
    if (descIdx === -1) return [];

    const transactions = [];
    rows.forEach(row => {
      const rawDate = (row[dateIdx] || '').trim();
      const desc = (row[descIdx] || '').trim();
      const rawAmt = (row[amtIdx] || '').trim().replace(/[₹,]/g, '');
      const amount = parseFloat(rawAmt);

      if (!desc || isNaN(amount) || amount <= 0) return;
      const date = normalizeDate(rawDate);
      if (!date) return;

      transactions.push({ date, description: desc, amount, category: classifyTransaction(desc) });
    });

    return transactions;
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
    // ISO format (2026-01-15)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // DD/MM/YYYY or DD-MM-YYYY
    const parts = raw.split(/[/\-]/);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (y.length === 4 && parseInt(m) <= 12) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const parsed = new Date(raw);
    return isNaN(parsed) ? null : parsed.toISOString().slice(0, 10);
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
