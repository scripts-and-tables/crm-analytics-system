"""
CRM Analytics Showcase — Streamlit + Plotly dashboard.

Reads from the SQLite file built by db/build.py and presents the CRM
snapshot as four tabs:

  1. Overview  — top-line counts, value-tier mix and current-month events.
  2. Segments  — per-customer drill-down with filters and CSV export.
  3. Lifecycle — multi-month trends in tier mix and lifecycle events.
  4. Products  — top consumable brands and category-line mix.

Run:
    python db/build.py                       # build data/input/crm.db
    streamlit run app/streamlit_app.py
"""

import sqlite3
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

REPO = Path(__file__).resolve().parents[1]
DEFAULT_DB = REPO / "data" / "input" / "crm.db"

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


@st.cache_resource
def get_conn(db_path: str) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, check_same_thread=False)


@st.cache_data
def list_months(_con) -> list[str]:
    return [r[0] for r in _con.execute(
        "SELECT DISTINCT report_mth_eom FROM crm_customer_snapshot ORDER BY 1 DESC"
    ).fetchall()]


@st.cache_data
def load_snapshot(_con, month: str) -> pd.DataFrame:
    return pd.read_sql_query(
        """
        SELECT s.*, c.customer_name, c.customer_group, c.city
        FROM crm_customer_snapshot s
        JOIN raw_customers c USING(customer_id)
        WHERE report_mth_eom = ?
        """,
        _con, params=(month,),
    )


@st.cache_data
def load_trend(_con) -> pd.DataFrame:
    return pd.read_sql_query(
        """
        SELECT report_mth_eom,
               activity_status,
               COALESCE(value_tier, '<NA>')      AS value_tier,
               COALESCE(lifecycle_event, '<NA>') AS lifecycle_event,
               COUNT(*)                          AS n
        FROM crm_customer_snapshot
        GROUP BY 1, 2, 3, 4
        ORDER BY 1
        """,
        _con,
    )


@st.cache_data
def load_product_engagement(_con) -> pd.DataFrame:
    return pd.read_sql_query(
        """
        SELECT p.brand,
               p.category,
               SUM(s.quantity * COALESCE(p.unit_size, 1)) AS units,
               SUM(s.quantity)                            AS qty,
               COUNT(*)                                   AS n_lines
        FROM raw_sales_transactions s
        JOIN raw_products p USING(product_id)
        WHERE s.quantity > 0
        GROUP BY 1, 2
        """,
        _con,
    )


def tier_sort_key(tier):
    return TIER_ORDER.index(tier) if tier in TIER_ORDER else len(TIER_ORDER)


def page_overview(snapshot: pd.DataFrame):
    st.subheader("Overview")
    n_total = len(snapshot)
    n_active = int((snapshot["activity_status"] == "Active").sum())
    n_events = int(snapshot["lifecycle_event"].notna().sum())
    avg_tenure = snapshot["tenure_months"].dropna().mean()

    cols = st.columns(4)
    cols[0].metric("Customers in snapshot", f"{n_total:,}")
    cols[1].metric("Active",
                   f"{n_active:,}",
                   f"{(n_active / n_total * 100):.1f}% of total" if n_total else "—")
    cols[2].metric("Lifecycle events", f"{n_events:,}")
    cols[3].metric("Avg tenure (months)", f"{avg_tenure:.1f}" if pd.notna(avg_tenure) else "—")

    left, right = st.columns(2)

    with left:
        st.markdown("**Value Tier mix (Active customers)**")
        tier_df = (snapshot.loc[snapshot["activity_status"] == "Active", ["value_tier"]]
                          .fillna({"value_tier": "<NA>"})
                          .groupby("value_tier", as_index=False).size()
                          .rename(columns={"size": "n"}))
        tier_df = tier_df.sort_values("value_tier", key=lambda s: s.map(tier_sort_key))
        fig = px.pie(tier_df, values="n", names="value_tier", hole=0.55,
                     color="value_tier", color_discrete_map=TIER_COLORS,
                     category_orders={"value_tier": TIER_ORDER})
        fig.update_traces(textposition="inside", textinfo="label+percent")
        fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=380, showlegend=False)
        st.plotly_chart(fig, width="stretch")

    with right:
        st.markdown("**Lifecycle events this month**")
        evt_df = (snapshot.loc[snapshot["lifecycle_event"].notna(), ["lifecycle_event"]]
                          .groupby("lifecycle_event", as_index=False).size()
                          .rename(columns={"size": "n"}))
        if evt_df.empty:
            st.info("No lifecycle events in this month.")
        else:
            fig = px.bar(evt_df, x="lifecycle_event", y="n",
                         color="lifecycle_event", color_discrete_map=EVENT_COLORS,
                         text="n")
            fig.update_traces(textposition="outside")
            fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=380,
                              showlegend=False, xaxis_title=None, yaxis_title="customers")
            st.plotly_chart(fig, width="stretch")

    st.markdown("**Per-tier KPI averages (Active customers)**")
    kpi = (snapshot[snapshot["activity_status"] == "Active"]
           .groupby("value_tier", dropna=False)
           .agg(customers=("customer_id", "count"),
                avg_AMC=("avg_monthly_consumption", "mean"),
                avg_AOS=("avg_order_size", "mean"),
                avg_O6=("o6", "mean"),
                avg_tenure_months=("tenure_months", "mean"))
           .reset_index())
    kpi = kpi.sort_values("value_tier", key=lambda s: s.map(tier_sort_key))
    st.dataframe(kpi.style.format({
        "avg_AMC": "{:.0f}",
        "avg_AOS": "{:.0f}",
        "avg_O6": "{:.1f}",
        "avg_tenure_months": "{:.1f}",
    }), width="stretch", hide_index=True)


def page_segments(snapshot: pd.DataFrame):
    st.subheader("Segments — per-customer drill-down")

    cols = st.columns(4)
    activity = cols[0].multiselect("Activity status", ["Active", "Not Active"], default=["Active"])
    tiers = cols[1].multiselect("Value tier", TIER_ORDER, default=TIER_ORDER)
    events = cols[2].multiselect("Lifecycle event", ["New", "Lost", "Reactivated"], default=[])
    groups = sorted(snapshot["customer_group"].dropna().unique())
    sel_groups = cols[3].multiselect("Customer group", groups, default=groups)

    df = snapshot.copy()
    if activity:
        df = df[df["activity_status"].isin(activity)]
    if tiers:
        df = df[df["value_tier"].isin(tiers)]
    if events:
        df = df[df["lifecycle_event"].isin(events)]
    if sel_groups:
        df = df[df["customer_group"].isin(sel_groups)]

    st.markdown(f"**{len(df):,} customers match the filter.**")

    show_cols = ["customer_id", "customer_name", "customer_group", "city",
                 "activity_status", "value_tier", "lifecycle_event",
                 "tenure_months", "avg_monthly_consumption", "avg_order_size", "o6",
                 "first_consumable_purchase_date", "last_consumable_purchase_date"]
    st.dataframe(df[show_cols], width="stretch", hide_index=True, height=520)

    st.download_button(
        "Download as CSV",
        data=df[show_cols].to_csv(index=False).encode("utf-8"),
        file_name="crm_customers.csv",
        mime="text/csv",
    )


def page_lifecycle(trend_df: pd.DataFrame):
    st.subheader("Lifecycle trends across months")

    tier_trend = trend_df[trend_df["activity_status"] == "Active"].groupby(
        ["report_mth_eom", "value_tier"], as_index=False)["n"].sum()
    tier_trend = tier_trend[tier_trend["value_tier"] != "<NA>"]

    st.markdown("**Active customer mix by value tier (stacked, monthly)**")
    fig = px.bar(tier_trend, x="report_mth_eom", y="n", color="value_tier",
                 color_discrete_map=TIER_COLORS,
                 category_orders={"value_tier": TIER_ORDER})
    fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=420,
                      xaxis_title=None, yaxis_title="active customers",
                      barmode="stack", legend_title=None)
    st.plotly_chart(fig, width="stretch")

    activity_trend = (trend_df.groupby(["report_mth_eom", "activity_status"], as_index=False)["n"]
                              .sum())
    st.markdown("**Active vs Not Active over time**")
    fig = px.area(activity_trend, x="report_mth_eom", y="n", color="activity_status",
                  color_discrete_map={"Active": "#10B981", "Not Active": "#9CA3AF"})
    fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=300,
                      xaxis_title=None, yaxis_title="customers", legend_title=None)
    st.plotly_chart(fig, width="stretch")

    evt_trend = trend_df[trend_df["lifecycle_event"] != "<NA>"].groupby(
        ["report_mth_eom", "lifecycle_event"], as_index=False)["n"].sum()
    st.markdown("**Lifecycle events per month**")
    if evt_trend.empty:
        st.info("No lifecycle events recorded across the loaded months.")
    else:
        fig = px.line(evt_trend, x="report_mth_eom", y="n", color="lifecycle_event",
                      color_discrete_map=EVENT_COLORS, markers=True)
        fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=320,
                          xaxis_title=None, yaxis_title="customers", legend_title=None)
        st.plotly_chart(fig, width="stretch")


def page_products(prod_df: pd.DataFrame):
    st.subheader("Product engagement")

    cons = (prod_df[prod_df["category"] == "consumable"]
                    .groupby("brand", as_index=False)
                    .agg(units=("units", "sum"), n_lines=("n_lines", "sum"))
                    .sort_values("units", ascending=False))

    left, right = st.columns(2)
    with left:
        st.markdown("**Consumable units sold by brand**")
        fig = px.bar(cons, x="brand", y="units", color="brand",
                     text=cons["units"].apply(lambda v: f"{v:,.0f}"))
        fig.update_traces(textposition="outside")
        fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=380,
                          showlegend=False, xaxis_title=None, yaxis_title="units")
        st.plotly_chart(fig, width="stretch")

    with right:
        st.markdown("**Transaction-line mix by category**")
        cat = prod_df.groupby("category", as_index=False)["n_lines"].sum()
        fig = px.pie(cat, values="n_lines", names="category", hole=0.45)
        fig.update_traces(textposition="inside", textinfo="label+percent")
        fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), height=380, showlegend=False)
        st.plotly_chart(fig, width="stretch")


def main():
    st.set_page_config(page_title="CRM Analytics Showcase", layout="wide")
    st.title("CRM Analytics Showcase")
    st.caption("Customer-level CRM snapshot powered by the RFMT business logic in `docs/crm_calculation_logic.md`.")

    db_path = DEFAULT_DB
    if not db_path.exists():
        st.error(
            f"Database not found at `{db_path.relative_to(REPO)}`.\n\n"
            "Build it with:\n\n"
            "```\npython scripts/generate_data/generate.py\npython db/build.py\n```"
        )
        st.stop()

    con = get_conn(str(db_path))
    months = list_months(con)
    if not months:
        st.error("crm_customer_snapshot is empty. Re-run db/build.py.")
        st.stop()

    with st.sidebar:
        st.markdown("### Snapshot month")
        month = st.selectbox("Report month-end", months, index=0)
        st.caption(f"DB: `{db_path.relative_to(REPO)}` · {len(months)} months loaded")
        st.markdown("---")
        st.markdown(
            "**Value Tier ladder** (top-down precedence)\n\n"
            "1. **Passive** — Active in 12 mo, silent for ≥6 mo\n"
            "2. **Diamond** — high AMC + AOS + frequency\n"
            "3. **Platinum** — high AMC + frequency\n"
            "4. **Gold** — high AMC\n"
            "5. **Silver** — moderate AMC\n"
            "6. **Bronze** — any consumable activity"
        )

    snapshot = load_snapshot(con, month)
    trend_df = load_trend(con)
    prod_df = load_product_engagement(con)

    tabs = st.tabs(["Overview", "Segments", "Lifecycle Trends", "Products"])
    with tabs[0]:
        page_overview(snapshot)
    with tabs[1]:
        page_segments(snapshot)
    with tabs[2]:
        page_lifecycle(trend_df)
    with tabs[3]:
        page_products(prod_df)


if __name__ == "__main__":
    main()
