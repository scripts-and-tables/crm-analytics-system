-- run_crm_calculation.sql
-- Builds the canonical CRM customer snapshot for a single report month, per
-- docs/crm_calculation_logic.md. Output: table `crm_customer_snapshot`.
--
-- Pipeline (top to bottom):
--   tt_params              parameter row(s): report month, tier thresholds, anonymous-group marker
--   tt_dates               start-of-month boundaries for the M1/M6/M12/M13/M24/M25 windows
--   tt_first_device_date   first `device` purchase date per customer
--   tt_consumable_lines    per-customer × per-month-bom consumption aggregates over consumable lines
--   tt_base_aggregates     per-customer M_total, M1, M6, M12, M13, M24, M25, O6, first/last consumable dates
--   crm_customer_snapshot  final output: identifiers, base aggregates, derived KPIs, status fields
--
-- Window convention (calendar months, inclusive of report month):
--   M1  = report month                                  →  start = report_month_bom + 0  months
--   M6  = report month and 5 prior calendar months      →  start = report_month_bom - 5  months
--   M12 = report month and 11 prior calendar months     →  start = report_month_bom - 11 months
--   M13 = report month and 12 prior calendar months     →  start = report_month_bom - 12 months
--   M24 = report month and 23 prior calendar months     →  start = report_month_bom - 23 months
--   M25 = report month and 24 prior calendar months     →  start = report_month_bom - 24 months
--
-- Filters applied throughout:
--   * only `category = 'consumable'` rows for all M-aggregates and O6 (the First Device Purchase Date is the sole device-based KPI).
--   * only positive `quantity` (returns excluded, per §6.3).
--   * customers whose `customer_group` matches the anonymous marker are excluded from the snapshot (per §6.4).
--
-- Tier thresholds are placeholders pending calibration on synthetic data.

PRAGMA foreign_keys = ON;

BEGIN;

-- =============================================================
-- 1. PARAMETERS
-- =============================================================
DROP TABLE IF EXISTS tt_params;
CREATE TEMP TABLE tt_params AS
SELECT
    -- Report month-end. Override for historical re-runs.
    '2024-12-31'  AS report_mth_eom,

    -- Anonymous / general customer-group marker (case-insensitive equality).
    'general'     AS anonymous_group,

    -- Value Tier thresholds (placeholders, see docs §5.2).
    -- Units / month thresholds on Average Monthly Consumption (AMC = M6/6).
    100.0         AS t_high,        -- Diamond / Platinum AMC floor
     50.0         AS t_mid_high,    -- Gold AMC floor
     20.0         AS t_mid,         -- Silver AMC floor

    -- Average Order Size threshold (Diamond only).
     20.0         AS a_high,

    -- Frequency gates: number of consumable orders in last 6 months.
        6         AS f_high,        -- Diamond
        3         AS f_mid;         -- Platinum


-- =============================================================
-- 2. DATE WINDOWS
-- =============================================================
DROP TABLE IF EXISTS tt_dates;
CREATE TEMP TABLE tt_dates AS
SELECT
    report_mth_eom,
    date(report_mth_eom, 'start of month')                 AS report_mth_bom,
    date(report_mth_eom, 'start of month',  '-0  month')   AS m01_bom,
    date(report_mth_eom, 'start of month',  '-5  month')   AS m06_bom,
    date(report_mth_eom, 'start of month', '-11  month')   AS m12_bom,
    date(report_mth_eom, 'start of month', '-12  month')   AS m13_bom,
    date(report_mth_eom, 'start of month', '-23  month')   AS m24_bom,
    date(report_mth_eom, 'start of month', '-24  month')   AS m25_bom
FROM tt_params;


-- =============================================================
-- 3. FIRST DEVICE PURCHASE DATE (per customer)
--    The only KPI sourced from `device` transactions.
-- =============================================================
DROP TABLE IF EXISTS tt_first_device_date;
CREATE TEMP TABLE tt_first_device_date AS
SELECT
    s.customer_id,
    MIN(s.invoice_date) AS first_device_purchase_date
FROM raw_sales_transactions s
JOIN raw_products          p ON p.product_id = s.product_id
WHERE p.category = 'device'
  AND s.quantity > 0
GROUP BY s.customer_id;


-- =============================================================
-- 4. CONSUMABLE LINES → MONTHLY ROLL-UP (per customer × month-of-purchase)
--    Pre-aggregation step that the time-window aggregates feed off.
--    "units" = quantity * unit_size (volume measure on the consumable).
-- =============================================================
DROP TABLE IF EXISTS tt_consumable_lines;
CREATE TEMP TABLE tt_consumable_lines AS
SELECT
    s.customer_id,
    date(s.invoice_date, 'start of month') AS purchase_mth_bom,
    s.invoice_date,
    s.invoice_id,
    s.quantity * p.unit_size               AS units
FROM raw_sales_transactions s
JOIN raw_products          p ON p.product_id = s.product_id
WHERE p.category  = 'consumable'
  AND s.quantity  > 0;


-- =============================================================
-- 5. BASE AGGREGATES (per customer)
--    The canonical M-fields, O6, and first/last consumable dates.
-- =============================================================
DROP TABLE IF EXISTS tt_base_aggregates;
CREATE TEMP TABLE tt_base_aggregates AS
SELECT
    cl.customer_id,
    d.report_mth_eom,

    -- Date KPIs
    MIN(cl.invoice_date)                                                       AS first_consumable_purchase_date,
    MAX(cl.invoice_date)                                                       AS last_consumable_purchase_date,

    -- Volume aggregates (units): cumulative windows ending at the report month
    TOTAL(cl.units)                                                            AS m_total,
    TOTAL(CASE WHEN cl.purchase_mth_bom >= d.m01_bom THEN cl.units ELSE 0 END) AS m1,
    TOTAL(CASE WHEN cl.purchase_mth_bom >= d.m06_bom THEN cl.units ELSE 0 END) AS m6,
    TOTAL(CASE WHEN cl.purchase_mth_bom >= d.m12_bom THEN cl.units ELSE 0 END) AS m12,
    TOTAL(CASE WHEN cl.purchase_mth_bom >= d.m13_bom THEN cl.units ELSE 0 END) AS m13,
    TOTAL(CASE WHEN cl.purchase_mth_bom >= d.m24_bom THEN cl.units ELSE 0 END) AS m24,
    TOTAL(CASE WHEN cl.purchase_mth_bom >= d.m25_bom THEN cl.units ELSE 0 END) AS m25,

    -- Order count in last 6 months (distinct invoices on consumable, positive lines)
    COUNT(DISTINCT CASE WHEN cl.purchase_mth_bom >= d.m06_bom THEN cl.invoice_id END) AS o6
FROM tt_consumable_lines cl
CROSS JOIN tt_dates d
GROUP BY cl.customer_id, d.report_mth_eom;


-- =============================================================
-- 6. FINAL SNAPSHOT (per customer × report month)
--    Includes every non-anonymous customer in the master, even those with
--    zero consumable purchases (they collapse to Not Active with NULL tier).
-- =============================================================
DROP TABLE IF EXISTS crm_customer_snapshot;
CREATE TABLE crm_customer_snapshot AS
WITH eligible_customers AS (
    SELECT c.customer_id
    FROM raw_customers c, tt_params p
    WHERE LOWER(COALESCE(c.customer_group, '')) <> p.anonymous_group
),
joined AS (
    SELECT
        d.report_mth_eom,
        ec.customer_id,
        fd.first_device_purchase_date,
        COALESCE(ba.first_consumable_purchase_date, NULL) AS first_consumable_purchase_date,
        COALESCE(ba.last_consumable_purchase_date,  NULL) AS last_consumable_purchase_date,
        COALESCE(ba.m_total, 0) AS m_total,
        COALESCE(ba.m1,      0) AS m1,
        COALESCE(ba.m6,      0) AS m6,
        COALESCE(ba.m12,     0) AS m12,
        COALESCE(ba.m13,     0) AS m13,
        COALESCE(ba.m24,     0) AS m24,
        COALESCE(ba.m25,     0) AS m25,
        COALESCE(ba.o6,      0) AS o6
    FROM eligible_customers ec
    CROSS JOIN tt_dates d
    LEFT JOIN tt_first_device_date fd ON fd.customer_id = ec.customer_id
    LEFT JOIN tt_base_aggregates   ba ON ba.customer_id = ec.customer_id
                                     AND ba.report_mth_eom = d.report_mth_eom
)
SELECT
    j.report_mth_eom,
    j.customer_id,

    -- Date KPIs
    j.first_device_purchase_date,
    j.first_consumable_purchase_date,
    j.last_consumable_purchase_date,

    -- Tenure months: inclusive of first purchase month, NULL if never purchased a consumable.
    CASE
        WHEN j.first_consumable_purchase_date IS NULL THEN NULL
        ELSE (CAST(strftime('%Y', j.report_mth_eom)                      AS INTEGER)
             - CAST(strftime('%Y', j.first_consumable_purchase_date)     AS INTEGER)) * 12
           + (CAST(strftime('%m', j.report_mth_eom)                      AS INTEGER)
             - CAST(strftime('%m', j.first_consumable_purchase_date)     AS INTEGER))
           + 1
    END AS tenure_months,

    -- Base aggregates
    j.m_total, j.m1, j.m6, j.m12, j.m13, j.m24, j.m25, j.o6,

    -- Derived ratios
    j.m6 / 6.0                                          AS avg_monthly_consumption,
    CASE WHEN j.o6 = 0 THEN NULL ELSE j.m6 / j.o6 END   AS avg_order_size,

    -- Activity status
    CASE WHEN j.m12 > 0 THEN 'Active' ELSE 'Not Active' END AS activity_status,

    -- Value tier (Active customers only; top-down precedence with Passive override)
    CASE
        WHEN j.m12 = 0                                                             THEN NULL
        WHEN j.m6  = 0                                                             THEN 'Passive'
        WHEN (j.m6 / 6.0) >= p.t_high
             AND j.o6 > 0
             AND (j.m6 / j.o6) >= p.a_high
             AND j.o6           >= p.f_high                                        THEN 'Diamond'
        WHEN (j.m6 / 6.0) >= p.t_high     AND j.o6 >= p.f_mid                      THEN 'Platinum'
        WHEN (j.m6 / 6.0) >= p.t_mid_high                                          THEN 'Gold'
        WHEN (j.m6 / 6.0) >= p.t_mid                                               THEN 'Silver'
        WHEN (j.m6 / 6.0) >  0                                                     THEN 'Bronze'
        ELSE NULL
    END AS value_tier,

    -- Monthly lifecycle event (mutually exclusive; only one assigned per customer per month).
    --   New         : first-ever consumable purchase happened this month.
    --   Lost        : last consumable purchase fell out of the 12-month window this month.
    --   Reactivated : returning customer after a stretch of >=12 consecutive inactive months.
    -- Note: the M1 > 0 guards prevent a never-purchased customer (M_total = M1 = 0) from being flagged.
    CASE
        WHEN j.m1 > 0 AND j.m1 = j.m_total                          THEN 'New'
        WHEN j.m12 = 0 AND j.m13 > 0                                THEN 'Lost'
        WHEN j.m1 > 0 AND j.m1 = j.m13 AND j.m_total > j.m13        THEN 'Reactivated'
        ELSE NULL
    END AS lifecycle_event
FROM joined j
CROSS JOIN tt_params p;


-- Helpful indexes for downstream dashboard queries.
CREATE INDEX IF NOT EXISTS ix_crm_snapshot_month    ON crm_customer_snapshot(report_mth_eom);
CREATE INDEX IF NOT EXISTS ix_crm_snapshot_customer ON crm_customer_snapshot(customer_id);
CREATE INDEX IF NOT EXISTS ix_crm_snapshot_tier     ON crm_customer_snapshot(value_tier);
CREATE INDEX IF NOT EXISTS ix_crm_snapshot_event    ON crm_customer_snapshot(lifecycle_event);

COMMIT;
