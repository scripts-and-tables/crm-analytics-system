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

    "p_call_opt_in_if_phone_present": 0.75,
    "p_call_opt_in_if_phone_missing": 0.08,

    # Customers: created_at range
    "customers_created_at_start": date(2015, 1, 1),
    "customers_created_at_end": date(2025, 12, 31),

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

