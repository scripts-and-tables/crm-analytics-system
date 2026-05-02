"""
Build the static GitHub Pages site under docs/.

Reads from data/input/crm.db (built by db/build.py) and writes:

  docs/data.json            aggregated CRM snapshot for the JS to consume
  docs/screenshots/*.png    per-chart PNG previews (used in README + as fallback)
  docs/specs/*.html         each docs/specs/*.md rendered as a styled HTML page

Usage:
    python scripts/build_report.py
"""

import json
import sqlite3
import sys
from pathlib import Path

import markdown
import plotly.express as px
import plotly.graph_objects as go

REPO = Path(__file__).resolve().parents[1]
DB = REPO / "data" / "input" / "crm.db"
DOCS = REPO / "docs"
SCREENSHOTS = DOCS / "screenshots"
SPECS = DOCS / "specs"

TIER_ORDER = ["Diamond", "Platinum", "Gold", "Silver", "Bronze", "Passive"]
TIER_COLORS = {
    "Diamond":  "#67E8F9",
    "Platinum": "#94A3B8",
    "Gold":     "#FBBF24",
    "Silver":   "#CBD5E1",
    "Bronze":   "#D97706",
    "Passive":  "#6B7280",
}
EVENT_COLORS = {
    "New":         "#22C55E",
    "Lost":        "#EF4444",
    "Reactivated": "#3B82F6",
}
ACTIVITY_COLORS = {"Active": "#10B981", "Not Active": "#6B7280"}

# Plotly defaults that match the dark theme of the static site.
DARK_LAYOUT = dict(
    template="plotly_dark",
    paper_bgcolor="#0F172A",
    plot_bgcolor="#0F172A",
    font=dict(color="#E2E8F0", family="Inter, system-ui, sans-serif"),
    margin=dict(l=40, r=20, t=40, b=40),
)


# ---------------------------------------------------------------- queries
def fetch_aggregates(con):
    months = [r[0] for r in con.execute(
        "SELECT DISTINCT report_mth_eom FROM crm_customer_snapshot ORDER BY 1"
    )]

    aggregates = []
    for m in months:
        tier_mix = {t: 0 for t in TIER_ORDER}
        for r in con.execute("""
            SELECT value_tier, COUNT(*) FROM crm_customer_snapshot
            WHERE report_mth_eom = ? AND activity_status = 'Active' AND value_tier IS NOT NULL
            GROUP BY 1
        """, (m,)):
            tier_mix[r[0]] = r[1]

        events = {"New": 0, "Lost": 0, "Reactivated": 0}
        for r in con.execute("""
            SELECT lifecycle_event, COUNT(*) FROM crm_customer_snapshot
            WHERE report_mth_eom = ? AND lifecycle_event IS NOT NULL
            GROUP BY 1
        """, (m,)):
            events[r[0]] = r[1]

        activity = {"Active": 0, "Not Active": 0}
        for r in con.execute("""
            SELECT activity_status, COUNT(*) FROM crm_customer_snapshot
            WHERE report_mth_eom = ? GROUP BY 1
        """, (m,)):
            activity[r[0]] = r[1]

        kpi_by_tier = {}
        for r in con.execute("""
            SELECT value_tier,
                   COUNT(*),
                   AVG(avg_monthly_consumption),
                   AVG(avg_order_size),
                   AVG(o6),
                   AVG(tenure_months)
            FROM crm_customer_snapshot
            WHERE report_mth_eom = ? AND activity_status = 'Active' AND value_tier IS NOT NULL
            GROUP BY 1
        """, (m,)):
            kpi_by_tier[r[0]] = {
                "n":      r[1],
                "amc":    round(r[2], 1) if r[2] is not None else None,
                "aos":    round(r[3], 1) if r[3] is not None else None,
                "o6":     round(r[4], 1) if r[4] is not None else None,
                "tenure": round(r[5], 1) if r[5] is not None else None,
            }

        total = activity["Active"] + activity["Not Active"]
        avg_tenure = con.execute("""
            SELECT AVG(tenure_months) FROM crm_customer_snapshot
            WHERE report_mth_eom = ? AND tenure_months IS NOT NULL
        """, (m,)).fetchone()[0]

        aggregates.append({
            "month": m,
            "total_customers": total,
            "tier_mix": tier_mix,
            "events": events,
            "activity": activity,
            "kpi_by_tier": kpi_by_tier,
            "avg_tenure_months": round(avg_tenure, 1) if avg_tenure is not None else None,
        })

    latest = months[-1]

    customers = []
    for r in con.execute("""
        SELECT s.customer_id, c.customer_name, c.customer_group, c.city,
               s.activity_status, s.value_tier, s.lifecycle_event,
               s.tenure_months, s.avg_monthly_consumption, s.avg_order_size, s.o6,
               s.first_consumable_purchase_date, s.last_consumable_purchase_date
        FROM crm_customer_snapshot s
        JOIN raw_customers c USING(customer_id)
        WHERE s.report_mth_eom = ?
        ORDER BY s.avg_monthly_consumption DESC NULLS LAST, s.customer_id
    """, (latest,)):
        customers.append({
            "customer_id":          r[0],
            "name":                 r[1],
            "group":                r[2],
            "city":                 r[3],
            "activity":             r[4],
            "tier":                 r[5],
            "event":                r[6],
            "tenure_months":        r[7],
            "amc":                  round(r[8], 1) if r[8] is not None else None,
            "aos":                  round(r[9], 1) if r[9] is not None else None,
            "o6":                   r[10],
            "first_purchase":       r[11],
            "last_purchase":        r[12],
        })

    brand_units = []
    for r in con.execute("""
        SELECT p.brand, ROUND(SUM(s.quantity * COALESCE(p.unit_size, 1)), 0) AS units
        FROM raw_sales_transactions s
        JOIN raw_products p USING(product_id)
        WHERE s.quantity > 0 AND p.category = 'consumable'
        GROUP BY 1
        ORDER BY 2 DESC
    """):
        brand_units.append({"brand": r[0], "units": r[1]})

    category_lines = []
    for r in con.execute("""
        SELECT p.category, COUNT(*)
        FROM raw_sales_transactions s
        JOIN raw_products p USING(product_id)
        WHERE s.quantity > 0
        GROUP BY 1
    """):
        category_lines.append({"category": r[0], "n_lines": r[1]})

    return {
        "report_months": months,
        "latest_month":  latest,
        "monthly":       aggregates,
        "customers":     customers,
        "brand_units":   brand_units,
        "category_lines": category_lines,
    }


# ---------------------------------------------------------------- screenshots
def screenshot_tier_donut(latest_agg, out_path):
    items = [(t, latest_agg["tier_mix"][t]) for t in TIER_ORDER if latest_agg["tier_mix"][t] > 0]
    fig = go.Figure(data=[go.Pie(
        labels=[i[0] for i in items],
        values=[i[1] for i in items],
        hole=0.55,
        marker=dict(colors=[TIER_COLORS[i[0]] for i in items]),
        textinfo="label+percent",
        textfont=dict(size=12),
    )])
    fig.update_layout(**DARK_LAYOUT, title="Value Tier mix (Active customers)", showlegend=False)
    fig.write_image(out_path, width=720, height=480, scale=2)


def screenshot_events_bar(latest_agg, out_path):
    items = [(e, latest_agg["events"][e]) for e in ["New", "Reactivated", "Lost"]]
    fig = go.Figure(data=[go.Bar(
        x=[i[0] for i in items],
        y=[i[1] for i in items],
        marker_color=[EVENT_COLORS[i[0]] for i in items],
        text=[f"{i[1]:,}" for i in items],
        textposition="outside",
    )])
    fig.update_layout(**DARK_LAYOUT, title="Lifecycle events (latest month)",
                      xaxis_title=None, yaxis_title="customers", showlegend=False)
    fig.write_image(out_path, width=720, height=480, scale=2)


def screenshot_tier_trend(monthly, out_path):
    fig = go.Figure()
    for tier in TIER_ORDER:
        ys = [m["tier_mix"][tier] for m in monthly]
        fig.add_trace(go.Bar(
            x=[m["month"] for m in monthly], y=ys, name=tier,
            marker_color=TIER_COLORS[tier],
        ))
    fig.update_layout(**DARK_LAYOUT, barmode="stack",
                      title="Active customer mix by Value Tier (monthly)",
                      xaxis_title=None, yaxis_title="active customers",
                      legend=dict(orientation="h", y=-0.2))
    fig.write_image(out_path, width=1200, height=540, scale=2)


def screenshot_events_trend(monthly, out_path):
    fig = go.Figure()
    for evt in ["New", "Reactivated", "Lost"]:
        fig.add_trace(go.Scatter(
            x=[m["month"] for m in monthly],
            y=[m["events"][evt] for m in monthly],
            mode="lines+markers", name=evt,
            line=dict(color=EVENT_COLORS[evt], width=2),
            marker=dict(size=8),
        ))
    fig.update_layout(**DARK_LAYOUT, title="Lifecycle events per month",
                      xaxis_title=None, yaxis_title="customers",
                      legend=dict(orientation="h", y=-0.2))
    fig.write_image(out_path, width=1200, height=480, scale=2)


def screenshot_brand_units(brand_units, out_path):
    fig = go.Figure(data=[go.Bar(
        x=[b["brand"] for b in brand_units],
        y=[b["units"] for b in brand_units],
        marker_color="#67E8F9",
        text=[f"{b['units']:,.0f}" for b in brand_units],
        textposition="outside",
    )])
    fig.update_layout(**DARK_LAYOUT, title="Consumable units sold by brand",
                      xaxis_title=None, yaxis_title="units", showlegend=False)
    fig.write_image(out_path, width=900, height=480, scale=2)


# ---------------------------------------------------------------- markdown -> html
SPEC_TEMPLATE = """<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} &middot; CRM Analytics</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<link rel="stylesheet" href="../assets/css/style.css">
</head>
<body class="docs-page">
<nav class="navbar navbar-expand-lg fixed-top bg-body-tertiary border-bottom border-secondary-subtle">
  <div class="container">
    <a class="navbar-brand fw-semibold d-flex align-items-center gap-2" href="../index.html">
      <i class="bi bi-bar-chart-line-fill text-primary"></i>
      <span>CRM&nbsp;Analytics</span>
    </a>
    <div class="ms-auto d-flex align-items-center gap-2">
      <a class="btn btn-sm btn-outline-light" href="../index.html"><i class="bi bi-house"></i> Home</a>
      <a class="btn btn-sm btn-primary" href="../dashboard.html">Dashboard <i class="bi bi-arrow-right"></i></a>
    </div>
  </div>
</nav>
<header class="docs-header" style="margin-top: 56px;">
  <div class="container">
    <a href="../index.html" class="back-link">&larr; Back to landing</a>
    <h1>{title}</h1>
  </div>
</header>
<main class="docs-body">
{body}
</main>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
"""


def render_specs():
    SPECS.mkdir(parents=True, exist_ok=True)
    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc"])
    for src in sorted(SPECS.glob("*.md")):
        body = md.convert(src.read_text(encoding="utf-8"))
        # Use the first H1 as the title, fallback to the filename.
        first_h1 = body.split("<h1", 1)
        if len(first_h1) > 1:
            text = first_h1[1].split(">", 1)[1].split("</h1>", 1)[0]
            title = text.strip()
        else:
            title = src.stem.replace("_", " ").title()
        out = SPECS / (src.stem + ".html")
        out.write_text(SPEC_TEMPLATE.format(title=title, body=body), encoding="utf-8")
        print(f"  rendered {src.name} -> {out.name}")
        md.reset()


# ---------------------------------------------------------------- main
def main():
    if not DB.exists():
        print(f"ERROR: {DB} not found. Run db/build.py first.", file=sys.stderr)
        sys.exit(1)

    DOCS.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)

    print("Building data.json ...")
    data = fetch_aggregates(con)
    payload = json.dumps(data, separators=(",", ":"), default=str)
    (DOCS / "data.json").write_text(payload, encoding="utf-8")
    print(f"  data.json: {len(payload):,} bytes  "
          f"({len(data['monthly'])} months, {len(data['customers']):,} customers)")

    print("Rendering screenshots ...")
    latest_agg = data["monthly"][-1]
    screenshot_tier_donut(latest_agg, SCREENSHOTS / "tier_mix.png")
    print("  tier_mix.png")
    screenshot_events_bar(latest_agg, SCREENSHOTS / "events_bar.png")
    print("  events_bar.png")
    screenshot_tier_trend(data["monthly"], SCREENSHOTS / "tier_trend.png")
    print("  tier_trend.png")
    screenshot_events_trend(data["monthly"], SCREENSHOTS / "events_trend.png")
    print("  events_trend.png")
    screenshot_brand_units(data["brand_units"], SCREENSHOTS / "brand_units.png")
    print("  brand_units.png")

    print("Rendering spec docs ...")
    render_specs()

    print("\nDone.")
    print(f"  Open docs/index.html locally, or push and visit GitHub Pages.")


if __name__ == "__main__":
    main()
