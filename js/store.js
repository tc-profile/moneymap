/**
 * Persistence layer using Firebase Firestore.
 * Data is scoped per authenticated user (users/{uid}/data/*).
 *
 * Reads come from an in-memory cache for speed; writes update the cache
 * immediately and persist to Firestore in the background.
 *
 * Firestore structure:
 *   users/{uid}/data/expenses  → { items: [...] }
 *   users/{uid}/data/income    → { items: [...] }
 *   users/{uid}/data/settings  → { budget, allocations }
 */
const Store = (() => {
  let _uid = null;
  let _db = null;

  const _cache = {
    transactions: [],
    income: [],
    budget: 0,
    allocations: {}
  };

  function _doc(name) {
    return _db.collection('users').doc(_uid).collection('data').doc(name);
  }

  function _persistExpenses() {
    _doc('expenses').set({ items: _cache.transactions })
      .catch(e => console.error('Firestore write [expenses]:', e));
  }

  function _persistIncome() {
    _doc('income').set({ items: _cache.income })
      .catch(e => console.error('Firestore write [income]:', e));
  }

  function _persistSettings() {
    _doc('settings').set({ budget: _cache.budget, allocations: _cache.allocations })
      .catch(e => console.error('Firestore write [settings]:', e));
  }

  return {
    async init(uid) {
      _uid = uid;
      _db = firebase.firestore();

      const [expSnap, incSnap, setSnap] = await Promise.all([
        _doc('expenses').get(),
        _doc('income').get(),
        _doc('settings').get()
      ]);

      _cache.transactions = expSnap.exists ? (expSnap.data().items || []) : [];
      _cache.income       = incSnap.exists ? (incSnap.data().items || []) : [];

      if (setSnap.exists) {
        const s = setSnap.data();
        _cache.budget      = s.budget || 0;
        _cache.allocations = s.allocations || {};
      } else {
        _cache.budget      = 0;
        _cache.allocations = {};
      }
    },

    getTransactions() {
      return _cache.transactions;
    },

    saveTransactions(txns) {
      _cache.transactions = txns;
      _persistExpenses();
    },

    addTransaction(txn) {
      txn.id = crypto.randomUUID();
      txn.createdAt = new Date().toISOString();
      _cache.transactions.push(txn);
      _persistExpenses();
      return txn;
    },

    updateTransaction(id, updates) {
      const idx = _cache.transactions.findIndex(t => t.id === id);
      if (idx === -1) return null;
      _cache.transactions[idx] = { ..._cache.transactions[idx], ...updates };
      _persistExpenses();
      return _cache.transactions[idx];
    },

    deleteTransaction(id) {
      _cache.transactions = _cache.transactions.filter(t => t.id !== id);
      _persistExpenses();
    },

    getBudget() {
      return _cache.budget;
    },

    saveBudget(amount) {
      _cache.budget = amount;
      _persistSettings();
    },

    getAllocations() {
      return _cache.allocations;
    },

    saveAllocations(alloc) {
      _cache.allocations = alloc;
      _persistSettings();
    },

    getIncome() {
      return _cache.income;
    },

    saveIncome(items) {
      _cache.income = items;
      _persistIncome();
    },

    importTransactions(newTxns, sourceId) {
      _cache.transactions = _cache.transactions.filter(t => t.sourceId !== sourceId);
      const enriched = newTxns.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: 'expense',
        sourceId,
        category: t.category || classifyTransaction(t.description)
      }));
      _cache.transactions.push(...enriched);
      _persistExpenses();
      return enriched.length;
    },

    importIncome(newItems, sourceId) {
      _cache.income = _cache.income.filter(t => t.sourceId !== sourceId);
      const enriched = newItems.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: 'income',
        sourceId
      }));
      _cache.income.push(...enriched);
      _persistIncome();
      return enriched.length;
    },

    clearAll() {
      _cache.transactions = [];
      _cache.income = [];
      _cache.budget = 0;
      _cache.allocations = {};
      _persistExpenses();
      _persistIncome();
      _persistSettings();
    },

    exportAsJSON() {
      return JSON.stringify({
        transactions: _cache.transactions,
        income: _cache.income,
        budget: _cache.budget,
        allocations: _cache.allocations
      }, null, 2);
    },

    exportAsCSV() {
      const txns = _cache.transactions;
      const income = _cache.income;
      if (!txns.length && !income.length) return '';
      const header = 'Type,Date,Description,Category,Amount\n';
      const expRows = txns.map(t =>
        `Expense,${t.date},"${t.description.replace(/"/g, '""')}",${t.category},${t.amount}`
      );
      const incRows = income.map(t =>
        `Income,${t.date},"${t.description.replace(/"/g, '""')}",${t.category || ''},${t.amount}`
      );
      return header + [...expRows, ...incRows].join('\n');
    }
  };
})();
