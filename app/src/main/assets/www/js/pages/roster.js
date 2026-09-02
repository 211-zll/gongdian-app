/**
 * roster.js —— 花名册页面
 * 人员增删改查、排序、导入导出（Excel/CSV）
 */
window.PageRoster = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var POSITIONS = ["工长", "副工长", "电力线路工", "配电值班员", "司机", "接触网工", "变电值班员", "管道工", "其他"];
  var SKILLS = ["高级技师", "技师", "高级工", "中级工", "初级工", "学徒"];
  var HEALTH = ["健康", "良好", "一般", "较差"];

  var state = { search: "", sort: "default", order: 1 };

  function getList() {
    var list = S.getRoster().slice();
    if (state.search) {
      var kw = state.search.trim().toLowerCase();
      list = list.filter(function (p) {
        return (p.name || "").toLowerCase().indexOf(kw) >= 0 || (p.position || "").toLowerCase().indexOf(kw) >= 0;
      });
    }
    if (state.sort === "name") {
      list.sort(function (a, b) { return state.order * ((a.name || "").localeCompare(b.name || "", "zh")); });
    } else if (state.sort === "position") {
      list.sort(function (a, b) { return state.order * ((a.position || "").localeCompare(b.position || "", "zh")); });
    } else if (state.sort === "age") {
      list.sort(function (a, b) { return state.order * ((a.age || 0) - (b.age || 0)); });
    } else {
      list.sort(function (a, b) { return (a.sortIndex || 0) - (b.sortIndex || 0); });
    }
    return list;
  }

  function render() {
    var list = getList();
    var html = '<div class="gd-page-head">';
    html += '<div><h1>花名册</h1><p class="gd-sub">工区人员名单，支持排序与 Excel 导入导出</p></div>';
    html += '<button class="gd-btn primary" data-act="roster-add">' + U.icon("plus") + "新增</button>";
    html += "</div>";

    html += '<div class="gd-toolbar">';
    html += '<div class="gd-search">' + U.icon("search") + '<input id="roster-search" placeholder="搜索姓名或职名" value="' + U.esc(state.search) + '"/></div>';
    html += '<select id="roster-sort" class="gd-input gd-sort">';
    var sorts = [["default", "默认顺序"], ["name", "按姓名"], ["position", "按职名"], ["age", "按年龄"]];
    for (var i = 0; i < sorts.length; i++) {
      html += '<option value="' + sorts[i][0] + '"' + (state.sort === sorts[i][0] ? " selected" : "") + ">" + sorts[i][1] + "</option>";
    }
    html += "</select>";
    html += '<button class="gd-btn ghost" data-act="roster-menu">' + U.icon("more") + "</button>";
    html += "</div>";

    if (list.length === 0) {
      html += '<div class="gd-empty">' + U.icon("users") + "<p>" + (S.getRoster().length === 0 ? "暂无人员，点击右上角「新增」添加第一位成员" : "未找到匹配人员") + "</p></div>";
    } else {
      html += '<div class="gd-list">';
      for (var j = 0; j < list.length; j++) {
        var p = list[j];
        var skillBadge = p.skillLevel ? '<span class="gd-badge skill">' + U.esc(p.skillLevel) + "</span>" : "";
        var posBadge = p.position ? '<span class="gd-badge pos">' + U.esc(p.position) + "</span>" : "";
        html += '<div class="gd-card roster-card" data-act="roster-ops" data-id="' + U.esc(p.id) + '">';
        html += '<div class="gd-avatar">' + U.esc((p.name || "?").slice(0, 1)) + "</div>";
        html += '<div class="gd-card-body">';
        html += '<div class="gd-card-title">' + U.esc(p.name || "未命名") + " " + posBadge + " " + skillBadge + "</div>";
        var sub = [];
        if (p.phone) sub.push(U.icon("phone", "inline") + " " + U.esc(p.phone));
        if (p.age) sub.push(U.esc(p.age) + " 岁");
        if (p.entryDate) sub.push("入路 " + U.esc(p.entryDate));
        html += '<div class="gd-card-sub">' + sub.join(" · ") + "</div>";
        html += "</div>";
        html += U.icon("right", "chev");
        html += "</div>";
      }
      html += "</div>";
    }
    html += '<p class="gd-tip">共 ' + list.length + " 人 · 点击人员弹出操作菜单（上移 / 下移 / 编辑 / 删除）</p>";
    return html;
  }

  /* ---------- 人员表单 ---------- */
  function personModal(item) {
    var isEdit = !!item;
    item = item || {};
    var options = { dismissible: true };
    var body =
      '<div class="gd-modal-title">' + (isEdit ? "编辑人员" : "新增人员") + "</div>" +
      '<form class="gd-form">' +
      U.field("姓名", "name", item.name, "请输入姓名", { required: true }) +
      '<div class="gd-row2">' +
      U.field("职名", "position", item.position || "", "选择职名", { type: "select", options: POSITIONS }) +
      U.field("技能等级", "skillLevel", item.skillLevel || "", "选择技能等级", { type: "select", options: SKILLS }) +
      "</div>" +
      U.field("身份证号", "idCard", item.idCard, "输入后自动计算年龄", {}) +
      U.field("手机号", "phone", item.phone, "请输入手机号", {}) +
      U.field("年龄", "age", item.age || "", "自动计算或手动填写", { type: "number", hint: "输入身份证号后自动计算年龄" }) +
      U.field("家庭住址", "address", item.address, "请输入家庭住址", {}) +
      '<div class="gd-row2">' +
      U.field("健康状况", "healthStatus", item.healthStatus || "", "选择健康状况", { type: "select", options: HEALTH }) +
      U.field("入路时间", "entryDate", item.entryDate || "", "", { type: "date" }) +
      "</div>" +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">' + (isEdit ? "保存" : "添加") + "</button>" +
      "</div>" +
      "</form>";
    return U.openModal(body, options).then(function (data) {
      if (!data) return;
      var name = (data.name || "").trim();
      if (!name) { U.toast("姓名为必填项", "error"); return; }
      if (data.idCard && !/^\d{15}$|^\d{17}[\dXx]$/.test(data.idCard)) { U.toast("身份证号格式不正确", "error"); return; }
      if (data.phone && !/^1[3-9]\d{9}$/.test(data.phone)) { U.toast("手机号格式不正确", "error"); return; }
      var age = data.age ? Number(data.age) : (U.ageFromIdCard(data.idCard) || null);
      if (age !== null && age !== undefined && (isNaN(age) || age <= 0 || age > 150)) { U.toast("年龄格式不正确", "error"); return; }
      var rec = {
        name: name,
        position: data.position || undefined,
        idCard: data.idCard || undefined,
        phone: data.phone || undefined,
        age: age || undefined,
        address: data.address || undefined,
        healthStatus: data.healthStatus || undefined,
        entryDate: data.entryDate || null,
        skillLevel: data.skillLevel || undefined
      };
      if (isEdit) {
        var list = S.getRoster();
        for (var i = 0; i < list.length; i++) if (list[i].id === item.id) { list[i] = Object.assign({}, list[i], rec); }
        S.saveRoster(list);
        U.toast("保存成功");
      } else {
        rec.id = U.uid();
        rec.sortIndex = S.getRoster().length;
        S.saveRoster(S.getRoster().concat([rec]));
        U.toast("添加成功");
      }
      window.App.refresh();
    });
  }

  /* ---------- 操作菜单 ---------- */
  function opsMenu(id) {
    var list = S.getRoster();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; break; }
    if (idx < 0) return;
    var item = list[idx];
    var html =
      '<div class="gd-modal-title">' + U.esc(item.name) + " · 操作</div>" +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="roster-detail" data-id="' + U.esc(id) + '">' + U.icon("users") + "查看详情</button>" +
      '<button class="gd-ops-item" data-act="roster-up" data-id="' + U.esc(id) + '">' + U.icon("up") + "上移" + (idx === 0 ? ' <em class="disabled">(已是首位)</em>' : "") + "</button>" +
      '<button class="gd-ops-item" data-act="roster-down" data-id="' + U.esc(id) + '">' + U.icon("down") + "下移" + (idx === list.length - 1 ? ' <em class="disabled">(已是末位)</em>' : "") + "</button>" +
      '<button class="gd-ops-item" data-act="roster-edit" data-id="' + U.esc(id) + '">' + U.icon("edit") + "编辑人员</button>" +
      '<button class="gd-ops-item danger" data-act="roster-del" data-id="' + U.esc(id) + '">' + U.icon("trash") + "删除人员</button>" +
      "</div>" +
      '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    return U.openModal(html, { dismissible: true }).then(function () {});
  }

  function detail(id) {
    var list = S.getRoster();
    var item = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { item = list[i]; break; }
    if (!item) return;
    var rows = [
      ["姓名", item.name], ["职名", item.position], ["技能等级", item.skillLevel],
      ["身份证号", item.idCard], ["手机号", item.phone], ["年龄", item.age],
      ["家庭住址", item.address], ["健康状况", item.healthStatus], ["入路时间", item.entryDate]
    ];
    var html = '<div class="gd-modal-title">人员详情</div><div class="gd-detail">';
    for (var j = 0; j < rows.length; j++) {
      if (!rows[j][1] && rows[j][1] !== 0) continue;
      html += '<div class="gd-detail-row"><span>' + rows[j][0] + "</span><b>" + U.esc(rows[j][1]) + "</b></div>";
    }
    html += '</div><div class="gd-modal-btns"><button class="gd-btn primary" data-act="cancel">关闭</button></div>';
    return U.openModal(html, { dismissible: true }).then(function () {});
  }

  function move(id, dir) {
    var list = S.getRoster();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; break; }
    if (idx < 0) return;
    var to = idx + dir;
    if (to < 0 || to >= list.length) return;
    var tmp = list[idx];
    list[idx] = list[to];
    list[to] = tmp;
    for (var k = 0; k < list.length; k++) list[k].sortIndex = k;
    S.saveRoster(list);
    window.App.refresh();
  }

  async function remove(id) {
    var list = S.getRoster();
    var item = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { item = list[i]; break; }
    if (!item) return;
    var ok = await U.confirmDialog("确定要删除人员「" + item.name + "」吗？此操作不可撤销。", { title: "删除人员" });
    if (!ok) return;
    S.saveRoster(list.filter(function (p) { return p.id !== id; }));
    U.toast("已删除");
    window.App.refresh();
  }

  /* ---------- 导入导出 ---------- */
  var TEMPLATE_HEADERS = ["姓名", "职名", "身份证号", "联系方式", "年龄", "家庭住址", "健康状况", "入路时间", "技能等级"];

  function exportExcel() {
    var list = S.getRoster();
    var rows = [TEMPLATE_HEADERS];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      rows.push([p.name || "", p.position || "", p.idCard || "", p.phone || "", p.age || "", p.address || "", p.healthStatus || "", p.entryDate || "", p.skillLevel || ""]);
    }
    window.XLSX.exportXlsx([{ name: "花名册", rows: rows }], "花名册.xlsx");
    U.toast("已导出花名册.xlsx");
  }

  function downloadTemplate() {
    window.XLSX.exportXlsx([{ name: "花名册导入模板", rows: [TEMPLATE_HEADERS] }], "花名册导入模板.xlsx");
    U.toast("模板已下载");
  }

  function parseRow(o) {
    var idCard = (o["身份证号"] || "").trim();
    var ageRaw = o["年龄"];
    var age = ageRaw !== "" && ageRaw !== undefined ? Number(ageRaw) : U.ageFromIdCard(idCard);
    return {
      name: (o["姓名"] || "").trim(),
      position: (o["职名"] || "").trim() || undefined,
      idCard: idCard || undefined,
      phone: (o["联系方式"] || "").trim() || undefined,
      age: age && age > 0 ? age : undefined,
      address: (o["家庭住址"] || "").trim() || undefined,
      healthStatus: (o["健康状况"] || "").trim() || undefined,
      entryDate: (o["入路时间"] || "").trim() || null,
      skillLevel: (o["技能等级"] || "").trim() || undefined
    };
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var ext = (file.name || "").split(".").pop().toLowerCase();
        var list = [];
        if (ext === "csv" || ext === "txt") {
          var rows = window.XLSX.parseCsv(String(e.target.result));
          if (rows.length < 2) { U.toast("文件内容为空或格式不正确", "error"); return; }
          var headers = rows[0];
          for (var i = 1; i < rows.length; i++) {
            var obj = {};
            for (var j = 0; j < headers.length; j++) obj[String(headers[j]).trim()] = rows[i][j];
            if (!obj["姓名"]) continue;
            var rec = parseRow(obj);
            if (rec.name) list.push(rec);
          }
        } else {
          var sheets = window.XLSX.readXlsx(e.target.result);
          var names = Object.keys(sheets);
          if (names.length === 0) { U.toast("未解析到任何人员数据", "error"); return; }
          var grid = sheets[names[0]];
          if (grid.length < 2) { U.toast("文件内容为空或格式不正确", "error"); return; }
          var hd = grid[0];
          for (var r = 1; r < grid.length; r++) {
            var o2 = {};
            for (var c = 0; c < hd.length; c++) o2[String(hd[c]).trim()] = grid[r][c] !== undefined ? grid[r][c] : "";
            if (!o2["姓名"]) continue;
            var rec2 = parseRow(o2);
            if (rec2.name) list.push(rec2);
          }
        }
        if (list.length === 0) { U.toast("未解析到任何人员数据", "error"); return; }
        var cur = S.getRoster();
        var startIdx = cur.length;
        for (var k = 0; k < list.length; k++) {
          list[k].id = U.uid();
          list[k].sortIndex = startIdx + k;
        }
        S.saveRoster(cur.concat(list));
        U.toast("导入完成：成功 " + list.length + " 条有效记录");
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
      '<div class="gd-modal-title">花名册导入 / 导出</div>' +
      '<div class="gd-ops-list">' +
      '<button class="gd-ops-item" data-act="roster-import-xlsx">' + U.icon("upload") + "导入 Excel / CSV</button>" +
      '<button class="gd-ops-item" data-act="roster-export">' + U.icon("download") + "导出 Excel</button>" +
      '<button class="gd-ops-item" data-act="roster-template">' + U.icon("file") + "下载导入模板</button>" +
      "</div>" +
      '<div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    return U.openModal(html, { dismissible: true }).then(function () {});
  }

  function pickAndImport() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.csv,.txt";
    input.style.display = "none";
    input.onchange = function () {
      if (input.files && input.files[0]) importFile(input.files[0]);
      document.body.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  }

  /* ---------- 事件 ---------- */
  var actions = {
    "roster-add": function () { personModal(null); },
    "roster-menu": function () { importMenu(); },
    "roster-ops": function (el) {
      var id = el.getAttribute("data-id");
      if (id) opsMenu(id);
    },
    "roster-detail": function (el) { detail(el.getAttribute("data-id")); },
    "roster-edit": function (el) { personModal(getById(el.getAttribute("data-id"))); },
    "roster-del": function (el) { remove(el.getAttribute("data-id")); },
    "roster-up": function (el) { move(el.getAttribute("data-id"), -1); },
    "roster-down": function (el) { move(el.getAttribute("data-id"), 1); },
    "roster-import-xlsx": function () { pickAndImport(); },
    "roster-export": function () { exportExcel(); },
    "roster-template": function () { downloadTemplate(); }
  };

  function getById(id) {
    var list = S.getRoster();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function bind() {
    var page = document.getElementById("gd-page");
    if (!page) return;
    var search = page.querySelector("#roster-search");
    if (search) {
      search.addEventListener("input", function () { state.search = this.value; rerenderList(); });
    }
    var sort = page.querySelector("#roster-sort");
    if (sort) {
      sort.addEventListener("change", function () { state.sort = this.value; rerenderList(); });
    }
  }

  function rerenderList() {
    var page = document.getElementById("gd-page");
    if (!page) return;
    page.innerHTML = render();
    bind();
  }

  return {
    render: render,
    bind: bind,
    actions: actions,
    refresh: rerenderList
  };
})();
