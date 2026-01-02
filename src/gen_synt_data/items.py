# src/generate_items.py
import random
import pandas as pd
from pathlib import Path


# ==========================================================
# SETTINGS (everything for items generation is here)
# ==========================================================
SETTINGS = {
    "seed": 42,

    # Total number of products you want in final table (after mix)
    # If total is too small for fixed parts, code will raise.
    "n_total_products": 100,

    # Counts by category
    "n_devices": 5,
    "n_accessories": 10,     # set 5..10 as you like
    "n_spare_parts": 8,      # set 5..10 as you like

    # Bulk refills (industrial): exactly 3 rows by default (2x500, 1x1000)
    "include_bulk_refills": True,
    "bulk_refills": [
        {"brand": "Good Smell", "scent": "Citrus", "gramm_g": 500,  "suffix": "(Industrial)"},
        {"brand": "AromaWave",  "scent": "Lavender", "gramm_g": 500, "suffix": "(Industrial)"},
        {"brand": "FreshNest",  "scent": "Coffee", "gramm_g": 1000, "suffix": "(Industrial)"},
    ],

    # Brands
    "device_brands": ["AromaDrive", "BreezeLine", "FreshNest"],  # 2–3 brands ok
    "refill_brands": ["Good Smell", "AromaWave", "FreshNest", "Citrusenko", "BreezeLine"],

    # Simple scents (as you requested)
    "scents": ["Citrus", "Lavender", "Coffee", "Vanilla", "Ocean", "Jasmine", "Rose", "Mint", "Pine", "Chocolate"],

    # Regular refill sizes (ONLY integers in gramm_g)
    "refill_sizes_g": [10, 20, 30, 50, 100],

    # Device catalog: 5 descriptive names (you can rename freely)
    "devices_catalog": [
        {"subcategory": "DEVICE", "name": "Diffuser Machine - Home"},
        {"subcategory": "DEVICE", "name": "Diffuser Machine - Compact"},
        {"subcategory": "DEVICE", "name": "Nebulizer Machine - Pro"},
        {"subcategory": "DEVICE", "name": "Car Diffuser Machine - Clip"},
        {"subcategory": "DEVICE", "name": "Car Diffuser Machine - Mini"},
    ],

    # Accessories (descriptive, no grammage)
    "accessories_catalog": [
        "Wall Bracket Mount",
        "Hanging Strap",
        "Decor Sticker Pack",
        "Protective Sleeve",
        "Travel Pouch",
        "Cable Organizer Clip",
        "Adhesive Mount Pad",
        "Car Vent Holder",
        "Desk Stand Base",
        "Cleaning Wipes Pack",
    ],

    # Spare parts (descriptive, no grammage)
    "spare_parts_catalog": [
        "Replacement Cap",
        "Nozzle Holder",
        "Scent Cartridge Holder",
        "Seal Ring (O-Ring)",
        "Diffuser Wick Set",
        "Power Adapter",
        "USB Cable",
        "Clip Replacement",
    ],

    # Output column names (match source class specification)
    "columns": ["product_id", "product_name", "brand", "category", "gramm_g"],

}


# ==========================================================
# Generator
# ==========================================================
def generate_items_df(settings: dict = SETTINGS) -> pd.DataFrame:
    random.seed(settings["seed"])

    n_total = int(settings["n_total_products"])
    n_devices = int(settings["n_devices"])
    n_acc = int(settings["n_accessories"])
    n_sp = int(settings["n_spare_parts"])

    include_bulk = bool(settings["include_bulk_refills"])
    bulk_rows_cfg = settings["bulk_refills"] if include_bulk else []
    n_bulk = len(bulk_rows_cfg)

    # Sanity checks
    if n_devices > len(settings["devices_catalog"]):
        raise ValueError("n_devices exceeds devices_catalog length. Add more device entries or reduce n_devices.")

    if n_acc > len(settings["accessories_catalog"]):
        raise ValueError("n_accessories exceeds accessories_catalog length. Add more entries or reduce n_accessories.")

    if n_sp > len(settings["spare_parts_catalog"]):
        raise ValueError("n_spare_parts exceeds spare_parts_catalog length. Add more entries or reduce n_spare_parts.")

    fixed = n_devices + n_acc + n_sp + n_bulk
    if fixed > n_total:
        raise ValueError(
            f"Fixed items (devices+accessories+spare_parts+bulk={fixed}) exceed n_total_products={n_total}. "
            f"Increase n_total_products or reduce fixed counts."
        )

    n_refills_regular = n_total - fixed

    rows = []

    # -------------------------
    # 1) Devices
    # -------------------------
    device_catalog = settings["devices_catalog"][:n_devices]
    for d in device_catalog:
        brand = random.choice(settings["device_brands"])
        rows.append({
            "product_name": f"{brand} {d['name']}",
            "brand": brand,
            "category": "DEVICE",
            "gramm_g": "",
        })

    # -------------------------
    # 2) Accessories
    # -------------------------
    for name in settings["accessories_catalog"][:n_acc]:
        brand = random.choice(settings["device_brands"])
        rows.append({
            "product_name": f"{brand} {name}",
            "brand": brand,
            "category": "ACCESSORY",
            "gramm_g": "",
        })

    # -------------------------
    # 3) Spare parts
    # -------------------------
    for name in settings["spare_parts_catalog"][:n_sp]:
        brand = random.choice(settings["device_brands"])
        rows.append({
            "product_name": f"{brand} {name}",
            "brand": brand,
            "category": "SPARE_PART",
            "gramm_g": "",
        })

    # -------------------------
    # 4) Bulk refills (industrial)
    # -------------------------
    for br in bulk_rows_cfg:
        brand = br["brand"]
        scent = br["scent"]
        gramm = int(br["gramm_g"])
        suffix = br.get("suffix", "").strip()
        suffix_part = f" {suffix}" if suffix else ""
        rows.append({
            "product_name": f"{brand} Refill Liquid {scent} {gramm}{suffix_part}",
            "brand": brand,
            "category": "REFILL",
            "gramm_g": gramm,
        })

    # -------------------------
    # 5) Regular refills (distributed across refill brands)
    # -------------------------
    refill_brands = list(settings["refill_brands"])
    scents = list(settings["scents"])
    sizes = list(settings["refill_sizes_g"])

    # distribute evenly by brand to keep it “business-like”
    base = n_refills_regular // len(refill_brands)
    remainder = n_refills_regular % len(refill_brands)

    # Build brand quotas
    quotas = {b: base for b in refill_brands}
    for b in refill_brands[:remainder]:
        quotas[b] += 1

    # generate refills
    for brand, qty in quotas.items():
        for _ in range(qty):
            scent = random.choice(scents)
            gramm = int(random.choice(sizes))
            rows.append({
                "product_name": f"{brand} Refill Liquid {scent} {gramm}",
                "brand": brand,
                "category": "REFILL",
                "gramm_g": gramm,
            })

    # -------------------------
    # Mix order (important per your request)
    # -------------------------
    random.shuffle(rows)

    # Assign sequential internal product_id after mixing
    df = pd.DataFrame(rows)
    df.insert(0, "product_id", range(1, len(df) + 1))

    # Ensure column order & types
    df = df[settings["columns"]].copy()

    # gramm_g should be integer or blank (no units). Keep blank as "".
    # Pandas may infer mixed types; force to object with clean values.
    df["gramm_g"] = df["gramm_g"].apply(lambda x: "" if x == "" else int(x))

    return df

def export_items_csv(df: pd.DataFrame, csv_path: Path) -> Path:
    csv_path = Path(csv_path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False)
    return csv_path