/**
 * schedule.js —— 排班表页面
 * 月历网格：行=人员，列=日期；班次：休/白/值/年休/学/差
 * 支持人员管理、默认排班、导入导出 Excel、导出图片
 */
window.PageSchedule = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var SHIFTS = ["休", "白", "值", "年休", "学", "差"];
  var SHIFT_CLASS = { "休": "rest", "白": "bai", "值": "zhi", "年休": "nrest", "学": "xue", "差": "cha" };

  var state = { yearMonth: U.fmtYm(new Date()), selected: null };

  function ymParts(ym) {
    var p = ym.split("-");
    return { year: Number(p[0]), month: Number(p[1]) - 1, ym: ym };
  }
  function ymd(ym, day) {
    var p = ym.split("-");
    return p[0] + "-" + p[1] + "-" + U.pad(day);
  }

  function load() {
    var m = S.getScheduleMonth(state.yearMonth);
    if (!m.persons || m.persons.length === 0) {
      var roster = S.getRoster();
      m.persons = roster.map(function (p) { return p.name; });
      if (m.persons.length > 0) S.saveScheduleMonth(state.yearMonth, m);
    }
    return m;
  }
  function save(m) {
    S.saveScheduleMonth(state.yearMonth, m);
  }

  function getMap(items) {
    var map = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!map[it.personName]) map[it.personName] = {};
      map[it.personName][it.scheduleDate] = it.shiftType;
    }
    return map;
  }

  function render() {
    var parts = ymParts(state.yearMonth);
    var days = U.daysInMonth(parts.year, parts.month);
    var m = load();
    var persons = m.persons || [];
    var map = getMap(m.items || []);
    var html = "";

    html += '<div class="gd-page-head">';
    html += "<div><h1>排班表</h1><p class='gd-sub'>" + state.yearMonth + " · 共 " + persons.length + " 人</p></div>";
    html += '<button class="gd-btn primary" data-act="sched-add">' + U.icon("plus") + "添加人员</button>";
    html += "</div>";

    html += '<div class="gd-toolbar">';
    html += '<button class="gd-btn ghost" data-act="sched-prev">' + U.icon("left", "flip") + "</button>";
    html += '<span class="gd-month">' + parts.year + "年" + (parts.month + 1) + "月</span>";
    html += '<button class="gd-btn ghost" data-act="sched-next">' + U.icon("right") + "</button>";
    html += '<span class="gd-flex1"></span>';
    html += '<button class="gd-btn ghost" data-act="sched-fs">' + U.icon("expand") + "</button>";
    html += '<button class="gd-btn ghost" data-act="sched-menu">' + U.icon("more") + "</button>";
    html += "</div>";

    if (persons.length === 0) {
      html += '<div class="gd-empty">' + U.icon("calendar") + "<p>暂无排班人员，点击「添加人员」从花名册选择</p></div>";
      html += '<div class="gd-card gd-help"><b>班次说明：</b>';
      for (var s = 0; s < SHIFTS.length; s++) {
        html += '<span class="gd-shift-badge ' + SHIFT_CLASS[SHIFTS[s]] + '">' + SHIFTS[s] + "</span>";
      }
      html += "<p>点击单元格选择班次；点击姓名弹出操作菜单</p></div>";
      return html;
    }

    html += '<div class="gd-table-wrap">';
    html += '<table class="gd-table sched-table">';
    html += "<colgroup><col style='width:76px'/>";
    for (var d = 1; d <= days; d++) html += "<col style='width:40px'/>";
    html += "</colgroup>";
    html += "<thead><tr><th class='sticky'>姓名</th>";
    for (var d2 = 1; d2 <= days; d2++) {
      var dt = new Date(parts.year, parts.month, d2);
      var wk = dt.getDay();
      var cls = wk === 0 || wk === 6 ? "weekend" : "";
      html += "<th class='" + cls + "'><b>" + d2 + "</b><i>" + U.weekdayCn(dt).slice(1) + "</i></th>";
    }
    html += "</tr></thead><tbody>";
    for (var r = 0; r < persons.length; r++) {
      var name = persons[r];
      html += "<tr>";
      html += '<td class="sticky name-cell" data-act="sched-person" data-name="' + U.esc(name) + '">' + U.esc(name) + "</td>";
      for (var d3 = 1; d3 <= days; d3++) {
        var dateStr = ymd(state.yearMonth, d3);
        var sh = map[name] ? map[name][dateStr] : "";
        var dt3 = new Date(parts.year, parts.month, d3);
        var wk3 = dt3.getDay();
        var cls3 = (wk3 === 0 || wk3 === 6) ? "weekend" : "";
        html += '<td class="' + cls3 + '">';
        html += sh ? '<button class="gd-shift ' + SHIFT_CLASS[sh] + '" data-act="sched-cell" data-name="' + U.esc(name) + '" data-day="' + d3 + '">' + sh + "</button>" :
                     '<button class="gd-shift empty" data-act="sched-cell" data-name="' + U.esc(name) + '" data-day="' + d3 + '">·</button>';
        html += "</td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    html += "</div>";

    // 班次统计
    var stats = {};
    for (var i = 0; i < (m.items || []).length; i++) {
      var st = m.items[i].shiftType;
      if (!stats[st]) stats[st] = 0;
      stats[st]++;
    }
    html += '<div class="gd-card gd-help"><b>班次说明：</b>';
    for (var s2 = 0; s2 < SHIFTS.length; s2++) {
      html += '<span class="gd-shift-badge ' + SHIFT_CLASS[SHIFTS[s2]] + '">' + SHIFTS[s2] + "</span>";
    }
    html += '<span class="gd-flex1"></span><span class="gd-mini">本月共 ' + (m.items || []).length + " 条排班</span>";
    html += "<p>点击单元格选择班次；点击姓名弹出操作菜单（上移 / 下移 / 删除）</p></div>";
    return html;
  }

  /* ---------- 班次选择 ---------- */
  function pickShift(name, day) {
    state.pendingShift = { name: name, day: day };
    var dateStr = ymd(state.yearMonth, day);
    var html = '<div class="gd-modal-title">' + U.esc(name) + " · " + dateStr + "</div>";
    html += '<div class="gd-shift-pick">';
    for (var i = 0; i < SHIFTS.length; i++) {
      html += '<button class="gd-shift big ' + SHIFT_CLASS[SHIFTS[i]] + '" data-act="sched-set" data-shift="' + SHIFTS[i] + '">' + SHIFTS[i] + "</button>";
    }
    html += "</div>";
    html += '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">取消</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }
  function setShift(name, day, shift) {
    var dateStr = ymd(state.yearMonth, day);
    var m = load();
    m.items = m.items || [];
    var idx = -1;
    for (var i = 0; i < m.items.length; i++) {
      if (m.items[i].personName === name && m.items[i].scheduleDate === dateStr) { idx = i; break; }
    }
    if (shift === "") { // 清空班次（“休”同样保存为记录，表格才能显示“休”）
      if (idx >= 0) m.items.splice(idx, 1);
    } else {
      var rec = { id: name + "-" + dateStr, personName: name, scheduleDate: dateStr, shiftType: shift, yearMonth: state.yearMonth };
      if (idx >= 0) m.items[idx] = rec; else m.items.push(rec);
    }
    save(m);
    window.App.refresh();
  }

  /* ---------- 人员操作 ---------- */
  function personOps(name) {
    var m = load();
    var persons = m.persons || [];
    var idx = persons.indexOf(name);
    var html =
      '<div class="gd-modal-title">' + U.esc(name) + " · 操作</div>" +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="sched-up" data-name="' + U.esc(name) + '">' + U.icon("up") + "上移" + (idx <= 0 ? ' <em class="disabled">(已是首位)</em>' : "") + "</button>" +
      '<button class="gd-ops-item" data-act="sched-down" data-name="' + U.esc(name) + '">' + U.icon("down") + "下移" + (idx === persons.length - 1 ? ' <em class="disabled">(已是末位)</em>' : "") + "</button>" +
      '<button class="gd-ops-item danger" data-act="sched-delperson" data-name="' + U.esc(name) + '">' + U.icon("trash") + "删除该人员当月排班</button>" +
      "</div>" +
      '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  function movePerson(name, dir) {
    var m = load();
    var persons = m.persons || [];
    var idx = persons.indexOf(name);
    var to = idx + dir;
    if (idx < 0 || to < 0 || to >= persons.length) return;
    var tmp = persons[idx];
    persons[idx] = persons[to];
    persons[to] = tmp;
    m.persons = persons;
    save(m);
    window.App.refresh();
  }

  async function removePerson(name) {
    var ok = await U.confirmDialog("确定要删除人员「" + name + "」的当月所有排班记录吗？此操作不可撤销。", { title: "删除人员" });
    if (!ok) return;
    var m = load();
    m.persons = (m.persons || []).filter(function (p) { return p !== name; });
    m.items = (m.items || []).filter(function (it) { return it.personName !== name; });
    save(m);
    U.toast("已删除");
    window.App.refresh();
  }

  /* ---------- 添加人员 ---------- */
  function addPerson() {
    var roster = S.getRoster();
    var m = load();
    var existing = (m.persons || []).slice();
    var available = roster.filter(function (p) { return existing.indexOf(p.name) < 0; });
    var html = '<div class="gd-modal-title">从花名册选择人员</div>';
    if (available.length === 0) {
      html += '<div class="gd-empty small">' + U.icon("users") + "<p>所有人员均已添加，或花名册暂无人员</p></div>";
      html += '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
      U.openModal(html, { dismissible: true }).then(function () {});
      return;
    }
    html += '<form class="gd-form"><div class="gd-check-list">';
    for (var i = 0; i < available.length; i++) {
      html += '<label class="gd-check"><input type="checkbox" name="sel" value="' + U.esc(available[i].name) + '"/><span>' + U.esc(available[i].name) + (available[i].position ? " · " + U.esc(available[i].position) : "") + "</span></label>";
    }
    html += '</div><div class="gd-modal-btns">';
    html += '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>';
    html += '<button type="submit" class="gd-btn primary">确认添加</button></div></form>';
    U.openModal(html, { dismissible: true }).then(function (data) {
      if (!data) return;
      var chosen = [];
      for (var k = 0; k < data.sel.length; k++) if (data.sel[k]) chosen.push(data.sel[k]);
      if (chosen.length === 0) return;
      var mm = load();
      mm.persons = (mm.persons || []).concat(chosen);
      save(mm);
      U.toast("已添加 " + chosen.length + " 人");
      window.App.refresh();
    });
  }

  /* ---------- 默认排班 ---------- */
  function generateDefault() {
    var m = load();
    var persons = m.persons || [];
    if (persons.length === 0) { U.toast("暂无排班人员", "error"); return; }
    var parts = ymParts(state.yearMonth);
    var days = U.daysInMonth(parts.year, parts.month);
    var items = [];
    for (var d = 1; d <= days; d++) {
      var dateStr = ymd(state.yearMonth, d);
      var dt = new Date(parts.year, parts.month, d);
      var isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
      var shift = isWeekend ? "休" : "白";
      for (var p = 0; p < persons.length; p++) {
        items.push({ id: persons[p] + "-" + dateStr, personName: persons[p], scheduleDate: dateStr, shiftType: shift, yearMonth: state.yearMonth });
      }
    }
    m.items = items;
    save(m);
    U.toast("已生成默认排班（周一至周五白班，周六周日休息）");
    window.App.refresh();
  }

  /* ---------- 导入排班 ---------- */
  function importSchedule(file, mode) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var ext = (file.name || "").split(".").pop().toLowerCase();
        var grid;
        if (ext === "csv" || ext === "txt") {
          grid = window.XLSX.parseCsv(String(e.target.result));
        } else {
          var sheets = window.XLSX.readXlsx(e.target.result);
          var names = Object.keys(sheets);
          if (names.length === 0) { U.toast("未解析到排班数据", "error"); return; }
          grid = sheets[names[0]];
        }
        if (!grid || grid.length < 2) { U.toast("文件内容为空或格式不正确", "error"); return; }
        // 第一行：姓名 + 1号 2号 ...
        var headers = grid[0].map(function (h) { return String(h == null ? "" : h).trim(); });
        var dayCols = [];
        for (var c = 1; c < headers.length; c++) {
          var mm2 = headers[c].match(/^(\d{1,2})/);
          if (mm2) dayCols.push({ col: c, day: Number(mm2[1]) });
        }
        if (dayCols.length === 0) {
          var headHint = headers.slice(0, 5).join("、");
          U.toast("未找到日期列，请确认第一行包含 1号、2号（识别到：" + headHint + "）", "error");
          return;
        }
        var parts = ymParts(state.yearMonth);
        var days = U.daysInMonth(parts.year, parts.month);
        var m = load();
        var items = (mode === "overwrite") ? [] : (m.items || []).slice();
        var filePersons = [];
        var addedNames = [];
        for (var r = 1; r < grid.length; r++) {
          var name = String(grid[r][0] == null ? "" : grid[r][0]).trim();
          if (!name) continue;
          if (filePersons.indexOf(name) < 0) filePersons.push(name);
          if (addedNames.indexOf(name) < 0) addedNames.push(name);
          for (var dc = 0; dc < dayCols.length; dc++) {
            var day = dayCols[dc].day;
            if (day < 1 || day > days) continue;
            var val = String(grid[r][dayCols[dc].col] == null ? "" : grid[r][dayCols[dc].col]).trim();
            if (!val) continue;
            if (SHIFTS.indexOf(val) < 0) continue; // 无效班次跳过
            var dateStr = ymd(state.yearMonth, day);
            // 删除旧记录
            items = items.filter(function (it) { return !(it.personName === name && it.scheduleDate === dateStr); });
            items.push({ id: name + "-" + dateStr, personName: name, scheduleDate: dateStr, shiftType: val, yearMonth: state.yearMonth });
          }
        }
        if (addedNames.length === 0) { U.toast("未解析到任何排班数据", "error"); return; }
        m.items = items;
        // 人员顺序：按文件内顺序排列，原有人且不在文件中的排在末尾
        var oldPersons = m.persons || [];
        var ordered = filePersons.slice();
        for (var pi = 0; pi < oldPersons.length; pi++) {
          if (ordered.indexOf(oldPersons[pi]) < 0) ordered.push(oldPersons[pi]);
        }
        m.persons = ordered;
        save(m);
        U.toast("导入完成：成功 " + addedNames.length + " 人 · " + items.length + " 条记录");
        window.App.refresh();
      } catch (err) {
        U.toast("导入失败：" + (err && err.message ? err.message : "文件格式错误"), "error");
      }
    };
    var ext2 = (file.name || "").split(".").pop().toLowerCase();
    if (ext2 === "csv" || ext2 === "txt") {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  function importMenu() {
    var html =
      '<div class="gd-modal-title">导入排班</div>' +
      '<p class="gd-modal-msg">选择 Excel/CSV 文件导入排班数据，第一行应为：姓名、1号、2号…（有效班次：休、白、值、年休、学、差）</p>' +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="sched-import-overwrite">' + U.icon("upload") + "覆盖模式（替换当月已有排班）</button>" +
      '<button class="gd-ops-item" data-act="sched-import-fill">' + U.icon("upload") + "填充模式（仅写入空白单元格）</button>" +
      "</div>" +
      '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  function pickImport(mode) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.csv,.txt";
    input.style.display = "none";
    input.onchange = function () {
      if (input.files && input.files[0]) importSchedule(input.files[0], mode);
      document.body.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  }

  /* ---------- 导出 ---------- */
  function exportExcel() {
    var parts = ymParts(state.yearMonth);
    var days = U.daysInMonth(parts.year, parts.month);
    var m = load();
    var persons = m.persons || [];
    var map = getMap(m.items || []);
    var headers = ["姓名"];
    for (var d = 1; d <= days; d++) headers.push(d + "号");
    var rows = [headers];
    for (var i = 0; i < persons.length; i++) {
      var row = [persons[i]];
      for (var d2 = 1; d2 <= days; d2++) {
        var sh = map[persons[i]] ? map[persons[i]][ymd(state.yearMonth, d2)] : "";
        row.push(sh || "");
      }
      rows.push(row);
    }
    window.XLSX.exportXlsx([{ name: state.yearMonth + "排班表", rows: rows }], "排班表_" + state.yearMonth + ".xlsx");
    U.toast("已导出 Excel");
  }

  function exportImage() {
    var parts = ymParts(state.yearMonth);
    var days = U.daysInMonth(parts.year, parts.month);
    var m = load();
    var persons = m.persons || [];
    var map = getMap(m.items || []);
    var cellW = 40, cellH = 34, nameW = 80, headerH = 40, pad = 10;
    var scale = 2;
    var W = (nameW + days * cellW) * scale + pad * 2;
    var H = (headerH + persons.length * cellH) * scale + pad * 2;
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W / scale, H / scale);
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(pad, pad, nameW, headerH);
    ctx.fillStyle = "#333";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("姓名", pad + nameW / 2, pad + headerH / 2);
    for (var d = 1; d <= days; d++) {
      var dt = new Date(parts.year, parts.month, d);
      var x = pad + nameW + (d - 1) * cellW;
      if (dt.getDay() === 0 || dt.getDay() === 6) { ctx.fillStyle = "#fef2f2"; ctx.fillRect(x, pad, cellW, H - pad * 2); ctx.fillStyle = "#333"; }
      ctx.fillStyle = "#333";
      ctx.font = "12px sans-serif";
      ctx.fillText(String(d), x + cellW / 2, pad + headerH / 2 - 6);
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#999";
      ctx.fillText(U.weekdayCn(dt).slice(1), x + cellW / 2, pad + headerH / 2 + 8);
      ctx.strokeStyle = "#eee";
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + headerH); ctx.stroke();
    }
    ctx.strokeStyle = "#e5e7eb";
    ctx.strokeRect(pad, pad, nameW + days * cellW, headerH + persons.length * cellH);
    for (var r = 0; r < persons.length; r++) {
      var y = pad + headerH + r * cellH;
      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(pad, y, nameW, cellH);
      ctx.fillStyle = "#333";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(persons[r], pad + 8, y + cellH / 2);
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + nameW + days * cellW, y); ctx.stroke();
      for (var d2 = 1; d2 <= days; d2++) {
        var x2 = pad + nameW + (d2 - 1) * cellW;
        var sh = map[persons[r]] ? map[persons[r]][ymd(state.yearMonth, d2)] : "";
        ctx.strokeStyle = "#e5e7eb";
        ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2, y + cellH); ctx.stroke();
        if (sh) {
          ctx.textAlign = "center";
          var col = sh === "值" ? "#1d4ed8" : sh === "白" ? "#047857" : sh === "休" ? "#9ca3af" : "#b45309";
          ctx.fillStyle = col;
          ctx.fillText(sh, x2 + cellW / 2, y + cellH / 2);
        }
      }
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#666";
    ctx.font = "10px sans-serif";
    ctx.fillText("供电工区排班表 " + state.yearMonth, pad, pad + H / scale - 4);
    var dataUrl = canvas.toDataURL("image/png");
    U.downloadDataUrl(dataUrl, "排班表_" + state.yearMonth + ".png");
    U.toast("已导出图片");
  }

  /* ---------- 菜单 ---------- */
  function menu() {
    var html =
      '<div class="gd-modal-title">排班表操作</div>' +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="sched-add">' + U.icon("plus") + "添加人员（从花名册）</button>" +
      '<button class="gd-ops-item" data-act="sched-gen">' + U.icon("refresh") + "生成默认排班</button>" +
      '<button class="gd-ops-item" data-act="sched-import">' + U.icon("upload") + "导入排班（Excel/CSV）</button>" +
      '<button class="gd-ops-item" data-act="sched-export">' + U.icon("download") + "导出 Excel</button>" +
      '<button class="gd-ops-item" data-act="sched-img">' + U.icon("image") + "导出图片</button>" +
      "</div>" +
      '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  /* ---------- 事件 ---------- */
  var actions = {
    "sched-add": addPerson,
    "sched-menu": menu,
    "sched-prev": function () {
      var p = ymParts(state.yearMonth);
      var d = new Date(p.year, p.month - 1, 1);
      state.yearMonth = U.fmtYm(d);
      window.App.refresh();
    },
    "sched-next": function () {
      var p = ymParts(state.yearMonth);
      var d = new Date(p.year, p.month + 1, 1);
      state.yearMonth = U.fmtYm(d);
      window.App.refresh();
    },
    "sched-cell": function (el) {
      pickShift(el.getAttribute("data-name"), Number(el.getAttribute("data-day")));
    },
    "sched-set": function (el) {
      var ps = state.pendingShift;
      if (ps) setShift(ps.name, ps.day, el.getAttribute("data-shift"));
    },
    "sched-person": function (el) {
      personOps(el.getAttribute("data-name"));
    },
    "sched-up": function (el) { movePerson(el.getAttribute("data-name"), -1); },
    "sched-down": function (el) { movePerson(el.getAttribute("data-name"), 1); },
    "sched-delperson": function (el) { removePerson(el.getAttribute("data-name")); },
    "sched-gen": generateDefault,
    "sched-import": importMenu,
    "sched-import-overwrite": function () { pickImport("overwrite"); },
    "sched-import-fill": function () { pickImport("fill"); },
    "sched-export": exportExcel,
    "sched-img": exportImage,
    "sched-fs": function () { U.enterFullscreen("sched-fs-exit"); },
    "sched-fs-exit": function () { U.exitFullscreen(); }
  };

  return { render: render, bind: function () {}, actions: actions };
})();







