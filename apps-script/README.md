# Google Sheets sync — Apps Script setup

`Sync.gs` and `Normalize.gs` in this folder keep the dashboard in near-real-time sync with the
program's master Google Sheet, with no manual export/upload. On a 10–15 minute timer, if the
sheet has been edited:

1. **`Normalize.gs`** reads the three messy, hand-maintained tabs (`SCHOLAR GENERAL INFO`,
   `MENTOR REPORTS`, `SUPPORT ACTIVITY LOG`) and writes clean, canonical-header data into four
   hidden tabs — one per dashboard entity (`NORMALIZED_SCHOLAR`, `NORMALIZED_ACADEMIC_TERM`,
   `NORMALIZED_MENTOR_REPORT`, `NORMALIZED_SUPPORT_ACTIVITY`).
2. **`Sync.gs`** exports each of those four normalized tabs as CSV and POSTs it to the
   dashboard's `POST /api/sync/import` endpoint.

Splitting it this way means the *raw* master tabs — with their decorative title rows, merged
header cells, and free-text notes columns — never have to round-trip through CSV text. Only the
clean, normalized tabs (which this script fully controls the shape of) do that, which is what
made the sync reliable.

**Never hand-edit the `NORMALIZED_*` tabs** — they're fully cleared and rewritten every time the
sync runs. If you need to fix how data gets normalized, edit `Normalize.gs`, not the tabs it
produces.

## 1. Paste both scripts into the Sheet

1. Open the program's master Google Sheet.
2. **Extensions → Apps Script**.
3. Delete the default `Code.gs` placeholder content and paste in the contents of `Sync.gs`
   (rename that file to `Sync` if prompted).
4. Add a **second file** (`+` next to Files → Script) named `Normalize`, and paste in the
   contents of `Normalize.gs`. Both files must be in the same Apps Script project — they share
   functions (e.g. `Sync.gs` calls `normalizeAll_()` from `Normalize.gs`, and `Normalize.gs` logs
   through `logSyncEvent()` from `Sync.gs`).
5. Save the project (any name, e.g. "Dashboard Sync").

## 2. Configure the endpoint and API key

The endpoint URL and API key are **not** in the script source — they're stored in the Apps
Script project's own Script Properties, which aren't visible to anyone who doesn't have edit
access to the script itself:

1. In the Apps Script editor: **Project Settings** (gear icon) → **Script Properties** → **Add script property**.
2. Add:
   - `SYNC_ENDPOINT_URL` → e.g. `https://your-dashboard.vercel.app/api/sync/import`
   - `SYNC_API_KEY` → the same value as the dashboard's `SHEETS_SYNC_API_KEY` environment
     variable (ask whoever manages the Vercel project for this, or generate a new long random
     value and set it in both places — see the repo's `.env.example`).

## 3. Install the triggers

1. Back in the Apps Script editor, select the `setupTriggers` function from the function
   dropdown (top toolbar) and click **Run**.
2. The first run will prompt for authorization — review and accept (this script reads/writes the
   spreadsheet and makes outbound HTTPS requests to the dashboard endpoint).
3. This installs:
   - `markDirty` on **edit** and **change** — flags the sheet dirty, does no network calls.
   - `syncIfDirty` on a **time-based trigger, every 15 minutes** — normalizes, then syncs.
4. Re-running `setupTriggers` at any time is safe; it removes and reinstalls its own triggers
   first, so you won't end up with duplicates.

## 4. Verify it works

1. Select the `testConnection` function from the dropdown and click **Run**. This forces a sync
   immediately (marks the sheet dirty, then runs `syncIfDirty`) without waiting for an edit or the
   timer, and shows a toast pointing you at the log.
2. Check the **"Sync Log"** tab (hidden by default — right-click any sheet tab → **Unhide sheet**
   if you don't see it). Each run appends, per entity: an `EXPORT` row (row/column/character counts
   of what was sent) and then an `OK` or `FAILED` row.
3. Spot-check the `NORMALIZED_*` tabs (also hidden — unhide the same way) to see the clean data
   that was actually sent, if you want to sanity-check a specific scholar's values.
4. On the dashboard, open **Admin → Data Imports** — you should see new batches attributed to
   "Google Sheets Sync", with `COMMITTED` status.

## How it behaves

- Edits don't sync immediately — they only set a dirty flag. The next 15-minute tick does the
  actual normalize + export + POST, so rapid edits don't spam the endpoint.
- A sync attempt normalizes and re-exports **all four entities** every time it runs (not just
  what changed) — simpler than tracking deltas, and cheap at this data volume.
- The dirty flag is only cleared if **all four** entities synced with a 2xx response. If any one
  fails (network issue, dashboard down, a source tab renamed), the flag stays set and the next
  scheduled run retries automatically — check the Sync Log tab for why.
- Each entity is sent as one CSV POST with an `x-entity` header (`SCHOLAR`, `ACADEMIC_TERM`,
  `MENTOR_REPORT`, or `SUPPORT_ACTIVITY`) telling the dashboard exactly which one it is — unlike
  the original raw-tab sync, there's no self-detection involved for these calls.
- Sent in FK-safe order: `SCHOLAR` first, since everything else references a scholar that must
  already exist.
- Values are exported via `getValues()` (raw), not `getDisplayValues()`, and numbers/dates are
  converted to text in a locale-independent way (`Sync.gs`'s `cellToText_`) — avoids a sheet
  locale rendering `4.5` as `4,5` and silently corrupting numeric fields.

## Troubleshooting

- **Nothing shows up on the dashboard**: check the Sync Log tab first. A `FAILED` row with an
  `HTTP 401` means `SYNC_API_KEY` doesn't match the dashboard's `SHEETS_SYNC_API_KEY` — re-check
  both values. An `HTTP 422` means the dashboard's TEMPLATE adapter rejected the data — the
  message includes the rejection reason (this would mean `Normalize.gs`'s output doesn't match
  the expected canonical headers; check `NORMALIZED_*` tabs against `TEMPLATE_COLUMNS` in
  `src/lib/data-import/templates.ts`).
- **An `ERROR` row from "NORMALIZE"**: one of the three raw tabs' real header couldn't be found
  within the first 20 rows scanned, or (for `SUPPORT ACTIVITY LOG`) its sub-header row doesn't
  look like the expected shape. Someone likely renamed a column or restructured a tab — check
  `Normalize.gs`'s header-detection logic (`normalizeScholarGeneralInfo_` /
  `normalizeMentorReports_` / `normalizeSupportActivityLog_`) against the tab's current columns.
- **A normalized tab looks wrong/empty**: run the relevant no-argument wrapper —
  `normalizeScholarGeneralInfoOnly`, `normalizeMentorReportsOnly`, or
  `normalizeSupportActivityLogOnly` — directly from the Apps Script editor's function dropdown,
  then inspect the `NORMALIZED_*` tab it wrote to. (The underlying `normalize*_()` functions take a
  required `ss` argument, so the editor can't call them directly with no arguments — always use
  the `*Only` wrapper, or `normalizeAll_`, from the dropdown.)
- **A column that used to map now shows blank** (e.g. after the source sheet's headers changed):
  `Normalize.gs` matches most header text bilingually (old Spanish alongside the new English
  headers — see `colIndexOfAny_`/`colIndexByPrefixAny_`/`colIndexByIncludesAny_` and
  `TERM_RE_`/`CREDITS_RE_`/`ENROLLMENT_RE_`/`FAILED_RE_`/`FAILED_DETAIL_RE_`), but a header that
  doesn't match *either* known variant resolves to `-1` and the field is silently blank — check the
  live header's exact text (casing/punctuation/apostrophes matter less, since `normKey_` strips
  accents/case/whitespace, but a genuinely different phrase needs a new alias added to the relevant
  list) against the column-name literals in `normalizeScholarGeneralInfo_`/`normalizeMentorReports_`.
- **A `WARN` row from "NORMALIZE"** (`"unrecognized columns: ..."`): `detectUnrecognizedColumns_`
  found a header the sheet has that's neither mapped to a field nor on the reviewed
  `SCHOLAR_UNMAPPED_HEADERS_`/`MENTOR_REPORT_UNMAPPED_HEADERS_` list below — either a genuinely new
  column that needs a decision (map it, or add it to the documented list with a reason), or a
  transcription mismatch in that list (the list's strings were written from a header inventory, not
  read from the live sheet — check exact punctuation/spacing first). Not fatal — the run still
  completes — but worth triaging before the next sync.

## Unmapped columns

Columns the source sheets carry that `Normalize.gs` deliberately does not map yet, and why. Kept
in sync with the `SCHOLAR_UNMAPPED_HEADERS_`/`MENTOR_REPORT_UNMAPPED_HEADERS_` constants in
`Normalize.gs` — update both together when the sheet changes or a decision is made.

**SCHOLAR GENERAL INFO:**

| Column(s) | Why unmapped |
|---|---|
| `ACUMULADO`, `Materias atrasadas`, `Alternativa de nivelación`, `¿Está nivelando?`, `PLAZO MÁXIMO`, `¿Recibió apoyo?`, `ESTADO`, `Total Credits`, `Cumulative - Credits`, `Overdue Courses`, `Academic Progress`, `Cumulative GPA` | Single-value-per-scholar academic-summary fields; the target model (`AcademicTerm`) is keyed per term and there's no reliable term to attach a bare value to without guessing. Several correspond to real fields (`delayedSubjects`, `levelingAlternative`, `maxDeadline`, `isLeveling`, `receivedSupport`) importable via the manual per-term upload template instead. |
| English-tracking block (`Participatin in English program`, `English level - 2026-1`, `Número de cursos U (requeridos)`, `Nivel requerido por la U`, `NIVEL DE INICIO`, `NIVEL (MARCO)`, `¿Hizo validación?`, `Cursos obligatorios`, `Cursos realizados (a la fecha)`, `% avance`, `NIVEL ACTUAL 2025-2`) | Proposed as a longitudinal `EnglishTracking` model (like `AcademicTerm`), not built yet — needs confirmation these actually repeat per term on the live sheet (only `English level - 2026-1` looks term-suffixed today). |
| `LB: ACADÉMICO`, `ICFES COL`, `NOTAS (Puntaje IB - Perú)`, `LB: Socioeconómico`, `SISBEN COL`, `Nivel económico (Perú)`, `NIVEL DE PRIORIZACIÓN`, `MONTO`, `OBSERVACIÓN`, `PUNTAJE SELECCIÓN` | Look conceptually closer to `SelectionCandidate`/`FinancialInput` than the `Scholar` profile. Flagged, not decided. |
| The lone `ESTADO FINAL` on 2025-1/2025-2's term blocks | Not on this static list — handled dynamically by `findAcademicStatusColumns_`, which leaves it unresolved (not a WARN) when two `MATERIAS REPROBADAS`/`MENCIONAR` pairs sit back-to-back with no way to tell which term the status belongs to. |

**MENTOR REPORTS:**

| Column(s) | Why unmapped |
|---|---|
| `MENTOR ID` | Real signal — the mentor's own ID — but `MentorReport` has no field for a mentor identity yet (plain string vs. a full `Mentor` model, not decided). Never read into `mentorName`. |
| `MONTH`, `DATE` | Ambiguous relationship to `reportingMonth`/`registrationDate`/`sessionDate` — the sheet has both a new bare structural column and the original free-text question already mapped; unclear which (if either) is authoritative without asking whoever maintains the sheet. |
| `ACADEMIC CAUSE`, `PSYCHOSOCIAL CAUSE` | New columns; unclear relationship to the existing `academicAlertType`/`psychosocialAlertType` mapping (which still targets the "situación específica" free-text questions). |
| The three "plan"/"materias rezagadas" columns | The new sheet splits one `nextSteps`-shaped question into three. Concatenate into `nextSteps` vs. new fields is an open question. |
| `¿Participó en actividades?` | Genuinely new; no clear destination field yet. |

### Manual verification after changing header-matching logic (no automated test runner here)

Apps Script has no local test runner, so any change to `Normalize.gs`'s column matching needs a
manual pass:
1. Paste the updated `Normalize.gs` into the Apps Script editor.
2. Run `normalizeScholarGeneralInfoOnly` (and/or `normalizeMentorReportsOnly`), then unhide and
   inspect the corresponding `NORMALIZED_*` tab — confirm every column you touched is populated for
   a few real rows, and that nothing that used to populate now shows blank.
3. Specifically for `NORMALIZED_ACADEMIC_TERM`'s `academicStatus` column: confirm it's populated
   for terms with an unambiguous 3-column block (`MATERIAS REPROBADAS` → `MENCIONAR` →
   `ESTADO FINAL`) and correctly left blank for any term where two such blocks sit back-to-back
   before a single `ESTADO FINAL` (an intentionally-unresolved ambiguity, not a bug — see
   `findAcademicStatusColumns_`).
4. Check the Sync Log tab for any unexpected `WARN`/`ERROR` rows after running `testConnection` —
   a `WARN` naming columns already on the "Unmapped columns" table above is expected and fine; one
   naming anything else means either a genuinely new column (triage it) or a typo in this file's
   list vs. the live sheet's exact text.
- **Want to force a sync right now**: run `testConnection` from the Apps Script editor.
