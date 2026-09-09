# **Executive Summary — Beca Tech Scholars Progress Dashboard**

The **Beca Tech Scholars Progress Dashboard** will serve as a decision-support system for the ver+ Beca Tech program, enabling the team to monitor scholar progress, identify risks early, improve reporting, and make better programmatic and financial decisions.

Today, program data is distributed across JotForm submissions and a master Excel file. This creates manual reporting work, limits real-time visibility, and makes it difficult to track scholar progress, risk evolution, support participation, and unit economics in a consistent way. The proposed medium-term architecture addresses this by centralizing data in a structured database and connecting it to an interactive dashboard.

The recommended architecture is:

```text
JotForm forms
   ↓
JotForm API / Webhooks
   ↓
ETL and data validation layer
   ↓
PostgreSQL database
   ↓
Dashboard / BI frontend
   ↓
Decision-making views
```

The implementation should prioritize the **Scholar Tracking layer**, which is the most urgent need. This layer will allow leadership and program teams to answer key questions such as:

- How many scholars are currently active?
- How many have withdrawn?
- What is the program retention rate?
- Which scholars are at risk?
- How is scholar risk changing month by month?
- Are scholars progressing academically as expected?
- Are scholars participating in support activities?
- What types of alerts are most common: academic, psychosocial, or participation-related?
- What is the cost per active, retained, or supported scholar?

The dashboard should include six core views:

1. **Executive Overview**  
    A high-level panel with active scholars, withdrawals, retention rate, GPA, risk distribution, participation rate, and basic unit economics.
2. **Risk & Alerts**  
    An operational view for identifying scholars in medium, high, or critical risk, including alert type, monthly risk changes, missing check-ins, missing mentor reports, and recommended actions.
3. **Scholar Profile**  
    An individual history view showing each scholar’s academic progress, GPA, risk history, mentor reports, check-ins, support participation, requests, and relevant program information.
4. **Academic Progress**  
    A view focused on GPA, credits, failed or delayed subjects, enrollment status, and progress against the expected academic pathway.
5. **Support Participation**  
    A view to monitor participation in tutoring, mentoring, workshops, psychosocial support, and other program activities.
6. **Unit Economics**  
    A financial view showing scholarship amounts, cost per active scholar, cost per retained scholar, cost by cohort, country, university, and type of support.

A critical part of the project is moving away from the current wide Excel format and toward a normalized data model. Instead of maintaining repeated columns such as GPA by semester, risk by month, or participation by period, the system should use structured tables such as:

- `scholars`
- `academic_terms`
- `monthly_checkins`
- `mentor_reports`
- `support_activities`
- `scholar_requests`
- `risk_assessments`
- `financial_inputs`
- `selection_pipeline`

The unique key across all data sources should be `ID_becario`. This will allow the program to connect information from JotForm, Excel, mentor reports, scholar check-ins, requests, academic progress, and financial records.

The dashboard should use a standard five-level risk taxonomy:

|**Risk level**|**Value**|
|---|---|
|Sin riesgo|0|
|Riesgo bajo|1|
|Riesgo medio|2|
|Riesgo alto|3|
|Crítico|4|

This taxonomy will allow the team to calculate monthly risk changes, identify worsening cases, prioritize interventions, and compare risk distribution across cohorts, countries, and universities.

The implementation should follow a phased roadmap:

## **Phase 1 — Data architecture and metric design**

Define the canonical data model, unique key, KPI formulas, risk taxonomy, controlled values, and source-to-database mapping.

## **Phase 2 — Database setup**

Create a PostgreSQL database with structured tables for scholars, academic terms, check-ins, mentor reports, support activities, requests, risk assessments, and financial inputs.

## **Phase 3 — Historical data migration**

Import and clean the current Excel master file, normalize wide tables into longitudinal records, and generate data quality reports.

## **Phase 4 — JotForm integration**

Connect JotForm submissions through API sync and webhooks, store raw submissions for traceability, transform them into clean database tables, and prevent duplicate records using submission IDs.

## **Phase 5 — Risk engine**

Create an explainable risk assessment process that calculates academic, psychosocial, participation, and global risk for each scholar by period.

## **Phase 6 — Dashboard MVP**

Build the first usable dashboard with Executive Overview, Risk & Alerts, Scholar Profile, Academic Progress, Support Participation, and basic Unit Economics.

## **Phase 7 — Permissions and governance**

Implement role-based access, especially for sensitive psychosocial information. Executives should see aggregated indicators, while detailed scholar-level notes should be restricted to authorized program staff.

## **Phase 8 — Selection Pipeline layer**

After the Scholar Tracking layer is stable, add the Selection Pipeline dashboard to monitor applications, candidate stages, conversion rates, drop-offs, selection quality, and cohort composition.

The recommended first build should focus on:

1. Database schema
2. Historical Excel import
3. JotForm sync for mentor reports and check-ins
4. Risk assessment table
5. Executive Overview dashboard
6. Risk & Alerts dashboard
7. Scholar Profile view

This approach gives the Beca Tech team a reliable foundation for monthly decision-making without overbuilding the system too early. The most important outcome is not only a dashboard, but a repeatable data infrastructure that allows ver+ to identify risk, track scholar progress, understand support needs, and evaluate program performance over time.