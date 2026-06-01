/**
 * Roadmap App — Google Apps Script backend
 * Bind this script to your spreadsheet (Extensions → Apps Script).
 * Set ADMIN_TOKEN in Script properties to override the temporary default below.
 *
 * Any sheet with row-1 headers (ID, Name, Description, Timeline Start, Timeline End)
 * is included automatically — no code changes when you add a new tab.
 */

var APP_CONFIG_SHEET_NAME = 'App Config';

/** Filter pill colors when the App Config sheet has no Color column. */
var DEFAULT_TEAM_COLORS = [
  '#8b5cf6',
  '#eab308',
  '#14b8a6',
  '#3b82f6',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#84cc16',
];

/** Status dropdown values and bar colors (column F on initiative tabs). */
var STATUS_DEFINITIONS = [
  { label: 'In Progress', color: '#3b82f6' },
  { label: 'Close to done', color: '#86efac' },
  { label: 'At Risk', color: '#fca5a5' },
  { label: 'Done', color: '#16a34a' },
  { label: 'Future', color: '#eab308' },
  { label: 'Paused', color: '#4b5563' },
];

var DEFAULT_STATUS_COLOR = '#64748b';

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
    if (action === 'deleteteam') {
      return jsonResponse(deleteTeam_(body));
    }
    if (action === 'addteam') {
      return jsonResponse(addTeam_(body));
    }
    if (action === 'delete') {
      return jsonResponse(deleteInitiative_(body));
    }
    if (action === 'updatestatus') {
      return jsonResponse(updateInitiativeStatus_(body));
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
  out.teams = readTeamsFromAppConfig_();
  out.statuses = getStatusDefinitions_();
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

function isAppConfigSheet_(sheet) {
  if (!sheet) return false;
  return normalizeHeader_(sheet.getName()) === 'app config';
}

function getAppConfigSheet_(createIfMissing) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(APP_CONFIG_SHEET_NAME);
  if (sheet) return sheet;
  if (!createIfMissing) return null;
  sheet = ss.insertSheet(APP_CONFIG_SHEET_NAME, 0);
  sheet.getRange(1, 1, 1, 2).setValues([['Team Name', 'Team Id']]);
  return sheet;
}

/**
 * Maps App Config headers to { nameCol, idCol, colorCol } (1-based) or null.
 */
function getAppConfigColumnMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 2) return null;

  var headers = sheet.getRange(1, 1, 1, Math.min(lastCol, 5)).getValues()[0];
  var h = headers.map(normalizeHeader_);

  var nameCol = -1;
  var idCol = -1;
  var colorCol = -1;

  for (var c = 0; c < h.length; c++) {
    if (h[c] === 'team name') nameCol = c + 1;
    if (h[c] === 'team id') idCol = c + 1;
    if (h[c] === 'color') colorCol = c + 1;
  }

  if (nameCol > 0 && idCol > 0) {
    return { nameCol: nameCol, idCol: idCol, colorCol: colorCol };
  }
  return null;
}

function readTeamsFromAppConfig_() {
  var sheet = getAppConfigSheet_(false);
  if (!sheet) return [];

  var map = getAppConfigColumnMap_(sheet);
  if (!map) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = Math.max(map.nameCol, map.idCol, map.colorCol > 0 ? map.colorCol : 0);
  var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  var teams = [];
  var seenIds = {};

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var label = String(row[map.nameCol - 1] || '').trim();
    var id = String(row[map.idCol - 1] || '').trim();
    if (!id) continue;

    var key = id.toLowerCase();
    if (seenIds[key]) continue;
    seenIds[key] = true;

    var team = {
      id: id,
      label: label || id,
    };

    if (map.colorCol > 0) {
      var color = String(row[map.colorCol - 1] || '').trim();
      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        team.color = color;
      }
    }
    if (!team.color) {
      team.color = DEFAULT_TEAM_COLORS[teams.length % DEFAULT_TEAM_COLORS.length];
    }

    teams.push(team);
  }

  return teams;
}

function getValidTeamIds_() {
  return readTeamsFromAppConfig_().map(function (t) {
    return t.id;
  });
}

function findAppConfigRowByTeamId_(sheet, map, teamId) {
  var target = String(teamId || '').trim().toLowerCase();
  if (!target) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, map.idCol, lastRow, map.idCol).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim().toLowerCase() === target) {
      return i + 2;
    }
  }
  return -1;
}

function countInitiativesUsingTeamId_(teamId) {
  var target = String(teamId || '').trim().toLowerCase();
  if (!target) return 0;
  var count = 0;
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (!isRoadmapDataSheet_(sheet)) continue;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;
    var col7 = sheet.getRange(2, 7, lastRow, 7).getValues();
    for (var r = 0; r < col7.length; r++) {
      var ids = parseTeamsCell_(col7[r][0]);
      for (var j = 0; j < ids.length; j++) {
        if (String(ids[j]).trim().toLowerCase() === target) {
          count++;
          break;
        }
      }
    }
  }
  return count;
}

function addTeam_(body) {
  var teamId = String(body.teamId || body.id || '').trim();
  var teamName = String(body.teamName || body.label || body.name || '').trim();
  var color = String(body.color || '').trim();

  if (!teamId) throw new Error('Team Id is required.');
  if (!teamName) throw new Error('Team Name is required.');
  if (!/^[a-zA-Z0-9_-]+$/.test(teamId)) {
    throw new Error('Team Id may only contain letters, numbers, hyphens, and underscores.');
  }
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new Error('Color must be a hex value like #8b5cf6.');
  }

  var sheet = getAppConfigSheet_(true);
  var map = getAppConfigColumnMap_(sheet);
  if (!map) {
    sheet.getRange(1, 1, 1, 2).setValues([['Team Name', 'Team Id']]);
    map = getAppConfigColumnMap_(sheet);
  }

  if (findAppConfigRowByTeamId_(sheet, map, teamId) >= 0) {
    throw new Error('Team Id already exists: ' + teamId);
  }

  var row = [];
  var maxCol = Math.max(map.nameCol, map.idCol, map.colorCol > 0 ? map.colorCol : 0);
  for (var c = 1; c <= maxCol; c++) {
    row.push('');
  }
  row[map.nameCol - 1] = teamName;
  row[map.idCol - 1] = teamId;
  if (map.colorCol > 0 && color) {
    row[map.colorCol - 1] = color;
  }
  sheet.appendRow(row);

  return { ok: true };
}

function deleteTeam_(body) {
  var teamId = String(body.teamId || body.id || '').trim();
  if (!teamId) throw new Error('Team Id is required.');

  var usage = countInitiativesUsingTeamId_(teamId);
  if (usage > 0) {
    throw new Error(
      'Cannot delete team "' +
        teamId +
        '": it is assigned on ' +
        usage +
        ' initiative(s). Remove it from those rows first.'
    );
  }

  var sheet = getAppConfigSheet_(false);
  if (!sheet) throw new Error('App Config sheet not found.');

  var map = getAppConfigColumnMap_(sheet);
  if (!map) throw new Error('App Config sheet is missing Team Name and Team Id headers.');

  var rowIndex = findAppConfigRowByTeamId_(sheet, map, teamId);
  if (rowIndex < 0) {
    throw new Error('Team Id not found in App Config: ' + teamId);
  }

  sheet.deleteRow(rowIndex);
  return { ok: true };
}

/**
 * True when row 1 looks like the roadmap table (ID, Name, Description, timelines).
 */
function isRoadmapDataSheet_(sheet) {
  if (isAppConfigSheet_(sheet)) return false;

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
  var valid = getValidTeamIds_();
  if (!valid.length) {
    throw new Error('No teams defined. Add rows to the App Config sheet.');
  }
  for (var i = 0; i < teamIds.length; i++) {
    if (valid.indexOf(teamIds[i]) === -1) {
      throw new Error('Teams must be one of: ' + valid.join(', ') + '.');
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

function getStatusDefinitions_() {
  return STATUS_DEFINITIONS.map(function (s) {
    return { id: s.label, label: s.label, color: s.color };
  });
}

function normalizeStatusKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function resolveStatusFromCell_(value) {
  var raw = String(value || '').trim();
  if (!raw) {
    return { label: '', color: DEFAULT_STATUS_COLOR };
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
    return { label: '', color: raw };
  }
  var key = normalizeStatusKey_(raw);
  for (var i = 0; i < STATUS_DEFINITIONS.length; i++) {
    if (normalizeStatusKey_(STATUS_DEFINITIONS[i].label) === key) {
      return {
        label: STATUS_DEFINITIONS[i].label,
        color: STATUS_DEFINITIONS[i].color,
      };
    }
  }
  return { label: raw, color: DEFAULT_STATUS_COLOR };
}

function getValidStatusLabels_() {
  return STATUS_DEFINITIONS.map(function (s) {
    return s.label;
  });
}

function validateStatusLabel_(status) {
  if (!status) return;
  var key = normalizeStatusKey_(status);
  var labels = getValidStatusLabels_();
  for (var i = 0; i < labels.length; i++) {
    if (normalizeStatusKey_(labels[i]) === key) {
      return labels[i];
    }
  }
  throw new Error('Status must be one of: ' + labels.join(', ') + '.');
}

function getRoadmapColumnMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  var colCount = Math.max(lastCol, 7);
  var headers = sheet.getRange(1, 1, 1, colCount).getValues()[0];
  var h = headers.map(normalizeHeader_);

  var map = {
    idCol: 1,
    nameCol: 2,
    descCol: 3,
    startCol: 4,
    endCol: 5,
    statusCol: 6,
    teamsCol: 7,
  };

  for (var c = 0; c < h.length; c++) {
    var col = c + 1;
    if (h[c] === 'id') map.idCol = col;
    else if (h[c] === 'name') map.nameCol = col;
    else if (h[c] === 'description') map.descCol = col;
    else if (h[c] === 'timeline start' || (h[c].indexOf('timeline') >= 0 && h[c].indexOf('start') >= 0)) {
      map.startCol = col;
    } else if (h[c] === 'timeline end' || (h[c].indexOf('timeline') >= 0 && h[c].indexOf('end') >= 0)) {
      map.endCol = col;
    } else if (h[c] === 'status') map.statusCol = col;
    else if (h[c] === 'teams' || h[c] === 'team' || h[c] === 'cohort') map.teamsCol = col;
    else if (h[c] === 'color' && map.statusCol === 6) map.statusCol = col;
  }

  return map;
}

function readSheetRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var map = getRoadmapColumnMap_(sheet);
  var lastCol = Math.max(map.teamsCol, map.statusCol, map.endCol);
  var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  var items = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var id = String(row[map.idCol - 1] || '').trim();
    if (!id) continue;
    var item = {
      id: id,
      name: String(row[map.nameCol - 1] || '').trim(),
      description: String(row[map.descCol - 1] || '').trim(),
      timeline: [
        formatDateCell_(row[map.startCol - 1]),
        formatDateCell_(row[map.endCol - 1]),
      ],
    };
    var statusCell = String(row[map.statusCol - 1] || '').trim();
    var resolved = resolveStatusFromCell_(statusCell);
    if (resolved.label) item.status = resolved.label;
    item.color = resolved.color;
    var teams = parseTeamsCell_(row[map.teamsCol - 1]);
    if (teams.length) {
      item.teams = teams;
    }
    items.push(item);
  }
  return items;
}

function updateInitiativeStatus_(body) {
  var domain = String(body.team || '').trim().toLowerCase();
  var id = String(body.id || '').trim();
  var statusInput = String(body.status || '').trim();
  if (!domain) throw new Error('Domain is required.');
  if (!id) throw new Error('ID is required.');
  if (!statusInput) throw new Error('Status is required.');

  var canonicalStatus = validateStatusLabel_(statusInput);
  var resolved = resolveStatusFromCell_(canonicalStatus);

  var sheetName = sheetNameFromDomainKey_(domain);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var rowIndex = findRowIndexById_(sheet, id);
  if (rowIndex < 0) {
    throw new Error('ID not found on tab ' + sheetName + ': ' + id);
  }

  var map = getRoadmapColumnMap_(sheet);
  sheet.getRange(rowIndex, map.statusCol).setValue(canonicalStatus);

  return {
    ok: true,
    status: resolved.label,
    color: resolved.color,
  };
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
  var statusInput = String(body.status || '').trim();
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
  var statusValue = '';
  if (statusInput) {
    statusValue = validateStatusLabel_(statusInput);
  }

  var sheetName = sheetNameFromDomainKey_(domain);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);

  var map = getRoadmapColumnMap_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, map.idCol, lastRow, map.idCol).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim().toLowerCase() === id.toLowerCase()) {
        throw new Error('ID already exists on tab ' + sheetName + ': ' + id);
      }
    }
  }

  var row = [];
  var maxCol = Math.max(map.teamsCol, map.statusCol);
  for (var c = 1; c <= maxCol; c++) {
    row.push('');
  }
  row[map.idCol - 1] = id;
  row[map.nameCol - 1] = name;
  row[map.descCol - 1] = description;
  row[map.startCol - 1] = timelineStart;
  row[map.endCol - 1] = timelineEnd;
  row[map.statusCol - 1] = statusValue;
  row[map.teamsCol - 1] = formatTeamsCell_(teamIds);
  sheet.appendRow(row);

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
