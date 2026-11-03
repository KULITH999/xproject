/*************************************************
 * VOID X VPN - API BRIDGE (Vercel <-> Google Apps Script)
 * google.script.run වෙනුවට fetch() පාවිච්චි කරනවා.
 *************************************************/

// >>> ඔබගේ Apps Script Web App URL එක මෙතනට දාන්න (/exec වලින් ඉවර වෙන එක) <<<
const API_URL = "https://script.google.com/macros/s/AKfycbyGFLMlIoS1DBh9f7yIFn0HBigZnLVpT_Hge8u60f6bTBybVxiIKpIj6YXm9eZQj4I/exec";

(function () {
  // method name + arguments -> REST body
  function buildBody(method, args) {
    switch (method) {
      case "getPublicData": return { action: "publicData" };
      case "adminLogin":    return { action: "adminLogin", username: args[0], password: args[1] };
      case "adminLogout":   return { action: "adminLogout", token: args[0] };
      case "getAdminData":  return { action: "adminData", token: args[0] };
      case "addPackage":
      case "updatePackage":
      case "addConfig":
      case "updateConfig":  return { action: method, token: args[0], data: args[1] };
      case "deletePackage":
      case "deleteConfig":
      case "deleteEhiFile": return { action: method, token: args[0], data: { id: args[1] } };
      case "addEhiFile":
        return { action: "addEhiFile", token: args[0],
          data: { packageId: args[1], name: args[2], fileName: args[3], dataUrl: args[4] } };
      default: return { action: method, token: args[0], data: args[1] };
    }
  }

  async function callApi(method, args) {
    if (!API_URL || API_URL.indexOf("script.google.com") === -1) {
      throw new Error("API_URL is not set in api.js");
    }
    // text/plain => CORS preflight එකක් නැහැ (Apps Script එකට ඕන)
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(buildBody(method, args)),
      redirect: "follow"
    });
    const json = await res.json();
    if (!json || json.status !== "success") {
      throw new Error((json && json.message) || "Server error");
    }
    return json.data;
  }

  // google.script.run එකට සමාන interface එකක්
  function makeRunner(success, failure) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === "withSuccessHandler") return fn => makeRunner(fn, failure);
        if (prop === "withFailureHandler") return fn => makeRunner(success, fn);
        return (...args) => {
          callApi(prop, args)
            .then(data => success && success(data))
            .catch(err => failure && failure(err));
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null);
  window.voidApi = callApi;
})();
