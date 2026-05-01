# MoneyMap

**Classify · Track · Report · Plan** — a client-side home budget management tool that classifies credit card spend and helps you stay on top of household finances.

## Features

| Area | Capability |
|------|-----------|
| **Dashboard** | Summary cards (total spend, monthly budget, top category), category doughnut chart, monthly trend bar chart, recent transactions |
| **Transactions** | Add / edit / delete transactions, search & filter by category or month |
| **Auto-Classify** | Keyword-based classification into 12 categories (Groceries, Dining, Fuel, Utilities, Shopping, Health, Education, Entertainment, Insurance, Household, Personal Care, Other) |
| **CSV Import** | Drag-and-drop credit card statement import with column mapping and auto-classification |
| **Budget Planner** | Set total monthly budget and per-category allocations, budget-vs-actual comparison chart |
| **Export** | Download data as CSV or JSON |

## Tech Stack

- Vanilla HTML / CSS / JavaScript (no build step required)
- [Chart.js 4](https://www.chartjs.org/) for visualisations (loaded via CDN)
- `localStorage` for persistence — all data stays in your browser

## Getting Started

```bash
cd MoneyMap

# Option 1: open directly
open index.html            # macOS
xdg-open index.html        # Linux

# Option 2: local server (recommended for full functionality)
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Folder Structure

```
MoneyMap/
├── index.html          # Single-page app shell
├── css/
│   └── style.css       # All styles
├── js/
│   ├── categories.js   # Category definitions & auto-classification rules
│   ├── store.js        # localStorage persistence layer
│   ├── charts.js       # Chart.js wrappers
│   └── app.js          # Main application controller
├── images/             # (placeholder for future assets)
├── data/               # (placeholder for sample CSVs)
└── README.md
```

## CSV Import Format

MoneyMap can import any CSV exported from a bank or credit card provider. After uploading, you map three columns:

| Column | Example values |
|--------|---------------|
| Date | `2026-01-15`, `15/01/2026`, `Jan 15 2026` |
| Description | `SWIGGY ORDER`, `Amazon.in`, `INDIAN OIL` |
| Amount | `1250.00`, `₹3,400` |

Transactions are auto-classified based on merchant keywords in the description.

## Privacy

All data is stored exclusively in your browser's `localStorage`. Nothing is transmitted to any server.
