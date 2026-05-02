/**
 * Chart.js wrappers for dashboard and budget views.
 */
const Charts = (() => {
  let categoryChart = null;
  let trendChart = null;
  let budgetChart = null;

  function destroyAll() {
    [categoryChart, trendChart, budgetChart].forEach(c => c?.destroy());
    categoryChart = trendChart = budgetChart = null;
  }

  function renderCategoryDoughnut(canvasId, txns) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const totals = {};
    txns.forEach(t => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });

    const cats = Object.keys(totals).map(id => getCategoryById(id));
    const data = Object.values(totals);

    categoryChart?.destroy();
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.name),
        datasets: [{
          data,
          backgroundColor: cats.map(c => c.color),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } }
        }
      }
    });
  }

  function renderMonthlyTrend(canvasId, txns) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const monthly = {};
    txns.forEach(t => {
      const month = t.date.slice(0, 7);
      monthly[month] = (monthly[month] || 0) + t.amount;
    });

    const sorted = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sorted.map(([m]) => {
      const [y, mo] = m.split('-');
      return new Date(y, mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    trendChart?.destroy();
    trendChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Spend (₹)',
          data: sorted.map(([, v]) => v),
          backgroundColor: '#2563eb',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } },
          x: { grid: { display: false } }
        },
        plugins: { legend: { display: false } }
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

  return { destroyAll, renderCategoryDoughnut, renderMonthlyTrend, renderBudgetVsActual };
})();
