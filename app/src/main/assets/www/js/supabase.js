/**
 * supabase.js —— Supabase 云端数据层对接（REST API，无需 SDK）
 * 需要先执行建表 SQL（见 README 或 supabase_setup.sql）。
 * 安全说明：使用 anon key + 关闭 RLS，适合内部使用；生产环境建议启用 Supabase Auth。
 */
window.Supabase = (function () {
  "use strict";

  var CONFIG_KEY = "gd_supabase_config";
  var url = "";
  var anonKey = "";

  function init(cfg) {
    url = String(cfg.url || "").replace(/\/+$/, "");
    anonKey = String(cfg.anonKey || "").trim();
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: url, anonKey: anonKey })); } catch (e) {}
    return !!url && !!anonKey;
  }
  function loadConfig() {
    try {
      var v = localStorage.getItem(CONFIG_KEY);
      if (!v) return null;
      var p = JSON.parse(v);
      url = String(p.url || "").replace(/\/+$/, "");
      anonKey = String(p.anonKey || "").trim();
      return { url: url, anonKey: anonKey };
    } catch (e) { return null; }
  }
  function hasConfig() {
    var c = loadConfig();
    return !!(c && c.url && c.anonKey);
  }

  function headers() {
    return { "apikey": anonKey, "Authorization": "Bearer " + anonKey, "Content-Type": "application/json", "Prefer": "return=representation" };
  }
  function api(path, opts) {
    opts = opts || {};
    return fetch(url + "/rest/v1/" + path, Object.assign({ headers: headers() }, opts));
  }
  function enc(s) { return encodeURIComponent(String(s)); }

  /* ---------- 连接测试 ---------- */
  async function testConnection() {
    try {
      var res = await api("gd_accounts?select=id&limit=1");
      return res.ok || res.status === 200;
    } catch (e) { return false; }
  }

  /* ---------- 账号 ---------- */
  async function findAccountByUsername(username) {
    var res = await api("gd_accounts?select=*&username=eq." + enc(username));
    if (!res.ok) return null;
    var rows = await res.json();
    return rows && rows.length ? rows[0] : null;
  }
  async function findAccountByPhone(phone) {
    var res = await api("gd_accounts?select=*&phone=eq." + enc(phone));
    if (!res.ok) return null;
    var rows = await res.json();
    return rows && rows.length ? rows[0] : null;
  }
  async function createAccount(acc) {
    var res = await api("gd_accounts", { method: "POST", body: JSON.stringify(acc) });
    if (!res.ok) {
      if (res.status === 409) throw new Error("用户名或手机号已存在");
      throw new Error("创建账号失败（" + res.status + "）");
    }
    var rows = await res.json();
    return rows && rows.length ? rows[0] : null;
  }

  /* ---------- 用户数据 ---------- */
  async function getAllData(accountId) {
    var res = await api("gd_user_data?select=data_key,data_value&account_id=eq." + enc(accountId));
    if (!res.ok) return [];
    return await res.json();
  }
  async function upsertData(accountId, key, value) {
    var check = await api("gd_user_data?account_id=eq." + enc(accountId) + "&data_key=eq." + enc(key));
    var rows = await check.json();
    var now = new Date().toISOString();
    if (rows && rows.length) {
      return await api("gd_user_data?account_id=eq." + enc(accountId) + "&data_key=eq." + enc(key), {
        method: "PATCH", body: JSON.stringify({ data_value: value, updated_at: now })
      });
    }
    return await api("gd_user_data", {
      method: "POST", body: JSON.stringify({ account_id: accountId, data_key: key, data_value: value, updated_at: now })
    });
  }

  return {
    init: init, loadConfig: loadConfig, hasConfig: hasConfig,
    testConnection: testConnection,
    findAccountByUsername: findAccountByUsername, findAccountByPhone: findAccountByPhone, createAccount: createAccount,
    getAllData: getAllData, upsertData: upsertData
  };
})();
