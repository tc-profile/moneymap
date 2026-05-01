/**
 * Persistence layer using localStorage.
 * All data stays in the user's browser — nothing is sent to any server.
 *
 * Each imported transaction carries a `sourceId` (the Drive folder or file ID).
 * Re-importing from the same source replaces all previous data from that source,
 * preventing duplicates.
 */
const Store = (() => {
  const KEYS = {
    TRANSACTIONS: 'moneymap_transactions',
    INCOME:       'moneymap_income',
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

    getIncome() {
      return _get(KEYS.INCOME, []);
    },

    saveIncome(items) {
      _set(KEYS.INCOME, items);
    },

    /**
     * Replace-on-import: removes all existing transactions with the same sourceId,
     * then inserts the new ones. Safe to call repeatedly with the same source.
     */
    importTransactions(newTxns, sourceId) {
      const existing = this.getTransactions().filter(t => t.sourceId !== sourceId);
      const enriched = newTxns.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: 'expense',
        sourceId: sourceId,
        category: t.category || classifyTransaction(t.description)
      }));
      this.saveTransactions([...existing, ...enriched]);
      return enriched.length;
    },

    importIncome(newItems, sourceId) {
      const existing = this.getIncome().filter(t => t.sourceId !== sourceId);
      const enriched = newItems.map(t => ({
        ...t,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: 'income',
        sourceId: sourceId
      }));
      this.saveIncome([...existing, ...enriched]);
      return enriched.length;
    },

    clearAll() {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    },

    exportAsJSON() {
      return JSON.stringify({
        transactions: this.getTransactions(),
        income: this.getIncome(),
        budget: this.getBudget(),
        allocations: this.getAllocations()
      }, null, 2);
    },

    exportAsCSV() {
      const txns = this.getTransactions();
      const income = this.getIncome();
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
