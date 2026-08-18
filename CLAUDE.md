# CRM Analytics System — Project Guide for Claude

## About the Project

A self-contained, end-to-end **CRM analytics showcase**. Not a production system — a portfolio/teaching artifact.

It takes raw CSVs of customers, products, and consumable transactions, applies an RFMT-based segmentation pipeline, and surfaces the result as a **static HTML + Plotly.js dashboard published on GitHub Pages**. All data is synthetic and fully reproducible from a seeded Python generator.

The repo is intentionally **vendor-agnostic** — no real client, brand, or product family is referenced. Terminology is generic (`consumable`, `units`, `unit_size`). Do not reintroduce domain-specific words like `refill`, `grammage`, or any company name.

---

## Current Focus

The repo is functionally complete (docs → schema → SQL → synthetic data → static site). Active workstreams:

1. **KPI catalog refinements.** The business logic in `docs/specs/crm_calculation_logic.md` is the source of truth. Any change to a rule, threshold, or output field flows downstream into `db/run_crm_calculation.sql`, `scripts/build_report.py` (chart aggregations), `docs/index.html`, and `docs/assets/js/app.js`. Keep them in lockstep.
2. **Showcase polish.** Visualisations, README framing, screenshots, GitHub Pages presentation.

---

## Tech Stack

| Layer              | Technology                                                                  |
|--------------------|-----------------------------------------------------------------------------|
| Language           | Python 3.10+                                                                |
| Database           | SQLite (file-based, lives at `data/input/crm.db`)                           |
| ETL                | Plain SQL in `db/run_crm_calculation.sql` (parameterised for one report month) |
| Build orchestrator | `db/build.py` — wipes the DB, applies schema, loads CSVs, runs the calc once per report month |
| Synthetic data     | `scripts/generate_data/generate.py` — `Faker` + stdlib `random`             |
| Report builder     | `scripts/build_report.py` — Plotly + Kaleido + python-markdown              |
| Dashboard          | Static HTML + Plotly.js (CDN) + vanilla JS, served from `docs/` via GitHub Pages |

No web server, no auth layer, no env vars, no secrets. Everything runs locally; the deployed artifact is purely static.

---

## Pipeline Overview

```
scripts/generate_data/generate.py
        │  (writes data/input/{products_master,customers_master,sales_transactions_YYYY}.csv)
        ▼
db/build.py
   ├── apply db/schema.sql                       → raw_products, raw_customers, raw_sales_transactions
   ├── load CSVs into the raw_* tables
   └── for each report month in --months:
         apply db/run_crm_calculation.sql        → crm_customer_snapshot (single-month)
         INSERT into crm_customer_snapshot_all   (accumulator)
        renames _all → crm_customer_snapshot, recreates indexes, ANALYZE
        │
        ▼
scripts/build_report.py
   ├── reads data/input/crm.db read-only
   ├── writes docs/data.json                     (per-month aggregates + customer table)
   ├── writes docs/screenshots/*.png             (Plotly charts via Kaleido for the README)
   └── renders docs/specs/*.md → docs/specs/*.html (styled to match the dashboard)
        │
        ▼
docs/index.html  (committed, served by GitHub Pages)
   loads data.json client-side, renders Plotly charts and a paginated/filterable customer table
```

**Reproducibility:** the generator seeds `random.seed(42)` and `Faker.seed(42)`. Tier thresholds in `db/run_crm_calculation.sql` are calibrated against this exact seeded distribution — changing the seed, the persona mix, or the order of RNG calls will shift the tier counts and you'll likely need to recalibrate `T_high / T_mid_high / T_mid / A_high / F_high / F_mid` (and re-run `build_report.py` to refresh the screenshots).

---

## Repo Layout

```
.
├── CLAUDE.md
├── README.md
├── docs/                              ← GitHub Pages root
│   ├── index.html                     dashboard (Plotly.js + vanilla JS)
│   ├── data.json                      generated, committed (so Pages can serve it)
│   ├── .nojekyll                      disables Jekyll
│   ├── assets/{css,js}/               page styles + client app
│   ├── screenshots/*.png              generated, committed (used by README)
│   └── specs/                         markdown specs + rendered .html
│       ├── crm_calculation_logic.md   KPI + segmentation source of truth
│       ├── source_files_specifications.md
│       └── project_requirements.md
├── db/
│   ├── schema.sql                     raw_* table DDL (SQLite)
│   ├── run_crm_calculation.sql        single-month CRM calc (parameterised in tt_params)
│   └── build.py                       multi-month build orchestrator
├── scripts/
│   ├── build_report.py                SQLite → docs/data.json + screenshots + spec HTML
│   └── generate_data/
│       ├── generate.py                seeded synthetic CSVs
│       ├── verify.py                  smoke test
│       └── requirements.txt
└── data/input/                        CSVs + crm.db (gitignored, rebuild locally)
```

---

## Key Files

- `docs/specs/crm_calculation_logic.md` — **source of truth.** Defines the M-fields (M1/M6/M12/M13/M24/M25/O6), the Activity Status / Value Tier / Lifecycle Event outputs, and every edge-case rule (returns excluded, anonymous customers excluded, calendar-month windows, top-down precedence). Read this before touching SQL.
- `docs/specs/evidence_base.md` — **why the rules are what they are.** Traces each segmentation rule to a published source (Ascarza et al. 2018; Fader/Hardie 2005, 2009; PwC 2025; EY 2025) or marks it plainly as our own choice, and records the two widely-quoted statistics this project refuses to repeat. When a KPI rule changes, this file changes with it: a rule with no entry here is a rule nobody has justified. Adding a source means checking it, not citing it from memory.
- `db/run_crm_calculation.sql` — implements the doc. The `tt_params` CTE at the top holds the report month and the calibration thresholds. The pipeline runs `tt_params → tt_dates → tt_first_device_date → tt_consumable_lines → tt_base_aggregates → crm_customer_snapshot`.
- `db/build.py` — the only place that knows about multi-month orchestration. Patches the report-month string in `run_crm_calculation.sql` once per iteration via regex (`REPORT_MONTH_PATTERN`). If the SQL's `tt_params` shape changes, update the regex.
- `scripts/build_report.py` — the bridge between SQL and the static site. `fetch_aggregates()` defines the JSON shape; the `screenshot_*` functions define what gets rendered as PNG; `render_specs()` converts each `docs/specs/*.md` to a styled `*.html`.
- `scripts/generate_data/generate.py` — `PERSONA_MIX` dictates the customer distribution; each persona has matching logic in `created_date_for`, `schedule_consumable_months`, and `PERSONA_KNOBS`. All three must stay consistent.
- `docs/index.html` + `docs/assets/js/app.js` — the dashboard. The JS reads `data.json` and assumes the shape produced by `fetch_aggregates()`; if you change the JSON shape, update both ends.

---

## Coding Conventions

- **Generic terminology only.** Never reintroduce `refill`, `grammage`, or any client/brand name. Product category enum: `device | consumable | accessories | spare_parts`.
- **The doc leads, the code follows.** When KPI rules change, update `docs/specs/crm_calculation_logic.md` first, then `db/run_crm_calculation.sql`, then `scripts/build_report.py` aggregations, then the JS. Don't silently diverge.
- **Don't add print/logging noise to the SQL pipeline.** The SQL is meant to be readable end-to-end.
- **Keep the generator deterministic.** RNG seed is `42` everywhere. Don't add un-seeded randomness; if you need a new RNG-consuming step, slot it in such that it doesn't perturb the order of existing calls (or accept that thresholds will need re-calibrating and update them in the same PR).
- **Threshold calibration is empirical.** When you change the persona mix or qty/unit ranges, run `python scripts/generate_data/verify.py` and re-tune `T_high / T_mid_high / T_mid / A_high / F_high / F_mid` so every tier is non-empty and Diamond stays a small elite.
- **Calendar-month windows.** All time logic in the SQL uses `date(x, 'start of month', '-N month')` with N = months_back - 1 (so `M6 = '-5 month'`, not `'-6 month'`). Don't introduce day-level windows.
- **The snapshot must always include every eligible customer**, even those with zero consumable purchases (they collapse to `Not Active` with `value_tier = NULL` and `tenure_months = NULL`). Anonymous customers (`customer_group = 'general'`, case-insensitive) are excluded.
- **Generated artifacts under `docs/` ARE committed** (`docs/data.json`, `docs/screenshots/*.png`, `docs/specs/*.html`) — GitHub Pages serves the repo as-is; we don't run a build step at deploy time. Re-run `scripts/build_report.py` and commit the diff whenever the underlying data or business logic changes.

---

## How to Run

```bash
pip install -r scripts/generate_data/requirements.txt
pip install plotly kaleido markdown
yes | kaleido_get_chrome             # one-off: PNG export needs headless Chrome

python scripts/generate_data/generate.py
python db/build.py
python scripts/generate_data/verify.py     # optional: distribution check
python scripts/build_report.py             # writes docs/data.json + screenshots + spec HTML
python -m http.server -d docs 8000         # optional: preview locally
```

Build options: `python db/build.py --db <path> --months <N> --latest YYYY-MM-DD`.

---

## Important Rules for Claude

- **Always read `docs/specs/crm_calculation_logic.md` before changing any KPI rule** in the SQL or the dashboard, and record the justification in `docs/specs/evidence_base.md` — a source that was actually fetched and read, or an honest "this is our choice". Never cite a paper from memory, and never quote a statistic without its primary source and its date.
- **Never commit raw input artifacts** (`data/input/*.csv`, `data/input/crm.db`). They are gitignored.
- **Do commit derived `docs/` artifacts** (`docs/data.json`, `docs/screenshots/*.png`, `docs/specs/*.html`) — Pages serves them.
- **Don't drop or rewrite `data/input/data_sample.db`** (a 47 MB legacy SQLite tracked from before this project) without explicit user approval.
- **No vendor names, no real-client framing, no `refill`/`grammage` terminology** — the showcase must read as a generic CRM analytics demo.
- **Re-run the verify script after any change to the generator or the SQL** to confirm every value tier and lifecycle event remains non-empty; then re-run `scripts/build_report.py` to refresh the dashboard data.
- Commit messages: descriptive subject + a short body explaining the **why**. No emojis, no Co-Authored-By lines.
