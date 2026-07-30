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
- **Want to force a sync right now**: run `testConnection` from the Apps Script editor.
