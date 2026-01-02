# src/gen_synt_data/__main__.py

# 1. OPEN: Open command line (Windows + R -> cmd -> Enter)
# 2. RUN: Change directory to project folder (cd ...)
# 3. RUN: set PYTHONPATH=src
# 4. RUN: python -m gen_synt_data


from pathlib import Path
import pandas as pd

from .items import generate_items_df
from .items import SETTINGS as SETTINGS_ITEMS

from .customers import generate_customers_df
from .customers import SETTINGS as SETTINGS_CUSTOMERS

repo_root = Path(__file__).resolve().parents[2]
data_path = repo_root / "data" / "input"

def export_df_to_csv(df: pd.DataFrame, csv_path: Path) -> Path:
    csv_path = Path(csv_path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False)
    return csv_path

def main():

    for (filename, settings, func) in (
        ('items.csv', SETTINGS_ITEMS, generate_items_df),
        ('customers.csv', SETTINGS_CUSTOMERS, generate_customers_df),
    ):
        df = func(settings)
        csv_path = data_path / filename
        export_df_to_csv(df=df, csv_path=csv_path)
        print(f"Saved {filename}: {csv_path}")


if __name__ == "__main__":
    main()
