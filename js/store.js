/**
 * Persistence layer using localStorage.
 * All data stays in the user's browser — nothing is sent to any server.
 */
const Store = (() => {
  const KEYS = {
    TRANSACTIONS: 'moneymap_transactions',
    BUDGET:       'moneymap_budget',
    ALLOCATIONS:  'moneymap_allocations'
  };

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  return {
    getTransactions() {
      return _get(KEYS.TRANSACTIONS, []);
    },

    saveTransactions(txns) {
      _set(KEYS.TRANSACTIONS, txns);
    },

    addTransaction(txn) {
      const txns = this.getTransactions();
      txn.id = crypto.randomUUID();
      txn.createdAt = new Date().toISOString();
      txns.push(txn);
      this.saveTransactions(txns);
      return txn;
    },

    updateTransaction(id, updates) {
      const txns = this.getTransactions();
      const idx = txns.findIndex(t => t.id === id);
      if (idx === -1) return null;
      txns[idx] = { ...txns[idx], ...updates };
      this.saveTransactions(txns);
      return txns[idx];
    },

    deleteTransaction(id) {
      const txns = this.getTransactions().filter(t => t.id !== id);
      this.saveTransactions(txns);
    },

    getBudget() {
      return _get(KEYS.BUDGET, 0);
    },

    saveBudget(amount) {
      _set(KEYS.BUDGET, amount);
    },

    getAllocations() {
      return _get(KEYS.ALLOCATIONS, {});
    },

    saveAllocations(alloc) {
      _set(KEYS.ALLOCATIONS, alloc);
    },

    importTransactions(newTxns) {
      const existing = this.getTransactions();
      const enriched = newTxns.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        category: t.category || classifyTransaction(t.description)
      }));
      this.saveTransactions([...existing, ...enriched]);
      return enriched.length;
    },

    exportAsJSON() {
      return JSON.stringify({
        transactions: this.getTransactions(),
        budget: this.getBudget(),
        allocations: this.getAllocations()
      }, null, 2);
    },

    exportAsCSV() {
      const txns = this.getTransactions();
      if (!txns.length) return '';
      const header = 'Date,Description,Category,Amount\n';
      const rows = txns.map(t =>
        `${t.date},"${t.description.replace(/"/g, '""')}",${t.category},${t.amount}`
      ).join('\n');
      return header + rows;
    }
  };
})();
