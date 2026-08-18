# Evidence base

Every segmentation rule in this project is either **traceable to a published
source** or **explicitly labelled a choice**. This file is where that trace
lives. It exists so the business logic can be argued with rather than merely
believed, and so the parts we made up are visible as things we made up.

Sources were checked and links verified on **18 August 2026**.

---

## How a source got onto this list

A source qualified only if all four held:

1. **It is peer-reviewed marketing science, published by a named institution, or
   a professional-services study that publishes its methodology.** Blog posts,
   vendor white papers and content-marketing "statistics" pages were rejected.
2. **It is free to read**, in full, without a subscription — with one deliberate
   exception, noted below.
3. **The link resolves.** Each URL was fetched and returned HTTP 200 with the
   expected content type on the date above.
4. **It says something this project can act on.** General "customers matter"
   material was left out.

**No third-party PDFs are committed to this repository.** The papers below are
author-hosted or institution-hosted copies, and redistributing them from an
MIT-licensed public repo is not ours to do. Links only.

---

## The sources

### 1. Ascarza et al. (2018) — the retention review

> Ascarza, E., Neslin, S. A., Netzer, O., Anderson, Z., Fader, P. S., Gupta, S.,
> Hardie, B. G. S., Lemmens, A., Libai, B., Neal, D., Provost, F., & Schrift, R.
> (2018). *In Pursuit of Enhanced Customer Retention Management: Review, Key
> Issues, and Future Directions.* **Customer Needs and Solutions**.
> DOI: [10.1007/s40547-017-0080-0](https://doi.org/10.1007/s40547-017-0080-0)

**Free full text (Harvard Business School):**
<https://www.hbs.edu/ris/Publication%20Files/ascarza_et_al_cns_17_e08d63cf-0b65-4526-9d23-b0b09dcee9b9_538a6ea6-a480-4841-b9f0-a87be24989ba.pdf>

The single most useful source for this project. It is the output of a workshop
at the 10th Triennial Invitational Choice Symposium, and its twelve authors sit
at Harvard Business School, Wharton, Columbia, London Business School, Tuck, NYU
Stern and Tilburg — plus a practitioner from Electronic Arts.

Three claims bear directly on what we built:

- It advocates **a definition of retention that extends beyond the traditional
  binary retain / not-retain view**, and surveys metrics ranging "from 0:1
  measures to recency/frequency calculations to metrics imputed from models
  designed to measure unobserved churn."
- It highlights **"the importance of distinguishing between which customers are
  at risk and which should be targeted — as they are not necessarily the same
  customers,"** noting that the highest-risk customers "do not necessarily
  overlap 100% with those who should be targeted."
- It reports **growing evidence that retention campaigns can be futile or even
  harmful**, and that 49% of top executives admit to being unhappy with their
  ability to support their retention goals.

### 2. Fader, Hardie & Lee (2005) — RFM and CLV

> Fader, P. S., Hardie, B. G. S., & Lee, K. L. (2005). *RFM and CLV: Using
> Iso-Value Curves for Customer Base Analysis.* **Journal of Marketing
> Research**, 42(4), 415–430.

**Free full text (author-hosted):**
<https://www.brucehardie.com/papers/rfm_clv_2005-02-16.pdf>
**Mirror (Wharton):**
<https://faculty.wharton.upenn.edu/wp-content/uploads/2012/05/Rfm_clv_2005-02-16_accepted.pdf>

The paper that formally connects the RFM paradigm this project is built on to
customer lifetime value. From its abstract: it presents "a formal model that
requires nothing more than RFM inputs to make specific lifetime value
projections," using a Pareto/NBD framework for transaction flow and a
gamma-gamma sub-model for spend per transaction, and it "reveals a number of
subtle but important **non-linear** associations that would be missed by relying
on observed data alone."

That last clause is the warning label for our tier thresholds. Sorting customers
by observed RFM into bands is a heuristic; it is not the same thing as valuing
them.

### 3. Fader & Hardie (2009) — probability models for customer-base analysis

> Fader, P. S., & Hardie, B. G. S. (2009). *Probability Models for Customer-Base
> Analysis.* **Journal of Interactive Marketing**, 23(1), 61–69.

**Free full text (Wharton):**
<https://faculty.wharton.upenn.edu/wp-content/uploads/2012/04/Fader_hardie_jim_09.pdf>

The methodological companion. Its taxonomy separates **contractual** settings
(you know when a customer leaves — they cancel) from **non-contractual** ones
(you never observe the defection, you only observe silence). This project is
squarely non-contractual, which is precisely the case where a fixed
"no purchase in N days = inactive" rule is a guess dressed as a fact.

### 4. Reichheld & Sasser (1990) — the retention-profit link

> Reichheld, F. F., & Sasser, W. E. (1990). *Zero Defections: Quality Comes to
> Services.* **Harvard Business Review**, 68(5), 105–111.

**Record (free):** <https://www.hbs.edu/faculty/Pages/item.aspx?num=9151> ·
**Article (paywalled):** <https://hbr.org/1990/09/zero-defections-quality-comes-to-services>

The one paywalled entry, listed because it is the origin of the most-quoted
number in this field and we need the primary reference to quote it correctly.
See *Numbers we will not use*, below.

### 5. James, Witten, Hastie & Tibshirani (2021) — statistical learning

> James, G., Witten, D., Hastie, T., & Tibshirani, R. (2021). *An Introduction to
> Statistical Learning*, 2nd edition. Springer.

**Free PDF (official):** <https://www.statlearning.com/>

The standard free graduate text, released by its authors. Relevant here for
classification, resampling and model assessment — i.e. everything needed if the
project moves from threshold rules to a fitted churn model. A Python edition
(2023) is on the same page.

### 6. PwC (2025) — Customer Experience Survey

**Free:** <https://www.pwc.com/us/en/services/consulting/business-transformation/library/2025-customer-experience-survey.html>

Methodology is published: **5,511 consumers and 406 executives in the United
States, surveyed 21 May – 30 June 2025.** The findings that matter to a
measurement project:

- **57% of executives say that while customer loyalty is vital, their loyalty
  systems are not delivering the outcomes they need.**
- **83% admit they need better tools to measure what is actually driving
  purchases** — while 84% say they have increased spending on loyalty.
- 46% say their company's current loyalty programme will be irrelevant in three
  years.
- 52% of consumers stopped buying from a brand after a bad product experience;
  29% after a poor customer experience.

The spend-versus-measurement gap in the second bullet is the clearest
third-party statement of the problem this project addresses.

### 7. EY (2025) — Future Consumer Index

**Free:** <https://www.ey.com/en_gl/newsroom/2025/03/ey-future-consumer-index-brands-fall-out-of-favor-as-pressure-mounts-to-win-back-faltering-customer-loyalty>

The 15th edition, **20,000 consumers across 26 countries**. Reports that brand
loyalty is weakening against value: 54% of respondents buy branded products only
on sale, and 72% of US consumers consider private label equal to brands for
their needs.

Useful as context for *why* a tier can decay, and a caution against reading a
tier drop as a purely customer-specific event when the whole market is moving.

---

## What the evidence says about what we built

Each row is a rule that currently exists in this repository, checked against the
sources above. `crm_calculation_logic.md` remains the source of truth for what
the code does; this table is the source of truth for **why**.

| # | Our practice | What the evidence says | Verdict |
|---|---|---|---|
| 1 | **RFMT bands** — customers sorted into value tiers by thresholds on volume, order frequency and recency | Fader/Hardie (2005) treat RFM as the correct *input* but derive value from a fitted model, warning that observed-data banding misses non-linear associations | **Defensible heuristic.** Honest as a segmentation; must not be described as a valuation |
| 2 | **Binary `Activity Status`** — Active / Not Active from a 12-month recency window | Ascarza et al. (2018) explicitly advocate extending retention "beyond the traditional binary retain/not retain view", and place 0:1 measures at the *bottom* of a ladder that rises to model-imputed unobserved churn | **Diverges from current best practice.** The weakest rule we have |
| 3 | **The "frequent buyers going cold" cell** is presented in the portal as "prime win-back targets" | Ascarza et al. (2018): highest-risk customers "do not necessarily overlap 100% with those who should be targeted"; retention campaigns "can be futile or even harmful" | **Overstated.** The grid identifies *risk*. It does not identify who is worth contacting |
| 4 | **Non-contractual assumption** — churn is never observed, only inferred from silence | Fader/Hardie (2009) taxonomy: this is the non-contractual case, where the defection event is unobservable by construction | **Correctly classified**, which is exactly why rule 2 is a problem |
| 5 | **Consumables only** drive engagement; devices, accessories and spare parts are excluded | No source prescribes this. It follows the repeat-purchase logic customer-base analysis assumes — a one-off purchase carries no repeat signal | **A choice**, and a reasonable one. Labelled as such |
| 6 | **Returns excluded** from engagement metrics | No source. A data-hygiene decision | **A choice** |
| 7 | **Calendar-month windows** rather than rolling day windows | No source. An implementation decision for reproducibility | **A choice** |
| 8 | **The portal's tiers** (VIP…XXS) are pure trailing-12-month spend | Monetary value alone is one third of RFM; Fader/Hardie (2005) show recency and frequency carry most of the discriminating power for future value | **Diverges.** The furthest of anything here from the literature |

---

## Numbers we will not use

Two figures circulate constantly in this field and neither survives a check.
They are recorded here so nobody adds them later in good faith.

**"A 5% increase in retention raises profits by 25–95%."**
The primary source is Reichheld & Sasser (1990), and what it actually reports is
a set of **industry-specific** results: cutting the defection rate by 5%
increased profits by **85% in one bank's branch system, 50% in an insurance
brokerage, and 30% in an auto-service chain**. The familiar "25–95%" band is a
later summary of a range of cases, not a general law, and it is routinely quoted
without its industry context or its date. If the retention–profit link is worth
stating, state a specific case and cite the year.

**"It costs five times more to acquire a customer than to retain one."**
No primary source was located for this during the review. It is repeated without
attribution across vendor marketing. **Not used anywhere in this project.**

---

## What this changes, in priority order

The point of an evidence base is that it produces work, not footnotes.

1. **Unify the two tier models.** The portal's spend-only ladder (row 8) and the
   dashboard's RFMT model (row 1) currently disagree, and the spend-only one is
   the less defensible of the two. One model, RFMT-based, across both surfaces.
2. **Replace the binary active flag with a continuous measure** (row 2). A
   probability that a customer is still "alive", in the Fader/Hardie sense,
   rather than a cliff edge at 365 days. The binary flag can remain as a derived
   convenience, but it should be derived, not primary.
3. **Separate "at risk" from "worth targeting"** (row 3). Rename the win-back
   cell, and add a second dimension — expected response, not just risk — before
   any screen recommends contacting anyone.
4. **Add a CLV projection** (row 1). Once 2 exists, the iso-value approach in
   Fader/Hardie (2005) becomes available, and tiers can be sanity-checked against
   projected value rather than only against past spend.

Items 1–3 are corrections. Item 4 is an extension.

---

## Provenance

| Checked | Result |
|---|---|
| All links above | Fetched 18 Aug 2026; HTTP 200 with expected content type |
| Ascarza et al. (2018) | PDF retrieved and read directly; author list, affiliations and quoted passages taken from the document, not from a summary |
| Fader, Hardie & Lee (2005) | PDF retrieved; abstract quoted from the document |
| PwC (2025) | Statistics and methodology read from the published page |
| Paywalled | Reichheld & Sasser (1990) only — cited for provenance, not quoted beyond the figures reported in secondary indexes |

If a link rots, the DOI and the full citation are above; do not substitute a
different source under the same claim without re-checking what it actually says.
