/**
 * learning.js —— 学习资料页面
 * 分类管理、文件链接、学习进度、打开/下载/分享
 */
window.PageLearning = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var CATS = { all: "全部", safety: "安全规章", technical: "技术标准", guide: "作业指导书", training: "培训课件" };
  var FILE_TYPES = { pdf: "PDF", word: "Word", excel: "Excel", ppt: "PPT", image: "图片", video: "视频", txt: "文本" };

  var state = { cat: "all", search: "" };

  function render() {
    var l = S.getLearning();
    var kw = state.search.trim().toLowerCase();
    var list = l.materials.filter(function (m) {
      if (state.cat !== "all" && m.category !== state.cat) return false;
      if (kw && (m.title || "").toLowerCase().indexOf(kw) < 0) return false;
      return true;
    }).sort(function (a, b) { return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(); });

    var html = '<div class="gd-page-head">';
    html += "<div><h1>学习资料</h1><p class='gd-sub'>安全规章、技术标准、作业指导书等学习资料管理</p></div>";
    html += '<button class="gd-btn primary" data-act="learn-add">' + U.icon("plus") + "添加</button>";
    html += "</div>";

    html += '<div class="gd-toolbar">';
    html += '<div class="gd-search">' + U.icon("search") + '<input id="learn-search" placeholder="搜索资料标题" value="' + U.esc(state.search) + '"/></div>';
    html += '<button class="gd-btn ghost small" data-act="learn-records">' + U.icon("clock") + "学习记录</button>";
    html += "</div>";

    html += '<div class="gd-toolbar sub">分类：';
    for (var k in CATS) {
      html += '<button class="gd-chip mini' + (state.cat === k ? " active" : "") + '" data-act="learn-cat" data-v="' + k + '">' + CATS[k] + "</button>";
    }
    html += "</div>";

    if (list.length === 0) {
      html += '<div class="gd-empty">' + U.icon("book") + "<p>" + (l.materials.length === 0 ? "点击下方按钮添加第一份学习资料" : "未找到匹配资料") + "</p></div>";
    } else {
      html += '<div class="gd-list">';
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        var prog = m.progress || 0;
        html += '<div class="gd-card learn-card" data-act="learn-detail" data-id="' + U.esc(m.id) + '">';
        html += '<div class="learn-icon">' + U.icon(fileIcon(m.fileType)) + "</div>";
        html += '<div class="gd-card-body">';
        html += '<div class="gd-card-title">' + U.esc(m.title) + "</div>";
        html += '<div class="gd-tags">';
        html += '<span class="gd-badge cat ' + m.category + '">' + (CATS[m.category] || m.category || "其他") + "</span>";
        html += '<span class="gd-badge ft ' + m.fileType + '">' + (FILE_TYPES[m.fileType] || m.fileType || "文件") + "</span>";
        if (m.description) html += '<span class="gd-badge due">' + U.esc(m.description) + "</span>";
        html += "</div>";
        html += '<div class="learn-progress">';
        html += '<div class="learn-progress-bar"><i style="width:' + prog + '%"></i></div>';
        html += "<span>" + prog + "%</span>";
        html += "</div>";
        html += '<div class="gd-card-sub">上传时间：' + U.fmtDateTime(m.createdAt) + "</div>";
        html += "</div></div>";
      }
      html += "</div>";
    }
    return html;
  }

  function fileIcon(ft) {
    if (ft === "image") return "image";
    if (ft === "video") return "camera";
    if (ft === "pdf") return "file";
    return "book";
  }

  /* ---------- 详情/操作 ---------- */
  function detail(id) {
    var l = S.getLearning();
    var m = null;
    for (var i = 0; i < l.materials.length; i++) if (l.materials[i].id === id) { m = l.materials[i]; break; }
    if (!m) return;
    var prog = m.progress || 0;
    var html =
      '<div class="gd-modal-title">' + U.esc(m.title) + "</div>" +
      '<div class="gd-modal-msg">';
    html += (CATS[m.category] || "") + " · " + (FILE_TYPES[m.fileType] || m.fileType || "") + (m.description ? "<br/>" + U.esc(m.description) : "");
    html += "</div>";
    html += '<div class="learn-progress big"><div class="learn-progress-bar"><i style="width:' + prog + '%"></i></div><span>' + prog + "%</span></div>";
    html += '<div class="gd-modal-msg small">上传时间：' + U.fmtDateTime(m.createdAt) + "</div>";
    html += '<div class="gd-field"><label class="gd-label">调整学习进度</label>';
    html += '<input type="range" min="0" max="100" step="5" value="' + prog + '" id="learn-range"/></div>';
    html += '<div class="gd-modal-btns">';
    if (m.fileUrl || m.fileData) {
      var openHref = m.fileData ? m.fileData : m.fileUrl;
      html += '<a class="gd-btn primary" target="_blank" rel="noopener" href="' + U.esc(openHref) + '">' + U.icon("file") + "打开</a>";
      if (m.fileData) {
        html += '<button class="gd-btn ghost" data-act="learn-download" data-id="' + U.esc(m.id) + '">' + U.icon("download") + "下载</button>";
      }
      html += '<button class="gd-btn ghost" data-act="learn-share" data-id="' + U.esc(m.id) + '">' + U.icon("share") + "分享</button>";
    }


    html += '<button class="gd-btn ghost" data-act="learn-edit" data-id="' + U.esc(m.id) + '">' + U.icon("edit") + "编辑</button>";
    html += '<button class="gd-btn danger" data-act="learn-del" data-id="' + U.esc(m.id) + '">' + U.icon("trash") + "删除</button>";
    html += '<button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
    // 进度调节
    var range = document.getElementById("learn-range");
    if (range) {
      range.addEventListener("input", function () {
        var v = Number(this.value);
        updateProgress(id, v);
        var bar = document.querySelector("#gd-page .learn-progress.big .learn-progress-bar i");
        var label = document.querySelector("#gd-page .learn-progress.big span");
        if (bar) bar.style.width = v + "%";
        if (label) label.textContent = v + "%";
      });
    }
  }

  function updateProgress(id, v) {
    var l = S.getLearning();
    for (var i = 0; i < l.materials.length; i++) {
      if (l.materials[i].id === id) {
        l.materials[i].progress = v;
        l.records = l.records || [];
        l.records.push({ id: U.uid(), materialId: id, action: "学习进度更新至 " + v + "%", time: new Date().toISOString() });
      }
    }
    S.saveLearning(l);
  }

  /* ---------- 表单 ---------- */
  function materialModal(item) {
    var isEdit = !!item;
    item = item || {};
    var catOptions = Object.keys(CATS).filter(function (k) { return k !== "all"; }).map(function (k) { return [k, CATS[k]]; });
    var ftOptions = Object.keys(FILE_TYPES).map(function (k) { return [k, FILE_TYPES[k]]; });
    var body =
      '<div class="gd-modal-title">' + (isEdit ? "编辑资料" : "新增资料") + "</div>" +
      '<form class="gd-form">' +
      U.field("标题", "title", item.title, "请输入资料标题", { required: true }) +
      '<div class="gd-row2">' +
      U.field("分类", "category", item.category || "safety", "选择分类", { type: "select", options: catOptions }) +
      U.field("文件类型", "fileType", item.fileType || "pdf", "选择类型", { type: "select", options: ftOptions }) +
      "</div>" +
      '<div class="gd-field"><label class="gd-label">本地文件</label><input type="file" id="learn-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.bmp,.mp4,.mov,.txt" onchange="window.__gdLearnFile(this)" style="font-size:13px"/><p class="gd-hint" id="learn-file-name">' + (item.fileName ? "已选择：" + U.esc(item.fileName) : "选择本地文件，单文件最大 2MB") + '</p><input type="hidden" name="fileData" id="learn-file-data" value="' + (item.fileData || "") + '"/><input type="hidden" name="fileName" id="learn-file-name-hidden" value="' + U.esc(item.fileName || "") + '"/></div>' +
      U.field("文件链接 URL", "fileUrl", item.fileUrl, "请输入文件访问链接", { hint: "本地文件与链接二选一，优先使用本地文件" }) +

      U.field("描述", "description", item.description, "请输入资料描述（选填）", { type: "textarea", rows: 4 }) +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">' + (isEdit ? "保存" : "创建") + "</button></div></form>";
    U.openModal(body, { dismissible: true }).then(function (data) {
      if (!data || !data.title.trim()) return;
      var now = new Date().toISOString();
      var rec = {
        title: data.title.trim(),
        category: data.category || "safety",
        fileType: data.fileType || "pdf",
        fileUrl: data.fileUrl ? data.fileUrl.trim() : undefined,
        fileData: data.fileData || undefined,
        fileName: data.fileName || undefined,
        description: data.description ? data.description.trim() : undefined
      };
      var l = S.getLearning();
      if (isEdit) {
        for (var i = 0; i < l.materials.length; i++) if (l.materials[i].id === item.id) {
          l.materials[i] = Object.assign({}, l.materials[i], rec);
        }
      } else {
        rec.id = U.uid();
        rec.progress = 0;
        rec.createdAt = now;
        l.materials.push(rec);
      }
      S.saveLearning(l);
      U.toast("保存成功");
      window.App.refresh();
    });
  }

  async function remove(id) {
    var l = S.getLearning();
    var m = null;
    for (var i = 0; i < l.materials.length; i++) if (l.materials[i].id === id) { m = l.materials[i]; break; }
    if (!m) return;
    var ok = await U.confirmDialog("确定要删除这份学习资料吗？", { title: "删除资料" });
    if (!ok) return;
    l.materials = l.materials.filter(function (x) { return x.id !== id; });
    S.saveLearning(l);
    U.toast("已删除");
    window.App.refresh();
  }

  function share(id) {
    var l = S.getLearning();
    var m = null;
    for (var i = 0; i < l.materials.length; i++) if (l.materials[i].id === id) { m = l.materials[i]; break; }
    if (!m) return;
    var text = m.title + (m.description ? "\n" + m.description : "") + (m.fileUrl ? "\n" + m.fileUrl : "");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { U.toast("分享链接已复制到剪贴板"); });
    } else {
      U.toast(text, "info");
    }
  }

  function records() {
    var l = S.getLearning();
    var recs = (l.records || []).slice().sort(function (a, b) { return new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime(); });
    var html = '<div class="gd-modal-title">学习记录</div><div class="gd-ops-list">';
    if (recs.length === 0) {
      html += "<p class='gd-hint'>暂无学习记录</p>";
    } else {
      for (var i = 0; i < Math.min(50, recs.length); i++) {
        var r = recs[i];
        var title = "";
        for (var j = 0; j < l.materials.length; j++) if (l.materials[j].id === r.materialId) { title = l.materials[j].title; break; }
        html += '<div class="gd-record-item"><b>' + U.esc(r.action || "") + "</b><span>" + U.esc(title) + " · " + U.fmtDateTime(r.time) + "</span></div>";
      }
    }
    html += '</div><div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  // 本地文件选择（供表单 onchange 调用）
  window.__gdLearnFile = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { U.toast("文件过大（最大 2MB）", "error"); input.value = ""; return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataEl = document.getElementById("learn-file-data");
      var nameEl = document.getElementById("learn-file-name-hidden");
      var labelEl = document.getElementById("learn-file-name");
      if (dataEl) dataEl.value = String(e.target.result);
      if (nameEl) nameEl.value = file.name;
      if (labelEl) labelEl.textContent = "已选择：" + file.name;
      U.toast("文件已添加");
    };
    reader.readAsDataURL(file);
  };

  /* ---------- 事件 ---------- */
  var actions = {
    "learn-add": function () { materialModal(null); },
    "learn-detail": function (el) { detail(el.getAttribute("data-id")); },
    "learn-edit": function (el) {
      var l = S.getLearning();
      for (var i = 0; i < l.materials.length; i++) if (l.materials[i].id === el.getAttribute("data-id")) { materialModal(l.materials[i]); return; }
    },
    "learn-del": function (el) { remove(el.getAttribute("data-id")); },
    "learn-share": function (el) { share(el.getAttribute("data-id")); },
    "learn-cat": function (el) { state.cat = el.getAttribute("data-v"); window.App.refresh(); },
    "learn-records": records,
    "learn-download": function (el) {
      var l = S.getLearning();
      for (var i = 0; i < l.materials.length; i++) if (l.materials[i].id === el.getAttribute("data-id")) {
        var mm = l.materials[i];
        if (mm.fileData) {
          var a = document.createElement("a");
          a.href = mm.fileData;
          a.download = mm.fileName || (mm.title + "." + (mm.fileType || "file"));
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          U.toast("已开始下载");
        }
        return;
      }
    }
  };

  function bind() {
    var page = document.getElementById("gd-page");
    if (!page) return;
    var search = page.querySelector("#learn-search");
    if (search) {
      search.addEventListener("input", function () { state.search = this.value; window.App.refresh(); });
    }
  }

  return { render: render, bind: bind, actions: actions };
})();


