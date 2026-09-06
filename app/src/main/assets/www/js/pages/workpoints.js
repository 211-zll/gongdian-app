/**
 * workpoints.js —— 工分统计页面
 * 月网格编辑工分、当日事由、工分排名、Excel 导出
 */
window.PageWorkPoints = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var state = { yearMonth: U.fmtYm(new Date()) };

  function ymParts(ym) {
    var p = ym.split("-");
    return { year: Number(p[0]), month: Number(p[1]) - 1, ym: ym };
  }
  function ymd(ym, day) {
    var p = ym.split("-");
    return p[0] + "-" + p[1] + "-" + U.pad(day);
  }

  function load() {
    var m = S.getWorkPointsMonth(state.yearMonth);
    if (!m.persons || m.persons.length === 0) {
      var roster = S.getRoster();
      m.persons = roster.map(function (p) { return p.name; });
      if (m.persons.length > 0) S.saveWorkPointsMonth(state.yearMonth, m);
    }
    return m;
  }

  function save(m) {
    S.saveWorkPointsMonth(state.yearMonth, m);
  }

  function buildView() {
    var m = load();
    var parts = ymParts(state.yearMonth);
    var days = U.daysInMonth(parts.year, parts.month);
    var persons = m.persons || [];
    var map = {};
    var totals = {};
    for (var i = 0; i < (m.items || []).length; i++) {
      var it = m.items[i];
      if (!map[it.personName]) map[it.personName] = {};
      map[it.personName][it.workDate] = it.points;
      totals[it.personName] = (totals[it.personName] || 0) + (it.points || 0);
    }
    var ranking = persons.map(function (n) { return { personName: n, total: totals[n] || 0 }; })
      .sort(function (a, b) { return b.total - a.total; });
    return { m: m, parts: parts, days: days, persons: persons, map: map, totals: totals, ranking: ranking, reasons: m.reasons || {} };
  }

  function render() {
    var v = buildView();
    var html = "";
    html += '<div class="gd-page-head">';
    html += "<div><h1>工分统计</h1><p class='gd-sub'>" + state.yearMonth + " · 共 " + v.persons.length + " 人</p></div>";
    html += '<button class="gd-btn primary" data-act="wp-add">' + U.icon("plus") + "添加人员</button>";
    html += "</div>";

    html += '<div class="gd-toolbar">';
    html += '<button class="gd-btn ghost" data-act="wp-prev">' + U.icon("left", "flip") + "</button>";
    html += '<span class="gd-month">' + v.parts.year + "年" + (v.parts.month + 1) + "月</span>";
    html += '<button class="gd-btn ghost" data-act="wp-next">' + U.icon("right") + "</button>";
    html += '<span class="gd-flex1"></span>';
    html += '<button class="gd-btn ghost" data-act="wp-fs">' + U.icon("expand") + "</button>";
    html += '<button class="gd-btn ghost" data-act="wp-menu">' + U.icon("more") + "</button>";
    html += "</div>";


    if (v.persons.length === 0) {
      html += '<div class="gd-empty">' + U.icon("chart") + "<p>暂无工分记录，点击「添加人员」开始</p></div>";
      html += '<div class="gd-card gd-help"><p>点击工分数值单元格可编辑工分；点击底部「事由」行单元格可编辑当日事由</p></div>';
      return html;
    }

    html += '<div class="gd-table-wrap">';
    html += '<table class="gd-table wp-table">';
    html += "<colgroup><col style='width:76px'/>";
    for (var d = 1; d <= v.days; d++) html += "<col style='width:44px'/>";
    html += "<col style='width:64px'/></colgroup>";
    html += "<thead><tr><th class='sticky'>姓名</th>";
    for (var d2 = 1; d2 <= v.days; d2++) {
      var dt = new Date(v.parts.year, v.parts.month, d2);
      var wk = dt.getDay();
      var cls = wk === 0 || wk === 6 ? "weekend" : "";
      html += "<th class='" + cls + "'><b>" + d2 + "</b><i>" + U.weekdayCn(dt).slice(1) + "</i></th>";
    }
    html += "<th class='total'>合计</th></tr>";
    // 事由行：放在日期表头下一行
    html += "<tr class='reason-row'>";
    html += '<th class="sticky reason-label">事由</th>';
    for (var d4 = 1; d4 <= v.days; d4++) {
      var ds4 = ymd(state.yearMonth, d4);
      var rs4 = v.reasons[ds4] || "";
      html += '<th class="reason-cell"><button class="gd-reason' + (rs4 ? " has" : "") + '" data-act="wp-reason" data-day="' + d4 + '">' + (rs4 ? U.esc(rs4) : "·") + "</button></th>";
    }
    html += "<th class='total'></th></tr></thead><tbody>";
    for (var r2 = 0; r2 < v.persons.length; r2++) {
      var name = v.persons[r2];
      html += "<tr>";
      html += '<td class="sticky name-cell" data-act="wp-person" data-name="' + U.esc(name) + '">' + U.esc(name) + "</td>";
      for (var d3 = 1; d3 <= v.days; d3++) {
        var dateStr = ymd(state.yearMonth, d3);
        var pt = v.map[name] ? v.map[name][dateStr] : 0;
        var dt3 = new Date(v.parts.year, v.parts.month, d3);
        var wk3 = dt3.getDay();
        var cls3 = (wk3 === 0 || wk3 === 6) ? "weekend" : "";
        html += '<td class="' + cls3 + '">';
        html += '<button class="gd-pt' + (pt > 0 ? " has" : "") + '" data-act="wp-cell" data-name="' + U.esc(name) + '" data-day="' + d3 + '">' + (pt > 0 ? pt : "·") + "</button>";
        html += "</td>";
      }
      html += '<td class="total">' + (v.totals[name] || 0) + "</td>";
      html += "</tr>";
    }
    html += "</tbody></table>";
    html += "</div>";
    // 工分排名卡片（放在工分表下方）
    if (v.persons.length > 0) {
      html += '<div class="gd-card rank-card"><div class="gd-card-head"><span>' + U.icon("chart") + " 工分排名</span></div><div class='rank-list'>";
      for (var r = 0; r < v.ranking.length; r++) {
        var rk = v.ranking[r];
        var medal = rk.total > 0 ? '<em class="rank-no">' + (r + 1) + "</em>" : "";
        html += '<div class="rank-item"><span class="rank-name">' + medal + U.esc(rk.personName) + '</span><b class="rank-total">' + (rk.total || 0) + " 分</b></div>";
      }
      html += "</div></div>";
    }

    html += '<div class="gd-card gd-help"><p>点击工分数值单元格可编辑工分，回车或失焦保存；点击日期下方「事由」行单元格可编辑当日事由</p></div>';
    return html;
  }

  /* ---------- 编辑工分 ---------- */
  function editPoints(name, day) {
    var v = buildView();
    var dateStr = ymd(state.yearMonth, day);
    var cur = v.map[name] ? (v.map[name][dateStr] || 0) : 0;
    var html =
      '<div class="gd-modal-title">' + U.esc(name) + " · " + dateStr + " 工分</div>" +
      '<form class="gd-form">' +
      '<div class="gd-field"><label class="gd-label">工分数值</label><input name="points" type="number" min="0" step="0.5" class="gd-input gd-big-input" value="' + cur + '" placeholder="0"/></div>' +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">保存</button></div></form>';
    U.openModal(html, { dismissible: true }).then(function (data) {
      if (!data) return;
      var pts = Number(data.points);
      if (isNaN(pts) || pts < 0) { U.toast("请输入有效工分", "error"); return; }
      var m = load();
      m.items = m.items || [];
      var idx = -1;
      for (var i = 0; i < m.items.length; i++) {
        if (m.items[i].personName === name && m.items[i].workDate === dateStr) { idx = i; break; }
      }
      if (pts === 0) {
        if (idx >= 0) m.items.splice(idx, 1);
      } else {
        var rec = { id: name + "-" + dateStr, personName: name, workDate: dateStr, yearMonth: state.yearMonth, reason: (m.reasons || {})[dateStr] || "", points: pts };
        if (idx >= 0) m.items[idx] = rec; else m.items.push(rec);
      }
      save(m);
      window.App.refresh();
    });
  }

  /* ---------- 编辑事由 ---------- */
  function editReason(day) {
    var v = buildView();
    var dateStr = ymd(state.yearMonth, day);
    var cur = v.reasons[dateStr] || "";
    var html =
      '<div class="gd-modal-title">' + dateStr + " 事由</div>" +
      '<form class="gd-form">' +
      '<div class="gd-field"><label class="gd-label">当日事由</label><textarea name="reason" class="gd-input" rows="3" placeholder="如：线路检修、巡视等">' + U.esc(cur) + "</textarea></div>" +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">保存</button></div></form>';
    U.openModal(html, { dismissible: true }).then(function (data) {
      if (!data) return;
      var m = load();
      m.reasons = m.reasons || {};
      m.reasons[dateStr] = (data.reason || "").trim();
      m.items = (m.items || []).map(function (it) {
        if (it.workDate === dateStr) it.reason = m.reasons[dateStr];
        return it;
      });
      save(m);
      window.App.refresh();
    });
  }

  /* ---------- 人员操作 ---------- */
  function personOps(name) {
    var m = load();
    var persons = m.persons || [];
    var idx = persons.indexOf(name);
    var html =
      '<div class="gd-modal-title">' + U.esc(name) + " · 操作</div>" +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="wp-up" data-name="' + U.esc(name) + '">' + U.icon("up") + "上移" + (idx <= 0 ? ' <em class="disabled">(已是首位)</em>' : "") + "</button>" +
      '<button class="gd-ops-item" data-act="wp-down" data-name="' + U.esc(name) + '">' + U.icon("down") + "下移" + (idx === persons.length - 1 ? ' <em class="disabled">(已是末位)</em>' : "") + "</button>" +
      '<button class="gd-ops-item danger" data-act="wp-delperson" data-name="' + U.esc(name) + '">' + U.icon("trash") + "删除该人员当月工分</button>" +
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
    var ok = await U.confirmDialog("确定要删除人员「" + name + "」的当月所有工分记录吗？", { title: "删除人员" });
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

  /* ---------- 导出 ---------- */
  function exportExcel() {
    var v = buildView();
    var headers = ["姓名"];
    for (var d = 1; d <= v.days; d++) headers.push(d + "号");
    headers.push("合计");
    var rows = [headers];
    for (var i = 0; i < v.persons.length; i++) {
      var name = v.persons[i];
      var row = [name];
      for (var d2 = 1; d2 <= v.days; d2++) {
        var pt = v.map[name] ? (v.map[name][ymd(state.yearMonth, d2)] || 0) : 0;
        row.push(pt > 0 ? pt : "");
      }
      row.push(v.totals[name] || 0);
      rows.push(row);
    }
    var reasonRow = ["事由"];
    for (var d3 = 1; d3 <= v.days; d3++) reasonRow.push(v.reasons[ymd(state.yearMonth, d3)] || "");
    reasonRow.push("");
    rows.push(reasonRow);
    window.XLSX.exportXlsx([{ name: state.yearMonth + "工分", rows: rows }], "工分统计_" + state.yearMonth + ".xlsx");
    U.toast("已导出 Excel");
  }

  /* ---------- 导出图片 ---------- */
  function exportImage() {
    var v = buildView();
    var days = v.days;
    var persons = v.persons;
    if (persons.length === 0) { U.toast("暂无工分数据可导出", "error"); return; }
    var nameW = 92, cellW = 46, cellH = 30, headerH = 40, pad = 10, scale = 2;
    var totalW = nameW + days * cellW + 64;
    var bodyTop = pad + 30;
    var reasonList = [];
    for (var rd = 1; rd <= days; rd++) {
      var rv = v.reasons[ymd(state.yearMonth, rd)];
      if (rv) reasonList.push({ day: rd, text: rv });
    }
    var reasonH = reasonList.length > 0 ? (20 + reasonList.length * 18 + 10) : 0;
    var rankH = persons.length > 0 ? (20 + persons.length * 18 + 6) : 0;
    var H = (bodyTop + headerH + persons.length * cellH + 10 + reasonH + rankH + 16) * scale + pad * 2;
    var W = (totalW + pad * 2) * scale;
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W / scale, H / scale);
    ctx.fillStyle = "#111827"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("供电工区工分统计（" + state.yearMonth + "）", pad, pad + 14);
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(pad, bodyTop, totalW, headerH);
    ctx.strokeStyle = "#d1d5db"; ctx.strokeRect(pad, bodyTop, totalW, headerH + persons.length * cellH);
    ctx.fillStyle = "#374151"; ctx.font = "12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("姓名", pad + nameW / 2, bodyTop + headerH / 2);
    ctx.beginPath(); ctx.moveTo(pad + nameW, bodyTop); ctx.lineTo(pad + nameW, bodyTop + headerH + persons.length * cellH); ctx.stroke();
    for (var d = 1; d <= days; d++) {
      var x = pad + nameW + (d - 1) * cellW;
      var dt = new Date(v.parts.year, v.parts.month, d);
      if (dt.getDay() === 0 || dt.getDay() === 6) { ctx.fillStyle = "#fef2f2"; ctx.fillRect(x, bodyTop, cellW, headerH + persons.length * cellH); }
      ctx.fillStyle = "#374151"; ctx.font = "12px sans-serif";
      ctx.fillText(String(d), x + cellW / 2, bodyTop + headerH / 2 - 5);
      ctx.fillStyle = "#9ca3af"; ctx.font = "10px sans-serif";
      ctx.fillText(U.weekdayCn(dt).slice(1), x + cellW / 2, bodyTop + headerH / 2 + 7);
      ctx.strokeStyle = "#d1d5db";
      ctx.beginPath(); ctx.moveTo(x, bodyTop); ctx.lineTo(x, bodyTop + headerH); ctx.stroke();
    }
    ctx.fillStyle = "#374151"; ctx.font = "12px sans-serif";
    ctx.fillText("合计", pad + nameW + days * cellW + 32, bodyTop + headerH / 2);
    for (var r = 0; r < persons.length; r++) {
      var y = bodyTop + headerH + r * cellH;
      ctx.fillStyle = "#f9fafb"; ctx.fillRect(pad, y, nameW, cellH);
      ctx.fillStyle = "#111827"; ctx.font = "12px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(persons[r], pad + 8, y + cellH / 2);
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + totalW, y); ctx.stroke();
      for (var d2 = 1; d2 <= days; d2++) {
        var x2 = pad + nameW + (d2 - 1) * cellW;
        ctx.strokeStyle = "#e5e7eb";
        ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(x2, y + cellH); ctx.stroke();
        var pt = v.map[persons[r]] ? (v.map[persons[r]][ymd(state.yearMonth, d2)] || 0) : 0;
        ctx.textAlign = "center";
        ctx.fillStyle = pt > 0 ? "#0f766e" : "#d1d5db";
        ctx.fillText(pt > 0 ? String(pt) : "-", x2 + cellW / 2, y + cellH / 2);
      }
      ctx.textAlign = "center"; ctx.fillStyle = "#111827"; ctx.font = "bold 12px sans-serif";
      ctx.fillText(String(v.totals[persons[r]] || 0), pad + nameW + days * cellW + 32, y + cellH / 2);
      ctx.font = "12px sans-serif";
    }
    var cy = bodyTop + headerH + persons.length * cellH + 14;
    if (reasonList.length > 0) {
      ctx.textAlign = "left"; ctx.fillStyle = "#374151"; ctx.font = "bold 12px sans-serif";
      ctx.fillText("本月事由", pad, cy);
      cy += 18;
      ctx.fillStyle = "#4b5563"; ctx.font = "11px sans-serif";
      for (var ri = 0; ri < reasonList.length; ri++) {
        ctx.fillText(reasonList[ri].day + "日：" + reasonList[ri].text, pad + 10, cy);
        cy += 18;
      }
      cy += 6;
    }
    if (persons.length > 0) {
      ctx.textAlign = "left"; ctx.fillStyle = "#374151"; ctx.font = "bold 12px sans-serif";
      ctx.fillText("工分排名", pad, cy);
      cy += 18;
      ctx.fillStyle = "#4b5563"; ctx.font = "11px sans-serif";
      for (var k2 = 0; k2 < v.ranking.length; k2++) {
        ctx.fillText((k2 + 1) + "." + v.ranking[k2].personName + "（" + (v.ranking[k2].total || 0) + " 分）", pad + 10, cy);
        cy += 18;
      }
    }
    var dataUrl = canvas.toDataURL("image/png");
    U.downloadDataUrl(dataUrl, "工分统计_" + state.yearMonth + ".png");
    U.toast("已导出图片");
  }
  function menu() {
    var html =
      '<div class="gd-modal-title">工分统计操作</div>' +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="wp-add">' + U.icon("plus") + "添加人员（从花名册）</button>" +
      '<button class="gd-ops-item" data-act="wp-export">' + U.icon("download") + "导出 Excel</button>" +
'<button class="gd-ops-item" data-act="wp-img">' + U.icon("image") + "导出图片</button>" +
      "</div>" +
      '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  /* ---------- 事件 ---------- */
  var actions = {
    "wp-add": addPerson,
    "wp-menu": menu,
    "wp-prev": function () {
      var p = ymParts(state.yearMonth);
      var d = new Date(p.year, p.month - 1, 1);
      state.yearMonth = U.fmtYm(d);
      window.App.refresh();
    },
    "wp-next": function () {
      var p = ymParts(state.yearMonth);
      var d = new Date(p.year, p.month + 1, 1);
      state.yearMonth = U.fmtYm(d);
      window.App.refresh();
    },
    "wp-cell": function (el) { editPoints(el.getAttribute("data-name"), Number(el.getAttribute("data-day"))); },
    "wp-reason": function (el) { editReason(Number(el.getAttribute("data-day"))); },
    "wp-person": function (el) { personOps(el.getAttribute("data-name")); },
    "wp-up": function (el) { movePerson(el.getAttribute("data-name"), -1); },
    "wp-down": function (el) { movePerson(el.getAttribute("data-name"), 1); },
    "wp-delperson": function (el) { removePerson(el.getAttribute("data-name")); },
    "wp-export": exportExcel,
    "wp-img": exportImage,
    "wp-fs": function () { U.enterFullscreen("wp-fs-exit"); },
    "wp-fs-exit": function () { U.exitFullscreen(); }
  };

  return { render: render, bind: function () {}, actions: actions };
})();




