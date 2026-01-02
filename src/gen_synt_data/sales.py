from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta, datetime
from typing import Iterable, List, Dict, Optional, Sequence, Tuple
import random


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def _next_month(d: date) -> date:
    # d must be month start
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def _month_end(d: date) -> date:
    # d is any date; compute end of that month
    ms = _month_start(d)
    nm = _next_month(ms)
    return nm - timedelta(days=1)


def _random_date_in_month(rng: random.Random, month_ms: date, min_date: date) -> date:
    me = _month_end(month_ms)
    lo = min_date if min_date > month_ms else month_ms
    hi = me
    if lo > hi:
        # should not happen, but guard
        lo = hi
    span = (hi - lo).days
    return lo + timedelta(days=rng.randint(0, span))


def _pick_from_list(rng: random.Random, values: Sequence, k: int = 1) -> List:
    if not values:
        return []
    if k <= 1:
        return [values[rng.randrange(len(values))]]
    # try no-duplicate sampling if possible
    if k <= len(values):
        return rng.sample(list(values), k=k)
    # if not enough unique, allow repeats
    out = []
    for _ in range(k):
        out.append(values[rng.randrange(len(values))])
    return out


def generate_customer_sales_rows(
    *,
    customer_id: int | str,
    created_at: date,
    sales_end_date: date,
    # product_id lists by category (already prepared outside)
    device_product_ids: Sequence[int | str],
    refill_product_ids: Sequence[int | str],
    accessory_product_ids: Sequence[int | str],
    spare_part_product_ids: Sequence[int | str],
    # optional stores
    store_ids: Optional[Sequence[int | str]] = None,

    # monthly dynamics
    p_buy_month: float = 0.70,
    p_lost_month: float = 0.01,

    # device logic
    p_device_if_no_device: float = 0.90,         # on an invoice, if customer has 0 devices
    p_device_repeat_base: float = 0.03,           # base repeat probability per invoice if has >=1 device
    device_repeat_decay: Sequence[float] = (1.0, 0.4, 0.2, 0.1),  # multiplier by devices_owned
    max_devices_per_customer: int = 3,

    # category add-ons
    p_refill_when_device: float = 0.85,
    p_refill_when_no_device: float = 0.85,
    p_accessory_line: float = 0.07,   # probability to add an accessory line to an invoice
    p_spare_part_line: float = 0.04,  # probability to add a spare part line to an invoice

    # invoice shape
    lines_range: Tuple[int, int] = (1, 3),  # total lines per invoice (min,max)
    # quantities by category
    qty_device_range: Tuple[int, int] = (1, 1),
    qty_refill_range: Tuple[int, int] = (1, 3),
    qty_accessory_range: Tuple[int, int] = (1, 1),
    qty_spare_range: Tuple[int, int] = (1, 1),

    # returns
    p_return_line: float = 0.01,  # chance a line is a return (negative qty & revenue)

    # pricing (simple ranges; revenue is line net amount)
    price_device_range: Tuple[float, float] = (120.0, 650.0),
    price_refill_range: Tuple[float, float] = (10.0, 60.0),
    price_accessory_range: Tuple[float, float] = (10.0, 40.0),
    price_spare_range: Tuple[float, float] = (15.0, 80.0),

    # discount
    p_discounted_line: float = 0.35,
    discount_max: float = 0.25,

    # randomness
    seed: Optional[int] = None,
    rng: Optional[random.Random] = None,
) -> List[Dict]:
    """
    Generate sales transaction rows (line-level) for a single customer month-by-month.
    Returns list[dict] with columns:
      invoice_id, customer_id, invoice_date, product_id, quantity, revenue, store_id

    Notes:
    - invoice_id duplicates exist across lines of the same invoice (expected).
    - revenue is generated as LINE net amount (qty * unit_price * (1-discount)).
    - all dates are >= created_at and <= sales_end_date.
    """
    if rng is None:
        rng = random.Random(seed)

    rows: List[Dict] = []

    # state
    devices_owned = 0
    lost = False
    invoice_seq = 0

    # iterate months
    month_ms = _month_start(created_at)
    while month_ms <= sales_end_date:
        if lost:
            break

        # monthly churn / lost
        if rng.random() < p_lost_month:
            lost = True
            break

        # monthly purchase decision
        if rng.random() >= p_buy_month:
            month_ms = _next_month(month_ms)
            continue

        # create one invoice in this month
        invoice_seq += 1
        invoice_date = _random_date_in_month(rng, month_ms, min_date=created_at)
        if invoice_date > sales_end_date:
            break

        ym = f"{invoice_date.year:04d}{invoice_date.month:02d}"
        invoice_id = f"{customer_id}-{ym}-{invoice_seq:05d}"

        store_id = ""
        if store_ids:
            store_id = store_ids[rng.randrange(len(store_ids))]

        # decide whether to include a device line
        include_device = False
        if devices_owned < max_devices_per_customer:
            if devices_owned == 0:
                include_device = (rng.random() < p_device_if_no_device)
            else:
                idx = min(devices_owned, len(device_repeat_decay) - 1)
                p_repeat = p_device_repeat_base * float(device_repeat_decay[idx])
                include_device = (rng.random() < p_repeat)

        # decide whether to include a refill line
        if include_device:
            include_refill = (rng.random() < p_refill_when_device)
        else:
            include_refill = (rng.random() < p_refill_when_no_device)

        # add-on categories
        include_accessory = (rng.random() < p_accessory_line)
        include_spare = (rng.random() < p_spare_part_line)

        # decide total lines
        min_lines, max_lines = lines_range
        total_lines = rng.randint(min_lines, max_lines)

        # mandatory categories list (at least 1 line for each included category)
        categories: List[str] = []
        if include_device and device_product_ids:
            categories.append("DEVICE")
        if include_refill and refill_product_ids:
            categories.append("REFILL")
        if include_accessory and accessory_product_ids:
            categories.append("ACCESSORY")
        if include_spare and spare_part_product_ids:
            categories.append("SPARE_PART")

        # if nothing selected (can happen if lists are empty or probabilities low), force REFILL if possible
        if not categories:
            if refill_product_ids:
                categories.append("REFILL")
            elif device_product_ids:
                categories.append("DEVICE")
            elif accessory_product_ids:
                categories.append("ACCESSORY")
            elif spare_part_product_ids:
                categories.append("SPARE_PART")
            else:
                # no items provided at all
                month_ms = _next_month(month_ms)
                continue

        # fill remaining lines with weighted choices favoring refills
        # (simple weights; you can pass these later as params if needed)
        while len(categories) < total_lines:
            pick = rng.random()
            if refill_product_ids and pick < 0.70:
                categories.append("REFILL")
            elif device_product_ids and pick < 0.80:
                categories.append("DEVICE")
            elif accessory_product_ids and pick < 0.92:
                categories.append("ACCESSORY")
            elif spare_part_product_ids:
                categories.append("SPARE_PART")
            else:
                # fallback
                categories.append(categories[0])

        # generate lines
        for cat in categories:
            if cat == "DEVICE":
                if not device_product_ids:
                    continue
                product_id = _pick_from_list(rng, device_product_ids, k=1)[0]
                qty = rng.randint(*qty_device_range)
                unit_price = rng.uniform(*price_device_range)
                # if a device is purchased, update ownership
                devices_owned = min(devices_owned + 1, max_devices_per_customer)

            elif cat == "REFILL":
                if not refill_product_ids:
                    continue
                product_id = _pick_from_list(rng, refill_product_ids, k=1)[0]
                qty = rng.randint(*qty_refill_range)
                unit_price = rng.uniform(*price_refill_range)

            elif cat == "ACCESSORY":
                if not accessory_product_ids:
                    continue
                product_id = _pick_from_list(rng, accessory_product_ids, k=1)[0]
                qty = rng.randint(*qty_accessory_range)
                unit_price = rng.uniform(*price_accessory_range)

            else:  # SPARE_PART
                if not spare_part_product_ids:
                    continue
                product_id = _pick_from_list(rng, spare_part_product_ids, k=1)[0]
                qty = rng.randint(*qty_spare_range)
                unit_price = rng.uniform(*price_spare_range)

            # discount
            discount = 0.0
            if rng.random() < p_discounted_line:
                discount = rng.uniform(0.0, discount_max)

            # returns
            if rng.random() < p_return_line:
                qty = -abs(qty)

            revenue = qty * unit_price * (1.0 - discount)

            rows.append({
                "invoice_id": invoice_id,
                "customer_id": customer_id,
                "invoice_date": invoice_date.isoformat(),
                "product_id": product_id,
                "quantity": qty,
                "revenue": round(revenue, 2),
                "store_id": store_id,
            })

        month_ms = _next_month(month_ms)

    return rows


import pandas as pd

for customer_id in range(1, 10001):
    rows = generate_customer_sales_rows(
        customer_id=customer_id,
        created_at=date(2024, 3, 15),
        sales_end_date=date(2025, 12, 31),

        device_product_ids=[1, 2, 3, 4, 5],
        refill_product_ids=list(range(10, 90)),
        accessory_product_ids=list(range(90, 98)),
        spare_part_product_ids=list(range(98, 101)),

        store_ids=[f"S{i:04d}" for i in range(1, 21)],

        p_buy_month=0.7,
        p_lost_month=0.01,
        lines_range=(1, 3),

        seed=customer_id,
    )

    df = pd.DataFrame(rows)
    print(datetime.now().isoformat(), f'Customer {customer_id}. Lines {len(df)}')
