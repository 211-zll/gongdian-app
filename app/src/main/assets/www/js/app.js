/**
 * app.js —— 应用主控
 * 路由、布局、底部导航、事件委托
 */
window.App = (function () {
  "use strict";
  var U = window.Util;

  var PAGES = {
    "/": PageHome,
    "/roster": PageRoster,
    "/schedule": PageSchedule,
    "/work-points": PageWorkPoints,
    "/todos": PageTodos,
    "/devices": PageDevices,
    "/learning": PageLearning,
    "/settings": PageSettings,
    "/more": MorePage
  };

  // 底部导航：全部 8 个功能入口
  var NAV = [
    { path: "/", label: "工作台", icon: "home" },
    { path: "/roster", label: "花名册", icon: "users" },
    { path: "/schedule", label: "排班", icon: "calendar" },
    { path: "/work-points", label: "工分", icon: "chart" },
    { path: "/todos", label: "待办", icon: "check" },
    { path: "/devices", label: "设备", icon: "grid" },
    { path: "/learning", label: "学习", icon: "book" },
    { path: "/settings", label: "数据", icon: "database" }
  ];

  var TITLES = {
    "/": "工作台", "/roster": "花名册", "/schedule": "排班表",
    "/work-points": "工分统计", "/todos": "待办 & 备忘录",
    "/devices": "设备资料", "/learning": "学习资料", "/settings": "数据管理", "/more": "更多功能"
  };

  var current = "/";
  var actions = {};

  /* ---------- 更多页面 ---------- */
  function MorePage() {
    var items = [
      { path: "/todos", icon: "check", label: "待办 & 备忘录", desc: "管理工作待办事项与日常记录" },
      { path: "/devices", icon: "grid", label: "设备资料", desc: "站区、区间、设备与照片管理" },
      { path: "/learning", icon: "book", label: "学习资料", desc: "安全规章、技术标准、作业指导书" },
      { path: "/settings", icon: "database", label: "数据管理", desc: "备份、恢复和重置您的数据" }
    ];
    var html = '<div class="gd-page-head"><div><h1>更多功能</h1><p class="gd-sub">供电工区班组长工作台</p></div></div>';
    html += '<div class="gd-list">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div class="gd-card" data-act="goto" data-path="' + it.path + '">';
      html += '<div class="more-icon">' + U.icon(it.icon) + "</div>";
      html += '<div class="gd-card-body"><div class="gd-card-title">' + it.label + "</div>";
      html += '<div class="gd-card-sub">' + it.desc + "</div></div>";
      html += U.icon("right", "chev");
      html += "</div>";
    }
    html += "</div>";
    html += '<p class="gd-tip">提示：本地文件仅保存在当前浏览器，更换设备或清除缓存后将丢失。</p>';
    return html;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var page = PAGES[current] || PageHome;
    var el = document.getElementById("gd-page");
    el.innerHTML = page.render();
    actions = {};
    if (page.actions) actions = page.actions;
    if (page.bind) page.bind();
    renderNav();
  }

  function renderNav() {
    var nav = document.getElementById("gd-nav");
    if (!nav) return;
    var html = "";
    for (var i = 0; i < NAV.length; i++) {
      var n = NAV[i];
      var active = current === n.path;
      html += '<button class="nav-item' + (active ? " active" : "") + '" data-act="nav" data-path="' + n.path + '">';
      html += '<span class="nav-icon">' + U.icon(n.icon) + "</span>";
      html += "<em>" + n.label + "</em></button>";
    }
    nav.innerHTML = html;
  }

  /* ---------- 导航 ---------- */
  function navigate(path) {
    if (!Store.isLoggedIn()) { showLogin(); return; }
    if (PAGES[path]) {
      current = path;
      window.location.hash = path;
      render();
      document.getElementById("gd-scroll") && (document.getElementById("gd-scroll").scrollTop = 0);
    }
  }

  function refresh() {
    if (!Store.isLoggedIn()) { showLogin(); return; }
    render();
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el) return;
    var act = el.getAttribute("data-act");
    if (act === "nav") { navigate(el.getAttribute("data-path")); return; }
    if (act === "goto") { navigate(el.getAttribute("data-path")); return; }
    var fn = actions[act];
    if (fn) fn(el);
  });

  /* ---------- 登录页 ---------- */
  function showLogin() {
    var el = document.getElementById("gd-page");
    if (el) el.innerHTML = LoginPage.render();
    actions = {};
    if (LoginPage.actions) actions = LoginPage.actions;
    if (LoginPage.bind) LoginPage.bind();
    var nav = document.getElementById("gd-nav");
    if (nav) nav.innerHTML = "";
  }

  /* ---------- 初始化 ---------- */
  function init() {
    if (!Store.isLoggedIn()) {
      showLogin();
      return;
    }
    var hash = window.location.hash.replace("#", "");
    if (PAGES[hash]) current = hash;
    render();
  }

  /* ---------- 已自动保存提示 ---------- */
  window.addEventListener("gd-saved", function () {
    var el = document.getElementById("gd-saved");
    if (!el) {
      el = document.createElement("div");
      el.id = "gd-saved";
      document.body.appendChild(el);
    }
    el.textContent = "已自动保存";
    el.className = "gd-saved show";
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = "gd-saved"; }, 1200);
  });

  window.addEventListener("hashchange", function () {
    if (!Store.isLoggedIn()) { showLogin(); return; }
    var hash = window.location.hash.replace("#", "");
    if (PAGES[hash] && hash !== current) {
      current = hash;
      render();
      document.getElementById("gd-scroll") && (document.getElementById("gd-scroll").scrollTop = 0);
    }
  });

  return { init: init, refresh: refresh, navigate: navigate, actions: actions, current: function () { return current; } };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { window.App.init(); });
} else {
  window.App.init();
}







