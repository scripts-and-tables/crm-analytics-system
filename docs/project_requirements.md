# CRM Project — System Requirements (Simplified)

## Introduction

We have access to three core datasets: **Sales Transactions**, **Customers Master**, and **Products (Items) Master**. The business teams—primarily **Marketing** and **Sales**, supported by the **Data team** (and relevant suppliers/partners where applicable)—want to generate deeper customer insights and apply established marketing practices (segmentation, lifecycle monitoring, and targeted customer lists).

To enable this, the system must:

* Transform and aggregate the raw inputs into consistent, validated, and analytics-ready datasets
* Store the curated results in a backend database for reliable access
* Expose the information via self-service reporting so business teams can filter and extract relevant customer data

---

## Expected Results

1. **Clean curated data in a database** available for:

   * Ad-hoc analysis
   * Targeted extraction requests using filters (even if some filters are not exposed in the UI)

2. **Standard Excel output(s)**:

   * A summary report that can be exported/submitted as needed

3. **Automatic transformation and calculation**:

   * Data is transformed and calculated automatically as soon as the most updated input data is received

4. **Self-service Power BI reporting**:

   * Power BI reports are updated and available so Marketing and Sales can:

     * Filter customers by key attributes (e.g., month, segment/category/status, opt-in flags)
     * Extract/export lists for actioning
     * Review aggregated summaries (e.g., totals by segment/category)

---

## High-Level System Requirements

### Backend (Data & Storage)

* The system must ingest the agreed input files (Sales Transactions yearly files, Customers Master, Products Master).
* The system must store a **monthly CRM snapshot for every customer** (historical months remain available for analysis).
* The system must support **filtered extraction** for business and analytical use cases, including:

  * Month selection
  * Segment/category/status (as defined in the CRM logic)
  * Opt-in flags (email/SMS/phone)
  * Customer group / city / store (where applicable)
* The system must support exporting the extracted results in common formats (CSV/Excel).

### Automation

* The system must refresh calculations automatically upon receipt of updated data (batch refresh workflow).
* The system must provide basic data quality controls (e.g., missing customer_id/product_id, invalid dates) and logging.

### Frontend / Reporting (Power BI)

* The reporting layer must provide:

  * Customer list view with filters and export
  * Aggregated summaries (customer counts by segment/category) with time context
* The latest month should be easy to access (default view), while historical navigation can be enabled as required.
