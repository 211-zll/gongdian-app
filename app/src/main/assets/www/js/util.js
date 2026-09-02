/**
 * util.js —— 通用工具函数
 */
(function (global) {
  "use strict";

  /* ---------- ID 生成 ---------- */
  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- 日期工具 ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtYmd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmtYm(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  var WEEK_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  function weekdayCn(d) { return WEEK_CN[d.getDay()]; }
  function parseYmd(s) {
    var p = String(s).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function fmtDateTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fmtDateCn(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + WEEK_CN[d.getDay()];
  }

  /* ---------- 身份证年龄计算 ---------- */
  function ageFromIdCard(id) {
    if (!id || typeof id !== "string") return null;
    var birth = null;
    if (/^\d{15}$/.test(id)) {
      birth = "19" + id.slice(6, 8) + "-" + id.slice(8, 10) + "-" + id.slice(10, 12);
    } else if (/^\d{17}[\dXx]$/.test(id)) {
      birth = id.slice(6, 10) + "-" + id.slice(10, 12) + "-" + id.slice(12, 14);
    } else {
      return null;
    }
    var b = parseYmd(birth);
    if (isNaN(b.getTime())) return null;
    var now = new Date();
    var age = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
    return age >= 0 && age <= 150 ? age : null;
  }

  /* ---------- HTML 转义 ---------- */
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- 下载 ---------- */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function downloadJson(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, filename);
  }
  function downloadText(text, filename, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    downloadBlob(blob, filename);
  }
  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(dataUrl); }, 1000);
  }

  /* ---------- Toast 提示 ---------- */
  function toast(msg, type) {
    var el = document.getElementById("gd-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "gd-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "gd-toast show " + (type || "info");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.className = "gd-toast"; }, 2400);
  }

  /* ---------- 确认对话框（Promise） ---------- */
  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "gd-dialog-overlay";
      overlay.innerHTML =
        '<div class="gd-dialog">' +
        '<div class="gd-dialog-title">' + esc(opts.title || "确认操作") + "</div>" +
        '<div class="gd-dialog-msg">' + esc(message) + "</div>" +
        '<div class="gd-dialog-btns">' +
        '<button class="gd-btn ghost" data-act="cancel">' + esc(opts.cancelText || "取消") + "</button>" +
        '<button class="gd-btn danger" data-act="ok">' + esc(opts.okText || "确定") + "</button>" +
        "</div></div>";
      overlay.addEventListener("click", function (e) {
        var act = e.target && e.target.getAttribute ? e.target.getAttribute("data-act") : null;
        if (act === "ok") { document.body.removeChild(overlay); resolve(true); }
        else if (act === "cancel") { document.body.removeChild(overlay); resolve(false); }
        else if (e.target === overlay) { document.body.removeChild(overlay); resolve(false); }
      });
      document.body.appendChild(overlay);
    });
  }

  /* ---------- 提示对话框 ---------- */
  function alertDialog(message, title) {
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "gd-dialog-overlay";
      overlay.innerHTML =
        '<div class="gd-dialog">' +
        '<div class="gd-dialog-title">' + esc(title || "提示") + "</div>" +
        '<div class="gd-dialog-msg">' + esc(message) + "</div>" +
        '<div class="gd-dialog-btns"><button class="gd-btn primary" data-act="ok">知道了</button></div>' +
        "</div>";
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay || (e.target && e.target.getAttribute("data-act") === "ok")) {
          document.body.removeChild(overlay);
          resolve();
        }
      });
      document.body.appendChild(overlay);
    });
  }

  /* ---------- 弹出层（底部抽屉/居中弹窗，Promise 获取表单） ---------- */
  function openModal(html, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "gd-modal-overlay";
      overlay.innerHTML = '<div class="gd-modal ' + (opts.sheet ? "sheet" : "center") + '">' + html + "</div>";
      function close(result) {
        document.body.removeChild(overlay);
        resolve(result);
      }
      overlay.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
        var act = btn ? btn.getAttribute("data-act") : null;
        if (act === "cancel") { close(null); }
        else if (btn && btn.getAttribute("type") !== "submit" && act !== "ok") {
          // 操作按钮：关闭弹窗，动作由全局事件委托继续执行
          close(null);
        }
        else if (e.target === overlay && opts.dismissible !== false) close(null);
      });
      // 表单提交
      var form = overlay.querySelector("form");
      if (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var data = {};
          // 优先取被点击的提交按钮（如班次选择）
          var submitter = e.submitter;
          if (submitter && submitter.name) data[submitter.name] = submitter.value;
          var inputs = form.querySelectorAll("input[name],select[name],textarea[name]");
          var checkboxGroups = {};
          for (var i = 0; i < inputs.length; i++) {
            var inp = inputs[i];
            var nm = inp.getAttribute("name");
            if (!nm) continue;
            if (inp.type === "checkbox") {
              if (!checkboxGroups[nm]) checkboxGroups[nm] = [];
              checkboxGroups[nm].push(inp);
            } else if (inp.type === "radio") {
              if (inp.checked) data[nm] = inp.value;
            } else {
              data[nm] = inp.value;
            }
          }
          // 复选框：单个返回布尔，多个返回选中值数组
          for (var g in checkboxGroups) {
            var group = checkboxGroups[g];
            if (group.length === 1) {
              data[g] = group[0].checked;
            } else {
              data[g] = [];
              for (var gi = 0; gi < group.length; gi++) {
                if (group[gi].checked) data[g].push(group[gi].value);
              }
            }
          }
          close(data);
        });
      }
      document.body.appendChild(overlay);
      // 自动聚焦
      setTimeout(function () {
        var f = overlay.querySelector("input:not([type=hidden]),select,textarea");
        if (f) f.focus();
      }, 60);
    });
  }

  /* ---------- 全屏 ---------- */
  function enterFullscreen(exitAct) {
    var wrap = document.querySelector("#gd-page .gd-table-wrap");
    if (!wrap) return;
    wrap.classList.add("gd-fs");
    var btn = document.getElementById("gd-fs-exit");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "gd-fs-exit";
      btn.className = "gd-fs-exit-btn";
      btn.setAttribute("data-act", exitAct || "fs-exit");
      btn.innerHTML = icon("close") + "退出全屏";
      document.body.appendChild(btn);
    }
  }
  function exitFullscreen() {
    var wrap = document.querySelector("#gd-page .gd-table-wrap");
    if (wrap) wrap.classList.remove("gd-fs");
    var btn = document.getElementById("gd-fs-exit");
    if (btn) document.body.removeChild(btn);
  }

  /* ---------- SVG 图标集合 ---------- */
  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
  };

  function icon(name, cls) {
    return '<span class="gd-icon ' + (cls || "") + '">' + (ICONS[name] || "") + "</span>";
  }

  /* ---------- 输入组件 ---------- */
  function field(label, name, value, placeholder, opts) {
    opts = opts || {};
    var html = '<div class="gd-field">';
    html += '<label class="gd-label">' + label + (opts.required ? ' <i class="req">*</i>' : "") + "</label>";
    if (opts.type === "select") {
      html += '<select name="' + name + '" class="gd-input">';
      var options = opts.options || [];
      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var v, l;
        if (Array.isArray(o)) { v = o[0]; l = o[1] || o[0]; }
        else if (o !== null && typeof o === "object") { v = o.value; l = o.label || o.value; }
        else { v = l = o; }
        html += '<option value="' + esc(v) + '"' + (String(value) === String(v) ? " selected" : "") + ">" + esc(l) + "</option>";
      }
      html += "</select>";
    } else if (opts.type === "textarea") {
      html += '<textarea name="' + name + '" class="gd-input" rows="' + (opts.rows || 3) + '" placeholder="' + esc(placeholder || "") + '">' + esc(value || "") + "</textarea>";
    } else if (opts.type === "checkbox") {
      html += '<label class="gd-check"><input type="checkbox" name="' + name + '"' + (value ? " checked" : "") + "/><span>" + esc(label) + "</span></label>";
    } else {
      html += '<input name="' + name + '" type="' + (opts.type || "text") + '" value="' + esc(value || "") + '" class="gd-input" placeholder="' + esc(placeholder || "") + '"' + (opts.required ? " required" : "") + "/>";
    }
    if (opts.hint) html += '<p class="gd-hint">' + opts.hint + "</p>";
    html += "</div>";
    return html;
  }

  global.Util = {
    uid: uid, pad: pad, fmtYmd: fmtYmd, fmtYm: fmtYm, daysInMonth: daysInMonth,
    weekdayCn: weekdayCn, parseYmd: parseYmd, fmtDateTime: fmtDateTime, fmtDateCn: fmtDateCn,
    ageFromIdCard: ageFromIdCard, esc: esc,
    downloadBlob: downloadBlob, downloadJson: downloadJson, downloadText: downloadText, downloadDataUrl: downloadDataUrl,
    toast: toast, confirmDialog: confirmDialog, alertDialog: alertDialog, openModal: openModal,
    icon: icon, field: field,
    enterFullscreen: enterFullscreen, exitFullscreen: exitFullscreen
  };
})(window);





