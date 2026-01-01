# CRM Analytics – Business Logic (CRM Layer)

## 1. Purpose

This document defines the **CRM-specific analytical logic** used to evaluate customer status and engagement based on refill purchase behavior.

The scope of this document is intentionally limited to **CRM logic only**. Topics such as data ingestion, storage, data modeling, and reporting are documented separately.

---

## 2. Analytical Model Overview (RFMT)

Customer evaluation in this CRM system is based on four fundamental behavioral dimensions:

* **Recency** – how recently a customer purchased a refill
* **Frequency** – how often a customer purchased refills
* **Monetary** – how much value the customer generated from refills
* **Tenure** – how long the customer has been purchasing refills

This RFMT-based approach is a well-established and widely used methodology in CRM and customer analytics, particularly in FMCG and retail environments.

A detailed explanation of the scientific background, empirical justification, and practical considerations of the RFMT model is provided in a **separate methodological document**.

In this document, RFMT is treated strictly as an **input framework** for customer status evaluation.

---

## 3. Customer Evaluation and Status Classification

Customer evaluation is performed **at month-end** and is derived exclusively from **refill purchase history**.

Only refill purchases are considered. Device and accessory purchases are excluded from all CRM calculations.

The CRM layer assigns three complementary outputs for each customer and evaluation month:

1. **Activity status** (active vs not active)
2. **Segment** (business-facing customer group)
3. **Current month event** (what changed during the month)

These outputs are designed to be consumed independently (for reporting) and jointly (for lifecycle tracking).

---

### 3.1 Activity Status

* **Active**: the customer made at least one refill purchase within the **last 12 months** relative to the evaluation month.
* **Not Active**: the customer made **no** refill purchases within the last 12 months.

---

### 3.2 Segment

Segment is the primary business-facing classification. It is derived from refill purchase history and customer behavior.

Segments include:

* **New**: customer’s first-ever refill purchase date is within the last 12 months.
* **Lost**: customer made refill purchases historically, but made **no** refill purchases within the last 12 months.
* **Pre-Lost**: customer made refill purchases historically, but made **no** refill purchases within the **last 6 months** (while still within the 12‑month activity window).
* **Ultra**: average refill consumption ≥ **800 g per month** over the **last 6 months**, and **at least 6 refill transactions** in the last 6 months.
* **Heavy**: average refill consumption ≥ **600 g per month** over the **last 6 months**, and **at least 3 refill transactions** in the last 6 months.
* **Large**: average refill consumption ≥ **250 g per month** over the **last 6 months**.
* **Average**: average refill consumption ≥ **175 g per month** over the **last 6 months**.
* **Low**: average refill consumption ≥ **100 g per month** over the **last 6 months**.
* **Minimal**: average refill consumption < **100 g per month** over the **last 6 months**.

---

### 3.3 Current Month Event

Current Month Event captures notable lifecycle events that occur **during the evaluation month**. This field is optional and may be blank.

Supported event values:

* **New**: the customer completed their **first-ever refill purchase** during the evaluation month.
* **Lost**: the customer is classified as Lost in the evaluation month, and was **not** Lost in the immediately preceding month (first month recognized as lost).
* **Reactivated**: the customer was Lost in the immediately preceding month and made at least one refill purchase during the evaluation month.

If none of the above events occur, the field remains blank.

---

## 4. Suggested CRM Calculation Fields

To generate a CRM snapshot for a given evaluation month, the system is expected to calculate the following fields **for each customer**.

These fields represent the minimal, canonical feature set required to support activity status, segmentation, and lifecycle tracking.

### 4.1 Status & Classification Fields

* **Activity Status** (Active / Not Active)
* **Segment** (New, Lost, Pre-Lost, Ultra, Heavy, Large, Average, Low, Minimal)
* **Current Month Event** (New, Lost, Reactivated, or NULL)

---

### 4.2 Key Refill Purchase Dates

* **First Refill Purchase Date**
* **Last Refill Purchase Date**

Dates are derived exclusively from positive refill transactions.

---

### 4.3 Consumption & Engagement Metrics

All metrics below are calculated using **grammage**, as defined in the items / product master.

* **Total Refill Consumption (6M)** – total grammage purchased in the last 6 calendar months
* **Total Refill Consumption (12M)** – total grammage purchased in the last 12 calendar months
* **Number of Refill Transactions (6M)** – count of refill purchase invoices in the last 6 calendar months

These metrics serve as inputs for segmentation logic and downstream CRM analytics.

---

## 5. Evaluation Rules and Edge Conditions

The following limitations, assumptions, and exceptions apply to the current CRM logic:

### 5.1 Evaluation Order and Precedence

Customer evaluation follows a **top-down precedence order**.

Statuses and segments are checked **sequentially**, and the **first matching condition is applied**. Once a condition is satisfied, all subsequent (lower-priority) conditions are ignored, even if they could also be met.

This guarantees deterministic and unambiguous classification.

---

### 5.2 Calendar Month Evaluation

All calculations are performed using **calendar months**, not rolling day-level windows.

* When evaluating activity in the **last 12 months** for a report month (e.g. December 2025), the system considers all refill purchases from **1 January 2025 through 31 December 2025**.
* Partial months or day-level precision are intentionally not used.

This approach simplifies reporting, improves stability of month-over-month comparisons, and aligns with standard CRM reporting practices.

---

### 5.3 Negative Transactions (Returns)

Transaction history may contain **negative-value transactions**, representing returns or refunds.

For the purposes of this CRM analysis:

* Only transactions with **positive refill quantity / grammage** are included in all calculations.
* Negative refill transactions (returns) are **excluded from analysis**.
* Positive refill purchases are always treated as valid, even if a return exists in a different month.

In other words, CRM evaluation is performed **as if returns never occurred**, while original positive purchases are retained.

This simplification may introduce limited inaccuracies (e.g. a customer counted as active despite having returned a refill), but is considered acceptable given the analytical scope and the need for deterministic, stable CRM logic.

---

### 5.4 General / Anonymous Customers

The customer master may contain customers of type **General** (or equivalent), representing:

* walk-in customers
* tourists
* customers without loyalty program registration or identifiable contact details

Such customers are:

* included in raw transactional data
* **excluded from all CRM analysis and segmentation**

CRM logic applies only to identifiable customers suitable for lifecycle and engagement analysis.

---

### 5.5 Measurement Unit (Grammage)

All refill purchase metrics are calculated using **grammage (volume/weight)** rather than monetary value.

* Each refill product has an associated **grammage value** defined in the **items / product master**.
* Transaction-level grammage is derived by multiplying the number of units sold by the product-specific grammage.
* Aggregated CRM metrics (e.g. consumption over 12 months) are calculated as the sum of grammage across refill transactions.

This approach ensures that customer engagement is measured based on **actual product consumption**, independent of pricing, discounts, or promotions, and accounts for differences in refill size across products.

---
