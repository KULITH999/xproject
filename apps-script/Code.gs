/*************************************************
 * VOID X VPN - GOOGLE APPS SCRIPT (REST API)
 * Frontend: Vercel | Database: Google Sheets
 *************************************************/

const SPREADSHEET_ID = "1sIla4cJgieRMFEfxFFS7j7rhI6CdrmTlSzSSXlJmIMA";

const SHEET_PACKAGES = "Packages";
const SHEET_CONFIGS = "Configs";
const SHEET_EHI_FILES = "EhiFiles";
const EHI_FOLDER_PROPERTY = "EHI_DRIVE_FOLDER_ID";
const SESSION_PREFIX = "VOID_ADMIN_";
const SESSION_SECONDS = 21600;

const PACKAGE_HEADERS = ["id", "network", "accessType", "name", "description", "active", "createdAt", "price", "dataAmount"];
const CONFIG_HEADERS = ["id", "packageId", "type", "name", "content", "active", "createdAt"];
const EHI_HEADERS = ["id", "packageId", "name", "fileId", "fileName", "mimeType", "active", "createdAt"];

/* ---------- ONE-TIME SETUP (editor එකෙන් Run කරන්න) ---------- */

function setupDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  createSheet_(ss, SHEET_PACKAGES, PACKAGE_HEADERS);
  createSheet_(ss, SHEET_CONFIGS, CONFIG_HEADERS);
  createSheet_(ss, SHEET_EHI_FILES, EHI_HEADERS);
  getEhiFolder_();
  return "VOID X VPN database is ready!";
}

// username/password වෙනස් කරලා ONE TIME Run කරන්න. පස්සේ password එක මකන්න.
function setAdminCredentials() {
  const USERNAME = "admin";
  const PASSWORD = "CHANGE_THIS_123";
  PropertiesService.getScriptProperties().setProperties({
    ADMIN_USERNAME: USERNAME,
    ADMIN_PASSWORD: PASSWORD
  });
  return "Admin credentials saved.";
}

/* ---------- REST API ---------- */

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";
  try {
    if (action === "publicData") {
      return jsonResponse_({ status: "success", data: getPublicData() });
    }
    if (!action) {
      return jsonResponse_({ status: "success", data: "VOID X VPN API is running." });
    }
    return jsonResponse_({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse_({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (x) { body = {}; }
    }
    if (!body.action && e && e.parameter) {
      body = Object.assign({}, e.parameter);
    }

    const action = String(body.action || "").trim();
    const token = String(body.token || "").trim();
    const payload = body.data || {};

    switch (action) {
      case "publicData":
        return jsonResponse_({ status: "success", data: getPublicData() });
      case "adminLogin":
        return jsonResponse_({ status: "success", data: adminLogin(body.username, body.password) });
      case "adminLogout":
        return jsonResponse_({ status: "success", data: adminLogout(token) });
      case "adminData":
        return jsonResponse_({ status: "success", data: getAdminData(token) });
      case "addPackage":
        return jsonResponse_({ status: "success", data: addPackage(token, payload) });
      case "updatePackage":
        return jsonResponse_({ status: "success", data: updatePackage(token, payload) });
      case "deletePackage":
        return jsonResponse_({ status: "success", data: deletePackage(token, payload.id) });
      case "addConfig":
        return jsonResponse_({ status: "success", data: addConfig(token, payload) });
      case "updateConfig":
        return jsonResponse_({ status: "success", data: updateConfig(token, payload) });
      case "deleteConfig":
        return jsonResponse_({ status: "success", data: deleteConfig(token, payload.id) });
      case "addEhiFile":
        return jsonResponse_({
          status: "success",
          data: addEhiFile(token, payload.packageId, payload.name, payload.fileName, payload.dataUrl)
        });
      case "deleteEhiFile":
        return jsonResponse_({ status: "success", data: deleteEhiFile(token, payload.id) });
      default:
        return jsonResponse_({ status: "error", message: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse_({ status: "error", message: err && err.message ? err.message : String(err) });
  }
}

/* ---------- DATABASE HELPERS ---------- */

function createSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const lastColumn = Math.max(sheet.getLastColumn(), 1);
    const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(v => String(v).trim());
    headers.forEach(header => {
      if (!existing.includes(header)) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        existing.push(header);
      }
    });
  }
  sheet.setFrozenRows(1);
}

function getDatabase_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(name) {
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) throw new Error("Database sheet missing: " + name + ". Run setupDatabase() first.");
  return sheet;
}

function getHeaders_(sheet) {
  if (sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(v => String(v).trim());
}

function appendObjectRow_(sheet, data) {
  const headers = getHeaders_(sheet);
  const row = headers.map(h => Object.prototype.hasOwnProperty.call(data, h) ? data[h] : "");
  sheet.appendRow(row);
}

function updateObjectRow_(sheet, rowNumber, data) {
  const headers = getHeaders_(sheet);
  headers.forEach((header, index) => {
    if (Object.prototype.hasOwnProperty.call(data, header)) {
      sheet.getRange(rowNumber, index + 1).setValue(data[header]);
    }
  });
}

function readRows_(name) {
  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(v => String(v).trim());
  return values.slice(1)
    .filter(row => row.some(v => v !== ""))
    .map(row => {
      const item = {};
      headers.forEach((h, i) => { item[h] = row[i]; });
      return item;
    });
}

function findRow_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return null;
  const idColumn = getHeaders_(sheet).indexOf("id") + 1;
  if (idColumn < 1) return null;
  const ids = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues();
  const index = ids.findIndex(r => String(r[0]) === String(id));
  return index === -1 ? null : index + 2;
}

function isActive_(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function clean_(value) {
  return String(value == null ? "" : value).trim();
}

function safeDate_(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || "");
}

/* ---------- ADMIN AUTH ---------- */

function adminLogin(username, password) {
  const props = PropertiesService.getScriptProperties();
  const u = props.getProperty("ADMIN_USERNAME");
  const p = props.getProperty("ADMIN_PASSWORD");

  if (!u || !p) throw new Error("Admin credentials not set. Run setAdminCredentials() in Apps Script.");
  if (String(username) !== u || String(password) !== p) {
    return { success: false, message: "Invalid username or password." };
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(SESSION_PREFIX + token, "authorized", SESSION_SECONDS);
  return { success: true, token: token, message: "Login successful." };
}

function verifyAdmin_(token) {
  if (!token) throw new Error("Admin login required.");
  if (CacheService.getScriptCache().get(SESSION_PREFIX + token) !== "authorized") {
    throw new Error("Session expired. Please login again.");
  }
  return true;
}

function adminLogout(token) {
  if (token) CacheService.getScriptCache().remove(SESSION_PREFIX + token);
  return { success: true };
}

/* ---------- PUBLIC DATA ---------- */

function getPublicData() {
  const allPackages = readRows_(SHEET_PACKAGES);

  const packages = allPackages
    .filter(r => isActive_(r.active))
    .map(r => ({
      id: String(r.id || ""),
      network: String(r.network || ""),
      accessType: String(r.accessType || "").toUpperCase(),
      name: String(r.name || ""),
      description: String(r.description || ""),
      dataAmount: String(r.dataAmount || ""),
      price: Number(r.price || 0)
    }));

  const freeIds = new Set(
    allPackages
      .filter(r => isActive_(r.active) && String(r.accessType || "").toUpperCase() === "FREE")
      .map(r => String(r.id || ""))
  );

  const configs = readRows_(SHEET_CONFIGS)
    .filter(r => isActive_(r.active) && freeIds.has(String(r.packageId || "")))
    .map(r => ({
      id: String(r.id || ""),
      packageId: String(r.packageId || ""),
      type: String(r.type || "").toUpperCase(),
      name: String(r.name || ""),
      content: String(r.content || "")
    }));

  const ehiFiles = readRows_(SHEET_EHI_FILES)
    .filter(r => isActive_(r.active) && freeIds.has(String(r.packageId || "")))
    .map(r => ({
      id: String(r.id || ""),
      packageId: String(r.packageId || ""),
      name: String(r.name || ""),
      fileName: String(r.fileName || ""),
      downloadUrl: getEhiDownloadUrl_(String(r.fileId || ""))
    }));

  return { packages: packages, configs: configs, ehiFiles: ehiFiles };
}

/* ---------- ADMIN DATA ---------- */

function getAdminData(token) {
  verifyAdmin_(token);

  const packages = readRows_(SHEET_PACKAGES).map(r => ({
    id: String(r.id || ""),
    network: String(r.network || ""),
    accessType: String(r.accessType || "").toUpperCase(),
    name: String(r.name || ""),
    description: String(r.description || ""),
    dataAmount: String(r.dataAmount || ""),
    price: Number(r.price || 0),
    active: isActive_(r.active),
    createdAt: safeDate_(r.createdAt)
  }));

  const configs = readRows_(SHEET_CONFIGS).map(r => ({
    id: String(r.id || ""),
    packageId: String(r.packageId || ""),
    type: String(r.type || "").toUpperCase(),
    name: String(r.name || ""),
    content: String(r.content || ""),
    active: isActive_(r.active),
    createdAt: safeDate_(r.createdAt)
  }));

  const ehiFiles = readRows_(SHEET_EHI_FILES).map(r => ({
    id: String(r.id || ""),
    packageId: String(r.packageId || ""),
    name: String(r.name || ""),
    fileName: String(r.fileName || ""),
    fileId: String(r.fileId || ""),
    active: isActive_(r.active),
    createdAt: safeDate_(r.createdAt)
  }));

  return { packages: packages, configs: configs, ehiFiles: ehiFiles };
}

/* ---------- PACKAGES ---------- */

function addPackage(token, data) {
  verifyAdmin_(token);
  validatePackage_(data);

  const id = Utilities.getUuid();
  const isPaid = clean_(data.accessType).toUpperCase() === "PAID";

  appendObjectRow_(getSheet_(SHEET_PACKAGES), {
    id: id,
    network: clean_(data.network).toUpperCase(),
    accessType: clean_(data.accessType).toUpperCase(),
    name: clean_(data.name),
    description: clean_(data.description || ""),
    active: true,
    createdAt: new Date(),
    price: isPaid ? Number(data.price) : "",
    dataAmount: isPaid ? clean_(data.dataAmount) : ""
  });

  return { success: true, id: id };
}

function updatePackage(token, data) {
  verifyAdmin_(token);
  validatePackage_(data);

  const sheet = getSheet_(SHEET_PACKAGES);
  const row = findRow_(sheet, data.id);
  if (!row) throw new Error("Package not found.");

  const accessType = clean_(data.accessType).toUpperCase();

  updateObjectRow_(sheet, row, {
    network: clean_(data.network).toUpperCase(),
    accessType: accessType,
    name: clean_(data.name),
    description: clean_(data.description || ""),
    active: data.active !== false,
    price: accessType === "PAID" ? Number(data.price) : "",
    dataAmount: accessType === "PAID" ? clean_(data.dataAmount) : ""
  });

  return { success: true };
}

function deletePackage(token, id) {
  verifyAdmin_(token);

  const packageSheet = getSheet_(SHEET_PACKAGES);
  const configSheet = getSheet_(SHEET_CONFIGS);
  const packageRow = findRow_(packageSheet, id);
  if (!packageRow) throw new Error("Package not found.");

  const configCol = getHeaders_(configSheet).indexOf("packageId") + 1;
  if (configCol > 0 && configSheet.getLastRow() >= 2) {
    const ids = configSheet.getRange(2, configCol, configSheet.getLastRow() - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(id)) configSheet.deleteRow(i + 2);
    }
  }

  const ehiSheet = getSheet_(SHEET_EHI_FILES);
  const ehiHeaders = getHeaders_(ehiSheet);
  const ehiPkgCol = ehiHeaders.indexOf("packageId") + 1;
  const ehiFileCol = ehiHeaders.indexOf("fileId") + 1;

  if (ehiPkgCol > 0 && ehiSheet.getLastRow() >= 2) {
    const rows = ehiSheet.getRange(2, 1, ehiSheet.getLastRow() - 1, ehiHeaders.length).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][ehiPkgCol - 1]) === String(id)) {
        const fileId = ehiFileCol > 0 ? String(rows[i][ehiFileCol - 1] || "") : "";
        if (fileId) {
          try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
        }
        ehiSheet.deleteRow(i + 2);
      }
    }
  }

  packageSheet.deleteRow(packageRow);
  return { success: true };
}

/* ---------- CONFIGS ---------- */

function addConfig(token, data) {
  verifyAdmin_(token);
  validateConfig_(data);

  if (!findRow_(getSheet_(SHEET_PACKAGES), data.packageId)) {
    throw new Error("Selected package does not exist.");
  }

  const id = Utilities.getUuid();

  appendObjectRow_(getSheet_(SHEET_CONFIGS), {
    id: id,
    packageId: clean_(data.packageId),
    type: clean_(data.type).toUpperCase(),
    name: clean_(data.name),
    content: String(data.content),
    active: true,
    createdAt: new Date()
  });

  return { success: true, id: id };
}

function updateConfig(token, data) {
  verifyAdmin_(token);
  validateConfig_(data);

  const sheet = getSheet_(SHEET_CONFIGS);
  const row = findRow_(sheet, data.id);
  if (!row) throw new Error("Config not found.");
  if (!findRow_(getSheet_(SHEET_PACKAGES), data.packageId)) {
    throw new Error("Selected package does not exist.");
  }

  updateObjectRow_(sheet, row, {
    packageId: clean_(data.packageId),
    type: clean_(data.type).toUpperCase(),
    name: clean_(data.name),
    content: String(data.content),
    active: data.active !== false
  });

  return { success: true };
}

function deleteConfig(token, id) {
  verifyAdmin_(token);
  const sheet = getSheet_(SHEET_CONFIGS);
  const row = findRow_(sheet, id);
  if (!row) throw new Error("Config not found.");
  sheet.deleteRow(row);
  return { success: true };
}

/* ---------- EHI FILES ---------- */

function addEhiFile(token, packageId, name, fileName, dataUrl) {
  verifyAdmin_(token);

  packageId = clean_(packageId);
  name = clean_(name);
  fileName = clean_(fileName);
  dataUrl = String(dataUrl || "");

  if (!packageId) throw new Error("Please select a package.");
  if (!name) throw new Error("Please enter an EHI file name.");
  if (!fileName) throw new Error("Please select an EHI file.");
  if (!dataUrl || dataUrl.indexOf("base64,") === -1) throw new Error("Invalid EHI file data.");
  if (!findRow_(getSheet_(SHEET_PACKAGES), packageId)) throw new Error("Selected package does not exist.");
  if (!/\.ehi$/i.test(fileName)) throw new Error("Only .ehi files are allowed.");

  const match = dataUrl.match(/^data:([^;]*);base64,([\s\S]*)$/);
  if (!match) throw new Error("Invalid file format.");

  const mimeType = match[1] || "application/octet-stream";
  const bytes = Utilities.base64Decode(match[2]);

  if (bytes.length > 15 * 1024 * 1024) throw new Error("EHI file is too large. Maximum size is 15 MB.");

  const folder = getEhiFolder_();
  const file = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const id = Utilities.getUuid();
  appendObjectRow_(getSheet_(SHEET_EHI_FILES), {
    id: id,
    packageId: packageId,
    name: name,
    fileId: file.getId(),
    fileName: fileName,
    mimeType: mimeType,
    active: true,
    createdAt: new Date()
  });

  return { success: true, id: id, fileName: fileName };
}

function deleteEhiFile(token, id) {
  verifyAdmin_(token);

  const sheet = getSheet_(EHI_SHEET_NAME_());
  const row = findRow_(sheet, id);
  if (!row) throw new Error("EHI file not found.");

  const fileCol = getHeaders_(sheet).indexOf("fileId") + 1;
  const fileId = fileCol > 0 ? String(sheet.getRange(row, fileCol).getValue() || "") : "";

  if (fileId) {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) {}
  }

  sheet.deleteRow(row);
  return { success: true };
}

function EHI_SHEET_NAME_() { return SHEET_EHI_FILES; }

function getEhiFolder_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty(EHI_FOLDER_PROPERTY);

  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (e) {}
  }

  const folders = DriveApp.getFoldersByName("VOID X VPN EHI FILES");
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("VOID X VPN EHI FILES");
  props.setProperty(EHI_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function getEhiDownloadUrl_(fileId) {
  if (!fileId) return "";
  return "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(fileId);
}

/* ---------- VALIDATION ---------- */

function validatePackage_(data) {
  if (!data) throw new Error("Package information is missing.");

  const networks = ["DIALOG", "MOBITEL", "HUTCH", "AIRTEL"];
  const network = clean_(data.network).toUpperCase();
  const accessType = clean_(data.accessType).toUpperCase();

  if (!networks.includes(network)) throw new Error("Invalid network.");
  if (!["FREE", "PAID"].includes(accessType)) throw new Error("Invalid package category.");
  if (!clean_(data.name)) throw new Error("Please enter a package name.");

  if (accessType === "PAID") {
    const price = Number(data.price);
    if (!clean_(data.dataAmount)) throw new Error("Please enter Data Amount or Unlimited.");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Please enter a valid package price.");
  }
}

function validateConfig_(data) {
  if (!data) throw new Error("Config information is missing.");
  if (!clean_(data.packageId)) throw new Error("Please select a package.");
  if (!["CODE", "NETMOD", "NPV", "EHI"].includes(clean_(data.type).toUpperCase())) {
    throw new Error("Config type must be NETMOD, NPV, CODE or EHI.");
  }
  if (!clean_(data.name) || !String(data.content || "").trim()) {
    throw new Error("Config name and content are required.");
  }
}
