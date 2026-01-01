# ingest.py
import os
import sqlite3

import pandas as pd


DB_PATH = "db/crm.db"

SALES_DIR = "data_raw/sales_transactions"
CUSTOMERS_FILE = "data_raw/masters/customers_master.csv"
PRODUCTS_FILE = "data_raw/masters/products_master.csv"


def connect_db(db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def load_customers(conn, csv_path=CUSTOMERS_FILE):
    df = pd.read_csv(csv_path, dtype=str)

    cols = [
        "customer_id",
        "customer_name",
        "customer_group",
        "city",
        "created_date",
        "email",
        "mobile_number",
        "opt_email",
        "opt_sms",
        "opt_phone",
    ]
    df = df[cols]

    conn.execute("DELETE FROM raw_customers;")
    df.to_sql("raw_customers", conn, if_exists="append", index=False)


def load_products(conn, csv_path=PRODUCTS_FILE):
    df = pd.read_csv(csv_path, dtype=str)

    cols = ["product_id", "product_name", "brand", "category", "grammage_g"]
    df = df[cols]

    conn.execute("DELETE FROM raw_products;")
    df.to_sql("raw_products", conn, if_exists="append", index=False)


def load_sales(conn, sales_dir=SALES_DIR):
    files = [
        f for f in os.listdir(sales_dir)
        if f.lower().endswith(".csv") and f.lower().startswith("sales_transactions_")
    ]
    files.sort()

    conn.execute("DELETE FROM raw_sales_transactions;")

    for filename in files:
        path = os.path.join(sales_dir, filename)
        df = pd.read_csv(path, dtype=str)

        # allow common alternative naming from sources
        if "net_amount" in df.columns and "revenue" not in df.columns:
            df = df.rename(columns={"net_amount": "revenue"})
        if "qty" in df.columns and "quantity" not in df.columns:
            df = df.rename(columns={"qty": "quantity"})

        cols = [
            "invoice_id",
            "customer_id",
            "invoice_date",
            "product_id",
            "quantity",
            "revenue",
            "store_id",
        ]
        df = df[cols]

        df.to_sql("raw_sales_transactions", conn, if_exists="append", index=False)


def ingest_all():
    conn = connect_db(DB_PATH)
    try:
        load_customers(conn)
        load_products(conn)
        load_sales(conn)
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    ingest_all()
    print("Done.")
