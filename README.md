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
* generation of analytics-ready outputs for reporting tools (Excel / Power BI)

Detailed business rules, thresholds, and segmentation logic are intentionally documented **outside of this README** and maintained in a dedicated business logic document.

---

## Data Model (High Level)

The system operates on three core datasets:

* **Transactions**: sales records containing customer identifiers, dates, products, and values
* **Customer master**: latest snapshot of customer attributes and identifiers
* **Product master**: product definitions and classifications

Raw data is stored in its original structure and transformed through controlled analytics layers.

---

## Design Requirements

The system is designed with the following requirements in mind:

* refreshable analytics based on new transactional data
* clear separation between raw data and analytics logic
* deterministic, explainable segmentation rules
* time-aware customer analysis
* compatibility with downstream reporting tools

---

## Core Analytics Concepts (Summary)

* **Core vs non-core products**
  Customer engagement is measured using recurring consumable products. One-off device or accessory purchases are excluded from engagement metrics.

* **Customer lifecycle segmentation**
  Customers are classified into lifecycle states (e.g. new, active, lost) based on purchase behavior over time.

* **RFMT-based value segmentation**
  Active customers are further segmented using Recency, Frequency, Monetary, and Tenure features.

Full definitions, thresholds, and examples are documented in `/docs/business_logic.md`.

---

## Methodological Background

The analytics approach implemented in this system is inspired by established CRM and customer analytics practices widely used in FMCG and retail organizations.

RFM/RFMT-based segmentation is a well-known, empirically validated methodology used in direct marketing, loyalty programs, and customer value analysis, providing a transparent and business-interpretable alternative to black-box models.

More about RFM on [Wikipedia](https://en.wikipedia.org/wiki/RFM_(market_research))

---

## Outputs

The system produces:

* customer-level CRM analytics tables
* lifecycle status indicators
* RFMT features and segments
* analytics-ready views for Excel and Power BI

Outputs are designed to support both operational reporting and strategic CRM analysis.

---

## How to Run (High Level)

1. Load raw customer, product, and transaction data.
2. Execute the analytics pipeline to generate CRM outputs.
3. Refresh analytics when new transactions are available.
4. Consume results in reporting tools.

Exact execution details can be adapted to different environments and are intentionally kept lightweight.

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
