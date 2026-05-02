"""
Build the CRM SQLite database from scratch.

Pipeline:
  1. Wipe and recreate the SQLite file from db/schema.sql.
  2. Load CSVs from data/input/ into the raw_* tables.
  3. Run db/run_crm_calculation.sql once per report month over the
     requested back-window, accumulating the per-month snapshots into a
     single permanent crm_customer_snapshot table.

Usage:
    python db/build.py
    python db/build.py --db custom/path/crm.db --months 12 --latest 2024-12-31
"""

import argparse
import csv
import glob
import re
import sqlite3
import time
from calendar import monthrange
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INPUT_DIR = REPO / "data" / "input"
DEFAULT_DB = INPUT_DIR / "crm.db"
DEFAULT_LATEST = "2024-12-31"
DEFAULT_MONTHS = 12

# Pattern that matches the parameterized report month in run_crm_calculation.sql:
#   '2024-12-31'  AS report_mth_eom,
REPORT_MONTH_PATTERN = re.compile(r"'(\d{4}-\d{2}-\d{2})'(\s+AS\s+report_mth_eom)")


def last_day_of_month(year, month):
    return date(year, month, monthrange(year, month)[1])


def report_month_eoms(latest, n):
    """Return n month-end dates ending at `latest`, oldest first."""
    months = []
    y, m = latest.year, latest.month
    for _ in range(n):
        months.append(last_day_of_month(y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(months))


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
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=str(DEFAULT_DB),
                    help=f"output SQLite path (default: {DEFAULT_DB})")
    ap.add_argument("--months", type=int, default=DEFAULT_MONTHS,
                    help=f"number of report months back from --latest (default: {DEFAULT_MONTHS})")
    ap.add_argument("--latest", default=DEFAULT_LATEST,
                    help=f"latest report month-end date YYYY-MM-DD (default: {DEFAULT_LATEST})")
    args = ap.parse_args()

    db_path = Path(args.db)
    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    schema_sql = (REPO / "db" / "schema.sql").read_text()
    calc_sql_template = (REPO / "db" / "run_crm_calculation.sql").read_text()

    con = sqlite3.connect(db_path)
    t0 = time.time()
    con.executescript(schema_sql)

    n_p = load_csv(con, "raw_products", INPUT_DIR / "products_master.csv",
                   ["product_id", "product_name", "brand", "category", "unit_size"])
    n_c = load_csv(con, "raw_customers", INPUT_DIR / "customers_master.csv",
                   ["customer_id", "customer_name", "customer_group", "city", "created_date",
                    "email", "mobile_number", "opt_email", "opt_sms", "opt_phone"])
    n_s = 0
    for f in sorted(glob.glob(str(INPUT_DIR / "sales_transactions_*.csv"))):
        n_s += load_csv(con, "raw_sales_transactions", f,
                        ["invoice_id", "customer_id", "invoice_date", "product_id",
                         "quantity", "revenue", "store_id"])
    con.commit()
    print(f"Loaded {n_p:,} products, {n_c:,} customers, {n_s:,} transactions "
          f"in {time.time() - t0:.1f}s")

    latest = date.fromisoformat(args.latest)
    months = report_month_eoms(latest, args.months)
    print(f"\nBuilding snapshot for {len(months)} months "
          f"({months[0].isoformat()} .. {months[-1].isoformat()}):")

    # Run calc once per month; the calc script DROPs and recreates
    # crm_customer_snapshot each time, so we capture rows into an
    # accumulator and rename it at the end.
    con.execute("DROP TABLE IF EXISTS crm_customer_snapshot_all")
    accumulator_created = False

    t1 = time.time()
    for m in months:
        patched_sql = REPORT_MONTH_PATTERN.sub(
            lambda mt: f"'{m.isoformat()}'{mt.group(2)}",
            calc_sql_template,
            count=1,
        )
        con.executescript(patched_sql)
        if not accumulator_created:
            con.execute("CREATE TABLE crm_customer_snapshot_all "
                        "AS SELECT * FROM crm_customer_snapshot WHERE 0")
            accumulator_created = True
        con.execute("INSERT INTO crm_customer_snapshot_all "
                    "SELECT * FROM crm_customer_snapshot")
        n = con.execute("SELECT COUNT(*) FROM crm_customer_snapshot").fetchone()[0]
        print(f"  {m.isoformat()}  -> {n:,} rows")

    con.execute("DROP INDEX IF EXISTS ix_crm_snapshot_month")
    con.execute("DROP INDEX IF EXISTS ix_crm_snapshot_customer")
    con.execute("DROP INDEX IF EXISTS ix_crm_snapshot_tier")
    con.execute("DROP INDEX IF EXISTS ix_crm_snapshot_event")
    con.execute("DROP TABLE crm_customer_snapshot")
    con.execute("ALTER TABLE crm_customer_snapshot_all RENAME TO crm_customer_snapshot")

    con.execute("CREATE INDEX ix_crm_snapshot_month    ON crm_customer_snapshot(report_mth_eom)")
    con.execute("CREATE INDEX ix_crm_snapshot_customer ON crm_customer_snapshot(customer_id)")
    con.execute("CREATE INDEX ix_crm_snapshot_tier     ON crm_customer_snapshot(value_tier)")
    con.execute("CREATE INDEX ix_crm_snapshot_event    ON crm_customer_snapshot(lifecycle_event)")
    con.execute("ANALYZE")
    con.commit()

    total = con.execute("SELECT COUNT(*) FROM crm_customer_snapshot").fetchone()[0]
    print(f"\nSnapshot built in {time.time() - t1:.1f}s — total rows: {total:,}")
    print(f"Database: {db_path}")


if __name__ == "__main__":
    main()
