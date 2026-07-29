# Google Sheets sync — Apps Script setup

`Sync.gs` in this folder keeps the dashboard in near-real-time sync with the program's master
Google Sheet, with no manual export/upload. It watches for edits, and every 10–15 minutes exports
the `SCHOLAR GENERAL INFO`, `MENTOR REPORTS`, and `SUPPORT ACTIVITY LOG` tabs as CSV and POSTs each
to the dashboard's `POST /api/sync/import` endpoint.

## 1. Paste the script into the Sheet

1. Open the program's master Google Sheet.
2. **Extensions → Apps Script**.
3. Delete the default `Code.gs` placeholder content and paste in the contents of `Sync.gs`.
4. Save the project (any name, e.g. "Dashboard Sync").

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
2. The first run will prompt for authorization — review and accept (this script only reads the
   spreadsheet and makes outbound HTTPS requests to the dashboard endpoint).
3. This installs:
   - `markDirty` on **edit** and **change** — flags the sheet dirty, does no network calls.
   - `syncIfDirty` on a **time-based trigger, every 15 minutes** — the actual sync.
4. Re-running `setupTriggers` at any time is safe; it removes and reinstalls its own triggers
   first, so you won't end up with duplicates.

## 4. Verify it works

1. Select the `testConnection` function from the dropdown and click **Run**. This forces a sync
   immediately (marks the sheet dirty, then runs `syncIfDirty`) without waiting for an edit or the
   timer, and shows a toast pointing you at the log.
2. Check the **"Sync Log"** tab (hidden by default — right-click any sheet tab → **Unhide sheet**
   if you don't see it). Each sync attempt appends one row per tab: timestamp, tab name, `OK` or
   `FAILED`, and either a row-count summary or the failure detail.
3. On the dashboard, open **Admin → Data Imports** — you should see new batches attributed to
   "Google Sheets Sync", with `COMMITTED` status.

## How it behaves

- Edits don't sync immediately — they only set a dirty flag. The next 15-minute tick does the
  actual export + POST, so rapid edits don't spam the endpoint.
- A sync attempt exports **all three tabs** every time it runs (not just the one that changed) —
  simpler than tracking which tab was touched, and cheap at this data volume.
- The dirty flag is only cleared if **all three** tabs synced with a 2xx response. If any tab
  fails (network issue, dashboard down, tab renamed), the flag stays set and the next scheduled
  run retries automatically — check the Sync Log tab for why.
- Each tab is sent as one CSV POST; the dashboard auto-detects which tab it is from the header
  shape, so this script never needs to know the dashboard's internal entity names.
- Values are exported as **displayed** (`getDisplayValues`), not raw formulas, so computed cells
  sync their current result.

## Troubleshooting

- **Nothing shows up on the dashboard**: check the Sync Log tab first. A `FAILED` row with an
  `HTTP 401` means `SYNC_API_KEY` doesn't match the dashboard's `SHEETS_SYNC_API_KEY` — re-check
  both values. An `HTTP 422` usually means the CSV didn't match any of the three known tab shapes
  (e.g. someone renamed a header column) — the message includes the dashboard's rejection reason.
- **"Tab not found" in the log**: one of the three tab names (`SCHOLAR GENERAL INFO`,
  `MENTOR REPORTS`, `SUPPORT ACTIVITY LOG`) was renamed in the spreadsheet. Update `TAB_NAMES` in
  `Sync.gs` to match, or rename the tab back.
- **Want to force a sync right now**: run `testConnection` from the Apps Script editor.
