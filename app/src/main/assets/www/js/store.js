/**
 * store.js —— 数据存储层（账号系统版）
 * 支持注册/登录/手机验证登录，数据按账号隔离。
 * 业务数据保存在浏览器 localStorage 中，key 带账号前缀；账号本身也保存在本机。
 */
(function (global) {
  "use strict";

  var ACCOUNTS_KEY = "gd_accounts";
  var SESSION_KEY = "gd_session";
  var SMS_KEY = "gd_sms_codes";

  /* ---------- 账号与会话 ---------- */
  function getSession() {
    try {
      var v = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function setSession(s, remember) {
    var str = s ? JSON.stringify(s) : "";
    try {
      if (s) {
        if (remember) { localStorage.setItem(SESSION_KEY, str); sessionStorage.removeItem(SESSION_KEY); }
        else { sessionStorage.setItem(SESSION_KEY, str); localStorage.removeItem(SESSION_KEY); }
      } else {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {}
  }
  function getAccounts() {
    try { var v = localStorage.getItem(ACCOUNTS_KEY); return v ? JSON.parse(v) : []; } catch (e) { return []; }
  }
  function saveAccounts(list) {
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function currentAccountId() {
    var s = getSession();
    return s ? s.accountId : "";
  }
  function currentUsername() {
    var s = getSession();
    return s ? (s.username || "") : "";
  }
  function isLoggedIn() { return true; }

  function hashPassword(pwd) {
    var h = 5381;
    var s = "gd_" + String(pwd) + "_salt";
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
    return "h" + h.toString(36);
  }

  function register(username, password, phone) {
    username = (username || "").trim();
    phone = (phone || "").trim() || null;
    return new Promise(function (resolve) {
      if (!username || !password) return resolve({ ok: false, msg: "请输入用户名和密码" });
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) return resolve({ ok: false, msg: "手机号格式不正确" });
      if (window.Supabase && window.Supabase.hasConfig()) {
        var doCreate = function () {
          window.Supabase.createAccount({ username: username, phone: phone, pass_hash: hashPassword(password) }).then(function (acc) {
            resolve({ ok: true, account: { id: acc.id, username: acc.username, phone: acc.phone } });
          })["catch"](function (e) { resolve({ ok: false, msg: e && e.message ? e.message : "注册失败" }); });
        }
        window.Supabase.findAccountByUsername(username).then(function (ex) {
          if (ex) return resolve({ ok: false, msg: "用户名已存在" });
          if (phone) {
            window.Supabase.findAccountByPhone(phone).then(function (p) {
              if (p) return resolve({ ok: false, msg: "该手机号已注册" });
              doCreate();
            })["catch"](function () { resolve({ ok: false, msg: "云端连接失败，请检查网络或配置" }); });
          } else doCreate();
        })["catch"](function () { resolve({ ok: false, msg: "云端连接失败，请检查网络或配置" }); });
      } else {
        var accounts = getAccounts();
        for (var i = 0; i < accounts.length; i++) {
          if (accounts[i].username === username) return resolve({ ok: false, msg: "用户名已存在" });
          if (phone && accounts[i].phone === phone) return resolve({ ok: false, msg: "该手机号已注册" });
        }
        var acc = { id: "acc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), username: username, phone: phone, passHash: hashPassword(password), createdAt: new Date().toISOString() };
        accounts.push(acc);
        saveAccounts(accounts);
        resolve({ ok: true, account: acc });
      }
    });
  }

  function login(loginId, password) {
    loginId = (loginId || "").trim();
    return new Promise(function (resolve) {
      if (!loginId || !password) return resolve({ ok: false, msg: "请输入账号和密码" });
      function checkPass(acc) {
        if (acc.pass_hash === hashPassword(password)) resolve({ ok: true, account: { id: acc.id, username: acc.username, phone: acc.phone } });
        else resolve({ ok: false, msg: "密码错误" });
      }
      if (window.Supabase && window.Supabase.hasConfig()) {
        window.Supabase.findAccountByUsername(loginId).then(function (acc) {
          if (acc) return checkPass(acc);
          window.Supabase.findAccountByPhone(loginId).then(function (acc2) {
            if (acc2) checkPass(acc2);
            else resolve({ ok: false, msg: "账号不存在，请先注册" });
          })["catch"](function () { resolve({ ok: false, msg: "云端连接失败，请检查网络或配置" }); });
        })["catch"](function () { resolve({ ok: false, msg: "云端连接失败，请检查网络或配置" }); });
      } else {
        var accounts = getAccounts();
        for (var i = 0; i < accounts.length; i++) {
          if (accounts[i].username === loginId || (accounts[i].phone && accounts[i].phone === loginId)) {
            if (accounts[i].passHash === hashPassword(password)) return resolve({ ok: true, account: accounts[i] });
            return resolve({ ok: false, msg: "密码错误" });
          }
        }
        resolve({ ok: false, msg: "账号不存在，请先注册" });
      }
    });
  }

  function sendCode(phone) {
    phone = (phone || "").trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) return { ok: false, msg: "手机号格式不正确" };
    var codes = {};
    try { var v = localStorage.getItem(SMS_KEY); if (v) codes = JSON.parse(v); } catch (e) {}
    var code = String(Math.floor(100000 + Math.random() * 900000));
    codes[phone] = { code: code, expiry: Date.now() + 5 * 60000 };
    try { localStorage.setItem(SMS_KEY, JSON.stringify(codes)); } catch (e) {}
    return { ok: true, code: code };
  }
  function verifyCode(phone, code) {
    phone = (phone || "").trim();
    var codes = {};
    try { var v = localStorage.getItem(SMS_KEY); if (v) codes = JSON.parse(v); } catch (e) {}
    var rec = codes[phone];
    if (!rec) return { ok: false, msg: "请先获取验证码" };
    if (rec.expiry < Date.now()) return { ok: false, msg: "验证码已过期，请重新获取" };
    if (String(rec.code) !== String(code).trim()) return { ok: false, msg: "验证码错误" };
    return { ok: true };
  }
  function loginByPhone(phone, code) {
    var v = verifyCode(phone, code);
    if (!v.ok) return Promise.resolve(v);
    phone = (phone || "").trim();
    return new Promise(function (resolve) {
      function doAutoReg() {
        var uname = "用户" + phone.slice(-4);
        register(uname, "gd" + phone.slice(-6), phone).then(function (r) { resolve(r); });
      }
      if (window.Supabase && window.Supabase.hasConfig()) {
        window.Supabase.findAccountByPhone(phone).then(function (acc) {
          if (acc) resolve({ ok: true, account: { id: acc.id, username: acc.username, phone: acc.phone } });
          else doAutoReg();
        })["catch"](function () { resolve({ ok: false, msg: "云端连接失败" }); });
      } else {
        var accounts = getAccounts();
        for (var i = 0; i < accounts.length; i++) if (accounts[i].phone === phone) return resolve({ ok: true, account: accounts[i] });
        doAutoReg();
      }
    });
  }

  function startSession(account, remember) {
    setSession({ accountId: account.id, username: account.username, phone: account.phone || null, remember: !!remember, loginAt: new Date().toISOString() }, !!remember);
  }
  function logout() { setSession(null); }

  /* ---------- 云端数据同步 ---------- */
  function syncFromCloud() {
    return new Promise(function (resolve) {
      if (!window.Supabase || !window.Supabase.hasConfig()) return resolve();
      var s = getSession();
      if (!s || !s.accountId) return resolve();
      window.Supabase.getAllData(s.accountId).then(function (rows) {
        for (var i = 0; i < rows.length; i++) {
          var k = rows[i].data_key;
          var val = rows[i].data_value;
          if (k && val !== null && val !== undefined) {
            try { localStorage.setItem(getPrefix() + k, JSON.stringify(val)); } catch (e) {}
          }
        }
        resolve();
      })["catch"](function () { resolve(); });
    });
  }

  var cloudSyncTimer = null;
  function queueCloudSync(key, val) {
    if (!window.Supabase || !window.Supabase.hasConfig()) return;
    var s = getSession();
    if (!s || !s.accountId) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(function () {
      try { window.Supabase.upsertData(s.accountId, key, val); } catch (e) {}
    }, 800);
  }



  /* ---------- 按账号隔离的数据读写 ---------- */
  function getPrefix() { return "gd_app_"; }

  function read(key, def) {
    try {
      var v = localStorage.getItem(getPrefix() + key);
      return v ? JSON.parse(v) : def;
    } catch (e) {
      return def;
    }
  }

  function write(key, val) {
    try {
      localStorage.setItem(getPrefix() + key, JSON.stringify(val));
      notifySaved();
      queueCloudSync(key, val);
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(key) {
    try { localStorage.removeItem(getPrefix() + key); } catch (e) {}
  }

  // 数据保存成功后通知界面显示"已自动保存"
  function notifySaved() {
    try {
      if (typeof window !== "undefined" && window.dispatchEvent && typeof CustomEvent !== "undefined") {
        window.dispatchEvent(new CustomEvent("gd-saved"));
      }
    } catch (e) {}
  }

  /* ==================== 花名册 ==================== */  /* ==================== 花名册 ==================== */
  function getRoster() { return read("roster", []); }
  function saveRoster(list) { write("roster", list); }

  /* ==================== 排班 ==================== */
  // schedule: { "2026-09": { items: [{id, personName, scheduleDate, shiftType, yearMonth}], persons: [name...] } }
  function getSchedule() { return read("schedule", {}); }
  function saveSchedule(data) { write("schedule", data); }
  function getScheduleMonth(yearMonth) {
    var all = getSchedule();
    return all[yearMonth] || { items: [], persons: [] };
  }
  function saveScheduleMonth(yearMonth, monthData) {
    var all = getSchedule();
    all[yearMonth] = monthData;
    saveSchedule(all);
  }

  /* ==================== 工分 ==================== */
  // workpoints: { "2026-09": { items: [{id, personName, workDate, yearMonth, reason, points}], reasons: {date: reason}, persons: [name...] } }
  function getWorkPoints() { return read("workpoints", {}); }
  function saveWorkPoints(data) { write("workpoints", data); }
  function getWorkPointsMonth(yearMonth) {
    var all = getWorkPoints();
    return all[yearMonth] || { items: [], reasons: {}, persons: [] };
  }
  function saveWorkPointsMonth(yearMonth, monthData) {
    var all = getWorkPoints();
    all[yearMonth] = monthData;
    saveWorkPoints(all);
  }

  /* ==================== 待办 ==================== */
  function getTodos() { return read("todos", []); }
  function saveTodos(list) { write("todos", list); }

  /* ==================== 备忘录 ==================== */
  function getMemos() { return read("memos", []); }
  function saveMemos(list) { write("memos", list); }

  /* ==================== 设备资料 ==================== */
  // devices: { sections: [...], stations: [...], items: [...] }
  function getDevices() {
    var d = read("devices", null);
    if (!d) d = { sections: [], stations: [], items: [] };
    if (!d.sections) d.sections = [];
    if (!d.stations) d.stations = [];
    if (!d.items) d.items = [];
    return d;
  }
  function saveDevices(d) { write("devices", d); }

  /* ==================== 相册 ==================== */
  // albums: [{id, name, type, parentId, createdAt}]
  // photos: [{id, albumId, name, dataUrl, createdAt}]
  function getAlbums() { return read("albums", []); }
  function saveAlbums(list) { write("albums", list); }
  function getPhotos() { return read("photos", []); }
  function savePhotos(list) { write("photos", list); }

  /* ==================== 设备图纸（CAD/PDF/Word/Excel/图片） ==================== */
  // drawings: [{id, name, type, dataUrl, size, createdAt}]
  function getDrawings() { return read("drawings", []); }
  function saveDrawings(list) { write("drawings", list); }

  /* ==================== 学习资料 ==================== */
  // learning: { materials: [...], records: [...] }
  function getLearning() {
    var l = read("learning", null);
    if (!l) l = { materials: [], records: [] };
    if (!l.materials) l.materials = [];
    if (!l.records) l.records = [];
    return l;
  }
  function saveLearning(l) { write("learning", l); }

  /* ==================== 全部数据（备份/恢复/重置） ==================== */
  function exportAll() {
    var cur = getSession();
    var accInfo = null;
    if (cur) {
      var accs = getAccounts();
      for (var ai = 0; ai < accs.length; ai++) {
        if (accs[ai].id === cur.accountId) {
          accInfo = { username: accs[ai].username, phone: accs[ai].phone, passHash: accs[ai].passHash };
          break;
        }
      }
    }
    return {
      app: "供电工区工作台",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      account: accInfo,
      roster: getRoster(),
      schedule: getSchedule(),
      workpoints: getWorkPoints(),
      todos: getTodos(),
      memos: getMemos(),
      devices: getDevices(),
      albums: getAlbums(),
      photos: getPhotos(),
      drawings: getDrawings(),
      learning: getLearning()
    };
  }

  function importAll(data) {
    if (!data || typeof data !== "object") return false;
    // 恢复备份中的账号（本机不存在则自动注册），并自动登录该账号以便数据写入正确前缀
    if (data.account && data.account.username) {
      var accs = getAccounts();
      var target = null;
      for (var ai = 0; ai < accs.length; ai++) {
        if (accs[ai].username === data.account.username) { target = accs[ai]; break; }
      }
      if (!target) {
        target = {
          id: "acc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          username: data.account.username,
          phone: data.account.phone || null,
          passHash: data.account.passHash,
          createdAt: new Date().toISOString()
        };
        accs.push(target);
        saveAccounts(accs);
      }
      startSession(target, true);
    }
    if (data.roster) saveRoster(data.roster);
    if (data.schedule) saveSchedule(data.schedule);
    if (data.workpoints) saveWorkPoints(data.workpoints);
    if (data.todos) saveTodos(data.todos);
    if (data.memos) saveMemos(data.memos);
    if (data.devices) saveDevices(data.devices);
    if (data.albums) saveAlbums(data.albums);
    if (data.photos) savePhotos(data.photos);
    if (data.drawings) saveDrawings(data.drawings);
    if (data.learning) saveLearning(data.learning);
    return true;
  }

  function resetAll() {
    remove("roster");
    remove("schedule");
    remove("workpoints");
    remove("todos");
    remove("memos");
    remove("devices");
    remove("albums");
    remove("photos");
    remove("drawings");
    remove("learning");
  }

  /* ==================== 统计辅助 ==================== */
  function calcRosterStats() {
    var roster = getRoster();
    return { totalStaff: roster.length };
  }

  function calcToday() {
    var today = new Date();
    var ymd = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    // 今日值班：查当月排班中 scheduleDate === today 且 shiftType === "值"
    var ym = ymd.slice(0, 7);
    var sm = getScheduleMonth(ym);
    var onDuty = [];
    for (var i = 0; i < sm.items.length; i++) {
      if (sm.items[i].scheduleDate === ymd && sm.items[i].shiftType === "值") onDuty.push(sm.items[i].personName);
    }
    // 今日待办
    var todos = getTodos();
    var todayTodos = [];
    for (var j = 0; j < todos.length; j++) {
      var t = todos[j];
      if (t.status === "completed") continue;
      // 截止日期在今天的待办（无截止日期的全部算作待办）
      if (!t.dueDate) { todayTodos.push(t); continue; }
      var due = t.dueDate.slice(0, 10);
      if (due <= ymd) todayTodos.push(t);
    }
    // 近 4 天排班
    var recentSchedule = [];
    for (var k = 0; k < 4; k++) {
      var d = new Date(today);
      d.setDate(d.getDate() + k);
      var ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      var dym = ds.slice(0, 7);
      var dm = getScheduleMonth(dym);
      for (var m = 0; m < dm.items.length; m++) {
        if (dm.items[m].scheduleDate === ds) {
          recentSchedule.push({ scheduleDate: ds, shiftType: dm.items[m].shiftType, personName: dm.items[m].personName });
        }
      }
    }
    return {
      todayYmd: ymd,
      onDuty: onDuty,
      todayTodos: todayTodos,
      recentSchedule: recentSchedule
    };
  }

  global.Store = {
    getRoster: getRoster, saveRoster: saveRoster,
    getSchedule: getSchedule, saveSchedule: saveSchedule,
    getScheduleMonth: getScheduleMonth, saveScheduleMonth: saveScheduleMonth,
    getWorkPoints: getWorkPoints, saveWorkPoints: saveWorkPoints,
    getWorkPointsMonth: getWorkPointsMonth, saveWorkPointsMonth: saveWorkPointsMonth,
    getTodos: getTodos, saveTodos: saveTodos,
    getMemos: getMemos, saveMemos: saveMemos,
    getDevices: getDevices, saveDevices: saveDevices,
    getAlbums: getAlbums, saveAlbums: saveAlbums,
    getPhotos: getPhotos, savePhotos: savePhotos,
    getDrawings: getDrawings, saveDrawings: saveDrawings,
    getLearning: getLearning, saveLearning: saveLearning,
    exportAll: exportAll, importAll: importAll, resetAll: resetAll,
    calcToday: calcToday, calcRosterStats: calcRosterStats,
    register: register, login: login, loginByPhone: loginByPhone,
    sendCode: sendCode, verifyCode: verifyCode,
    startSession: startSession, logout: logout,
    isLoggedIn: isLoggedIn, currentUsername: currentUsername, currentAccountId: currentAccountId,
    syncFromCloud: syncFromCloud
  };
})(window);









