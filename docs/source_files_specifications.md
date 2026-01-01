# CRM Project — Source Files Details

## Purpose

This document defines the **input CSV files** used by the CRM project:

* What each file represents
* Which columns it contains (field definitions, formats, and constraints)
* How the files relate to each other (keys and relationships)

These files are expected to be stored in the project **raw input folder** (landing area) and serve as the authoritative source for downstream calculations (segments, activity status, events, etc.).

---

## 1) Sales Transactions (CSV)

### File naming convention

One file per year.

**Examples**

* `sales_transactions_2020.csv`
* `sales_transactions_2021.csv`
* `sales_transactions_2022.csv`

### What it represents

Transactional sales records at **invoice level** (one row per invoice). This file family is the primary behavioral source used to derive refill behavior, consumption, revenue, and event logic.

### Grain

* **1 row per invoice_id / product_id**

### Columns

| Column         | Description                 | Format / Type      | Notes                                                                 |
| -------------- | --------------------------- | ------------------ | --------------------------------------------------------------------- |
| `invoice_id`   | Business invoice identifier | Text / Integer     | **Not a primary key**; duplicates may exist depending on source rules |
| `customer_id`  | Customer identifier         | Text / Integer     | **Foreign key** → Customers master (`customer_id`)                    |
| `invoice_date` | Invoice date                | `YYYY-MM-DD` (ISO) | Date only (no time)                                                   |
| `product_id`   | Product identifier          | Text / Integer     | **Foreign key** → Products master (`product_id`)                      |
| `quantity`     | Quantity sold               | Numeric            | Sign convention to be defined (e.g., returns)                         |
| `revenue`      | Net amount (revenue)        | Numeric            | Net revenue amount per invoice                                        |
| `store_id`     | Store identifier            | Text / Integer     | Optional, but retained                                                |

**Notes**

* These yearly files should have **identical structure** (same columns, formats, and meaning) to support concatenation into a single unified dataset.

---

## 2) Customers Master (CSV)

### File name (example)

`customers_master.csv`

### What it represents

Customer reference data (stable attributes used for segmentation, contactability, and grouping).

### Grain

* **1 row per customer**

### Columns

| Column           | Description                       | Format / Type      | Notes                                                        |
| ---------------- | --------------------------------- | ------------------ | ------------------------------------------------------------ |
| `customer_id`    | Customer identifier               | Text / Integer     | **Primary key**                                              |
| `customer_name`  | Customer name                     | Text               |                                                              |
| `customer_group` | Customer group / cluster          | Text               | Used for grouping/analysis                                   |
| `city`           | City                              | Text               |                                                              |
| `created_date`   | Customer creation date            | `YYYY-MM-DD` (ISO) |                                                              |
| `email`          | Email address                     | Text               | Nullable                                                     |
| `mobile_number`  | Mobile phone number               | Text               | Nullable; store as text to preserve leading zeros/formatting |
| `opt_email`      | Marketing consent for email       | Boolean / 0-1      | Nullable allowed; define default handling                    |
| `opt_sms`        | Marketing consent for SMS         | Boolean / 0-1      | Nullable allowed; define default handling                    |
| `opt_phone`      | Marketing consent for phone calls | Boolean / 0-1      | Nullable allowed; define default handling                    |

---

## 3) Products Master (CSV)

### File name (example)

`products_master.csv`

### What it represents

Product reference data required to classify transactions (e.g., refill vs non-refill via category rules) and compute consumption.

### Grain

* **1 row per product**

### Columns

| Column         | Description               | Format / Type | Notes                                             |
| -------------- | ------------------------- | ------------- | ------------------------------------------------- |
| `product_id`   | Product identifier        | Integer       | **Primary key**                                   |
| `product_name` | Product name              | Text          |                                                   |
| `brand`        | Brand                     | Text          |                                                   |
| `category`     | Category                  | Text          | Options: device, refill, spare parts, accessories |
| `grammage_g`   | Grammage per unit (grams) | Numeric       | Required for consumption calculations             |

---

## 4) File Relationships

### Keys

* `sales_transactions.customer_id` → `customers_master.customer_id`
* `sales_transactions.product_id` → `products_master.product_id`

##
