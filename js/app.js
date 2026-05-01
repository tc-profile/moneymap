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

  // ─── File Import (CSV, XLSX/XLS, PDF, Google Sheets) ───
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  let importHeaders = [];
  let importRows = [];

  ['dragenter', 'dragover'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); dropZone.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(evt =>
    dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over')));

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      readAsText(file).then(text => showMapping(parseCSVText(text)));
    } else if (ext === 'xlsx' || ext === 'xls') {
      readAsArrayBuffer(file).then(buf => showMapping(parseExcel(buf)));
    } else if (ext === 'pdf') {
      readAsArrayBuffer(file).then(buf => parsePDF(buf).then(data => showMapping(data)));
    } else {
      alert('Unsupported format. Please use CSV, XLSX, XLS, or PDF.');
    }
  }

  function readAsText(file) {
    return new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.readAsText(file);
    });
  }

  function readAsArrayBuffer(file) {
    return new Promise(resolve => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.readAsArrayBuffer(file);
    });
  }

  function parseCSVText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    return { headers: parseCSVLine(lines[0]), rows: lines.slice(1).map(parseCSVLine) };
  }

  function parseExcel(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (json.length < 2) return { headers: [], rows: [] };
    return { headers: json[0].map(String), rows: json.slice(1).map(r => r.map(String)) };
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

      // Group text items into rows by Y position (within tolerance)
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

    // Use the row with the most columns as the header
    let headerIdx = 0;
    let maxCols = 0;
    allLines.forEach((line, i) => {
      if (line.length > maxCols) { maxCols = line.length; headerIdx = i; }
    });

    const headers = allLines[headerIdx];
    const dataRows = allLines.slice(headerIdx + 1).filter(r => r.length >= 2);
    // Pad shorter rows to match header length
    const padded = dataRows.map(r => {
      while (r.length < headers.length) r.push('');
      return r;
    });

    return { headers, rows: padded };
  }

  // ─── Google Sheets Import ───
  document.getElementById('btn-gsheet-import').addEventListener('click', () => {
    const url = document.getElementById('gsheet-url').value.trim();
    if (!url) { alert('Please paste a Google Sheets URL.'); return; }

    const sheetId = extractSheetId(url);
    if (!sheetId) { alert('Invalid Google Sheets URL. Please paste a valid sharing link.'); return; }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    fetch(csvUrl)
      .then(res => {
        if (!res.ok) throw new Error('Could not fetch sheet. Make sure it is shared as "Anyone with the link".');
        return res.text();
      })
      .then(text => showMapping(parseCSVText(text)))
      .catch(err => alert(err.message));
  });

  function extractSheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // ─── Column Mapping (shared by all formats) ───
  function showMapping(data) {
    if (!data.headers.length) {
      alert('Could not detect any columns. Please check the file format.');
      return;
    }
    importHeaders = data.headers;
    importRows = data.rows;

    const mapSection = document.getElementById('csv-mapping');
    mapSection.hidden = false;
    document.getElementById('import-result').hidden = true;

    ['map-date', 'map-desc', 'map-amount'].forEach(id => {
      const sel = document.getElementById(id);
      sel.innerHTML = '<option value="">—</option>';
      importHeaders.forEach((h, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = h;
        sel.appendChild(opt);
      });
    });

    autoMapColumns();
  }

  function autoMapColumns() {
    importHeaders.forEach((h, i) => {
      const lower = h.toLowerCase();
      if (lower.includes('date'))        document.getElementById('map-date').value = i;
      if (lower.includes('desc') || lower.includes('narration') || lower.includes('particular'))
        document.getElementById('map-desc').value = i;
      if (lower.includes('amount') || lower.includes('debit'))
        document.getElementById('map-amount').value = i;
    });
  }

  document.getElementById('btn-import').addEventListener('click', () => {
    const dateIdx = parseInt(document.getElementById('map-date').value);
    const descIdx = parseInt(document.getElementById('map-desc').value);
    const amtIdx  = parseInt(document.getElementById('map-amount').value);

    if (isNaN(dateIdx) || isNaN(descIdx) || isNaN(amtIdx)) {
      alert('Please map all three columns.');
      return;
    }

    const transactions = [];
    importRows.forEach(row => {
      const rawDate = (row[dateIdx] || '').trim();
      const desc = (row[descIdx] || '').trim();
      const rawAmt = (row[amtIdx] || '').trim().replace(/[₹,]/g, '');
      const amount = parseFloat(rawAmt);

      if (!desc || isNaN(amount) || amount <= 0) return;

      const date = normalizeDate(rawDate);
      if (!date) return;

      transactions.push({ date, description: desc, amount, category: classifyTransaction(desc) });
    });

    const count = Store.importTransactions(transactions);
    document.getElementById('import-result').hidden = false;
    document.getElementById('import-msg').textContent = `Successfully imported ${count} transactions.`;
    document.getElementById('csv-mapping').hidden = true;
    refresh();
  });

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
