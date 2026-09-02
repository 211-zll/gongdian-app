/**
 * home.js —— 工作台（首页）
 * 统计卡片、今日值班、今日待办、快捷操作、近期排班
 */
window.PageHome = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var QUICK = [
    { key: "add-person", label: "添加入员", icon: "users", path: "/roster" },
    { key: "add-todo", label: "添加待办", icon: "check", path: "/todos" },
    { key: "schedule", label: "排班表", icon: "calendar", path: "/schedule" },
    { key: "work-points", label: "工分统计", icon: "chart", path: "/work-points" },
    { key: "devices", label: "设备资料", icon: "grid", path: "/devices" },
    { key: "data-backup", label: "数据备份", icon: "database", path: "/settings" }
  ];

  function render() {
    var now = new Date();
    var dateCn = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日 " + U.weekdayCn(now);
    var stats = S.calcRosterStats();
    var today = S.calcToday();
    var onDuty = today.onDuty;
    var todayTodos = today.todayTodos;
    var pendingCount = todayTodos.filter(function (t) { return t.status !== "completed"; }).length;

    var html = '<div class="home-page">';
    html += '<section class="home-hero"><p class="home-date">' + dateCn + "</p>";
    html += "<h1>班组长工作台</h1></section>";

    // 统计卡片
    html += '<section class="home-stats">';
    html += '<div class="home-stat g1"><span>' + U.icon("users") + "</span><b>" + stats.totalStaff + '</b><em>工区人员<small>人</small></em></div>';
    html += '<div class="home-stat g2"><span>' + U.icon("calendar") + "</span><b>" + onDuty.length + '</b><em>今日值班<small>人</small></em></div>';
    html += '<div class="home-stat g3"><span>' + U.icon("check") + "</span><b>" + pendingCount + '</b><em>今日待办<small>项</small></em></div>';
    html += "</section>";

    // 今日值班
    html += '<section class="gd-card home-card"><div class="gd-card-head"><span>' + U.icon("calendar") + " 今日值班</span><button class='gd-link' data-act='goto-schedule'>查看排班 →</button></div>";
    if (onDuty.length === 0) {
      html += '<div class="gd-card-empty">今日无值班</div>';
    } else {
      html += '<div class="home-avatar-row">';
      for (var i = 0; i < onDuty.length; i++) {
        html += '<div class="home-avatar"><span>' + U.esc(onDuty[i].slice(0, 1)) + "</span><b>" + U.esc(onDuty[i]) + "</b></div>";
      }
      html += "</div>";
    }
    html += "</section>";

    // 今日待办
    html += '<section class="gd-card home-card"><div class="gd-card-head"><span>' + U.icon("check") + " 今日待办</span><button class='gd-link' data-act='goto-todos'>全部 →</button></div>";
    var shown = todayTodos.slice(0, 5);
    if (shown.length === 0) {
      html += '<div class="gd-card-empty">今日暂无待办事项</div>';
    } else {
      html += '<div class="home-todo-list">';
      for (var j = 0; j < shown.length; j++) {
        var t = shown[j];
        var done = t.status === "completed";
        html += '<div class="home-todo' + (done ? " done" : "") + '" data-act="home-todo-toggle" data-id="' + U.esc(t.id) + '">';
        html += '<span class="home-todo-check">' + (done ? U.icon("check") : "") + "</span>";
        html += '<div class="home-todo-body"><b>' + U.esc(t.title) + "</b>";
        if (t.description) html += "<p>" + U.esc(t.description) + "</p>";
        html += "</div>";
        var pri = t.priority || "low";
        html += '<span class="gd-badge pri ' + pri + '">' + ({ high: "高", medium: "中", low: "低" }[pri] || "低") + "</span>";
        if (t.isImportant) html += '<span class="star">' + U.icon("star") + "</span>";
        html += "</div>";
      }
      html += "</div>";
    }
    html += "</section>";

    // 快捷操作
    html += '<section class="home-card"><h2 class="home-sec-title">快捷操作</h2><div class="home-quick">';
    for (var q = 0; q < QUICK.length; q++) {
      var item = QUICK[q];
      html += '<button class="home-quick-item" data-act="goto" data-path="' + item.path + '">';
      html += '<span>' + U.icon(item.icon) + "</span><b>" + item.label + "</b></button>";
    }
    html += "</div></section>";

    // 近期排班
    html += '<section class="gd-card home-card"><div class="gd-card-head"><span>' + U.icon("calendar") + " 近期排班</span><button class='gd-link' data-act='goto-schedule'>排班表 →</button></div>";
    var recent = buildRecent(today.todayYmd, today.recentSchedule);
    if (recent.length === 0) {
      html += '<div class="gd-card-empty">暂无排班数据</div>';
    } else {
      html += '<div class="home-recent">';
      for (var r = 0; r < recent.length; r++) {
        html += '<div class="home-recent-row">';
        html += '<div class="home-recent-date"><b>' + recent[r].label + "</b></div>";
        html += '<div class="home-recent-persons">';
        if (recent[r].items.length === 0) {
          html += "<span class='muted'>无值班</span>";
        } else {
          for (var p = 0; p < recent[r].items.length; p++) {
            var it = recent[r].items[p];
            html += '<span class="home-recent-tag ' + (it.shiftType === "值" ? "zhi" : "bai") + '">' + U.esc(it.name) + "·" + it.shiftType + "</span>";
          }
        }
        html += "</div></div>";
      }
      html += "</div>";
    }
    html += "</section>";

    html += "</div>";
    return html;
  }

  function buildRecent(todayYmd, list) {
    var out = [];
    for (var k = 0; k < 4; k++) {
      var d = U.parseYmd(todayYmd);
      d.setDate(d.getDate() + k);
      var ds = U.fmtYmd(d);
      var items = list.filter(function (x) { return x.scheduleDate === ds && x.shiftType === "值"; })
        .sort(function (a, b) { return a.shiftType === b.shiftType ? 0 : (a.shiftType === "值" ? -1 : 1); })
        .map(function (x) { return { name: x.personName, shiftType: x.shiftType }; });
      out.push({ label: (d.getMonth() + 1) + "/" + d.getDate() + " " + U.weekdayCn(d), items: items });
    }
    return out;
  }

  function toggleTodo(id) {
    var list = S.getTodos();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list[i].status = list[i].status === "completed" ? "pending" : "completed";
        list[i].updatedAt = new Date().toISOString();
      }
    }
    S.saveTodos(list);
    window.App.refresh();
  }

  var actions = {
    "home-todo-toggle": function (el) { toggleTodo(el.getAttribute("data-id")); },
    "goto": function (el) { window.App.navigate(el.getAttribute("data-path")); },
    "goto-schedule": function () { window.App.navigate("/schedule"); },
    "goto-todos": function () { window.App.navigate("/todos"); }
  };

  return { render: render, bind: function () {}, actions: actions };
})();


