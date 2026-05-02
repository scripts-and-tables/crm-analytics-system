"""
Synthetic data generator for the CRM analytics showcase.

Produces, under data/input/:
  products_master.csv
  customers_master.csv
  sales_transactions_2022.csv
  sales_transactions_2023.csv
  sales_transactions_2024.csv

The dataset is engineered so every CRM output (activity status, value
tier, lifecycle event) is exercised by the resulting snapshot:

  * Active customers spread across all value tiers, including Diamond
    and Platinum (which require both volume and the frequency gate).
  * Passive customers (active in the 12-month window, silent for >=6
    months).
  * Not Active customers including a "Just Lost" cohort whose last
    purchase fell out of the 12-month window in the report month.
  * Reactivated customers (long inactive gap then a purchase in the
    report month).
  * Brand-new customers (first-ever consumable purchase in the report
    month).
  * Customer-master rows with zero transactions.
  * Anonymous (General) customers with transactions, to verify they
    are excluded from the CRM snapshot.
  * Negative-quantity transactions (returns) at a low rate.

Run:
  python scripts/generate_data/generate.py
"""

import csv
import random
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from faker import Faker

# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------
SEED = 42

REPORT_DATE = date(2024, 12, 31)        # Snapshot anchor used by run_crm_calculation.sql
HISTORY_START = date(2022, 1, 1)        # Earliest invoice date for normal activity

N_CUSTOMERS = 5000
N_DEVICES = 5
N_CONSUMABLES = 70
N_ACCESSORIES = 15
N_SPARE_PARTS = 10

# Persona mix drives both the customer master and the per-customer
# transaction shape. Must sum to 1.0.
PERSONA_MIX = {
    "heavy":        0.05,
    "regular":      0.15,
    "light":        0.25,
    "passive":      0.10,
    "lost":         0.20,
    "just_lost":    0.05,
    "reactivated":  0.05,
    "brand_new":    0.05,
    "never_bought": 0.05,
    "general":      0.05,
}
assert abs(sum(PERSONA_MIX.values()) - 1.0) < 1e-9

RETURN_RATE = 0.01
CITIES = ["Sao Paulo", "Rio de Janeiro", "Belo Horizonte", "Brasilia",
          "Curitiba", "Salvador", "Fortaleza", "Recife"]
GROUPS = ["Loyalty", "Subscription", "Standard"]
ANONYMOUS_GROUP = "General"
BRANDS = ["Lumen", "Aurora", "Verde", "Sable"]

# -------------------------------------------------------------------
# RNG setup
# -------------------------------------------------------------------
random.seed(SEED)
Faker.seed(SEED)
fake = Faker()


# -------------------------------------------------------------------
# Date helpers
# -------------------------------------------------------------------
def first_of_month(d):
    return d.replace(day=1)


def add_months(d, n):
    """Add n calendar months to `d`, snapping to the first of the resulting month."""
    y = d.year + (d.month - 1 + n) // 12
    m = (d.month - 1 + n) % 12 + 1
    return date(y, m, 1)


def random_day_in_month(d):
    """Random day in the calendar month containing d."""
    bom = first_of_month(d)
    nxt = add_months(bom, 1)
    return bom + timedelta(days=random.randrange((nxt - bom).days))


# -------------------------------------------------------------------
# Products
# -------------------------------------------------------------------
def generate_products():
    products = []
    pid = 1

    for i in range(N_DEVICES):
        products.append({
            "product_id":   pid,
            "product_name": f"Device {chr(65 + i)}",
            "brand":        random.choice(BRANDS),
            "category":     "device",
            "unit_size":    None,
        })
        pid += 1

    pack_sizes = [5.0, 10.0, 15.0, 25.0, 40.0]
    for _ in range(N_CONSUMABLES):
        products.append({
            "product_id":   pid,
            "product_name": f"Consumable {pid:03d}",
            "brand":        random.choice(BRANDS),
            "category":     "consumable",
            "unit_size":    random.choice(pack_sizes),
        })
        pid += 1

    for i in range(N_ACCESSORIES):
        products.append({
            "product_id":   pid,
            "product_name": f"Accessory {i + 1}",
            "brand":        random.choice(BRANDS),
            "category":     "accessories",
            "unit_size":    None,
        })
        pid += 1

    for i in range(N_SPARE_PARTS):
        products.append({
            "product_id":   pid,
            "product_name": f"Spare Part {i + 1}",
            "brand":        random.choice(BRANDS),
            "category":     "spare_parts",
            "unit_size":    None,
        })
        pid += 1

    return products


# -------------------------------------------------------------------
# Customers
# -------------------------------------------------------------------
def assign_personas(n):
    counts = {k: int(round(n * v)) for k, v in PERSONA_MIX.items()}
    counts["light"] += n - sum(counts.values())
    labels = []
    for k, c in counts.items():
        labels.extend([k] * c)
    random.shuffle(labels)
    return labels


def created_date_for(persona):
    """Return a creation date such that the persona's intended schedule is
    physically realizable (e.g. a 'reactivated' customer must have been
    created early enough to have purchases predating the M13 window)."""
    if persona == "brand_new":
        # Created in the last two months so first consumable purchase is in the report month.
        anchor = date(2024, 11, 1) if random.random() < 0.5 else date(2024, 12, 1)
        return random_day_in_month(anchor)
    if persona == "heavy":
        # Long-tenured customers.
        return HISTORY_START + timedelta(days=random.randrange(0, 365))
    if persona in ("lost", "just_lost", "reactivated"):
        # Need creation well before the 13-month boundary (2023-12-01) so
        # there is room for purchases in the >=13-months-back zone.
        earliest = date(2020, 1, 1)
        latest   = date(2023, 9, 30)
        span = (latest - earliest).days
        return earliest + timedelta(days=random.randrange(0, span))
    if persona == "passive":
        # Need creation at least 7 months before report so they can have
        # >=1 purchase outside the M6 window.
        earliest = date(2022, 1, 1)
        latest   = date(2024, 5, 31)
        span = (latest - earliest).days
        return earliest + timedelta(days=random.randrange(0, span))
    if persona == "general":
        # Anonymous customers can be created any time in the visible history.
        span_days = (REPORT_DATE - HISTORY_START).days
        return HISTORY_START + timedelta(days=random.randrange(0, span_days))
    # regular / light / never_bought: anywhere in the visible history.
    span_days = (REPORT_DATE - HISTORY_START).days
    return HISTORY_START + timedelta(days=random.randrange(0, span_days))


def generate_customers(personas):
    customers = []
    for cid, persona in enumerate(personas, start=1):
        group = ANONYMOUS_GROUP if persona == "general" else random.choice(GROUPS)
        customers.append({
            "customer_id":    cid,
            "customer_name":  fake.name(),
            "customer_group": group,
            "city":           random.choice(CITIES),
            "created_date":   created_date_for(persona).isoformat(),
            "email":          fake.email() if random.random() < 0.85 else None,
            "mobile_number":  fake.msisdn() if random.random() < 0.7 else None,
            "opt_email":      random.choice([0, 1]) if random.random() < 0.9 else None,
            "opt_sms":        random.choice([0, 1]) if random.random() < 0.9 else None,
            "opt_phone":      random.choice([0, 1]) if random.random() < 0.9 else None,
            "_persona":       persona,
        })
    return customers


# -------------------------------------------------------------------
# Transactions
# -------------------------------------------------------------------
def split_consumables_by_band(products):
    by_band = defaultdict(list)
    for p in products:
        if p["category"] != "consumable":
            continue
        size = p["unit_size"]
        if size <= 10:
            by_band["small"].append(p)
        elif size <= 25:
            by_band["medium"].append(p)
        else:
            by_band["large"].append(p)
    return by_band


def schedule_consumable_months(persona, created):
    """
    Return the list of month-start dates on which this customer should
    have at least one consumable order. Designed so the resulting
    monthly aggregates land each persona in the intended CRM segment.
    """
    report_bom = first_of_month(REPORT_DATE)
    created_bom = first_of_month(max(created, HISTORY_START))

    all_months = []
    cur = created_bom
    while cur <= report_bom:
        all_months.append(cur)
        cur = add_months(cur, 1)
    if not all_months:
        return []

    if persona == "heavy":
        anchor = max(all_months[0], add_months(report_bom, -23))
        return [m for m in all_months if m >= anchor]

    if persona == "regular":
        kept = [m for m in all_months if random.random() < 0.7]
        last_six = [add_months(report_bom, -i) for i in range(6)]
        for m in last_six[:4]:
            if m not in kept:
                kept.append(m)
        return sorted(set(kept))

    if persona == "light":
        kept = [m for m in all_months if random.random() < 0.35]
        last_six = [add_months(report_bom, -i) for i in range(6)]
        if not any(m in last_six for m in kept):
            kept.append(random.choice(last_six))
        return sorted(set(kept))

    if persona == "passive":
        cutoff = add_months(report_bom, -6)
        eligible = [m for m in all_months if m < cutoff]
        if not eligible:
            return []
        k = min(len(eligible), random.randint(2, 6))
        return sorted(random.sample(eligible, k=k))

    if persona == "lost":
        cutoff = add_months(report_bom, -13)
        eligible = [m for m in all_months if m < cutoff]
        if not eligible:
            return []
        k = min(len(eligible), random.randint(1, 6))
        return sorted(random.sample(eligible, k=k))

    if persona == "just_lost":
        target = add_months(report_bom, -12)        # exactly the 13th month back
        earlier_pool = [m for m in all_months if m < target]
        k = min(len(earlier_pool), random.randint(1, 4))
        earlier = random.sample(earlier_pool, k=k) if earlier_pool else []
        return sorted({target, *earlier})

    if persona == "reactivated":
        old_cutoff = add_months(report_bom, -13)
        old_eligible = [m for m in all_months if m < old_cutoff]
        k = min(len(old_eligible), random.randint(1, 4))
        old = random.sample(old_eligible, k=k) if old_eligible else []
        return sorted({*old, report_bom})

    if persona == "brand_new":
        return [report_bom]

    if persona == "general":
        kept = [m for m in all_months if random.random() < 0.2]
        return sorted(kept[-random.randint(1, 4):]) if kept else []

    if persona == "never_bought":
        return []

    raise ValueError(f"unknown persona {persona}")


def make_consumable_lines(pool, n_lines, qty_lo, qty_hi):
    chosen = random.sample(pool, k=min(n_lines, len(pool)))
    lines = []
    for p in chosen:
        qty = random.randint(qty_lo, qty_hi)
        lines.append({
            "product_id": p["product_id"],
            "quantity":   qty,
            "revenue":    round(qty * p["unit_size"] * 0.6 * (0.9 + random.random() * 0.2), 2),
            "store_id":   random.randint(1, 20),
        })
    return lines


def make_device_line(devices):
    p = random.choice(devices)
    return {
        "product_id": p["product_id"],
        "quantity":   1,
        "revenue":    round(random.uniform(180, 520), 2),
        "store_id":   random.randint(1, 20),
    }


# Per-persona generation knobs (for the consumable activity loop).
PERSONA_KNOBS = {
    "heavy":       {"orders": (4, 8), "lines": (1, 3), "qty": (15, 30), "band": ("medium", "large")},
    "regular":     {"orders": (1, 3), "lines": (1, 2), "qty": (5, 15),  "band": None},
    "light":       {"orders": (1, 1), "lines": (1, 2), "qty": (3, 8),   "band": ("small", "medium")},
    "passive":     {"orders": (1, 2), "lines": (1, 2), "qty": (3, 12),  "band": None},
    "lost":        {"orders": (1, 2), "lines": (1, 2), "qty": (3, 12),  "band": None},
    "just_lost":   {"orders": (1, 2), "lines": (1, 2), "qty": (3, 12),  "band": None},
    "reactivated": {"orders": (1, 1), "lines": (1, 2), "qty": (3, 10),  "band": None},
    "brand_new":   {"orders": (1, 2), "lines": (1, 2), "qty": (3, 12),  "band": None},
    "general":     {"orders": (1, 1), "lines": (1, 1), "qty": (1, 5),   "band": None},
}


def generate_transactions(customers, products):
    devices = [p for p in products if p["category"] == "device"]
    by_band = split_consumables_by_band(products)
    all_consumables = [p for p in products if p["category"] == "consumable"]

    rows = []
    invoice_seq = 100_000

    def push_invoice(cid, day, lines):
        nonlocal invoice_seq
        invoice_seq += 1
        invoice_id = f"INV{invoice_seq:08d}"
        for ln in lines:
            rows.append({
                "invoice_id":   invoice_id,
                "customer_id":  cid,
                "invoice_date": day.isoformat(),
                "product_id":   ln["product_id"],
                "quantity":     ln["quantity"],
                "revenue":      ln["revenue"],
                "store_id":     ln["store_id"],
            })

    for c in customers:
        persona = c["_persona"]
        if persona == "never_bought":
            continue

        cid = c["customer_id"]
        created = date.fromisoformat(c["created_date"])

        # Device purchase: most non-anonymous customers acquire a device shortly after creation.
        if persona != "general" and random.random() < 0.95:
            device_day = min(created + timedelta(days=random.randint(0, 14)), REPORT_DATE)
            push_invoice(cid, device_day, [make_device_line(devices)])

        # Consumable activity per persona.
        knobs = PERSONA_KNOBS[persona]
        if knobs["band"]:
            pool = []
            for b in knobs["band"]:
                pool.extend(by_band[b])
        else:
            pool = all_consumables
        if not pool:
            pool = all_consumables

        for mth_bom in schedule_consumable_months(persona, created):
            n_orders = random.randint(*knobs["orders"])
            for _ in range(n_orders):
                day = min(random_day_in_month(mth_bom), REPORT_DATE)
                n_lines = random.randint(*knobs["lines"])
                lines = make_consumable_lines(pool, n_lines, *knobs["qty"])
                if lines:
                    push_invoice(cid, day, lines)

    # Returns: pick ~RETURN_RATE of positive consumable lines and add a
    # negative-quantity matching line within 30 days.
    consumable_pids = {p["product_id"] for p in all_consumables}
    positive_ix = [i for i, t in enumerate(rows)
                   if t["quantity"] > 0 and t["product_id"] in consumable_pids]
    n_returns = int(len(positive_ix) * RETURN_RATE)
    for ix in random.sample(positive_ix, k=n_returns):
        orig = rows[ix]
        ret_day = min(
            date.fromisoformat(orig["invoice_date"]) + timedelta(days=random.randint(1, 30)),
            REPORT_DATE,
        )
        invoice_seq += 1
        rows.append({
            "invoice_id":   f"INV{invoice_seq:08d}",
            "customer_id":  orig["customer_id"],
            "invoice_date": ret_day.isoformat(),
            "product_id":   orig["product_id"],
            "quantity":     -orig["quantity"],
            "revenue":      -orig["revenue"],
            "store_id":     orig["store_id"],
        })

    return rows


# -------------------------------------------------------------------
# CSV writers
# -------------------------------------------------------------------
def write_csv(path, rows, fieldnames):
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def write_outputs(out_dir, products, customers, transactions):
    out_dir.mkdir(parents=True, exist_ok=True)

    write_csv(
        out_dir / "products_master.csv",
        products,
        ["product_id", "product_name", "brand", "category", "unit_size"],
    )

    write_csv(
        out_dir / "customers_master.csv",
        customers,
        ["customer_id", "customer_name", "customer_group", "city", "created_date",
         "email", "mobile_number", "opt_email", "opt_sms", "opt_phone"],
    )

    by_year = defaultdict(list)
    for t in transactions:
        by_year[t["invoice_date"][:4]].append(t)
    for year, year_rows in sorted(by_year.items()):
        write_csv(
            out_dir / f"sales_transactions_{year}.csv",
            year_rows,
            ["invoice_id", "customer_id", "invoice_date", "product_id",
             "quantity", "revenue", "store_id"],
        )

    return by_year


# -------------------------------------------------------------------
# Entry point
# -------------------------------------------------------------------
def main():
    out_dir = Path(__file__).resolve().parents[2] / "data" / "input"

    products = generate_products()
    personas = assign_personas(N_CUSTOMERS)
    customers = generate_customers(personas)
    transactions = generate_transactions(customers, products)
    by_year = write_outputs(out_dir, products, customers, transactions)

    persona_counts = defaultdict(int)
    for c in customers:
        persona_counts[c["_persona"]] += 1

    print("Generated:")
    print(f"  products:     {len(products):>9,}")
    print(f"  customers:    {len(customers):>9,}")
    for persona, count in sorted(persona_counts.items()):
        print(f"    {persona:<14}{count:>7,}")
    print(f"  transactions: {len(transactions):>9,}")
    for year, year_rows in sorted(by_year.items()):
        print(f"    {year}:        {len(year_rows):>9,}")
    print(f"\nOutput dir: {out_dir}")


if __name__ == "__main__":
    main()
