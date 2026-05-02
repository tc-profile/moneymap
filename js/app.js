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

  function parseExcelFromBuffer(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // raw: false → SheetJS formats dates/numbers as display strings
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (json.length < 2) return { headers: [], rows: [] };

    const stringRows = json.map(r => (Array.isArray(r) ? r : [r]).map(String));

    // Log first 5 rows so we can diagnose header detection
    console.log('[Excel] First 5 rows:', stringRows.slice(0, 5));

    // Try keyword-based header detection; require score >= 2 to trust it
    let headerIdx = 0;
    const kwIdx = _findHeaderRow(stringRows, 20);
    if (_headerScore(stringRows[kwIdx]) >= 2) {
      headerIdx = kwIdx;
    } else {
      // Fallback: first row with >= 3 non-empty cells
      for (let i = 0; i < Math.min(stringRows.length, 20); i++) {
        if (stringRows[i].filter(c => c.trim()).length >= 3) { headerIdx = i; break; }
      }
    }

    const headers = stringRows[headerIdx];
    const dataRows = stringRows.slice(headerIdx + 1)
      .filter(r => r.some(c => c.trim()));
    console.log('[Excel] Header at row', headerIdx, '→', headers, '| Data rows:', dataRows.length);
    if (dataRows.length > 0) console.log('[Excel] Sample data row 0:', dataRows[0]);
    return { headers, rows: dataRows };
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
      return parseCSVText(text);
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
      return parsePDF(new Uint8Array(buf));
    }

    if (ext === 'xlsx' || ext === 'xls' ||
        contentType.includes('spreadsheet') || contentType.includes('excel')) {
      const buf = await res.arrayBuffer();
      return parseExcelFromBuffer(new Uint8Array(buf));
    }

    const text = await res.text();
    return parseCSVText(text);
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
          perFile.push({ name: f.name, headers: result.headers, rows: result.rows });
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
      .then(data => {
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
        const filesToProcess = data.perFile && data.perFile.length ? data.perFile : [{ name: 'File', headers: data.headers, rows: data.rows }];
        filesToProcess.forEach(f => {
          console.log(`\n── Processing: ${f.name || 'File'} ──`);
          const txns = autoExtractTransactions(f.headers, f.rows);
          const fileTotal = txns.reduce((s, t) => s + t.amount, 0);
          fileDetails.push(`${f.name || 'File'}: ${txns.length} txns, ₹${Math.round(fileTotal).toLocaleString('en-IN')}`);
          allTxns.push(...txns);
        });

        document.getElementById('import-result').hidden = false;
        if (allTxns.length) {
          // Clear all previous expense data and rebuild with fresh import
          Store.saveTransactions([]);
          const count = Store.importTransactions(allTxns, data.sourceId);
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
      .then(data => {
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
        const filesToProcess = data.perFile && data.perFile.length ? data.perFile : [{ name: 'File', headers: data.headers, rows: data.rows }];
        filesToProcess.forEach(f => {
          console.log(`\n── Processing: ${f.name || 'File'} ──`);
          const items = autoExtractTransactions(f.headers, f.rows);
          const fileTotal = items.reduce((s, t) => s + t.amount, 0);
          fileDetails.push(`${f.name || 'File'}: ${items.length} txns, ₹${Math.round(fileTotal).toLocaleString('en-IN')}`);
          allItems.push(...items);
        });

        document.getElementById('import-result').hidden = false;
        if (allItems.length) {
          Store.saveIncome([]);
          const count = Store.importIncome(allItems, data.sourceId);
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

  function autoExtractTransactions(headers, rows) {
    let dateIdx = -1, descIdx = -1, debitIdx = -1, creditIdx = -1, amtIdx = -1;

    const dateKeywords = ['date', 'txn date', 'transaction date', 'post date', 'posting date', 'value date'];
    const descKeywords = ['desc', 'detail', 'narration', 'particular', 'merchant', 'source',
                          'reference', 'remark', 'note', 'payee', 'vendor',
                          'supplier', 'beneficiary', 'party'];
    const debitKeywords  = ['debit', 'charge', 'spend'];
    const creditKeywords = ['credit', 'refund', 'cashback'];
    const amtKeywords    = ['amount', 'inr', 'rupee', 'sum', 'price', 'cost', 'fee'];

    // Noise: summary / informational rows to skip
    const noisePatterns = [
      /total\s*(amount)?\s*(due|outstanding|payable)/i,
      /minimum\s*(amount)?\s*(due|payment|payable)/i,
      /credit\s*limit/i,
      /available\s*(credit|cash)?\s*limit/i,
      /cash\s*(withdrawal)?\s*limit/i,
      /opening\s*balance/i,
      /closing\s*balance/i,
      /outstanding\s*(balance|amount)/i,
      /previous\s*balance/i,
      /statement\s*(date|period|summary|balance)/i,
      /billing\s*(cycle|period|date)/i,
      /payment\s*due\s*date/i,
      /reward\s*point/i,
      /loyalty\s*point/i,
      /account\s*(number|no|summary)/i,
      /generated\s*(on|at|date)/i,
      /\bpage\b.*\bof\b/i,
      /^total\s*$/i,
      /^\s*$/
    ];

    // Descriptions that indicate a credit/payment/refund (skip for expenses)
    const creditDescPatterns = [
      /\bpayment\b/i,
      /\brefund\b/i,
      /\breversal\b/i,
      /\bcashback\b/i,
      /\bcredit\s*(received|adjustment|note)\b/i,
      /\breward\s*(redemption|credit)\b/i,
      /\bdispute\b/i,
      /\bsurcharge\s*waiver\b/i
    ];

    console.log('[Extract] Headers:', headers.map((h, i) => `[${i}]="${h}"`).join(', '));

    headers.forEach((h, i) => {
      const lower = h.toLowerCase().trim();

      if (dateIdx === -1 && dateKeywords.some(k => lower.includes(k))) dateIdx = i;

      if (descIdx === -1 && descKeywords.some(k => lower.includes(k)) &&
          !dateKeywords.some(k => lower.includes(k))) descIdx = i;

      if (debitIdx === -1 && debitKeywords.some(k => lower.includes(k)) &&
          !lower.includes('limit') && !lower.includes('date')) debitIdx = i;

      if (creditIdx === -1 && creditKeywords.some(k => lower.includes(k)) &&
          !lower.includes('limit') && !lower.includes('card') && !lower.includes('no')) creditIdx = i;

      if (debitIdx === -1 && /^\s*dr\.?\s*$/i.test(lower)) debitIdx = i;
      if (creditIdx === -1 && /^\s*cr\.?\s*$/i.test(lower)) creditIdx = i;

      if (amtIdx === -1 && i !== debitIdx && i !== creditIdx &&
          amtKeywords.some(k => lower.includes(k)) &&
          !lower.includes('limit') && !lower.includes('due') &&
          !lower.includes('balance') && !lower.includes('outstanding')) amtIdx = i;
    });

    let primaryAmtIdx = debitIdx !== -1 ? debitIdx : (amtIdx !== -1 ? amtIdx : -1);
    const hasSeparateDebitCredit = debitIdx !== -1 && creditIdx !== -1;

    // Fallback: detect columns by content
    if ((dateIdx === -1 || primaryAmtIdx === -1) && rows.length > 0) {
      headers.forEach((_, i) => {
        if (dateIdx !== -1 && primaryAmtIdx !== -1) return;
        const samples = rows.slice(0, 10).map(r => (r[i] || '').trim()).filter(Boolean);
        if (dateIdx === -1 && samples.some(s => normalizeDate(s))) {
          console.log(`[Extract] Fallback: col ${i} looks like dates (sample: "${samples[0]}")`);
          dateIdx = i;
        }
        if (primaryAmtIdx === -1 && i !== dateIdx && i !== creditIdx &&
            samples.some(s => !isNaN(parseFloat(s.replace(/[₹,]/g, ''))))) {
          console.log(`[Extract] Fallback: col ${i} looks like amounts (sample: "${samples[0]}")`);
          primaryAmtIdx = i;
        }
      });
    }

    if (dateIdx === -1 || primaryAmtIdx === -1) {
      console.warn('[Extract] FAILED — could not detect columns.',
        'dateIdx:', dateIdx, 'amtIdx:', primaryAmtIdx);
      if (rows.length > 0) console.warn('[Extract] Sample row:', rows[0]);
      return [];
    }

    // Validate descIdx: if it points to a column of mostly numbers, reset it
    if (descIdx !== -1 && rows.length > 0) {
      const samples = rows.slice(0, 10).map(r => (r[descIdx] || '').trim()).filter(Boolean);
      const numericCount = samples.filter(s => /^[\d₹,.\s\-]+$/.test(s)).length;
      if (numericCount > samples.length * 0.5) {
        console.log(`[Extract] descIdx ${descIdx} ("${headers[descIdx]}") is mostly numeric — resetting`);
        descIdx = -1;
      }
    }

    // Smart fallback: pick the column with the longest average text content
    if (descIdx === -1) {
      let bestCol = -1, bestLen = 0;
      const usedCols = new Set([dateIdx, primaryAmtIdx, creditIdx, debitIdx].filter(c => c !== -1));
      for (let i = 0; i < headers.length; i++) {
        if (usedCols.has(i)) continue;
        const samples = rows.slice(0, 10).map(r => (r[i] || '').trim()).filter(Boolean);
        const avgLen = samples.length > 0
          ? samples.reduce((s, v) => s + v.length, 0) / samples.length
          : 0;
        if (avgLen > bestLen) { bestLen = avgLen; bestCol = i; }
      }
      if (bestCol !== -1) {
        console.log(`[Extract] Description fallback → col ${bestCol} ("${headers[bestCol]}") avg len ${bestLen.toFixed(1)}`);
        descIdx = bestCol;
      }
    }
    if (descIdx === -1) return [];

    console.log(`[Extract] Mapping → Date:[${dateIdx}] "${headers[dateIdx]}"`,
      `| Desc:[${descIdx}] "${headers[descIdx]}"`,
      `| Amt:[${primaryAmtIdx}] "${headers[primaryAmtIdx]}"`,
      hasSeparateDebitCredit ? `| Credit:[${creditIdx}] "${headers[creditIdx]}" (DEBIT-ONLY mode)` : '(single amount col)',
      `| Rows: ${rows.length}`);

    if (rows.length > 0) {
      const r = rows[0];
      console.log(`[Extract] Row 0 values → date="${r[dateIdx]}", desc="${r[descIdx]}", amt="${r[primaryAmtIdx]}"` +
        (hasSeparateDebitCredit ? `, credit="${r[creditIdx]}"` : ''));
    }

    const transactions = [];
    let skipped = { noDate: 0, noDesc: 0, noise: 0, creditRow: 0, noAmt: 0, negativeAmt: 0, creditDesc: 0 };

    rows.forEach(row => {
      const rawDate = (row[dateIdx] || '').trim();
      const desc = (row[descIdx] || '').trim();

      if (!desc || desc.length < 3) { skipped.noDesc++; return; }
      if (noisePatterns.some(p => p.test(desc))) { skipped.noise++; return; }

      // --- Separate debit/credit columns ---
      if (hasSeparateDebitCredit) {
        const debitRaw = (row[debitIdx] || '').trim().replace(/[₹,\s]/g, '');
        const creditRaw = (row[creditIdx] || '').trim().replace(/[₹,\s]/g, '');
        const debitVal = parseFloat(debitRaw);
        const creditVal = parseFloat(creditRaw);

        // Only include rows where debit > 0
        if (isNaN(debitVal) || debitVal <= 0) { skipped.creditRow++; return; }

        // If credit column also has a value, it's ambiguous — skip if credit > debit
        if (!isNaN(creditVal) && creditVal > 0 && creditVal >= debitVal) { skipped.creditRow++; return; }

        const date = normalizeDate(rawDate);
        if (!date) { skipped.noDate++; return; }

        transactions.push({ date, description: desc, amount: debitVal, category: classifyTransaction(desc) });
        return;
      }

      // --- Single amount column ---
      let rawAmt = (row[primaryAmtIdx] || '').trim();

      // Detect "Cr" / "CR" suffix — indicates credit, skip
      if (/cr\.?\s*$/i.test(rawAmt)) { skipped.creditRow++; return; }

      // Strip formatting
      rawAmt = rawAmt.replace(/[₹,\s]/g, '').replace(/dr\.?\s*$/i, '');
      let amount = parseFloat(rawAmt);

      // Negative amount = credit/refund → skip
      if (!isNaN(amount) && amount < 0) { skipped.negativeAmt++; return; }
      if (isNaN(amount) || amount <= 0) { skipped.noAmt++; return; }

      // Skip if description indicates credit/payment/refund
      if (creditDescPatterns.some(p => p.test(desc))) { skipped.creditDesc++; return; }

      const date = normalizeDate(rawDate);
      if (!date) { skipped.noDate++; return; }

      transactions.push({ date, description: desc, amount, category: classifyTransaction(desc) });
    });

    const total = transactions.reduce((s, t) => s + t.amount, 0);
    console.log(`[Extract] ✓ ${transactions.length} transactions, total ₹${total.toLocaleString('en-IN')}`);
    console.log(`[Extract] Skipped →`, skipped);
    if (transactions.length > 0) {
      console.log('[Extract] First:', transactions[0]);
      console.log('[Extract] Last:', transactions[transactions.length - 1]);
    }
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
