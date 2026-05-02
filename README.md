# CRM Analytics System

## Overview

This repository contains a **CRM analytics system** designed to transform raw transactional data into structured, refreshable CRM outputs used for customer analysis, segmentation, and reporting.

The focus of this project is **system design and analytics logic**, not dashboards or one-off analysis. The repository demonstrates how CRM analytics can be implemented in a structured, production-oriented way using clear data layers, deterministic rules, and reproducible refresh logic.

All data used in this repository is synthetic.

---

## Scope of the Repository

This repository covers:

* ingestion and structuring of raw CRM data
* implementation of CRM analytics logic
* generation of analytics-ready outputs for a Streamlit + Plotly dashboard and CSV / Excel exports

Detailed business rules, thresholds, and segmentation logic are intentionally documented **outside of this README** and maintained in a dedicated business logic document.

---

## Data Model (High Level)

The system operates on three core datasets:

* **Transactions**: sales records containing customer identifiers, dates, products, and values
* **Customer master**: latest snapshot of customer attributes and identifiers
* **Product master**: product definitions and classifications

Raw data is stored in its original structure and transformed through controlled analytics layers.

Input files data model: `/docs/source_files_specifications.md`.

---

## Design Requirements

The system is designed with the following requirements in mind:

* refreshable analytics based on new transactional data
* clear separation between raw data and analytics logic
* deterministic, explainable segmentation rules
* time-aware customer analysis
* compatibility with downstream reporting tools

Project requirements: `/docs/project_requirements.md`.


---

## Core Analytics Concepts (Summary)

* **Consumables drive CRM**
  Customer engagement is measured using recurring **consumable** products. Device, accessory, and spare-part purchases are excluded from engagement metrics. The only device-based KPI is the First Device Purchase Date.

* **Three independent customer outputs per month**
  Each customer is assigned an **Activity Status** (Active / Not Active), a **Value Tier** (Passive override, then Diamond / Platinum / Gold / Silver / Bronze) and an optional **Monthly Lifecycle Event** (New / Lost / Reactivated).

* **RFMT-based value tiering**
  Diamond and Platinum exercise Recency, Frequency and Monetary (volume) jointly via thresholds on AMC (Average Monthly Consumption), AOS (Average Order Size) and O6 (orders in last 6 months). Tenure is captured as `tenure_months` for cohort and loyalty analysis.

Calculation / Segmentation full details: `/docs/crm_calculation_logic.md`.

---

## Methodological Background

The analytics approach implemented in this system is inspired by established CRM and customer analytics practices widely used in FMCG and retail organizations.

RFM/RFMT-based segmentation is a well-known, empirically validated methodology used in direct marketing, loyalty programs, and customer value analysis, providing a transparent and business-interpretable alternative to black-box models.

More about RFM on [Wikipedia](https://en.wikipedia.org/wiki/RFM_(market_research))

---

## Outputs

The system produces:

* a customer × report-month CRM snapshot table (activity status, value tier, lifecycle event, RFMT features)
* derived per-customer KPIs (`tenure_months`, AMC, AOS, first/last consumable purchase dates, first device purchase date)
* a Streamlit + Plotly dashboard for slicing and exporting the snapshot
* CSV / Excel exports for ad-hoc business use

Outputs are designed to support both operational reporting and strategic CRM analysis.

---

## How to Run (High Level)

1. Generate or place the raw customer, product, and transaction CSVs in `data/input/`.
2. Build the SQLite database from `db/schema.sql` and load the CSVs.
3. Run `db/run_crm_calculation.sql` to materialize the CRM snapshot table.
4. Launch the Streamlit dashboard to explore segments, lifecycle events, and KPIs.

A one-shot helper script will be added once the data generator and dashboard are in place.

---

## Limitations

* The repository uses synthetic data only.
* Predictive modeling is intentionally out of scope.
* Master data is treated as point-in-time snapshots.

---

## Potential Extensions

* churn and reactivation modeling
* customer lifetime value forecasting
* promotion and uplift analysis
* near-real-time refresh orchestration

---

## License

This project is provided under the **MIT License** and is intended as a reference implementation of a CRM analytics system.
