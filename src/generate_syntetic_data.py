# src/generate_synthetic_data.py

import pandas as pd
import numpy as np
from faker import Faker
from datetime import date

# =========================
# SETTINGS (edit here)
# =========================
SETTINGS = {
    "seed": 42,
    "faker_locale": "en_US",

    # Volumes (start small while developing; scale later)
    "n_customers": 300_000,
    "n_items": 500,

    # Customers: field availability probabilities
    "p_first_name": 0.90,
    "p_last_name": 0.60,
    "p_email": 0.70,
    "p_phone": 0.80,

    # Customers: opt-in rules
    "p_email_opt_in_if_email_present": 0.60,
    "p_email_opt_in_if_email_missing": 0.05,

    "p_sms_opt_in_if_phone_present": 0.90,
    "p_sms_opt_in_if_phone_missing": 0.15,

    # Slightly different than SMS
    "p_call_opt_in_if_phone_present": 0.75,
    "p_call_opt_in_if_phone_missing": 0.08,

    # Customers: created_at range
    "customers_created_at_start": date(2015, 1, 1),
    "customers_created_at_end": date(2025, 12, 31),

    # Items: simple catalog
    "brands": ["Nestle", "P&G", "Unilever", "Mondelez", "PepsiCo", "Danone", "Kraft", "Kellogg's"],
    "categories": {
        "Food": ["Cereal", "Biscuits", "Chocolate", "Pasta", "Sauce"],
        "Beverage": ["Juice", "Soda", "Water", "Energy"],
        "HPC": ["Shampoo", "Soap", "Detergent", "Toothpaste"],
        "Baby": ["Formula", "Diapers", "Wipes"],
    },
    "pack_sizes_g": [50, 80, 100, 150, 200, 250, 400, 500, 750, 1000],

    # Transactions
    "max_invoices_per_customer": 10,
    "max_lines_per_invoice": 6,

    # Share of "heavy" customers
    "heavy_share": 0.15,
    "heavy_mult": 2.5,

    # Invoice count skew (geometric). Smaller p => heavier tail.
    "invoice_geom_p": 0.40,

    # Item popularity skew
    "item_zipf_alpha": 1.05,

    # Discount
    "discount_max": 0.25,

    # Blanks in string fields
    "blank": "",
}


# =========================
# Customers
# =========================
def generate_customers_df(settings=SETTINGS):
    n = int(settings["n_customers"])
    blank = settings["blank"]

    rng = np.random.default_rng(settings["seed"])
    fake = Faker(settings["faker_locale"])
    Faker.seed(settings["seed"])

    # created_at uniform by day
    start = np.datetime64(settings["customers_created_at_start"].isoformat())
    end = np.datetime64(settings["customers_created_at_end"].isoformat())
    total_days = int((end - start).astype("timedelta64[D]").astype(int))
    offsets = rng.integers(0, total_days + 1, size=n, dtype=np.int32)
    created_at = (start + offsets.astype("timedelta64[D]")).astype("datetime64[D]")

    def gen_optional_strings(p, gen_func):
        mask = rng.random(n) < p
        out = np.full(n, blank, dtype=object)
        k = int(mask.sum())
        if k > 0:
            out[mask] = [gen_func() for _ in range(k)]
        return out, mask

    first_name, _ = gen_optional_strings(settings["p_first_name"], fake.first_name)
    last_name, _ = gen_optional_strings(settings["p_last_name"], fake.last_name)
    email, email_mask = gen_optional_strings(settings["p_email"], fake.email)
    phone, phone_mask = gen_optional_strings(settings["p_phone"], fake.phone_number)

    # opt-ins
    p_email_opt_in = np.where(
        email_mask,
        settings["p_email_opt_in_if_email_present"],
        settings["p_email_opt_in_if_email_missing"],
    )
    email_opt_in = (rng.random(n) < p_email_opt_in).astype(np.int8)

    p_sms_opt_in = np.where(
        phone_mask,
        settings["p_sms_opt_in_if_phone_present"],
        settings["p_sms_opt_in_if_phone_missing"],
    )
    sms_opt_in = (rng.random(n) < p_sms_opt_in).astype(np.int8)

    p_call_opt_in = np.where(
        phone_mask,
        settings["p_call_opt_in_if_phone_present"],
        settings["p_call_opt_in_if_phone_missing"],
    )
    call_opt_in = (rng.random(n) < p_call_opt_in).astype(np.int8)

    df = pd.DataFrame({
        "created_at": created_at.astype(str),
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "email_opt_in": email_opt_in,
        "sms_opt_in": sms_opt_in,
        "call_opt_in": call_opt_in,
    })

    # Sort by created_at, then assign sequential customer_id starting at 1
    df = df.sort_values("created_at", kind="mergesort").reset_index(drop=True)
    df.insert(0, "customer_id", np.arange(1, len(df) + 1, dtype=np.int64))

    return df


# =========================
# Items
# =========================
def generate_items_df(settings=SETTINGS):
    n = int(settings["n_items"])
    rng = np.random.default_rng(settings["seed"] + 10)

    brands = settings["brands"]
    categories = settings["categories"]
    pack_sizes = settings["pack_sizes_g"]

    rows = []
    used_eans = set()

    for i in range(1, n + 1):
        item_id = i
        cat = rng.choice(list(categories.keys()))
        sub = rng.choice(categories[cat])
        brand = rng.choice(brands)
        pack_g = int(rng.choice(pack_sizes))

        # EAN-13 (not strict check digit; unique is enough for demo)
        while True:
            ean13 = "".join(rng.choice(list("0123456789"), size=13))
            if ean13 not in used_eans:
                used_eans.add(ean13)
                break

        base_price = {
            "Food": rng.uniform(6, 25),
            "Beverage": rng.uniform(3, 15),
            "HPC": rng.uniform(8, 35),
            "Baby": rng.uniform(20, 80),
        }[cat]
        list_price = round(float(base_price * (0.7 + 0.0008 * pack_g)), 2)

        item_name = f"{brand} {sub} {pack_g}g"

        rows.append([item_id, ean13, item_name, brand, cat, sub, pack_g, list_price])

    df = pd.DataFrame(rows, columns=[
        "item_id", "ean13", "item_name", "brand", "category", "subcategory", "pack_g", "list_price"
    ])
    return df


# =========================
# Sales transactions (invoice lines)
# =========================
def generate_sales_transactions_df(customers_df, items_df, settings=SETTINGS):
    rng = np.random.default_rng(settings["seed"] + 20)

    n_customers = len(customers_df)
    max_inv = int(settings["max_invoices_per_customer"])
    max_lines = int(settings["max_lines_per_invoice"])

    # Convert created_at to datetime64[D]
    cust_created = np.array(customers_df["created_at"].values, dtype="datetime64[D]")
    cust_id = customers_df["customer_id"].to_numpy(dtype=np.int64)

    # Heavy customers multiplier
    heavy_mask = rng.random(n_customers) < float(settings["heavy_share"])
    mult = np.where(heavy_mask, float(settings["heavy_mult"]), 1.0)

    # Skewed invoice counts: geometric (1..), scaled by mult, capped
    # geometric gives 1,2,3... with tail
    base = rng.geometric(p=float(settings["invoice_geom_p"]), size=n_customers)
    inv_counts = np.clip(np.rint(base * mult).astype(np.int32), 1, max_inv)

    total_invoices = int(inv_counts.sum())

    # Expand customer_id per invoice
    inv_customer_id = np.repeat(cust_id, inv_counts)
    inv_created = np.repeat(cust_created, inv_counts)

    # Invoice date must be >= customer created_at and <= end
    end = np.datetime64(settings["customers_created_at_end"].isoformat()).astype("datetime64[D]")
    max_days = (end - inv_created).astype("timedelta64[D]").astype(np.int32)
    max_days = np.maximum(max_days, 0)

    # Random offset per invoice (vectorized)
    inv_offsets = (rng.random(total_invoices) * (max_days.astype(np.float64) + 1.0)).astype(np.int32)
    inv_date = (inv_created + inv_offsets.astype("timedelta64[D]")).astype("datetime64[D]")

    # Create invoices, sort by date, assign invoice_id sequential
    invoices = pd.DataFrame({
        "invoice_date": inv_date.astype(str),
        "customer_id": inv_customer_id,
    }).sort_values("invoice_date", kind="mergesort").reset_index(drop=True)

    invoices.insert(0, "invoice_id", np.arange(1, len(invoices) + 1, dtype=np.int64))

    # Lines per invoice
    lines_per_inv = rng.integers(1, max_lines + 1, size=len(invoices), dtype=np.int32)
    total_lines = int(lines_per_inv.sum())

    line_invoice_id = np.repeat(invoices["invoice_id"].to_numpy(dtype=np.int64), lines_per_inv)
    line_customer_id = np.repeat(invoices["customer_id"].to_numpy(dtype=np.int64), lines_per_inv)
    line_date = np.repeat(invoices["invoice_date"].to_numpy(dtype=object), lines_per_inv)

    # Item popularity weights (Zipf-like)
    n_items = len(items_df)
    ranks = np.arange(1, n_items + 1, dtype=np.float64)
    weights = 1.0 / np.power(ranks, float(settings["item_zipf_alpha"]))
    probs = weights / weights.sum()

    # Choose items (item_id is sequential 1..n_items, so we can index prices easily)
    item_idx = rng.choice(np.arange(n_items), size=total_lines, p=probs)
    line_item_id = (item_idx + 1).astype(np.int64)

    # Unit price from list_price + noise
    list_price = items_df["list_price"].to_numpy(dtype=np.float64)
    base_price = list_price[item_idx]
    unit_price = np.round(base_price * rng.uniform(0.95, 1.05, size=total_lines), 2)

    # Qty (lognormal-ish, at least 1)
    qty = np.maximum(1, np.rint(rng.lognormal(mean=0.6, sigma=0.6, size=total_lines)).astype(np.int32))

    # Discount (0..discount_max), slightly higher for opted-in email (optional nuance)
    # If you prefer pure random, remove the customer join below.
    email_opt_in_map = customers_df.set_index("customer_id")["email_opt_in"].to_dict()
    cust_opt = np.array([email_opt_in_map.get(int(x), 0) for x in line_customer_id], dtype=np.int8)

    disc_max = float(settings["discount_max"])
    discount = rng.uniform(0.00, disc_max, size=total_lines)
    discount = np.clip(discount + (cust_opt * 0.02), 0.0, disc_max)  # small bump
    discount_pct = np.round(discount, 4)

    net_amount = np.round(qty * unit_price * (1.0 - discount_pct), 2)

    df = pd.DataFrame({
        "invoice_id": line_invoice_id,
        "invoice_date": line_date,
        "customer_id": line_customer_id,
        "item_id": line_item_id,
        "qty": qty.astype(np.int32),
        "unit_price": unit_price.astype(np.float64),
        "discount_pct": discount_pct.astype(np.float64),
        "net_amount": net_amount.astype(np.float64),
    })

    # Optional: stable line id
    df.insert(0, "line_id", np.arange(1, len(df) + 1, dtype=np.int64))

    return df


# =========================
# Orchestrator
# =========================
def generate_all(settings=SETTINGS):
    customers = generate_customers_df(settings)
    items = generate_items_df(settings)
    sales = generate_sales_transactions_df(customers, items, settings)
    return customers, items, sales


if __name__ == "__main__":
    customers_df, items_df, sales_df = generate_all(SETTINGS)

    print("customers:", customers_df.shape, "items:", items_df.shape, "sales:", sales_df.shape)
    print(customers_df.head(3))
    print(items_df.head(3))
    print(sales_df.head(3))
