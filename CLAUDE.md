# CRM Analytics System — Project Guide for Claude

## About the Project

A self-contained, end-to-end **CRM analytics showcase**. Not a production system — a demo/teaching artifact.

It takes raw CSVs of customers, products, and consumable transactions, applies an RFMT-based segmentation pipeline, and surfaces the result as an interactive Streamlit + Plotly dashboard. All data is synthetic and fully reproducible from a seeded Python generator.

The repo is intentionally **vendor-agnostic** — no real client, brand, or product family is referenced. Terminology is generic (`consumable`, `units`, `unit_size`). Do not reintroduce domain-specific words like `refill`, `grammage`, or any company name.

---

## Current Focus

The repo is functionally complete (docs → schema → SQL → synthetic data → dashboard). Active workstreams:

1. **KPI catalog refinements.** The business logic in `docs/crm_calculation_logic.md` is the source of truth. Any change to a rule, threshold, or output field flows downstream into `db/run_crm_calculation.sql`, the Streamlit pages, and (where relevant) `scripts/generate_data/generate.py`. Keep the four in lockstep.
2. **Showcase polish.** Visualisations, README, screenshots, recruiter-facing framing.

---

## Tech Stack

| Layer            | Technology                                                                 |
|------------------|----------------------------------------------------------------------------|
| Language         | Python 3.10+                                                               |
| Database         | SQLite (file-based, lives at `data/input/crm.db`)                          |
| ETL              | Plain SQL in `db/run_crm_calculation.sql` (parameterised for one report month) |
| Build orchestrator | `db/build.py` — wipes the DB, applies schema, loads CSVs, runs the calc once per report month |
| Synthetic data   | `scripts/generate_data/generate.py` — `Faker` + stdlib `random` (numpy/pandas listed but not currently imported by the generator itself) |
| Dashboard        | Streamlit ≥ 1.30 + Plotly ≥ 5.18 + pandas ≥ 2.0                            |

No web server, no auth layer, no env vars, no secrets. Everything runs locally.

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
         apply db/run_crm_calculation.sql        → crm_customer_snapshot (one month)
         INSERT into crm_customer_snapshot_all   (accumulator)
        renames _all → crm_customer_snapshot, recreates indexes, ANALYZE
        │
        ▼
app/streamlit_app.py
   reads crm.db read-only and renders Overview / Segments / Lifecycle / Products tabs
```

**Reproducibility:** the generator seeds `random.seed(42)` and `Faker.seed(42)`. Tier thresholds in `db/run_crm_calculation.sql` are calibrated against this exact seeded distribution — changing the seed, the persona mix, or the order of RNG calls will shift the tier counts and you'll likely need to recalibrate `T_high / T_mid_high / T_mid / A_high / F_high / F_mid`.

---

## Repo Layout

```
.
├── CLAUDE.md                          (this file)
├── README.md
├── docs/
│   ├── crm_calculation_logic.md       (KPI + segmentation source of truth)
│   ├── source_files_specifications.md (input CSV schemas)
│   └── project_requirements.md
├── db/
│   ├── schema.sql                     (raw_* table DDL)
│   ├── run_crm_calculation.sql        (single-month CRM calc; parameterised in tt_params)
│   └── build.py                       (multi-month orchestrator)
├── scripts/generate_data/
│   ├── generate.py                    (synthetic CSVs)
│   ├── verify.py                      (smoke-test: load CSVs → run calc → print distribution)
│   └── requirements.txt
├── app/
│   ├── streamlit_app.py               (4-tab dashboard)
│   └── requirements.txt
└── data/input/                        (CSVs + crm.db are gitignored)
```

---

## Key Files

- `docs/crm_calculation_logic.md` — **source of truth.** Defines the M-fields (M1/M6/M12/M13/M24/M25/O6), the Activity Status / Value Tier / Lifecycle Event outputs, and every edge-case rule (returns excluded, anonymous customers excluded, calendar-month windows, top-down precedence). Read this before touching SQL.
- `db/run_crm_calculation.sql` — implements the doc. The `tt_params` CTE at the top holds the report month and the calibration thresholds. The pipeline runs `tt_params → tt_dates → tt_first_device_date → tt_consumable_lines → tt_base_aggregates → crm_customer_snapshot`.
- `db/build.py` — the only place that knows about multi-month orchestration. Patches the report-month string in `run_crm_calculation.sql` once per iteration via regex (`REPORT_MONTH_PATTERN`). If the SQL's `tt_params` shape changes, update the regex.
- `scripts/generate_data/generate.py` — `PERSONA_MIX` dictates the customer distribution; each persona has matching logic in `created_date_for`, `schedule_consumable_months`, and `PERSONA_KNOBS`. All three must stay consistent.
- `app/streamlit_app.py` — the dashboard reads `crm.db` read-only. Connection cached via `@st.cache_resource`; query results via `@st.cache_data`. The `_con` underscore prefix on cached functions tells Streamlit not to hash the connection.

---

## Coding Conventions

- **Generic terminology only.** Never reintroduce `refill`, `grammage`, or any client/brand name. Product category enum: `device | consumable | accessories | spare_parts`.
- **The doc leads, the code follows.** When KPI rules change, update `docs/crm_calculation_logic.md` first, then `db/run_crm_calculation.sql`, then anything downstream. Don't silently diverge.
- **Don't add print/logging noise to the SQL pipeline.** The SQL is meant to be readable end-to-end.
- **Keep the generator deterministic.** RNG seed is `42` everywhere. Don't add un-seeded randomness; if you need a new RNG-consuming step, slot it in such that it doesn't perturb the order of existing calls (or accept that thresholds will need re-calibrating and update them in the same PR).
- **Threshold calibration is an empirical step, not a design choice.** When you change the persona mix or qty/unit ranges, run `python scripts/generate_data/verify.py` and re-tune `T_high / T_mid_high / T_mid / A_high / F_high / F_mid` in `db/run_crm_calculation.sql` so every tier is non-empty and Diamond stays a small elite.
- **Calendar-month windows.** All time logic in the SQL uses `date(x, 'start of month', '-N month')` with N = months_back - 1 (so `M6 = '-5 month'`, not `'-6 month'`). Don't introduce day-level windows.
- **The snapshot must always include every eligible customer**, even those with zero consumable purchases (they collapse to `Not Active` with `value_tier = NULL` and `tenure_months = NULL`). Anonymous customers (`customer_group = 'general'`, case-insensitive) are excluded.

---

## How to Run

```bash
pip install -r scripts/generate_data/requirements.txt -r app/requirements.txt
python scripts/generate_data/generate.py     # 5,000 customers, ~138K transactions
python db/build.py                            # 12-month snapshot in ~10s
python scripts/generate_data/verify.py        # optional: print distribution
streamlit run app/streamlit_app.py
```

Build options: `python db/build.py --db <path> --months <N> --latest YYYY-MM-DD`.

---

## Important Rules for Claude

- **Always read `docs/crm_calculation_logic.md` before changing any KPI rule** in the SQL or the dashboard.
- **Never commit generated artifacts** (`data/input/*.csv`, `data/input/crm.db`). They are gitignored — keep it that way.
- **Don't drop or rewrite `data/input/data_sample.db`** (a 47 MB legacy SQLite file tracked from before this project) without explicit user approval. It predates the current pipeline.
- **No vendor names, no real-client framing, no `refill`/`grammage` terminology** — the showcase must read as a generic CRM analytics demo.
- **Re-run the verify script after any change to the generator or the SQL** to confirm every value tier and lifecycle event remains non-empty.
- Commit messages: descriptive subject + a short body explaining the **why**. No emojis, no Co-Authored-By lines.
