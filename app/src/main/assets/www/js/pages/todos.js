/**
 * todos.js —— 待办 & 备忘录页面
 */
window.PageTodos = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var PRIORITY = { high: "高", medium: "中", low: "低" };
  var MEMO_CATS = { work: "工作笔记", password: "密码记录", meeting: "会议记录" };

  var state = { tab: "todos", todoStatus: "all", todoPriority: "all", memoCat: "all", memoSearch: "" };

  function dueText(iso) {
    if (!iso) return "";
    var t = new Date(iso).getTime();
    if (isNaN(t)) return iso;
    var diff = t - Date.now();
    var day = Math.floor(diff / 86400000);
    if (diff < 0) {
      if (day <= 0) return "已过期";
      return "已过期" + day + "天";
    }
    if (day > 0) return "还剩" + day + "天";
    var h = Math.floor(diff / 3600000);
    if (h > 0) return "还剩" + h + "小时";
    var m = Math.floor(diff / 60000);
    if (m > 0) return "还剩" + m + "分钟";
    return "即将到期";
  }

  function todoSort(list) {
    var order = { high: 0, medium: 1, low: 2 };
    return list.slice().sort(function (a, b) {
      if (!!a.isImportant !== !!b.isImportant) return a.isImportant ? -1 : 1;
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      var pa = order[a.priority] !== undefined ? order[a.priority] : 3;
      var pb = order[b.priority] !== undefined ? order[b.priority] : 3;
      if (pa !== pb) return pa - pb;
      var ta = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      var tb = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ta - tb;
    });
  }

  function render() {
    var html = '<div class="gd-page-head">';
    html += "<div><h1>待办 & 备忘录</h1><p class='gd-sub'>管理工作待办事项与日常记录</p></div>";
    html += "</div>";

    html += '<div class="gd-seg">';
    html += '<button class="' + (state.tab === "todos" ? "active" : "") + '" data-act="tab-todos">' + U.icon("check") + "待办事项</button>";
    html += '<button class="' + (state.tab === "memos" ? "active" : "") + '" data-act="tab-memos">' + U.icon("book") + "备忘录</button>";
    html += "</div>";

    if (state.tab === "todos") {
      html += renderTodos();
    } else {
      html += renderMemos();
    }
    return html;
  }

  /* ==================== 待办 ==================== */
  function renderTodos() {
    var todos = S.getTodos();
    var filtered = todos.filter(function (t) {
      if (state.todoStatus !== "all" && t.status !== state.todoStatus) return false;
      if (state.todoPriority !== "all" && t.priority !== state.todoPriority) return false;
      return true;
    });
    filtered = todoSort(filtered);
    var html = "";
    html += '<div class="gd-toolbar">';
    html += '<button class="gd-chip' + (state.todoStatus === "all" ? " active" : "") + '" data-act="todo-status" data-v="all">全部</button>';
    html += '<button class="gd-chip' + (state.todoStatus === "pending" ? " active" : "") + '" data-act="todo-status" data-v="pending">进行中</button>';
    html += '<button class="gd-chip' + (state.todoStatus === "completed" ? " active" : "") + '" data-act="todo-status" data-v="completed">已完成</button>';
    html += '<span class="gd-flex1"></span>';
    html += '<button class="gd-btn primary small" data-act="todo-add">' + U.icon("plus") + "添加</button>";
    html += '<button class="gd-btn ghost small" data-act="todo-menu">' + U.icon("more") + "</button>";
    html += "</div>";
    html += '<div class="gd-toolbar sub">优先级：';
    var prios = [["all", "全部"], ["high", "高"], ["medium", "中"], ["low", "低"]];
    for (var i = 0; i < prios.length; i++) {
      html += '<button class="gd-chip mini' + (state.todoPriority === prios[i][0] ? " active" : "") + '" data-act="todo-priority" data-v="' + prios[i][0] + '">' + prios[i][1] + "</button>";
    }
    html += "</div>";

    if (filtered.length === 0) {
      html += '<div class="gd-empty">' + U.icon("check") + "<p>" + (todos.length === 0 ? "添加一条新的待办开始管理吧" : "没有匹配的待办事项") + "</p></div>";
    } else {
      html += '<div class="gd-list">';
      for (var j = 0; j < filtered.length; j++) {
        var t = filtered[j];
        var done = t.status === "completed";
        html += '<div class="gd-card todo-card' + (done ? " done" : "") + '">';
        html += '<button class="gd-circle' + (done ? " checked" : "") + '" data-act="todo-toggle" data-id="' + U.esc(t.id) + '">' + (done ? U.icon("check") : "") + "</button>";
        html += '<div class="gd-card-body" data-act="todo-edit" data-id="' + U.esc(t.id) + '">';
        html += '<div class="gd-card-title">' + U.esc(t.title) + (t.isImportant ? ' <span class="star">' + U.icon("star") + "</span>" : "") + "</div>";
        if (t.description) html += '<div class="gd-card-sub">' + U.esc(t.description) + "</div>";
        html += '<div class="gd-tags">';
        html += '<span class="gd-badge pri ' + t.priority + '">' + (PRIORITY[t.priority] || "中") + "</span>";
        if (t.dueDate) html += '<span class="gd-badge due">' + dueText(t.dueDate) + "</span>";
        html += "</div></div>";
        html += '<button class="gd-del" data-act="todo-del" data-id="' + U.esc(t.id) + '">' + U.icon("trash") + "</button>";
        html += "</div>";
      }
      html += "</div>";
    }
    return html;
  }

  function todoModal(item) {
    var isEdit = !!item;
    item = item || {};
    var body =
      '<div class="gd-modal-title">' + (isEdit ? "编辑待办" : "新增待办") + "</div>" +
      '<form class="gd-form">' +
      U.field("内容", "title", item.title, "请输入待办内容", { required: true }) +
      
      '<div class="gd-row2">' +
      U.field("优先级", "priority", item.priority || "medium", "选择优先级", { type: "select", options: [["high", "高"], ["medium", "中"], ["low", "低"]] }) +
      U.field("截止日期", "dueDate", item.dueDate ? item.dueDate.slice(0, 16) : "", "", { type: "datetime-local" }) +
      "</div>" +
      '<div class="gd-field"><label class="gd-check"><input type="checkbox" name="isImportant"' + (item.isImportant ? " checked" : "") + '/><span>' + U.icon("star") + " 标记为重要</span></label></div>" +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">' + (isEdit ? "保存" : "添加") + "</button></div></form>";
    U.openModal(body, { dismissible: true }).then(function (data) {
      if (!data) return;
      var title = (data.title || "").trim();
      if (!title) { U.toast("内容不能为空", "error"); return; }
      var now = new Date().toISOString();
      var rec = {
        title: title,

        priority: data.priority || "medium",
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        isImportant: !!data.isImportant
      };
      var list = S.getTodos();
      if (isEdit) {
        for (var i = 0; i < list.length; i++) if (list[i].id === item.id) {
          list[i] = Object.assign({}, list[i], rec, { updatedAt: now });
        }
        S.saveTodos(list);
        U.toast("保存成功");
      } else {
        rec.id = U.uid();
        rec.status = "pending";
        rec.createdAt = now;
        rec.updatedAt = now;
        S.saveTodos([rec].concat(list));
        U.toast("添加成功");
      }
      window.App.refresh();
    });
  }

  function toggle(id) {
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

  async function removeTodo(id) {
    var ok = await U.confirmDialog("确定要删除这条待办吗？", { title: "删除待办" });
    if (!ok) return;
    S.saveTodos(S.getTodos().filter(function (t) { return t.id !== id; }));
    U.toast("已删除");
    window.App.refresh();
  }

  /* ==================== 备忘录 ==================== */
  function renderMemos() {
    var memos = S.getMemos();
    var kw = state.memoSearch.trim().toLowerCase();
    var filtered = memos.filter(function (m) {
      if (state.memoCat !== "all" && m.category !== state.memoCat) return false;
      if (kw) {
        var hit = (m.title || "").toLowerCase().indexOf(kw) >= 0 || (m.content || "").toLowerCase().indexOf(kw) >= 0;
        if (!hit) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (!!a.isImportant !== !!b.isImportant) return a.isImportant ? -1 : 1;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
    var html = "";
    html += '<div class="gd-toolbar">';
    html += '<div class="gd-search">' + U.icon("search") + '<input id="memo-search" placeholder="搜索备忘录" value="' + U.esc(state.memoSearch) + '"/></div>';
    html += '<button class="gd-btn primary small" data-act="memo-add">' + U.icon("plus") + "新建</button>";
    html += '<button class="gd-btn ghost small" data-act="memo-menu">' + U.icon("more") + "</button>";
    html += "</div>";
    html += '<div class="gd-toolbar sub">分类：';
    var cats = [["all", "全部"]].concat(Object.keys(MEMO_CATS).map(function (k) { return [k, MEMO_CATS[k]]; }));
    for (var i = 0; i < cats.length; i++) {
      html += '<button class="gd-chip mini' + (state.memoCat === cats[i][0] ? " active" : "") + '" data-act="memo-cat" data-v="' + cats[i][0] + '">' + cats[i][1] + "</button>";
    }
    html += "</div>";

    if (filtered.length === 0) {
      html += '<div class="gd-empty">' + U.icon("book") + "<p>" + (memos.length === 0 ? "创建第一条备忘录记录工作点滴" : "暂无匹配的备忘录") + "</p></div>";
    } else {
      html += '<div class="gd-list">';
      for (var j = 0; j < filtered.length; j++) {
        var m = filtered[j];
        html += '<div class="gd-card memo-card">';
        html += '<div class="gd-card-body" data-act="memo-edit" data-id="' + U.esc(m.id) + '">';
        html += '<div class="gd-card-title">' + U.esc(m.title) + (m.isImportant ? ' <span class="star">' + U.icon("star") + "</span>" : "") + "</div>";
        if (m.content) html += '<div class="gd-card-sub multi">' + U.esc(m.content) + "</div>";
        html += '<div class="gd-tags">';
        html += '<span class="gd-badge cat ' + m.category + '">' + (MEMO_CATS[m.category] || m.category || "其他") + "</span>";
        html += '<span class="gd-badge due">' + U.fmtDateTime(m.updatedAt) + "</span>";
        html += "</div></div>";
        html += '<button class="gd-del" data-act="memo-del" data-id="' + U.esc(m.id) + '">' + U.icon("trash") + "</button>";
        html += "</div>";
      }
      html += "</div>";
    }
    return html;
  }

  function memoModal(item) {
    var isEdit = !!item;
    item = item || {};
    var body =
      '<div class="gd-modal-title">' + (isEdit ? "编辑备忘录" : "新建备忘录") + "</div>" +
      '<form class="gd-form">' +
      U.field("内容", "title", item.title, "请输入备忘录内容", { required: true, type: "textarea", rows: 5 }) +
      
      U.field("分类", "category", item.category || "work", "选择分类", { type: "select", options: Object.keys(MEMO_CATS).map(function (k) { return [k, MEMO_CATS[k]]; }) }) +
      '<div class="gd-field"><label class="gd-check"><input type="checkbox" name="isImportant"' + (item.isImportant ? " checked" : "") + '/><span>' + U.icon("star") + " 重要</span></label></div>" +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">' + (isEdit ? "保存" : "创建") + "</button></div></form>";
    U.openModal(body, { dismissible: true }).then(function (data) {
      if (!data) return;
      var title = (data.title || "").trim();
      if (!title) { U.toast("内容不能为空", "error"); return; }
      var now = new Date().toISOString();
      var rec = {
        title: title,

        category: data.category || "work",
        isImportant: !!data.isImportant
      };
      var list = S.getMemos();
      if (isEdit) {
        for (var i = 0; i < list.length; i++) if (list[i].id === item.id) {
          list[i] = Object.assign({}, list[i], rec, { updatedAt: now });
        }
        S.saveMemos(list);
        U.toast("保存成功");
      } else {
        rec.id = U.uid();
        rec.createdAt = now;
        rec.updatedAt = now;
        S.saveMemos([rec].concat(list));
        U.toast("创建成功");
      }
      window.App.refresh();
    });
  }

  async function removeMemo(id) {
    var ok = await U.confirmDialog("确定要删除这条备忘录吗？", { title: "删除备忘录" });
    if (!ok) return;
    S.saveMemos(S.getMemos().filter(function (m) { return m.id !== id; }));
    U.toast("已删除");
    window.App.refresh();
  }

  /* ---------- 导出 ---------- */
  function exportJson(kind) {
    var data = kind === "todos" ? S.getTodos() : S.getMemos();
    U.downloadJson({ app: "供电工区工作台", type: kind === "todos" ? "待办事项" : "备忘录", exportedAt: new Date().toISOString(), items: data }, (kind === "todos" ? "待办事项" : "备忘录") + "_" + U.fmtYmd(new Date()) + ".json");
    U.toast("已导出 JSON");
  }

  function menu(kind) {
    var html =
      '<div class="gd-modal-title">' + (kind === "todos" ? "待办事项" : "备忘录") + " 操作</div>" +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="' + kind + '-export">' + U.icon("download") + "导出 JSON 备份</button>" +
      "</div>" +
      '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  /* ---------- 事件 ---------- */
  var actions = {
    "tab-todos": function () { state.tab = "todos"; window.App.refresh(); },
    "tab-memos": function () { state.tab = "memos"; window.App.refresh(); },
    "todo-status": function (el) { state.todoStatus = el.getAttribute("data-v"); window.App.refresh(); },
    "todo-priority": function (el) { state.todoPriority = el.getAttribute("data-v"); window.App.refresh(); },
    "todo-add": function () { todoModal(null); },
    "todo-edit": function (el) {
      var id = el.getAttribute("data-id");
      var list = S.getTodos();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) { todoModal(list[i]); return; }
    },
    "todo-toggle": function (el) { toggle(el.getAttribute("data-id")); },
    "todo-del": function (el) { removeTodo(el.getAttribute("data-id")); },
    "todo-menu": function () { menu("todos"); },
    "todo-export": function () { exportJson("todos"); },
    "memo-add": function () { memoModal(null); },
    "memo-edit": function (el) {
      var id = el.getAttribute("data-id");
      var list = S.getMemos();
      for (var i = 0; i < list.length; i++) if (list[i].id === id) { memoModal(list[i]); return; }
    },
    "memo-del": function (el) { removeMemo(el.getAttribute("data-id")); },
    "memo-cat": function (el) { state.memoCat = el.getAttribute("data-v"); window.App.refresh(); },
    "memo-menu": function () { menu("memos"); },
    "memo-export": function () { exportJson("memos"); }
  };

  function bind() {
    var page = document.getElementById("gd-page");
    if (!page) return;
    var search = page.querySelector("#memo-search");
    if (search) {
      search.addEventListener("input", function () { state.memoSearch = this.value; window.App.refresh(); });
    }
  }

  return { render: render, bind: bind, actions: actions };
})();




