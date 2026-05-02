# CRM Analytics – Business Logic (CRM Layer)

## 1. Purpose

This document defines the **CRM-specific analytical logic** used to evaluate each customer's status, value tier and lifecycle events based on their **consumable purchase behavior**.

The scope is intentionally limited to **CRM logic only**. Topics such as data ingestion, storage, data modeling, dashboards and reporting are documented separately.

---

## 2. Product Taxonomy

The product master groups items into the following categories:

| Category       | Description                                                                                |
|----------------|--------------------------------------------------------------------------------------------|
| `device`       | Durable main item; typically purchased once. Triggers entry into the customer base.        |
| `consumable`   | Recurring-purchase product attached to the device. **Primary input to all CRM KPIs.**      |
| `accessories`  | Optional add-on items.                                                                     |
| `spare_parts`  | Replacement parts for the device.                                                          |

**Rule of scope.** All CRM KPIs are computed from `consumable` transactions only, with one exception: the **First Device Purchase Date** KPI is computed from `device` transactions (Section 4.2).

---

## 3. Analytical Model Overview (RFMT)

Customer evaluation is based on four behavioral dimensions:

* **Recency** – how recently the customer purchased a consumable
* **Frequency** – how often the customer purchased consumables
* **Monetary** – how much volume (units) the customer generated from consumables
* **Tenure** – how long the customer has been purchasing consumables

In this document RFMT is treated strictly as the **input framework**; the operational outputs are an Activity Status, a Value Tier (with the Passive override) and a Monthly Lifecycle Event, all defined in Section 5.

---

## 4. Reporting Cadence and Conventions

### 4.1 Calendar-month snapshot

The CRM layer produces one snapshot **per calendar month**, computed at **month-end**.

* When the report is generated for a month *M*, the evaluation date is the last day of *M*.
* The "last 12 months" window for a report on **April 2026** is **May 2025 → April 2026** (12 full calendar months).
* Partial months and day-level windows are intentionally not used — this keeps month-over-month comparisons stable.

### 4.2 Per-customer base aggregates (the M-fields)

For every customer and every report month the system precomputes the following base aggregates over **consumable transactions only** (positive units only — see Section 6.3):

| Field          | Definition                                                                          |
|----------------|-------------------------------------------------------------------------------------|
| `M_total`      | Total consumable units purchased ever, across the customer's full history.          |
| `M1`           | Consumable units purchased in the **last 1 calendar month** (the report month).     |
| `M6`           | Consumable units purchased in the **last 6 calendar months**.                       |
| `M12`          | Consumable units purchased in the **last 12 calendar months**.                      |
| `M13`          | Consumable units purchased in the **last 13 calendar months**.                      |
| `M24`          | Consumable units purchased in the **last 24 calendar months**.                      |
| `M25`          | Consumable units purchased in the **last 25 calendar months**.                      |
| `O6`           | Number of consumable **orders** (invoices) in the last 6 calendar months.           |

The `M*` fields are deliberately overlapping (each is a cumulative window ending at the report month). They are the only intermediate signals required: every Activity Status, Value Tier, and Lifecycle Event below is derived from them by simple comparisons.

> **Why M13 and M25?** They are not redundant with M12 and M24: the difference `M13 − M12` tells us whether the customer made a purchase exactly **13 months ago**, which is what we need to detect a fresh transition into the *Not Active* state. Same idea for M25.

### 4.3 Derived per-customer KPIs

| KPI                                | Formula                                                | Notes                                       |
|------------------------------------|--------------------------------------------------------|---------------------------------------------|
| **First Device Purchase Date**     | `MIN(invoice_date)` over `device` transactions         | Entry into the customer base.               |
| **First Consumable Purchase Date** | `MIN(invoice_date)` over `consumable` transactions     | Start of consumable lifecycle.              |
| **Last Consumable Purchase Date**  | `MAX(invoice_date)` over `consumable` transactions     | Most recent recurring engagement.           |
| **Tenure Months**                  | calendar months between `first_consumable_purchase_date` and `report_month_end`, **inclusive of the first purchase month** (NULL if customer has never purchased a consumable) | How long the customer has been a consumable buyer. Loyalty / cohort axis. |
| **Average Monthly Consumption (AMC)** | `M6 / 6`                                            | Unit volume per month, smoothed over 6 mo.  |
| **Average Order Size (AOS)**       | `M6 / O6` (NULL if `O6 = 0`)                           | Average units per consumable order, last 6 mo. |

**Tenure Months convention.** The first purchase month counts as month 1. Worked examples for a report month-end of April 2026:

| `first_consumable_purchase_date` | `tenure_months` |
|----------------------------------|-----------------|
| April 2026                       | 1               |
| March 2026                       | 2               |
| April 2025                       | 13              |
| January 2024                     | 28              |
| (never purchased a consumable)   | NULL            |

Equivalent formula:

```
tenure_months = (YEAR(report_month_end) - YEAR(first_consumable_purchase_date)) * 12
              + (MONTH(report_month_end) - MONTH(first_consumable_purchase_date))
              + 1
```

NULL — not 0 — is used for customers with no consumable purchases, so that "first month of purchase" (`= 1`) and "never purchased" (`= NULL`) are unambiguously distinguishable.

---

## 5. Customer Outputs (per report month)

The CRM layer assigns three complementary outputs to every eligible customer in every report month:

1. **Activity Status** — Active vs Not Active (Section 5.1)
2. **Value Tier** — Passive, or one of the volume tiers (Section 5.2). Defined only for Active customers.
3. **Monthly Lifecycle Event** — New / Lost / Reactivated, or none (Section 5.3)

These are independent fields and can be combined freely in reporting.

### 5.1 Activity Status

Derived directly from `M12`:

| Status        | Rule         | Meaning                                                       |
|---------------|--------------|---------------------------------------------------------------|
| **Active**    | `M12 > 0`    | At least one consumable purchase in the last 12 calendar months. |
| **Not Active**| `M12 = 0`    | No consumable purchases in the last 12 calendar months.       |

### 5.2 Value Tier (defined for Active customers only)

The Value Tier is evaluated **top-down with first-match precedence** — once a row matches, all later rules are ignored. The first rule (Passive) overrides everything else.

> **Tier names.** The names below (Diamond / Platinum / Gold / Silver / Bronze, plus Passive) are an initial proposal — they have a clear hierarchical reading. The thresholds on AMC and AOS are placeholders; final values will be calibrated against the synthetic dataset.

| Order | Tier         | Rule                                                                          | Intent                                          |
|-------|--------------|-------------------------------------------------------------------------------|-------------------------------------------------|
| 1     | **Passive**  | `M6 = 0`                                                                      | Active in 12-month window but **silent for 6+ months**. Override — applied before any volume tier. |
| 2     | **Diamond**  | `AMC ≥ T_high` **AND** `AOS ≥ A_high` **AND** `O6 ≥ F_high`                   | Top: high recurring volume, large baskets **and** consistent order frequency. |
| 3     | **Platinum** | `AMC ≥ T_high` **AND** `O6 ≥ F_mid`                                           | High recurring volume sustained across multiple orders. |
| 4     | **Gold**     | `AMC ≥ T_mid_high`                                                            | Solid recurring buyer.                           |
| 5     | **Silver**   | `AMC ≥ T_mid`                                                                 | Moderate recurring buyer.                        |
| 6     | **Bronze**   | `AMC > 0`                                                                     | Any recurring activity in the last 6 months.     |

Threshold variables (`T_high`, `T_mid_high`, `T_mid`, `A_high`, `F_high`, `F_mid`) are defined in a separate calibration table once the synthetic data is in place.

> **Why a frequency gate on the top two tiers?** Without `O6 ≥ F_*`, a customer who placed a single very large order in the last 6 months could land in Diamond/Platinum on volume alone. The frequency gate ensures that the top tiers reward **sustained engagement**, not one-off volume spikes — completing the RFMT picture (Diamond/Platinum exercise R, F and M; Gold/Silver/Bronze exercise M only and are differentiated purely by volume).

> **Important.** Because rule 1 (Passive) supersedes everything else, the Diamond → Bronze hierarchy is meaningful only for customers with at least one consumable purchase in the last 6 calendar months.

### 5.3 Monthly Lifecycle Event

The Monthly Lifecycle Event captures what changed **during the report month**. It is optional — if no event applies, the field is left blank. Only one event can be assigned per customer per month; the rules are mutually exclusive by construction.

| Event           | Rule                                                              | Reading                                                                 |
|-----------------|-------------------------------------------------------------------|-------------------------------------------------------------------------|
| **New**         | `M1 = M_total`                                                    | All of the customer's consumable history is in this single month → **first-ever** consumable purchase happened this month. |
| **Lost**        | `M12 = 0` **AND** `M13 > 0`                                       | The customer's last consumable purchase fell **exactly out of the 12-month window** this month — this is the first month they are recognized as Not Active. |
| **Reactivated** | `M1 = M13` **AND** `M_total > M13`                                | Everything in the last 13 months happened this month (i.e. zero purchases in months 2–13), **and** the customer purchased earlier than 13 months ago — they were Not Active and just came back. |

Notes on the formulas:

* `M1 = M_total` for **New** captures that the customer has no history outside this month.
* For **Lost**, we compare the cumulative 12- and 13-month windows: `M13 − M12 > 0` would be an equivalent way to say "the customer purchased in the 13th month back". Using `M12 = 0` ensures we only flag the *first* month they fail the activity test.
* For **Reactivated**, the condition `M1 = M13` is equivalent to "no purchases in months 2 through 13", so the customer had been Not Active in the previous month. The extra condition `M_total > M13` excludes truly-new customers (who are caught by **New** instead).

---

## 6. Evaluation Rules and Edge Conditions

### 6.1 Top-down precedence

Customer evaluation follows **top-down precedence** within each output (Activity Status, Value Tier, Lifecycle Event). Statuses are checked sequentially and the **first matching rule is applied** — once a condition is satisfied, all subsequent (lower-priority) rules are ignored. This guarantees deterministic, unambiguous classification.

### 6.2 Calendar-month evaluation

All windows are full calendar months (Section 4.1). No rolling day-level windows.

### 6.3 Negative transactions (returns)

Transaction history may contain negative-quantity transactions representing returns or refunds.

* Only transactions with **positive consumable quantity / units** are included in any CRM aggregate.
* Negative consumable transactions (returns) are excluded.
* Original positive purchases are retained even if a corresponding return exists in another month.

CRM evaluation is performed **as if returns never occurred**. This may introduce a small inaccuracy (a customer counted as active despite a later return) but is considered acceptable given the analytical scope.

### 6.4 General / Anonymous customers

The customer master may contain customers of type **General** (or equivalent) — walk-ins, tourists, customers without identifiable contact details. Such customers:

* are included in raw transactional data,
* are **excluded** from all CRM analysis, segmentation and lifecycle tracking.

### 6.5 Measurement unit (units / volume)

All consumable purchase metrics are measured in **units** (the volume / pack-size measure recorded on the product master), not in monetary value.

* Each consumable product carries a `unit_size` value in the product master.
* Transaction-level units = `quantity × unit_size`.
* Aggregated metrics (`M*`, AMC, AOS) are sums of units across consumable transactions.

This makes engagement independent of pricing, discounts and promotions, and accounts for differences in pack size across consumable SKUs.

---

## 7. Summary of CRM output schema

For each customer × report month, the CRM layer emits:

* **Identifiers**: `customer_id`, `report_month`
* **Base aggregates**: `M_total`, `M1`, `M6`, `M12`, `M13`, `M24`, `M25`, `O6`
* **Derived KPIs**: `first_device_purchase_date`, `first_consumable_purchase_date`, `last_consumable_purchase_date`, `tenure_months`, `avg_monthly_consumption`, `avg_order_size`
* **Status fields**: `activity_status`, `value_tier`, `lifecycle_event`

This is the canonical output that downstream reporting (Streamlit dashboard, exports) consumes.
