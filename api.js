// api.js - Connects the website to the Google Apps Script backend
// Apps Script එක Deploy කළාම ලැබෙන /exec URL එක මෙතනට දාන්න
const API_URL = "https://script.google.com/macros/s/AKfycbxY6X1ie9DwWxb19nMqDVhkM3yk96DJ9recRQPAeflssfn4w0wrX-HIoA6ogM2UvBqs/exec";

async function callApi(action, extra) {
  if (!API_URL || API_URL.indexOf("PASTE_") === 0) {
    throw new Error("api.js එකේ API_URL එක තවම දාලා නැහැ.");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    // text/plain පාවිච්චි කරන්නේ CORS preflight වළක්වන්න
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action: action }, extra || {}))
  });
  if (!res.ok) throw new Error("Network error: " + res.status);
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message || "Server error");
  return json.data;
}

const methods = {
  getPublicData: () => callApi("publicData"),
  adminLogin: (u, p) => callApi("adminLogin", { username: u, password: p }),
  adminLogout: t => callApi("adminLogout", { token: t }),
  getAdminData: t => callApi("adminData", { token: t }),
  addPackage: (t, d) => callApi("addPackage", { token: t, data: d }),
  updatePackage: (t, d) => callApi("updatePackage", { token: t, data: d }),
  deletePackage: (t, id) => callApi("deletePackage", { token: t, data: { id: id } }),
  addConfig: (t, d) => callApi("addConfig", { token: t, data: d }),
  updateConfig: (t, d) => callApi("updateConfig", { token: t, data: d }),
  deleteConfig: (t, id) => callApi("deleteConfig", { token: t, data: { id: id } }),
  addEhiFile: (t, pid, name, fileName, dataUrl) =>
    callApi("addEhiFile", {
      token: t,
      data: { packageId: pid, name: name, fileName: fileName, dataUrl: dataUrl }
    }),
  deleteEhiFile: (t, id) => callApi("deleteEhiFile", { token: t, data: { id: id } })
};

// google.script.run emulate කරනවා
function makeRunner(onOk, onFail) {
  const r = {
    withSuccessHandler: fn => makeRunner(fn, onFail),
    withFailureHandler: fn => makeRunner(onOk, fn)
  };
  Object.keys(methods).forEach(name => {
    r[name] = (...args) => {
      methods[name](...args)
        .then(v => onOk && onOk(v))
        .catch(e => onFail && onFail(e));
    };
  });
  return r;
}

window.google = { script: { run: makeRunner() } };
