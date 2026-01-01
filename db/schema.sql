-- schema.sql
-- SQLite schema for CRM project: raw (landing) tables only.
-- Notes:
-- - We keep input structure as-is (no source_system / load_dttm fields).
-- - invoice_id is NOT a PK, so we use a surrogate key (txn_id) for raw_sales_transactions.
-- - Date fields are stored as TEXT in ISO format: 'YYYY-MM-DD'.

PRAGMA foreign_keys = ON;

BEGIN;

-- =========================
-- RAW: Sales Transactions
-- =========================
CREATE TABLE IF NOT EXISTS raw_sales_transactions (
    txn_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id   TEXT,
    customer_id  TEXT NOT NULL,
    invoice_date TEXT NOT NULL,          -- ISO: YYYY-MM-DD
    product_id   TEXT NOT NULL,
    quantity     REAL NOT NULL,
    revenue      REAL NOT NULL,
    store_id     TEXT,

    CHECK (invoice_date GLOB '????-??-??')
);

-- Helpful indexes for joins/filtering
CREATE INDEX IF NOT EXISTS ix_raw_sales_customer_id
    ON raw_sales_transactions(customer_id);

CREATE INDEX IF NOT EXISTS ix_raw_sales_product_id
    ON raw_sales_transactions(product_id);

CREATE INDEX IF NOT EXISTS ix_raw_sales_invoice_date
    ON raw_sales_transactions(invoice_date);

CREATE INDEX IF NOT EXISTS ix_raw_sales_invoice_id
    ON raw_sales_transactions(invoice_id);


-- =========================
-- RAW: Customers Master
-- =========================
CREATE TABLE IF NOT EXISTS raw_customers (
    customer_id    TEXT PRIMARY KEY,
    customer_name  TEXT,
    customer_group TEXT,
    city           TEXT,
    created_date   TEXT,                 -- ISO: YYYY-MM-DD (nullable if unknown)
    email          TEXT,                 -- nullable
    mobile_number  TEXT,                 -- nullable (keep as TEXT)
    opt_email      INTEGER,              -- nullable, expected 0/1
    opt_sms        INTEGER,              -- nullable, expected 0/1
    opt_phone      INTEGER,              -- nullable, expected 0/1

    CHECK (created_date IS NULL OR created_date GLOB '????-??-??'),
    CHECK (opt_email IS NULL OR opt_email IN (0, 1)),
    CHECK (opt_sms   IS NULL OR opt_sms   IN (0, 1)),
    CHECK (opt_phone IS NULL OR opt_phone IN (0, 1))
);

CREATE INDEX IF NOT EXISTS ix_raw_customers_group
    ON raw_customers(customer_group);

CREATE INDEX IF NOT EXISTS ix_raw_customers_city
    ON raw_customers(city);


-- =========================
-- RAW: Products (Items) Master
-- =========================
CREATE TABLE IF NOT EXISTS raw_products (
    product_id   TEXT PRIMARY KEY,
    product_name TEXT,
    brand        TEXT,
    category     TEXT,
    grammage_g   REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_raw_products_category
    ON raw_products(category);

CREATE INDEX IF NOT EXISTS ix_raw_products_brand
    ON raw_products(brand);

COMMIT;
