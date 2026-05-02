"""
Smoke-test the synthetic dataset against the calculation SQL.

Loads the CSVs in data/input/ into an in-memory SQLite, runs
db/schema.sql and db/run_crm_calculation.sql, and prints the resulting
distribution of activity status, value tier and lifecycle event so a
reviewer can confirm the data exercises every CRM branch.

Run after generate.py:
    python scripts/generate_data/generate.py
    python scripts/generate_data/verify.py
"""

import csv
import glob
import sqlite3
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INPUT_DIR = REPO / "data" / "input"


def load_csv(con, table, csv_path, columns):
    with open(csv_path, newline="") as fh:
        rdr = csv.DictReader(fh)
        rows = []
        for r in rdr:
            row = []
            for col in columns:
                v = r.get(col, "")
                row.append(None if v == "" else v)
            rows.append(tuple(row))
    placeholders = ",".join("?" * len(columns))
    con.executemany(
        f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})",
        rows,
    )
    return len(rows)


def main():
    schema_sql = (REPO / "db/schema.sql").read_text()
    calc_sql   = (REPO / "db/run_crm_calculation.sql").read_text()

    con = sqlite3.connect(":memory:")
    con.executescript(schema_sql)

    t0 = time.time()
    n_products = load_csv(con, "raw_products", INPUT_DIR / "products_master.csv",
                          ["product_id", "product_name", "brand", "category", "unit_size"])
    n_customers = load_csv(con, "raw_customers", INPUT_DIR / "customers_master.csv",
                           ["customer_id", "customer_name", "customer_group", "city", "created_date",
                            "email", "mobile_number", "opt_email", "opt_sms", "opt_phone"])
    n_sales = 0
    for f in sorted(glob.glob(str(INPUT_DIR / "sales_transactions_*.csv"))):
        n_sales += load_csv(con, "raw_sales_transactions", f,
                            ["invoice_id", "customer_id", "invoice_date", "product_id",
                             "quantity", "revenue", "store_id"])
    print(f"Loaded {n_products:,} products, {n_customers:,} customers, "
          f"{n_sales:,} transactions in {time.time() - t0:.2f}s")

    t1 = time.time()
    con.executescript(calc_sql)
    print(f"Calculation SQL ran in {time.time() - t1:.2f}s\n")

    n_active = con.execute(
        "SELECT COUNT(*) FROM crm_customer_snapshot WHERE activity_status='Active'"
    ).fetchone()[0]
    n_total = con.execute("SELECT COUNT(*) FROM crm_customer_snapshot").fetchone()[0]

    print(f"Snapshot: {n_total:,} customers ({n_active:,} Active, {n_total - n_active:,} Not Active)\n")

    print("Value tier (Active customers):")
    for r in con.execute("""
        SELECT COALESCE(value_tier, '<none>') AS tier, COUNT(*) AS n
        FROM crm_customer_snapshot
        WHERE activity_status = 'Active'
        GROUP BY 1
        ORDER BY CASE COALESCE(value_tier, '')
            WHEN 'Diamond'  THEN 1 WHEN 'Platinum' THEN 2 WHEN 'Gold' THEN 3
            WHEN 'Silver'   THEN 4 WHEN 'Bronze'   THEN 5 WHEN 'Passive' THEN 6
            ELSE 7 END
    """):
        pct = r[1] / n_active * 100 if n_active else 0
        print(f"  {r[0]:<10} {r[1]:>6,}  ({pct:5.1f}% of Active)")

    print("\nLifecycle event:")
    for r in con.execute("""
        SELECT COALESCE(lifecycle_event, '<none>') AS evt, COUNT(*) AS n
        FROM crm_customer_snapshot
        GROUP BY 1
        ORDER BY n DESC
    """):
        print(f"  {r[0]:<12} {r[1]:>6,}")

    print("\nKPI averages by tier:")
    print(f"  {'tier':<10} {'amc':>10} {'aos':>10} {'o6':>6} {'tenure':>8} {'n':>6}")
    for r in con.execute("""
        SELECT value_tier,
               ROUND(AVG(avg_monthly_consumption), 1)                                     AS avg_amc,
               CASE WHEN AVG(avg_order_size) IS NULL THEN NULL
                    ELSE ROUND(AVG(avg_order_size), 1) END                                AS avg_aos,
               ROUND(AVG(o6), 1)                                                          AS avg_o6,
               ROUND(AVG(tenure_months), 1)                                               AS avg_tenure,
               COUNT(*)                                                                   AS n
        FROM crm_customer_snapshot
        WHERE value_tier IS NOT NULL
        GROUP BY 1
        ORDER BY CASE value_tier
            WHEN 'Diamond'  THEN 1 WHEN 'Platinum' THEN 2 WHEN 'Gold' THEN 3
            WHEN 'Silver'   THEN 4 WHEN 'Bronze'   THEN 5 WHEN 'Passive' THEN 6
            ELSE 7 END
    """):
        aos = "n/a" if r[2] is None else f"{r[2]:>10.1f}"
        tenure = "n/a" if r[4] is None else f"{r[4]:>8.1f}"
        print(f"  {r[0]:<10} {r[1]:>10.1f} {aos} {r[3]:>6.1f} {tenure} {r[5]:>6,}")

    # Anonymous-exclusion sanity
    n_general = con.execute(
        "SELECT COUNT(*) FROM raw_customers WHERE LOWER(customer_group) = 'general'"
    ).fetchone()[0]
    n_general_in_snap = con.execute("""
        SELECT COUNT(*) FROM crm_customer_snapshot s
        JOIN raw_customers c USING(customer_id)
        WHERE LOWER(c.customer_group) = 'general'
    """).fetchone()[0]
    print(f"\nAnonymous-customer exclusion: {n_general:,} in master, "
          f"{n_general_in_snap:,} in snapshot (must be 0)")

    # Returns sanity
    n_pos = con.execute(
        "SELECT COUNT(*) FROM raw_sales_transactions WHERE quantity > 0"
    ).fetchone()[0]
    n_neg = con.execute(
        "SELECT COUNT(*) FROM raw_sales_transactions WHERE quantity < 0"
    ).fetchone()[0]
    rate = n_neg / n_pos * 100 if n_pos else 0
    print(f"Returns: {n_neg:,} negative-quantity rows ({rate:.2f}% of {n_pos:,} positive lines)")


if __name__ == "__main__":
    main()
