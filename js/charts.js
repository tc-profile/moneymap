/**
 * Chart.js wrappers for dashboard and budget views.
 */
const Charts = (() => {
  let incExpChart = null;
  let budgetChart = null;

  const FY_MONTH_ORDER = [
    { idx: 3, label: 'Apr' }, { idx: 4, label: 'May' }, { idx: 5, label: 'Jun' },
    { idx: 6, label: 'Jul' }, { idx: 7, label: 'Aug' }, { idx: 8, label: 'Sep' },
    { idx: 9, label: 'Oct' }, { idx: 10, label: 'Nov' }, { idx: 11, label: 'Dec' },
    { idx: 0, label: 'Jan' }, { idx: 1, label: 'Feb' }, { idx: 2, label: 'Mar' }
  ];

  function destroyAll() {
    [incExpChart, budgetChart].forEach(c => c?.destroy());
    incExpChart = budgetChart = null;
  }

  function renderIncomeVsExpense(canvasId, expenseTxns, fyStart) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const monthKeys = FY_MONTH_ORDER.map(m => {
      const year = m.idx <= 2 ? fyStart + 1 : fyStart;
      return `${year}-${String(m.idx + 1).padStart(2, '0')}`;
    });
    const labels = FY_MONTH_ORDER.map(m => m.label);

    // Expense totals per month
    const expByMonth = {};
    expenseTxns.forEach(t => {
      const mk = t.date.slice(0, 7);
      expByMonth[mk] = (expByMonth[mk] || 0) + t.amount;
    });

    // Income totals per month from saved income data
    const incomeData = Store.getIncomeData();
    const incomeValues = monthKeys.map(mk => {
      const entry = incomeData[mk];
      if (!entry) return 0;
      return Object.values(entry).reduce((s, v) => s + (v || 0), 0);
    });
    const expenseValues = monthKeys.map(mk => expByMonth[mk] || 0);

    incExpChart?.destroy();
    incExpChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomeValues,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            borderWidth: 2
          },
          {
            label: 'Expense',
            data: expenseValues,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: '#ef4444',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`
            }
          }
        }
      }
    });
  }

  function renderBudgetVsActual(canvasId, allocations, month) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const txns = Store.getTransactions().filter(t => t.date.startsWith(month));

    const actualByCategory = {};
    txns.forEach(t => {
      actualByCategory[t.category] = (actualByCategory[t.category] || 0) + t.amount;
    });

    const cats = CATEGORIES.filter(c => allocations[c.id] || actualByCategory[c.id]);
    if (!cats.length) {
      budgetChart?.destroy();
      budgetChart = null;
      return;
    }

    budgetChart?.destroy();
    budgetChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cats.map(c => c.name),
        datasets: [
          {
            label: 'Budget',
            data: cats.map(c => allocations[c.id] || 0),
            backgroundColor: 'rgba(37,99,235,.25)',
            borderColor: '#2563eb',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Actual',
            data: cats.map(c => actualByCategory[c.id] || 0),
            backgroundColor: cats.map(c => {
              const actual = actualByCategory[c.id] || 0;
              const budget = allocations[c.id] || 0;
              return actual > budget ? 'rgba(239,68,68,.7)' : 'rgba(16,185,129,.7)';
            }),
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } },
          y: { grid: { display: false } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  return { destroyAll, renderIncomeVsExpense, renderBudgetVsActual };
})();
