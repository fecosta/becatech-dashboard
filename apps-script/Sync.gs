/**
 * Google Sheets → Beca Tech Dashboard sync.
 *
 * Bound to the program's master spreadsheet. Marks the sheet "dirty" on edit, then on a
 * time-driven trigger:
 *   1. Normalizes the three messy master tabs into clean, canonical-header tabs (Normalize.gs —
 *      must be in the same Apps Script project).
 *   2. Exports each normalized tab as CSV and POSTs it to the dashboard's
 *      POST /api/sync/import endpoint, one call per entity, in FK-safe order.
 * See README.md in this folder for setup instructions.
 *
 * Configuration (Project Settings > Script Properties — never hardcode these in source):
 *   SYNC_ENDPOINT_URL  e.g. https://your-dashboard.vercel.app/api/sync/import
 *   SYNC_API_KEY       must match the dashboard's SHEETS_SYNC_API_KEY env var
 */

// FK-safe order: SCHOLAR must land before anything that references scholarId.
var ENTITY_TABS = [
  { entity: "SCHOLAR", tab: "NORMALIZED_SCHOLAR" },
  { entity: "ACADEMIC_TERM", tab: "NORMALIZED_ACADEMIC_TERM" },
  { entity: "MENTOR_REPORT", tab: "NORMALIZED_MENTOR_REPORT" },
  { entity: "SUPPORT_ACTIVITY", tab: "NORMALIZED_SUPPORT_ACTIVITY" },
];
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
 * edited since the last successful sync: normalizes the master tabs, then exports+POSTs each of
 * the 4 canonical entities, in FK-safe order. Clears the dirty flag only if every entity synced
 * successfully, so a partial failure is retried on the next run instead of silently dropping data.
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

  try {
    normalizeAll_();
  } catch (err) {
    logSyncEvent("NORMALIZE", "FAILED", String(err));
    return; // don't sync stale/partial normalized tabs if normalization itself broke
  }

  var allOk = true;

  for (var i = 0; i < ENTITY_TABS.length; i++) {
    var entity = ENTITY_TABS[i].entity;
    var tabName = ENTITY_TABS[i].tab;
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      logSyncEvent(entity, "ERROR", 'Normalized tab "' + tabName + '" not found — normalization may have failed silently.');
      allOk = false;
      continue;
    }

    try {
      var range = sheet.getDataRange();
      var csv = sheetToCsv(sheet);
      // Logged unconditionally (even if the POST below throws) so a bad export is visible
      // without having to reproduce it.
      logSyncEvent(
        entity,
        "EXPORT",
        "sheetRows=" + range.getNumRows() + " sheetCols=" + range.getNumColumns() + " csvChars=" + csv.length,
      );

      var response = UrlFetchApp.fetch(endpoint, {
        method: "post",
        contentType: "text/csv; charset=utf-8",
        headers: { "x-api-key": apiKey, "x-entity": entity, "x-sheet-name": tabName },
        payload: csv,
        muteHttpExceptions: true,
      });
      var status = response.getResponseCode();
      if (status >= 200 && status < 300) {
        var body = JSON.parse(response.getContentText());
        logSyncEvent(
          entity,
          "OK",
          "batchId=" + body.batchId + " total=" + body.totalRows + " success=" + body.successRows + " errors=" + body.errorRows,
        );
      } else {
        allOk = false;
        logSyncEvent(entity, "FAILED", "HTTP " + status + ": " + response.getContentText().slice(0, 500));
      }
    } catch (err) {
      allOk = false;
      logSyncEvent(entity, "FAILED", String(err));
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

/**
 * Convert a sheet's full data range to CSV text. Uses getValues() (raw values), not
 * getDisplayValues() — display values are formatted per the spreadsheet's locale (e.g. a number
 * might render as "4,5" instead of "4.5" in a Spanish-locale sheet), which would silently corrupt
 * numeric fields on the dashboard side. cellToText_ converts each raw value to locale-independent
 * text itself.
 */
function sheetToCsv(sheet) {
  var values = sheet.getDataRange().getValues();
  var lines = [];
  for (var r = 0; r < values.length; r++) {
    var fields = [];
    for (var c = 0; c < values[r].length; c++) {
      fields.push(csvEscape(cellToText_(values[r][c])));
    }
    lines.push(fields.join(","));
  }
  return lines.join("\n");
}

/** Locale-independent text for one cell's raw value (from getValues()). */
function cellToText_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value); // numbers/booleans/strings: JS's own toString, never locale-formatted
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
