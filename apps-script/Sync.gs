/**
 * Google Sheets → Beca Tech Dashboard sync.
 *
 * Bound to the program's master spreadsheet. Marks the sheet "dirty" on edit, then on a
 * time-driven trigger exports the three raw tabs and POSTs each to the dashboard's
 * POST /api/sync/import endpoint. See README.md in this folder for setup instructions.
 *
 * Configuration (Project Settings > Script Properties — never hardcode these in source):
 *   SYNC_ENDPOINT_URL  e.g. https://your-dashboard.vercel.app/api/sync/import
 *   SYNC_API_KEY       must match the dashboard's SHEETS_SYNC_API_KEY env var
 */

var TAB_NAMES = ["SCHOLAR GENERAL INFO", "MENTOR REPORTS", "SUPPORT ACTIVITY LOG"];
var SYNC_LOG_SHEET_NAME = "Sync Log";
var DIRTY_PROPERTY = "dirty";
var DIRTY_SINCE_PROPERTY = "dirtySince";

/**
 * Installable onEdit/onChange trigger handler — just flags the sheet dirty. Cheap and safe to
 * run on every keystroke; the actual sync work only happens in syncIfDirty(), on its own timer.
 */
function markDirty(e) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty(DIRTY_PROPERTY, "true");
  if (!props.getProperty(DIRTY_SINCE_PROPERTY)) {
    props.setProperty(DIRTY_SINCE_PROPERTY, new Date().toISOString());
  }
}

/**
 * Time-driven trigger (install via setupTriggers(), every 10-15 min). If the sheet has been
 * edited since the last successful sync, exports each of the 3 tabs as CSV and POSTs it to the
 * dashboard. Clears the dirty flag only if every tab synced successfully, so a partial failure
 * is retried on the next run instead of silently dropping data.
 */
function syncIfDirty() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(DIRTY_PROPERTY) !== "true") return; // nothing changed since last sync

  var endpoint = props.getProperty("SYNC_ENDPOINT_URL");
  var apiKey = props.getProperty("SYNC_API_KEY");
  if (!endpoint || !apiKey) {
    logSyncEvent("(config)", "ERROR", "SYNC_ENDPOINT_URL / SYNC_API_KEY not set in Script Properties.");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allOk = true;

  for (var i = 0; i < TAB_NAMES.length; i++) {
    var tabName = TAB_NAMES[i];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      logSyncEvent(tabName, "ERROR", "Tab not found in this spreadsheet.");
      allOk = false;
      continue;
    }

    try {
      var csv = sheetToCsv(sheet);
      var response = UrlFetchApp.fetch(endpoint, {
        method: "post",
        contentType: "text/csv; charset=utf-8",
        headers: { "x-api-key": apiKey, "x-sheet-name": tabName },
        payload: csv,
        muteHttpExceptions: true,
      });
      var status = response.getResponseCode();
      if (status >= 200 && status < 300) {
        var body = JSON.parse(response.getContentText());
        logSyncEvent(
          tabName,
          "OK",
          "batchId=" + body.batchId + " total=" + body.totalRows + " success=" + body.successRows + " errors=" + body.errorRows,
        );
      } else {
        allOk = false;
        logSyncEvent(tabName, "FAILED", "HTTP " + status + ": " + response.getContentText().slice(0, 500));
      }
    } catch (err) {
      allOk = false;
      logSyncEvent(tabName, "FAILED", String(err));
    }
  }

  if (allOk) {
    props.deleteProperty(DIRTY_PROPERTY);
    props.deleteProperty(DIRTY_SINCE_PROPERTY);
  }
}

/**
 * One-time setup: run manually from the Apps Script editor (select this function, click Run) to
 * install both triggers. Safe to re-run — it removes any triggers it previously installed first.
 */
function setupTriggers() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    var fn = existing[i].getHandlerFunction();
    if (fn === "markDirty" || fn === "syncIfDirty") ScriptApp.deleteTrigger(existing[i]);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger("markDirty").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("markDirty").forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger("syncIfDirty").timeBased().everyMinutes(15).create();

  Logger.log("Triggers installed: markDirty (onEdit + onChange), syncIfDirty (every 15 min).");
}

/**
 * Manual smoke test: run once after setting Script Properties to confirm the endpoint/key work,
 * without waiting for the timer or making an edit first.
 */
function testConnection() {
  PropertiesService.getScriptProperties().setProperty(DIRTY_PROPERTY, "true");
  syncIfDirty();
  SpreadsheetApp.getActiveSpreadsheet().toast("Check the \"" + SYNC_LOG_SHEET_NAME + "\" tab for the result.", "Sync test run");
}

/** Convert a sheet's full data range to CSV text (values as displayed, not formulas). */
function sheetToCsv(sheet) {
  var values = sheet.getDataRange().getDisplayValues();
  var lines = [];
  for (var r = 0; r < values.length; r++) {
    var fields = [];
    for (var c = 0; c < values[r].length; c++) {
      fields.push(csvEscape(values[r][c]));
    }
    lines.push(fields.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value) {
  var s = value == null ? "" : String(value);
  if (s.indexOf(",") >= 0 || s.indexOf('"') >= 0 || s.indexOf("\n") >= 0) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Append a row to the hidden "Sync Log" tab (created on first use) so failures are visible
 * without digging through Apps Script's own execution logs. */
function logSyncEvent(tab, status, message) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = ss.getSheetByName(SYNC_LOG_SHEET_NAME);
  if (!log) {
    log = ss.insertSheet(SYNC_LOG_SHEET_NAME);
    log.appendRow(["Timestamp", "Tab", "Status", "Message"]);
    log.hideSheet();
  }
  log.appendRow([new Date().toISOString(), tab, status, message]);
}
