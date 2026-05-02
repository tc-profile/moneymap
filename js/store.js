/**
 * Persistence layer using Firebase Firestore subcollections.
 *
 * Data model (per user):
 *   users/{uid}/expenses/{docId}     – credit-card / cash expenses
 *   users/{uid}/income/{docId}       – salary, freelance, etc.
 *   users/{uid}/assets/{docId}       – property, gold, vehicles
 *   users/{uid}/loans/{docId}        – home, car, personal loans
 *   users/{uid}/investments/{docId}  – MF, stocks, FD, PPF, NPS
 *   users/{uid}/config/settings      – budget & category allocations
 *
 * An in-memory cache keeps reads synchronous so the UI layer
 * doesn't need async/await for rendering.
 */
const Store = (() => {
  let _uid = null;
  let _db  = null;

  const _cache = {
    expenses:    [],
    income:      [],
    assets:      [],
    loans:       [],
    investments: [],
    budgets:     {},  // { "2026-01": { total: 50000, allocations: { groceries: 15000, … } }, … }
    incomeData:  {}   // { "2026-04": { salary: 50000, farm: 10000, mf: 5000, others: 2000 }, … }
  };

  /* ── Firestore helpers ── */

  function _col(name) {
    return _db.collection('users').doc(_uid).collection(name);
  }

  function _configDoc() {
    return _db.collection('users').doc(_uid).collection('config').doc('settings');
  }

  async function _batchOps(ops) {
    for (let i = 0; i < ops.length; i += 450) {
      const batch = _db.batch();
      ops.slice(i, i + 450).forEach(op => {
        if (op.type === 'delete') batch.delete(op.ref);
        else batch.set(op.ref, op.data);
      });
      await batch.commit();
    }
  }

  async function _replaceCollection(name, items) {
    const ops = [];
    const snap = await _col(name).get();
    snap.docs.forEach(doc => ops.push({ type: 'delete', ref: doc.ref }));
    items.forEach(item => ops.push({ type: 'set', ref: _col(name).doc(item.id), data: item }));
    await _batchOps(ops);
    console.log(`[Store] Firestore → ${name}: deleted ${snap.docs.length}, wrote ${items.length} docs at users/${_uid}/${name}`);
  }

  /* ── Public API ── */

  return {
    async init(uid) {
      _uid = uid;
      _db  = firebase.firestore();

      const [expSnap, incSnap, astSnap, lnSnap, invSnap, cfgDoc] = await Promise.all([
        _col('expenses').get(),
        _col('income').get(),
        _col('assets').get(),
        _col('loans').get(),
        _col('investments').get(),
        _configDoc().get()
      ]);

      _cache.expenses    = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cache.income      = incSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cache.assets      = astSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cache.loans       = lnSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      _cache.investments = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (cfgDoc.exists) {
        const s = cfgDoc.data();
        if (s.budgets) {
          _cache.budgets = s.budgets;
        } else if (s.budget || s.allocations) {
          const now = new Date();
          const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          _cache.budgets[key] = { total: s.budget || 0, allocations: s.allocations || {} };
        }
        if (s.incomeData) {
          _cache.incomeData = s.incomeData;
        }
      }

      console.log(`[Store] Loaded: ${_cache.expenses.length} expenses, ${_cache.income.length} income, ` +
        `${_cache.assets.length} assets, ${_cache.loans.length} loans, ${_cache.investments.length} investments`);
    },

    /* ── Expenses (backward-compat alias: getTransactions) ── */

    getExpenses()     { return _cache.expenses; },
    getTransactions() { return _cache.expenses; },

    addTransaction(txn) {
      txn.id        = crypto.randomUUID();
      txn.createdAt = new Date().toISOString();
      txn.type      = 'expense';
      _cache.expenses.push(txn);
      _col('expenses').doc(txn.id).set(txn).catch(e => console.error('Firestore:', e));
      return txn;
    },

    updateTransaction(id, updates) {
      const idx = _cache.expenses.findIndex(t => t.id === id);
      if (idx === -1) return null;
      _cache.expenses[idx] = { ..._cache.expenses[idx], ...updates };
      _col('expenses').doc(id).update(updates).catch(e => console.error('Firestore:', e));
      return _cache.expenses[idx];
    },

    deleteTransaction(id) {
      _cache.expenses = _cache.expenses.filter(t => t.id !== id);
      _col('expenses').doc(id).delete().catch(e => console.error('Firestore:', e));
    },

    async importExpenses(txns, sourceId) {
      const enriched = txns.map(t => ({
        ...t,
        id:        crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type:      'expense',
        sourceId,
        category:  t.category || classifyTransaction(t.description)
      }));

      _cache.expenses = enriched;
      await _replaceCollection('expenses', enriched);
      return enriched.length;
    },

    /* ── Income ── */

    getIncome() { return _cache.income; },

    async importIncome(items, sourceId) {
      const enriched = items.map(t => ({
        ...t,
        id:        crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type:      'income',
        sourceId
      }));

      _cache.income = enriched;
      await _replaceCollection('income', enriched);
      return enriched.length;
    },

    /* ── Assets ── */

    getAssets() { return _cache.assets; },

    addAsset(asset) {
      asset.id        = crypto.randomUUID();
      asset.createdAt = new Date().toISOString();
      _cache.assets.push(asset);
      _col('assets').doc(asset.id).set(asset).catch(e => console.error('Firestore:', e));
      return asset;
    },

    /* ── Loans ── */

    getLoans() { return _cache.loans; },

    addLoan(loan) {
      loan.id        = crypto.randomUUID();
      loan.createdAt = new Date().toISOString();
      _cache.loans.push(loan);
      _col('loans').doc(loan.id).set(loan).catch(e => console.error('Firestore:', e));
      return loan;
    },

    /* ── Investments ── */

    getInvestments() { return _cache.investments; },

    addInvestment(inv) {
      inv.id        = crypto.randomUUID();
      inv.createdAt = new Date().toISOString();
      _cache.investments.push(inv);
      _col('investments').doc(inv.id).set(inv).catch(e => console.error('Firestore:', e));
      return inv;
    },

    /* ── Settings (per-month budgets) ── */

    getBudgetForMonth(month) {
      const entry = _cache.budgets[month];
      return entry ? entry.total : 0;
    },

    getAllocationsForMonth(month) {
      const entry = _cache.budgets[month];
      return entry ? (entry.allocations || {}) : {};
    },

    saveBudgetForMonth(month, total, allocations) {
      _cache.budgets[month] = { total, allocations };
      _configDoc().set({ budgets: _cache.budgets }, { merge: true })
        .catch(e => console.error('Firestore:', e));
    },

    getBudget() {
      const now = new Date();
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return this.getBudgetForMonth(key);
    },
    getAllocations() {
      const now = new Date();
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return this.getAllocationsForMonth(key);
    },

    /* ── Income Report Data ── */

    getIncomeData()  { return _cache.incomeData; },

    saveIncomeData(data) {
      _cache.incomeData = data;
      _configDoc().set({ incomeData: data }, { merge: true })
        .catch(e => console.error('Firestore:', e));
    },

    /* ── Export ── */

    exportAsJSON() {
      return JSON.stringify({
        expenses:    _cache.expenses,
        income:      _cache.income,
        assets:      _cache.assets,
        loans:       _cache.loans,
        investments: _cache.investments,
        budgets:     _cache.budgets,
        incomeData:  _cache.incomeData
      }, null, 2);
    },

    exportAsCSV() {
      const txns   = _cache.expenses;
      const income = _cache.income;
      if (!txns.length && !income.length) return '';
      const header = 'Type,Date,Description,Category,Amount\n';
      const expRows = txns.map(t =>
        `Expense,${t.date},"${(t.description || '').replace(/"/g, '""')}",${t.category},${t.amount}`
      );
      const incRows = income.map(t =>
        `Income,${t.date},"${(t.description || '').replace(/"/g, '""')}",${t.category || ''},${t.amount}`
      );
      return header + [...expRows, ...incRows].join('\n');
    }
  };
})();
