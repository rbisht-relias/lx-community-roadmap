/**
 * Roadmap App — Google Apps Script backend
 * Bind this script to your spreadsheet (Extensions → Apps Script).
 * Set ADMIN_TOKEN in Script properties to override the temporary default below.
 *
 * Any sheet with row-1 headers (ID, Name, Description, Timeline Start, Timeline End)
 * is included automatically — no code changes when you add a new tab.
 */

var VALID_TEAMS = ['c1', 'c2', 'c3', 'c4'];

/** Temporary dev token — replace via Script property ADMIN_TOKEN before production. */
var DEFAULT_ADMIN_TOKEN = 'relias-2026';

function getAdminToken_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  return fromProps || DEFAULT_ADMIN_TOKEN;
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  if (action === 'tabs') {
    return jsonResponse({ tabs: getTabKeys_() });
  }
  return jsonResponse(readRoadmap_());
}

function doPost(e) {
  try {
    var body = parsePostBody_(e);
    var token = getAdminToken_();
    if (!body.adminToken || body.adminToken !== token) {
      return jsonResponse({ ok: false, error: 'Invalid admin token.' }, 403);
    }
    var action = String(body.action || 'add').trim().toLowerCase();
    if (action === 'delete') {
      return jsonResponse(deleteInitiative_(body));
    }
    var result = appendInitiative_(body);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err.message || err) }, 400);
  }
}

function readRoadmap_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = {};
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (!isRoadmapDataSheet_(sheet)) continue;
    var key = domainKeyFromSheetName_(sheet.getName());
    out[key] = readSheetRows_(sheet);
  }
  return out;
}

function getTabKeys_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = [];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (isRoadmapDataSheet_(sheet)) {
      tabs.push(domainKeyFromSheetName_(sheet.getName()));
    }
  }
  return tabs;
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * True when row 1 looks like the roadmap table (ID, Name, Description, timelines).
 */
function isRoadmapDataSheet_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 5) return false;

  var headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 7)).getValues()[0];
  var h = headers.map(normalizeHeader_);

  if (h[0] !== 'id' || h[1] !== 'name' || h[2] !== 'description') {
    return false;
  }

  var startOk =
    h[3] === 'timeline start' ||
    (h[3].indexOf('timeline') >= 0 && h[3].indexOf('start') >= 0);
  var endOk =
    h[4] === 'timeline end' ||
    (h[4].indexOf('timeline') >= 0 && h[4].indexOf('end') >= 0);

  return startOk && endOk;
}

function domainKeyFromSheetName_(name) {
  return String(name).trim().toLowerCase();
}

/** POST body still uses `team` for the domain (sheet tab) key. */
function sheetNameFromDomainKey_(domainKey) {
  var key = String(domainKey).trim().toLowerCase();
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (domainKeyFromSheetName_(sheet.getName()) === key && isRoadmapDataSheet_(sheet)) {
      return sheet.getName();
    }
  }
  throw new Error(
    'No sheet found for domain "' +
      domainKey +
      '". Add a tab with row-1 headers: ID, Name, Description, Timeline Start, Timeline End.'
  );
}

function parseTeamsCell_(value) {
  if (!value) return [];
  return String(value)
    .split(/[,;]/)
    .map(function (part) {
      return String(part || '').trim();
    })
    .filter(function (part) {
      return part.length > 0;
    });
}

function formatTeamsCell_(teamIds) {
  if (!teamIds || !teamIds.length) return '';
  return teamIds.join(',');
}

function validateTeamIds_(teamIds) {
  if (!teamIds || !teamIds.length) return;
  for (var i = 0; i < teamIds.length; i++) {
    if (VALID_TEAMS.indexOf(teamIds[i]) === -1) {
      throw new Error('Teams must be one of: ' + VALID_TEAMS.join(', ') + '.');
    }
  }
}

function readTeamsFromBody_(body) {
  if (Array.isArray(body.teams)) {
    return body.teams
      .map(function (id) {
        return String(id || '').trim();
      })
      .filter(function (id) {
        return id.length > 0;
      });
  }
  if (body.cohort) {
    return parseTeamsCell_(body.cohort);
  }
  return parseTeamsCell_(body.teams);
}

function readSheetRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow, 7).getValues();
  var items = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var id = String(row[0] || '').trim();
    if (!id) continue;
    var item = {
      id: id,
      name: String(row[1] || '').trim(),
      description: String(row[2] || '').trim(),
      timeline: [formatDateCell_(row[3]), formatDateCell_(row[4])],
    };
    var color = String(row[5] || '').trim();
    if (color) item.color = color;
    var teams = parseTeamsCell_(row[6]);
    if (teams.length) {
      item.teams = teams;
    }
    items.push(item);
  }
  return items;
}

function formatDateCell_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function findRowIndexById_(sheet, id) {
  var target = String(id || '').trim().toLowerCase();
  if (!target) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim().toLowerCase() === target) {
      return i + 2;
    }
  }
  return -1;
}

function deleteInitiative_(body) {
  var domain = String(body.team || '').trim().toLowerCase();
  var id = String(body.id || '').trim();
  if (!domain) throw new Error('Domain is required.');
  if (!id) throw new Error('ID is required.');

  var sheetName = sheetNameFromDomainKey_(domain);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var rowIndex = findRowIndexById_(sheet, id);
  if (rowIndex < 0) {
    throw new Error('ID not found on tab ' + sheetName + ': ' + id);
  }

  sheet.deleteRow(rowIndex);
  return { ok: true };
}

function appendInitiative_(body) {
  var domain = String(body.team || '').trim().toLowerCase();
  var id = String(body.id || '').trim();
  var name = String(body.name || '').trim();
  var description = String(body.description || '').trim();
  var timelineStart = String(body.timelineStart || '').trim();
  var timelineEnd = String(body.timelineEnd || '').trim();
  var color = String(body.color || '').trim();
  var teamIds = readTeamsFromBody_(body);

  if (!domain) throw new Error('Domain is required.');
  if (!id) throw new Error('ID is required.');
  if (!name) throw new Error('Name is required.');
  if (!description) throw new Error('Description is required.');
  if (!timelineStart || !timelineEnd) throw new Error('Timeline start and end are required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(timelineStart) || !/^\d{4}-\d{2}-\d{2}$/.test(timelineEnd)) {
    throw new Error('Dates must be YYYY-MM-DD.');
  }
  if (timelineEnd < timelineStart) throw new Error('Timeline end must be on or after start.');
  validateTeamIds_(teamIds);
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new Error('Color must be a hex value like #f97316.');
  }

  var sheetName = sheetNameFromDomainKey_(domain);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim().toLowerCase() === id.toLowerCase()) {
        throw new Error('ID already exists on tab ' + sheetName + ': ' + id);
      }
    }
  }

  sheet.appendRow([
    id,
    name,
    description,
    timelineStart,
    timelineEnd,
    color || '',
    formatTeamsCell_(teamIds),
  ]);

  return { ok: true };
}

function parsePostBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body.');
  }
  return JSON.parse(e.postData.contents);
}

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
