/**
 * Reads the three messy, hand-maintained master tabs and writes clean, canonical-header data
 * into four hidden "NORMALIZED_*" tabs — one per dashboard entity (SCHOLAR, ACADEMIC_TERM,
 * MENTOR_REPORT, SUPPORT_ACTIVITY). Sync.gs exports and POSTs those normalized tabs instead of
 * the raw ones.
 *
 * This is a direct port of the pivoting/mapping logic already proven correct in
 * src/lib/data-import/adapters/{legacy,legacy-mentor-reports,legacy-support-activity}.ts — same
 * regexes, same field mappings — just reading cells directly via SpreadsheetApp instead of
 * round-tripping through CSV text, which is what made the dashboard-side parsing fragile against
 * this sheet's decorative rows, merged multi-line header cells, and free-text columns.
 *
 * Values are passed through mostly unchanged (numbers stay numbers, blank stays blank) — type
 * coercion and validation already happen robustly on the dashboard side. The one thing this
 * layer MUST do that the dashboard's TEMPLATE adapter does not is map free-text country/status/
 * activity values into their canonical enum form ("Colombia" -> "COLOMBIA", etc.), since that
 * mapping lives in the legacy adapters this replaces, not in the simpler TEMPLATE path.
 *
 * Never hand-edit the NORMALIZED_* tabs — they're fully regenerated (cleared + rewritten) every
 * time normalizeAll_() runs.
 */

var HEADER_SCAN_LIMIT_ = 20;

// "gpa" and the bare "materias reprobadas..." prefix are the same word/phrase in both the old
// Spanish and new English sheet headers, so those two patterns need no bilingual alternation.
var TERM_RE_ = /^gpa (\d{4}-\d)$/;
var CREDITS_RE_ = /^(?:creditos|credits) (\d{4}-\d)$/;
var ENROLLMENT_RE_ = /^(?:estado matricula|enrollment status) (\d{4}-\d)$/;
var FAILED_RE_ = /^materias reprobadas.*(\d{4}-\d)$/;
var FAILED_DETAIL_RE_ = /^mencionar las asignaturas (\d{4}-\d)$/;
// "ESTADO FINAL" (bare, no term in the text) repeats identically once per term block — it can only
// be resolved to a term positionally (see findAcademicStatusColumns_), not by regex on its own.
var ESTADO_FINAL_KEY_ = "estado final";

var ACTIVITY_TYPE_BY_KEY_ = {
  "tutorias ind": "INDIVIDUAL_TUTORING",
  "tutorias grup": "GROUP_TUTORING",
  "mentorias ind": "INDIVIDUAL_MENTORING",
  "mentorias grup": "GROUP_MENTORING",
  talleres: "WORKSHOP",
};

/** Strip accents, lowercase, collapse whitespace. Explicit combining-mark range (not \p{Diacritic})
 * so this doesn't depend on a specific V8/regex-Unicode feature level. */
function normKey_(k) {
  return String(k == null ? "" : k)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mapCountry_(v) {
  var s = normKey_(v);
  if (!s) return "";
  if (s.indexOf("col") === 0) return "COLOMBIA";
  if (s.indexOf("per") === 0) return "PERU";
  return String(v).trim();
}

function mapStatus_(v) {
  var s = normKey_(v);
  if (!s) return "";
  // Real sheet values are like "BECARIO(A) ACTIVO" — the keyword isn't a prefix, so this
  // matches anywhere in the string, not just at position 0.
  if (s.indexOf("activ") !== -1) return "ACTIVE";
  if (s.indexOf("retir") !== -1 || s.indexOf("desert") !== -1) return "WITHDRAWN";
  if (s.indexOf("gradu") !== -1) return "GRADUATED";
  if (s.indexOf("paus") !== -1) return "PAUSED";
  return String(v).trim();
}

/** Ordinal-word prefix -> semester number, checked after accent/case normalization via normKey_.
 * Real sheet values look like "Quinto semestre" ("Fifth semester"), not a plain int. */
var SEMESTER_WORD_RE_ = [
  [/^primer/, 1],
  [/^segund/, 2],
  [/^tercer/, 3],
  [/^cuart/, 4],
  [/^quint/, 5],
  [/^sext/, 6],
  [/^septim/, 7],
  [/^setim/, 7],
  [/^octav/, 8],
  [/^noven/, 9],
  [/^decim/, 10],
  [/^undecim/, 11],
  [/^duodecim/, 12],
];

/** "Quinto semestre" -> 5, "3er semestre" -> 3, 7 -> 7, "" -> "" (unparseable -> blank, so it
 * coerces to null downstream instead of NaN — see coerceValue in coerce.ts). */
function parseSemesterCell_(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return v;
  var s = normKey_(v);
  if (!s) return "";
  var digitMatch = /^(\d+)/.exec(s);
  if (digitMatch) return Number(digitMatch[1]);
  for (var i = 0; i < SEMESTER_WORD_RE_.length; i++) {
    if (SEMESTER_WORD_RE_[i][0].test(s)) return SEMESTER_WORD_RE_[i][1];
  }
  return "";
}

/** JS Date -> "yyyy-MM-dd" (unambiguous, locale-independent); anything else passes through as-is. */
function normalizeDateCell_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return v;
}

function colIndexOf_(headerKeys, name) {
  return headerKeys.indexOf(name);
}

/** First column whose normalized header exactly equals any of `names` — the general-purpose
 * bilingual lookup (old Spanish header text alongside the new sheet's English equivalent). */
function colIndexOfAny_(headerKeys, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = headerKeys.indexOf(names[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function colIndexByPrefix_(headerKeys, prefix) {
  for (var i = 0; i < headerKeys.length; i++) {
    if (headerKeys[i].indexOf(prefix) === 0) return i;
  }
  return -1;
}

/** Bilingual version of colIndexByPrefix_ — first column whose header starts with any prefix. */
function colIndexByPrefixAny_(headerKeys, prefixes) {
  for (var i = 0; i < headerKeys.length; i++) {
    for (var j = 0; j < prefixes.length; j++) {
      if (headerKeys[i].indexOf(prefixes[j]) === 0) return i;
    }
  }
  return -1;
}

/** nth (0-based) column whose normalized header includes `substr`, in column order. */
function colIndexByIncludes_(headerKeys, substr, occurrence) {
  var count = 0;
  for (var i = 0; i < headerKeys.length; i++) {
    if (headerKeys[i].indexOf(substr) !== -1) {
      if (count === occurrence) return i;
      count += 1;
    }
  }
  return -1;
}

/** Bilingual version of colIndexByIncludes_ — nth column whose header includes any of `substrs`. */
function colIndexByIncludesAny_(headerKeys, substrs, occurrence) {
  var count = 0;
  for (var i = 0; i < headerKeys.length; i++) {
    for (var j = 0; j < substrs.length; j++) {
      if (headerKeys[i].indexOf(substrs[j]) !== -1) {
        if (count === occurrence) return i;
        count += 1;
        break;
      }
    }
  }
  return -1;
}

/** 0-based row index of the first row within the scan window whose normalized keys satisfy `matches`. */
function findHeaderRowIndex_(values, matches) {
  var limit = Math.min(values.length, HEADER_SCAN_LIMIT_);
  for (var i = 0; i < limit; i++) {
    if (matches(values[i].map(normKey_))) return i;
  }
  return -1;
}

/** Clears and rewrites a hidden NORMALIZED_* tab with `header` + `rows` (array of arrays).
 * `textColumns` (header names) are forced to Plain Text format BEFORE the values are written —
 * order matters: Sheets auto-detects/reformats a value into a date or number AT WRITE TIME (the
 * same way typing "2024-1" into the UI auto-converts it to a date), so setting the format after
 * writing wouldn't undo an already-applied conversion. This is why AcademicTerm's `term` column
 * ("2024-1", "2024-2", ...) was silently turning into real Date values (then exported as
 * "2024-01-01") despite looking correct when viewed in the sheet — the cell's underlying value
 * was a Date the whole time, just displayed via a format that happened to render like the
 * original text. `scholarId` is forced defensively for the same reason, even though it hasn't
 * shown symptoms yet: a long digit string risks the same kind of silent reinterpretation
 * (as a number, potentially losing leading zeros or rendering in scientific notation). */
function writeNormalizedTab_(ss, tabName, header, rows, textColumns) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.hideSheet();
  } else {
    sheet.clear(); // also clears formats, so text-forcing below must happen on every run
  }
  var numRows = rows.length + 1; // +1: header row
  if (textColumns) {
    for (var i = 0; i < textColumns.length; i++) {
      var colIndex = header.indexOf(textColumns[i]);
      if (colIndex === -1) continue;
      sheet.getRange(1, colIndex + 1, numRows, 1).setNumberFormat("@");
    }
  }
  var data = [header].concat(rows);
  sheet.getRange(1, 1, data.length, header.length).setValues(data);
}

/** Runs all three normalizers. Call this before exporting/syncing. */
function normalizeAll_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  normalizeScholarGeneralInfo_(ss);
  normalizeMentorReports_(ss);
  normalizeSupportActivityLog_(ss);
}

// The three normalize*_() functions above take a required `ss` parameter, so they can't be run
// directly from the editor's function dropdown (it always calls with zero arguments). These
// no-argument wrappers are the ones to select there when debugging a single tab.
function normalizeScholarGeneralInfoOnly() {
  normalizeScholarGeneralInfo_(SpreadsheetApp.getActiveSpreadsheet());
}
function normalizeMentorReportsOnly() {
  normalizeMentorReports_(SpreadsheetApp.getActiveSpreadsheet());
}
function normalizeSupportActivityLogOnly() {
  normalizeSupportActivityLog_(SpreadsheetApp.getActiveSpreadsheet());
}

// ---------------------------------------------------------------------------
// SCHOLAR GENERAL INFO -> NORMALIZED_SCHOLAR + NORMALIZED_ACADEMIC_TERM
// ---------------------------------------------------------------------------

var SCHOLAR_HEADER_ = [
  "scholarId", "fullName", "country", "cohort", "university", "academicProgram", "gender",
  "programStatus", "currentSemester", "startDate", "expectedEndDate",
];
var ACADEMIC_TERM_HEADER_ = [
  "scholarId", "term", "gpa", "creditsEnrolled", "enrollmentStatus", "failedSubjectsCount",
  "failedSubjectsDetail", "academicStatus",
];

/** Positionally resolve bare "ESTADO FINAL" columns (no term in the header text — it repeats
 * identically once per term block) to a specific term, by pairing each with the MATERIAS
 * REPROBADAS/MENCIONAR block immediately preceding it. Real layout for most terms is a clean
 * 3-column block (MATERIAS -> MENCIONAR -> ESTADO FINAL); two terms (2025-1/2025-2) instead stack
 * two MATERIAS/MENCIONAR pairs back-to-back before a single ESTADO FINAL, which makes that column
 * genuinely ambiguous. Per policy, an ambiguous or orphaned ESTADO FINAL is left unresolved
 * (surfaced via Task 8's unmapped-columns list) rather than guessed. */
function findAcademicStatusColumns_(headerKeys) {
  var cols = [];
  var pendingTerms = [];
  for (var i = 0; i < headerKeys.length; i++) {
    var key = headerKeys[i];
    var failedMatch = FAILED_RE_.exec(key);
    if (failedMatch) {
      var nextDetail = headerKeys[i + 1] ? FAILED_DETAIL_RE_.exec(headerKeys[i + 1]) : null;
      if (nextDetail && nextDetail[1] === failedMatch[1]) pendingTerms.push(failedMatch[1]);
    } else if (key === ESTADO_FINAL_KEY_) {
      if (pendingTerms.length === 1) cols.push({ colIndex: i, term: pendingTerms[0], field: "academicStatus" });
      pendingTerms = []; // clear at every boundary, whether resolved, ambiguous, or orphaned
    }
  }
  return cols;
}

function findTermColumns_(headerKeys) {
  var cols = [];
  headerKeys.forEach(function (key, colIndex) {
    var m;
    if ((m = TERM_RE_.exec(key))) cols.push({ colIndex: colIndex, term: m[1], field: "gpa" });
    else if ((m = CREDITS_RE_.exec(key))) cols.push({ colIndex: colIndex, term: m[1], field: "creditsEnrolled" });
    else if ((m = ENROLLMENT_RE_.exec(key))) cols.push({ colIndex: colIndex, term: m[1], field: "enrollmentStatus" });
    else if ((m = FAILED_RE_.exec(key))) cols.push({ colIndex: colIndex, term: m[1], field: "failedSubjectsCount" });
    else if ((m = FAILED_DETAIL_RE_.exec(key))) cols.push({ colIndex: colIndex, term: m[1], field: "failedSubjectsDetail" });
  });
  return cols.concat(findAcademicStatusColumns_(headerKeys));
}

function normalizeScholarGeneralInfo_(ss) {
  var sheet = ss.getSheetByName("SCHOLAR GENERAL INFO");
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();

  var headerRowIndex = findHeaderRowIndex_(values, function (keys) {
    var hasId = keys.indexOf("id") !== -1 || keys.indexOf("id_becario") !== -1;
    var hasTermGpa = keys.some(function (k) { return TERM_RE_.test(k); });
    return hasId && hasTermGpa;
  });
  if (headerRowIndex < 0) {
    logSyncEvent(
      "NORMALIZE",
      "ERROR",
      "SCHOLAR GENERAL INFO: real header not found in first " + HEADER_SCAN_LIMIT_ + " rows.",
    );
    return;
  }

  var headerKeys = values[headerRowIndex].map(normKey_);
  var idCol = colIndexOf_(headerKeys, "id") !== -1 ? colIndexOf_(headerKeys, "id") : colIndexOf_(headerKeys, "id_becario");
  var fullNameCol = colIndexOfAny_(headerKeys, ["nombre completo", "scholars name"]);
  var countryCol = colIndexOfAny_(headerKeys, ["pais", "country"]);
  var cohortCol = colIndexOfAny_(headerKeys, ["cohorte", "cohort"]);
  var universityCol = colIndexOfAny_(headerKeys, ["universidad", "university"]);
  var programCol = colIndexOfAny_(headerKeys, ["programa academico", "academic program"]);
  var genderCol = colIndexByPrefixAny_(headerKeys, ["genero", "gender"]);
  var statusCol = colIndexOfAny_(headerKeys, ["estado actual", "current status"]);
  // "current semester" (new sheet) is a distinct exact string from "semester"/"semestre" (old
  // sheet) — not a substring match, so it needs its own alias rather than relying on the prefix.
  var semesterCol = colIndexOfAny_(headerKeys, ["semester", "semestre", "current semester"]);
  var startDateCol = colIndexOfAny_(headerKeys, ["fecha de inicio", "started date"]);
  // No new-sheet equivalent exists for this column (only a bare "Estimated Graduation Year" —
  // see estimatedGraduationYear) — expectedEndDate is intentionally left null for new-sheet rows
  // rather than derived from other fields (explicit decision, not an oversight).
  var endDateCol = colIndexOf_(headerKeys, "fecha de finalizacion");
  var termColumns = findTermColumns_(headerKeys);

  var scholarRows = [];
  var termRows = [];

  for (var r = headerRowIndex + 1; r < values.length; r++) {
    var row = values[r];
    var scholarId = idCol !== -1 ? row[idCol] : "";
    if (scholarId === "" || scholarId === null || scholarId === undefined) continue; // skip blank rows

    scholarRows.push([
      scholarId,
      fullNameCol !== -1 ? row[fullNameCol] : "",
      countryCol !== -1 ? mapCountry_(row[countryCol]) : "",
      cohortCol !== -1 ? row[cohortCol] : "",
      universityCol !== -1 ? row[universityCol] : "",
      programCol !== -1 ? row[programCol] : "",
      genderCol !== -1 ? row[genderCol] : "",
      statusCol !== -1 ? mapStatus_(row[statusCol]) : "",
      semesterCol !== -1 ? parseSemesterCell_(row[semesterCol]) : "",
      startDateCol !== -1 ? normalizeDateCell_(row[startDateCol]) : "",
      endDateCol !== -1 ? normalizeDateCell_(row[endDateCol]) : "",
    ]);

    // Pivot repeating per-term columns — a term bucket is created whenever ANY matching column
    // is found for it, even if that specific cell is blank (matches legacy.ts's ensure() semantics).
    var byTerm = {};
    termColumns.forEach(function (col) {
      var bucket = byTerm[col.term];
      if (!bucket) {
        bucket = {
          scholarId: scholarId, term: col.term, gpa: "", creditsEnrolled: "", enrollmentStatus: "",
          failedSubjectsCount: "", failedSubjectsDetail: "", academicStatus: "",
        };
        byTerm[col.term] = bucket;
      }
      bucket[col.field] = row[col.colIndex];
    });
    Object.keys(byTerm).forEach(function (term) {
      var b = byTerm[term];
      termRows.push([
        b.scholarId, b.term, b.gpa, b.creditsEnrolled, b.enrollmentStatus, b.failedSubjectsCount,
        b.failedSubjectsDetail, b.academicStatus,
      ]);
    });
  }

  writeNormalizedTab_(ss, "NORMALIZED_SCHOLAR", SCHOLAR_HEADER_, scholarRows, ["scholarId"]);
  writeNormalizedTab_(ss, "NORMALIZED_ACADEMIC_TERM", ACADEMIC_TERM_HEADER_, termRows, ["scholarId", "term"]);
}

// ---------------------------------------------------------------------------
// MENTOR REPORTS -> NORMALIZED_MENTOR_REPORT
// ---------------------------------------------------------------------------

var MENTOR_REPORT_HEADER_ = [
  "scholarId", "scholarName", "mentorName", "country", "cohort", "university", "reportingMonth",
  "registrationDate", "sessionDate", "sessionType", "sessionSummary", "modality", "permanenceRisk",
  "academicStatus", "academicAlertType", "approvedCoursesCount", "atRiskCoursesCount",
  "difficultSubjects", "psychosocialStatus", "psychosocialAlertType", "accompanimentPlan",
  "estimatedSupportTime", "individualTutoring", "groupTutoring", "individualMentoring",
  "groupMentoring", "workshops", "highlights", "academicProgressNotes", "nextSteps", "submissionId",
];

function normalizeMentorReports_(ss) {
  var sheet = ss.getSheetByName("MENTOR REPORTS");
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();

  var headerRowIndex = findHeaderRowIndex_(values, function (keys) {
    return keys.indexOf("numero de id") !== -1 && keys.indexOf("submission id") !== -1;
  });
  if (headerRowIndex < 0) {
    logSyncEvent("NORMALIZE", "ERROR", "MENTOR REPORTS: real header not found in first " + HEADER_SCAN_LIMIT_ + " rows.");
    return;
  }

  var k = values[headerRowIndex].map(normKey_);
  var col = {
    scholarId: colIndexOf_(k, "numero de id"),
    scholarName: colIndexOf_(k, "nombre del becario"),
    mentorName: colIndexOf_(k, "soy:"),
    country: colIndexOf_(k, "pais"),
    cohort: colIndexOf_(k, "cohorte del programa:"),
    university: colIndexOf_(k, "universidad"),
    reportingMonth: colIndexOf_(k, "¿que mes reportas?"),
    registrationDate: colIndexOf_(k, "fecha de registro"),
    sessionDate: colIndexOf_(k, "fecha"),
    sessionType: colIndexOf_(k, "sesion:"),
    sessionSummary: colIndexOf_(k, "resumen de lo tratado en la sesion"),
    modality: colIndexOf_(k, "modalidad del espacio"),
    permanenceRisk: colIndexByIncludes_(k, "identifica senales que puedan poner en riesgo", 0),
    academicStatus: colIndexOf_(k, "estado academico"),
    academicAlertType: colIndexByIncludes_(k, "situacion especifica", 0),
    approvedCoursesCount: colIndexOf_(k, "numero de asignaturas/cursos aprobados"),
    atRiskCoursesCount: colIndexByIncludes_(k, "numero de asignaturas/cursos en riesgo", 0),
    difficultSubjects: colIndexByIncludes_(k, "asignaturas con dificultades", 0),
    psychosocialStatus: colIndexOf_(k, "estado psicosocial"),
    psychosocialAlertType: colIndexByIncludes_(k, "situacion especifica", 1),
    accompanimentPlan: colIndexByIncludes_(k, "plan de acompanamiento", 0),
    estimatedSupportTime: colIndexByIncludes_(k, "tiempo estimado del acompanamiento", 0),
    individualTutoring: colIndexOf_(k, "tutorias individuales"),
    groupTutoring: colIndexOf_(k, "tutorias grupales"),
    individualMentoring: colIndexOf_(k, "mentorias individuales"),
    groupMentoring: colIndexOf_(k, "mentorias grupales"),
    workshops: colIndexOf_(k, "talleres grupales"),
    highlights: colIndexByIncludes_(k, "algo destacado", 0),
    academicProgressNotes: colIndexByIncludes_(k, "avance academico del becario", 0),
    nextSteps: colIndexByIncludes_(k, "de inicio:", 0),
    submissionId: colIndexOf_(k, "submission id"),
  };

  var get = function (row, key) {
    var i = col[key];
    return i !== -1 ? row[i] : "";
  };
  var getDate = function (row, key) {
    var i = col[key];
    return i !== -1 ? normalizeDateCell_(row[i]) : "";
  };

  var rows = [];
  for (var r = headerRowIndex + 1; r < values.length; r++) {
    var row = values[r];
    // "numero de id" here is the MENTOR's ID, not the scholar's (see the dashboard-side
    // validate.ts, which resolves the real scholarId by matching scholarName instead, falling
    // back to this raw value only when scholarName is absent). A decorative/blank row has neither
    // — skip only when BOTH are blank, so a real row missing just one of the two isn't dropped.
    var scholarId = get(row, "scholarId");
    var scholarName = get(row, "scholarName");
    if (!scholarId && !scholarName) continue; // skip fully blank rows

    rows.push([
      scholarId,
      scholarName,
      get(row, "mentorName"),
      mapCountry_(get(row, "country")),
      get(row, "cohort"),
      get(row, "university"),
      get(row, "reportingMonth"),
      getDate(row, "registrationDate"),
      getDate(row, "sessionDate"),
      get(row, "sessionType"),
      get(row, "sessionSummary"),
      get(row, "modality"),
      get(row, "permanenceRisk"),
      get(row, "academicStatus"),
      get(row, "academicAlertType"),
      get(row, "approvedCoursesCount"),
      get(row, "atRiskCoursesCount"),
      get(row, "difficultSubjects"),
      get(row, "psychosocialStatus"),
      get(row, "psychosocialAlertType"),
      get(row, "accompanimentPlan"),
      get(row, "estimatedSupportTime"),
      get(row, "individualTutoring"),
      get(row, "groupTutoring"),
      get(row, "individualMentoring"),
      get(row, "groupMentoring"),
      get(row, "workshops"),
      get(row, "highlights"),
      get(row, "academicProgressNotes"),
      get(row, "nextSteps"),
      get(row, "submissionId"),
    ]);
  }

  writeNormalizedTab_(ss, "NORMALIZED_MENTOR_REPORT", MENTOR_REPORT_HEADER_, rows, ["scholarId"]);
}

// ---------------------------------------------------------------------------
// SUPPORT ACTIVITY LOG -> NORMALIZED_SUPPORT_ACTIVITY
// ---------------------------------------------------------------------------

var SUPPORT_ACTIVITY_HEADER_ = ["scholarId", "period", "activityType", "activityCount", "country", "cohort", "university", "source"];
var SUPPORT_SUB_HEADER_OFFSET_ = 1; // row 0 = block labels, row 1 = sub-column names
var SUPPORT_FIRST_DATA_OFFSET_ = 2;

/** Bucket each activity column under the nearest preceding "MES" column, left to right. */
function findActivityColumns_(subHeaderKeys) {
  var columns = [];
  var mesColIndex = -1;
  subHeaderKeys.forEach(function (key, colIndex) {
    if (key === "mes") {
      mesColIndex = colIndex;
      return;
    }
    var activityType = ACTIVITY_TYPE_BY_KEY_[key];
    if (activityType && mesColIndex >= 0) {
      columns.push({ colIndex: colIndex, mesColIndex: mesColIndex, activityType: activityType });
    }
  });
  return columns;
}

function normalizeSupportActivityLog_(ss) {
  var sheet = ss.getSheetByName("SUPPORT ACTIVITY LOG");
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();

  var subHeaderRow = values[SUPPORT_SUB_HEADER_OFFSET_];
  if (!subHeaderRow) {
    logSyncEvent("NORMALIZE", "ERROR", "SUPPORT ACTIVITY LOG: sub-header row not found.");
    return;
  }
  var subHeaderKeys = subHeaderRow.map(normKey_);
  if (subHeaderKeys[0] !== "id" || subHeaderKeys.indexOf("mes") === -1 || subHeaderKeys.indexOf("tutorias ind") === -1) {
    logSyncEvent("NORMALIZE", "ERROR", "SUPPORT ACTIVITY LOG: sub-header row doesn't look like the expected shape.");
    return;
  }

  var activityColumns = findActivityColumns_(subHeaderKeys);
  var rows = [];

  for (var r = SUPPORT_FIRST_DATA_OFFSET_; r < values.length; r++) {
    var row = values[r];
    var scholarId = row[0];
    if (scholarId === "" || scholarId === null || scholarId === undefined) continue; // skip blank rows

    var country = mapCountry_(row[1]);
    var cohort = row[5];
    var university = row[6];

    activityColumns.forEach(function (activityCol) {
      var period = row[activityCol.mesColIndex];
      if (period === "" || period === null || period === undefined) return; // month hasn't happened yet

      rows.push([scholarId, period, activityCol.activityType, row[activityCol.colIndex], country, cohort, university, "google-sheets-sync"]);
    });
  }

  writeNormalizedTab_(ss, "NORMALIZED_SUPPORT_ACTIVITY", SUPPORT_ACTIVITY_HEADER_, rows, ["scholarId"]);
}
