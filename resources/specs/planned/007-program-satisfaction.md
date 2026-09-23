# SPEC-007 — Program Satisfaction

**Status:** PLANNED / BLOCKED — SOURCE DATA REQUIRED  
**Methodology state:** NEW EXTERNAL INTEGRATION · NOT IMPLEMENTABLE UNTIL THE SOURCE CONTRACT IS SUPPLIED  
**Repository baseline:** `main @ 58575cf278898324a46c96d40d730301c05757ed`  
**Origin:** SPEC-004 §13 (Home — Section 6 · Program Satisfaction), deferred out of SPEC-004 so
its source-ready scope could be accepted independently.

**Relevant prior specs:**  
- SPEC-002 — Spreadsheet Ingestion Refactor
- SPEC-004 — Dashboard Data & Visualization Corrections

**Relevant ADRs:**  
- `docs/adr/001-canonical-scholar-identifier.md`
- `docs/adr/007-spreadsheet-source-adapters.md`

---

# 1. Status

`PLANNED / BLOCKED — SOURCE DATA REQUIRED`

Program Satisfaction comes from a separate spreadsheet that is **not currently represented in the
repository at all**. No existing dashboard data source may be substituted for it, and no
satisfaction value or denominator rule may be invented.

This requirement was deferred, not dropped. Nothing here is implementation-authorized until §3 and
§4 are satisfied.

---

# 2. Goal

Integrate source-backed Program Satisfaction reporting into Home — Section 6.

---

# 3. Required source contract

Implementation may not begin until the following are obtained and recorded:

1. spreadsheet / file identity (and Drive location);
2. tab name;
3. header structure;
4. an anonymized representative sample;
5. the canonical scholar identifier, or an approved aggregation identifier if the survey is
   anonymous;
6. the satisfaction scale (1–5, 1–10, NPS, categorical, …);
7. value **polarity** — which end of the scale is good;
8. response date;
9. semester / period field;
10. the denominator rule — satisfaction over respondents, over active scholars, or over invited
    scholars;
11. the multiple-response rule — what happens when one scholar answers twice in a period;
12. anonymity rules — whether individual responses may ever be displayed or linked;
13. the expected relationship to the Cohort / Country / University filters.

---

# 4. Identity constraints

## 4.1 If scholar-linked

Satisfaction records must resolve to the canonical scholar identifier `Scholar.scholarId`
(ADR-001).

Explicitly prohibited:

- fuzzy name matching;
- email address used as an identity key;
- any database-generated id as a cross-source join key.

A record that does not resolve to a canonical `scholarId` is unresolved, and must be reported as
unresolved rather than attached to a best-guess scholar.

## 4.2 If anonymous

If the survey carries no scholar identifier, the approved aggregation model must be defined
**before** implementation — what the unit of aggregation is, what may be filtered, and what must
not be, given that anonymous responses cannot be safely narrowed to small groups.

Do not attempt to re-identify anonymous responses.

---

# 5. Period decision — unresolved

The product requirement includes semester-aware satisfaction reporting. The current Home filter
model exposes **no semester dimension**.

This decision is deliberately left open and must be settled by the product owner, not during
implementation. The options on record are:

- use the latest completed semester automatically;
- add a new semester filter to Home;
- another approved period rule.

Do not invent this behavior.

---

# 6. Context

Home Section 6 currently has no satisfaction data of any kind. Every other Home section reads the
program's single Google Sheets pipeline; this one would introduce a **second external source**,
which is why it carries heavier governance than a normal dashboard addition.

---

# 7. User workflow

A program lead opens Home, reads Section 6 · Program Satisfaction, and sees how satisfied scholars
are for the relevant period, under the filter scope agreed in §3 item 13.

---

# 8. Non-goals

- Substituting any existing dashboard signal (risk, check-ins, mentor reports) for satisfaction.
- Inventing a scale, polarity, denominator, or period rule.
- Re-identifying anonymous responses.
- Changing canonical scholar identity.
- Any Drop-out Reasons work — see SPEC-006.

---

# 9. Data considerations

A persistence model is expected — satisfaction is periodic and multi-row per scholar, so it is
unlikely to fit as a column on `Scholar`. Expected surface area, to be confirmed:

- a new Prisma model plus migration;
- an ingestion path for the second source (Apps Script normalization, or a source adapter, or
  both);
- validation rules, including scale-range and polarity checks;
- `src/lib/dashboard/queries.ts` aggregation and `types.ts`;
- Home UI;
- tests.

Review `bulkUpsert()`'s `ON CONFLICT` keys when choosing the model's `@@unique`.

---

# 10. Authorization / security

Survey responses are personal data and may have been collected under a confidentiality promise.

Before any implementation:

- confirm whether mentors may see satisfaction at all, and at what granularity;
- confirm a minimum-cell-size rule if anonymous responses can be filtered, so a filtered view
  cannot isolate one respondent;
- keep scholar-scoped queries behind `scholarAccessWhere()` where the data is scholar-linked.

---

# 11. Governance

This is a **new external data integration**. Per `AGENTS.md`, it requires:

- a new ADR (or an equivalent repository-governed integration decision) covering the second
  source, its authority, and its identity contract;
- a persistence decision and migration;
- ingestion design;
- validation rules;
- tests.

It must be implemented separately from the ready dashboard corrections — which is why it now has
its own specification rather than holding SPEC-004 open.

---

# 12. Acceptance criteria

Deferred until §3, §4 and §5 are settled. At minimum, the eventual implementation must satisfy:

- every scholar-linked record resolves through canonical `scholarId`, or is reported unresolved;
- the displayed denominator matches the approved rule and is visible;
- polarity is stated so the number cannot be read backwards;
- the period rule is the approved one, not an implementation default;
- anonymity constraints hold under every filter combination.

---

# 13. Testing

Deferred. Expected: unit tests for parsing/scale/polarity, and a DB-backed integration test for
ingestion, identity resolution, and the Home aggregation under filters.

---

# 14. Documentation impact

Deferred. Expected: a new ADR, `docs/DATA_MODEL.md`, `docs/SECURITY.md` if visibility rules
change, `docs/ARCHITECTURE.md` for the second ingestion source, and `apps-script/README.md` if the
Apps Script carries it.

---

# 15. Blocking action

**Required from the program/data owner:** the thirteen items in §3, the identity model in §4, and
the period decision in §5.

Until they are supplied, this specification stays in `resources/specs/planned/`.
