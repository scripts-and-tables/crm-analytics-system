-- STAGING - DATES - 01

DROP TABLE IF EXISTS tt_dates;
CREATE TEMP TABLE tt_dates AS
WITH dt_ AS
	(SELECT '2024-12-31' AS rd)
SELECT
	rd as report_mth_eom,
	date(rd, 'start of month', '-0  month') report_m01_bom,
	date(rd, 'start of month', '-6  month') report_m06_bom,
	date(rd, 'start of month', '-7  month') report_m07_bom,
	date(rd, 'start of month', '-12 month') report_m12_bom,
	date(rd, 'start of month', '-12 month') report_m13_bom
FROM dt_;

-- STAGING - SALES - 01
-- Getting prefiltered sales

drop table if exists tt_stg_sales_01;
CREATE TEMP TABLE tt_stg_sales_01 AS
select
	invoice_id, customer_id, invoice_date,
	total(quantity) as tot_quantity
from
	sales
	LEFT JOIN items
	ON sales.product_id = items.product_id
WHERE category = 'REFILL'
GROUP BY invoice_id, customer_id;


-- STAGING - SALES - 02
-- Gruping sales
drop table if exists tt_stg_sales_02;
CREATE TEMP TABLE tt_stg_sales_02 AS
select
	customer_id,
	date(invoice_date, 'start of month') as date_bom,
	count(*) as num_invoices,
	total(tot_quantity) as tot_quantity
from tt_stg_sales_01
GROUP BY
	customer_id,
	date(invoice_date, 'start of month');

-- STAGING - CRM - 01
drop table if exists tt_crm_01;
create temp table tt_crm_01 AS
select
	tt_dates.report_mth_eom,

	customer_id,

	min(date_bom)		AS first_order_bom,
	max(date_bom)		AS last_order_bom,

	total(num_invoices) 														as num_invoices_all,
	TOTAL (case when date_bom >= report_m06_bom THEN num_invoices ELSE 0 END)	as num_invoices_06m,

	total(tot_quantity) as sales_all,
	TOTAL (case when date_bom >= report_m01_bom THEN tot_quantity ELSE 0 END)	as sales_01m,
	TOTAL (case when date_bom >= report_m06_bom THEN tot_quantity ELSE 0 END)	as sales_06m,
	TOTAL (case when date_bom >= report_m07_bom THEN tot_quantity ELSE 0 END)	as sales_07m,
	TOTAL (case when date_bom >= report_m12_bom THEN tot_quantity ELSE 0 END)	as sales_12m,
	TOTAL (case when date_bom >= report_m13_bom THEN tot_quantity ELSE 0 END)	as sales_13m
from
	tt_stg_sales_02, tt_dates
GROUP BY customer_id;

-- STAGING - CRM - 02
drop table if exists tt_crm_02;
create temp table tt_crm_02 AS
select
    customer_id,
	report_mth_eom,
	case when sales_12m > 0 THEN 1 ELSE 0 END AS crm_active,

	CASE
		WHEN sales_12m > 0 AND sales_12m = sales_all 			THEN 'NEW'
		WHEN sales_all > 0 AND sales_12m = 0					THEN 'LOST'
		WHEN sales_all > 0 AND sales_06m = 0					THEN 'LOST'
		WHEN sales_06m / 6.0 >= 25 AND num_invoices_06m >=50 	THEN 'ULTRA'
		WHEN sales_06m / 6.0 >= 20 AND num_invoices_06m >=50  	THEN 'HEAVY'
		WHEN sales_06m / 6.0 >= 15  							THEN 'LARGE'
		WHEN sales_06m / 6.0 >= 10 								THEN 'AVERAGE'
		WHEN sales_06m / 6.0 >= 5   							THEN 'LOW'
		WHEN sales_06m / 6.0 >  0   							THEN 'MINIMAL'
	END AS crm_segment,

	CASE
		WHEN sales_01m > 0 AND sales_01m == sales_all 							THEN 'NEW'
		WHEN sales_12m = 0 AND sales_13m > 0 									THEN 'LOST'
		WHEN sales_01m > 0 and sales_all > sales_01m and sales_13m = sales_01m 	THEN 'REACTIVATED'
	END AS crm_cur_mth_event

from tt_crm_01
order by sales_06m desc