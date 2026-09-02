/**
 * devices.js —— 设备资料页面
 * 设备总览 / 设备图片（相册）/ 区间 / 站区，设备分类管理，相册照片上传
 */
window.PageDevices = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var CATEGORIES = ["配电所", "远动房", "箱变", "架空线", "电抗器", "对接箱", "分支箱", "变压器", "其他"];
  var CATEGORY_COLORS = ["#059669", "#0284c7", "#d97706", "#b45309", "#7c3aed", "#db2777", "#0d9488", "#dc2626", "#64748b"];
  var POLE_TYPES = ["隔离杆", "直线杆", "耐张杆", "电缆杆", "跨越杆"];

  var state = {
    tab: "overview",
    view: "list",
    search: "",
    sectionId: null,
    sectionName: "",
    stationId: null,
    stationName: "",
    category: "",
    device: null
  };

  function devices() { return S.getDevices(); }
  function saveDevices(d) { S.saveDevices(d); }

  function render() {
    // 设备详情视图
    if (state.view === "detail") {
      var dhtml = '<div class="gd-page-head"><div><button class="crumb" data-act="dev-back">' + U.icon("back") + "返回</button><h1>设备详情</h1><p class='gd-sub'>" + U.esc(state.sectionName || state.stationName || "") + "</p></div></div>";
      dhtml += renderDetail(state.deviceId);
      return dhtml;
    }
    var html = "";
    var crumbs = [];
    if (state.view !== "list") {
      crumbs.push('<button class="crumb" data-act="dev-back">' + U.icon("back") + "返回</button>");
    }
    html += '<div class="gd-page-head">';
    html += "<div>" + (crumbs.length ? crumbs.join("") : "") + "<h1>设备资料</h1>";
    var sub = "";
    if (state.tab === "sections" && state.view === "categories") sub = state.sectionName || "区间设备";
    if (state.tab === "sections" && state.view === "devices") sub = (state.sectionName || "") + " / " + (state.category || "");
    if (state.tab === "stations" && state.view === "categories") sub = state.stationName || "站区设备";
    if (state.tab === "stations" && state.view === "devices") sub = (state.stationName || "") + " / " + (state.category || "");
    if (state.tab === "photos") sub = "设备照片与相册";
    if (state.tab === "overview") sub = "设备分类总览";
    html += "<p class='gd-sub'>" + sub + "</p></div>";
    if (state.view === "list" && (state.tab === "sections" || state.tab === "stations")) {
      html += '<button class="gd-btn primary" data-act="dev-add-' + (state.tab === "sections" ? "section" : "station") + '">' + U.icon("plus") + (state.tab === "sections" ? "新增区间" : "新增站区") + "</button>";
    }
    if (state.view === "devices" || state.view === "categories") {
      html += '<button class="gd-btn primary" data-act="dev-add-device">' + U.icon("plus") + "新增设备</button>";
    }
    html += "</div>";

    var tabs = [["overview", "设备总览"], ["photos", "设备图片"], ["sections", "区间"], ["stations", "站区"]];
    html += '<div class="gd-seg">';
    for (var i = 0; i < tabs.length; i++) {
      html += '<button class="' + (state.tab === tabs[i][0] ? "active" : "") + '" data-act="dev-tab" data-v="' + tabs[i][0] + '">' + tabs[i][1] + "</button>";
    }
    html += "</div>";

    if (state.tab === "overview") html += renderOverview();
    else if (state.tab === "photos") html += renderPhotos();
    else if (state.tab === "sections") html += renderSections();
    else html += renderStations();
    return html;
  }

  function renderOverview() {
    var d = devices();
    var counts = {};
    for (var i = 0; i < d.items.length; i++) {
      var c = d.items[i].category || "其他";
      counts[c] = (counts[c] || 0) + 1;
    }
    var html = '<div class="gd-card-head"><span>' + U.icon("grid") + " 设备类型统计</span><button class='gd-btn ghost small' data-act='dev-export'>" + U.icon("download") + "导出 JSON</button></div>";
    html += '<div class="dev-grid">';
    var keys = Object.keys(counts);
    if (keys.length === 0) {
      html += '<div class="gd-empty">' + U.icon("grid") + "<p>暂无设备，先在「区间 / 站区」中添加</p></div></div>";
    } else {
      for (var j = 0; j < keys.length; j++) {
        var cat = keys[j];
        var idx = CATEGORIES.indexOf(cat);
        var color = idx >= 0 ? CATEGORY_COLORS[idx] : "#64748b";
        html += '<div class="dev-stat" data-act="dev-view-all-cat" data-cat="' + U.esc(cat) + '" style="--c:' + color + '">';
        html += "<b>" + counts[cat] + "</b><span>" + U.esc(cat) + "</span></div>";
      }
      html += "</div>";
    }
    html += renderDrawings();
    return html;
  }

  function drawingTypeLabel(name) {
    var ext = (name || "").split(".").pop().toLowerCase();
    if (ext === "dwg" || ext === "dxf") return "CAD 图纸";
    if (ext === "pdf") return "PDF";
    if (ext === "doc" || ext === "docx") return "Word";
    if (ext === "xls" || ext === "xlsx") return "Excel";
    if (ext === "ppt" || ext === "pptx") return "PPT";
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].indexOf(ext) >= 0) return "图片";
    return "文件";
  }
  function drawingIsImage(name) {
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].indexOf((name || "").split(".").pop().toLowerCase()) >= 0;
  }
  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(2) + " MB";
  }
  function renderDrawings() {
    var list = S.getDrawings();
    var html = '<div class="gd-card drawings-card"><div class="gd-card-head"><span>' + U.icon("file") + " 设备图纸</span><button class='gd-btn ghost small' data-act='drawing-upload'>" + U.icon("upload") + "导入图纸</button></div>";
    html += "<p class='gd-card-desc'>支持 CAD（.dwg/.dxf）、PDF、Word、Excel、图片等格式，图纸保存在本机浏览器</p>";
    if (list.length === 0) {
      html += '<div class="gd-card-empty">暂无图纸，点击「导入图纸」上传 CAD 或文件图纸</div>';
    } else {
      html += '<div class="drawing-list">';
      for (var i = 0; i < list.length; i++) {
        var dr = list[i];
        var isImg = drawingIsImage(dr.name);
        html += '<div class="drawing-item">';
        if (isImg) {
          html += '<img class="drawing-thumb" src="' + U.esc(dr.dataUrl) + '" alt=""/>';
        } else {
          html += '<div class="drawing-icon">' + U.icon("file") + "</div>";
        }
        html += '<div class="drawing-info"><b>' + U.esc(dr.name) + "</b><span>" + U.esc(dr.typeLabel || drawingTypeLabel(dr.name)) + (dr.size ? " · " + fmtSize(dr.size) : "") + "</span></div>";
        html += '<button class="gd-mini-btn" data-act="drawing-download" data-id="' + U.esc(dr.id) + '">' + U.icon("download") + "</button>";
        html += '<button class="gd-mini-btn danger" data-act="drawing-del" data-id="' + U.esc(dr.id) + '">' + U.icon("trash") + "</button>";
        html += "</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    return html;
  }



  function renderSections() {
    var d = devices();
    var sections = d.sections;
    var html = "";
    if (state.view === "categories") return renderCategories("section", sections, d);
    if (state.view === "devices") return renderDevices("section", sections, d);
    html += '<div class="gd-search-bar">' + U.icon("search") + '<input id="dev-search" placeholder="搜索区间名称" value="' + U.esc(state.search) + '"/></div>';
    if (sections.length === 0) {
      html += '<div class="gd-empty">' + U.icon("grid") + "<p>点击添加区间按钮创建第一个区间</p></div>";
      return html;
    }
    html += '<div class="gd-list">';
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      var cnt = d.items.filter(function (it) { return it.locationType === "section" && it.sectionId === s.id; }).length;
      html += '<div class="gd-card" data-act="dev-section-enter" data-id="' + U.esc(s.id) + '" data-name="' + U.esc(s.name) + '">';
      html += '<div class="gd-card-body"><div class="gd-card-title">' + U.esc(s.name) + "</div>";
      if (s.description) html += '<div class="gd-card-sub">' + U.esc(s.description) + "</div>";
      html += '<div class="gd-card-sub">' + cnt + " 台设备</div></div>";
      html += '<button class="gd-mini-btn" data-act="dev-section-edit" data-id="' + U.esc(s.id) + '">' + U.icon("edit") + "</button>";
      html += '<button class="gd-mini-btn danger" data-act="dev-section-del" data-id="' + U.esc(s.id) + '">' + U.icon("trash") + "</button>";
      html += U.icon("right", "chev");
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderStations() {
    var d = devices();
    var stations = d.stations;
    var html = "";
    if (state.view === "categories") return renderCategories("station", stations, d);
    if (state.view === "devices") return renderDevices("station", stations, d);
    html += '<div class="gd-search-bar">' + U.icon("search") + '<input id="dev-search" placeholder="搜索站区名称" value="' + U.esc(state.search) + '"/></div>';
    if (stations.length === 0) {
      html += '<div class="gd-empty">' + U.icon("grid") + "<p>点击添加站区按钮创建第一个站区</p></div>";
      return html;
    }
    html += '<div class="gd-list">';
    for (var i = 0; i < stations.length; i++) {
      var s = stations[i];
      var cnt = d.items.filter(function (it) { return it.locationType === "station" && it.stationId === s.id; }).length;
      html += '<div class="gd-card" data-act="dev-station-enter" data-id="' + U.esc(s.id) + '" data-name="' + U.esc(s.name) + '">';
      html += '<div class="gd-card-body"><div class="gd-card-title">' + U.esc(s.name) + "</div>";
      if (s.description) html += '<div class="gd-card-sub">' + U.esc(s.description) + "</div>";
      html += '<div class="gd-card-sub">' + cnt + " 台设备</div></div>";
      html += '<button class="gd-mini-btn" data-act="dev-station-edit" data-id="' + U.esc(s.id) + '">' + U.icon("edit") + "</button>";
      html += '<button class="gd-mini-btn danger" data-act="dev-station-del" data-id="' + U.esc(s.id) + '">' + U.icon("trash") + "</button>";
      html += U.icon("right", "chev");
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderCategories(type, locs, d) {
    var locId = type === "section" ? state.sectionId : state.stationId;
    var items = d.items.filter(function (it) {
      return type === "section" ? (it.locationType === "section" && it.sectionId === locId) : (it.locationType === "station" && it.stationId === locId);
    });
    var counts = {};
    for (var i = 0; i < items.length; i++) {
      var c = items[i].category || "其他";
      counts[c] = (counts[c] || 0) + 1;
    }
    var html = '<div class="gd-card-head"><span>' + (type === "section" ? U.esc(state.sectionName) : U.esc(state.stationName)) + " · 设备分类</span></div>";
    if (Object.keys(counts).length === 0) {
      html += '<div class="gd-empty">' + U.icon("grid") + "<p>该" + (type === "section" ? "区间" : "站区") + "暂无设备，点击右上角「新增设备」</p></div>";
      return html;
    }
    html += '<div class="dev-grid">';
    var cats = Object.keys(counts);
    for (var j = 0; j < cats.length; j++) {
      var cat = cats[j];
      var idx = CATEGORIES.indexOf(cat);
      var color = idx >= 0 ? CATEGORY_COLORS[idx] : "#64748b";
      html += '<div class="dev-stat" data-act="dev-view-cat" data-cat="' + U.esc(cat) + '" style="--c:' + color + '">';
      html += "<b>" + counts[cat] + "</b><span>" + U.esc(cat) + "</span></div>";
    }
    html += "</div>";
    return html;
  }

  function renderDevices(type, locs, d) {
    var locId = type === "section" ? state.sectionId : state.stationId;
    var items = d.items.filter(function (it) {
      var matchLoc = type === "section" ? (it.locationType === "section" && it.sectionId === locId) : (it.locationType === "station" && it.stationId === locId);
      var matchCat = !state.category || (it.category || "其他") === state.category;
      var kw = state.search.trim().toLowerCase();
      var matchKw = !kw || (it.name || "").toLowerCase().indexOf(kw) >= 0;
      return matchLoc && matchCat && matchKw;
    });
    var html = '<div class="gd-search-bar">' + U.icon("search") + '<input id="dev-search" placeholder="搜索设备名称" value="' + U.esc(state.search) + '"/></div>';
    if (items.length === 0) {
      html += '<div class="gd-empty">' + U.icon("grid") + "<p>暂无设备，点击「新增设备」添加</p></div>";
      return html;
    }
    html += '<div class="gd-list">';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var idx = CATEGORIES.indexOf(it.category);
      var color = idx >= 0 ? CATEGORY_COLORS[idx] : "#64748b";
      html += '<div class="gd-card" data-act="dev-detail" data-id="' + U.esc(it.id) + '">';
      html += '<div class="dev-avatar" style="--c:' + color + '">' + U.esc((it.name || "?").slice(0, 1)) + "</div>";
      html += '<div class="gd-card-body"><div class="gd-card-title">' + U.esc(it.name) + "</div>";
      var sub = [];
      if (it.category) sub.push(it.category);
      if (it.poleType) sub.push(it.poleType);
      if (it.model) sub.push(it.model);
      html += '<div class="gd-card-sub">' + sub.join(" · ") + "</div>";
      if (it.commissionDate) html += '<div class="gd-card-sub">投运 ' + U.esc(it.commissionDate) + "</div>";
      html += "</div>";
      html += U.icon("right", "chev");
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderDetail(id) {
    var d = devices();
    var it = null;
    for (var i = 0; i < d.items.length; i++) if (d.items[i].id === id) { it = d.items[i]; break; }
    if (!it) { state.view = "devices"; return render(); }
    state.device = it;
    var locName = it.locationType === "station"
      ? ((d.stations.filter(function (s) { return s.id === it.stationId; })[0] || {}).name)
      : ((d.sections.filter(function (s) { return s.id === it.sectionId; })[0] || {}).name);
    var html = '<div class="gd-detail-card gd-card">';
    html += '<div class="gd-detail-title">' + U.esc(it.name) + "</div>";
    html += '<div class="gd-detail-grid">';
    var rows = [
      ["分类", it.category], ["杆型", it.poleType], ["型号", it.model], ["归属", locName],
      ["投运日期", it.commissionDate], ["经度", it.longitude], ["纬度", it.latitude],
      ["参数", it.parameters], ["维护记录", it.maintenanceRecords], ["一次图 URL", it.diagramUrl]
    ];
    for (var j = 0; j < rows.length; j++) {
      if (!rows[j][1]) continue;
      html += '<div class="gd-detail-row"><span>' + rows[j][0] + "</span><b>" + U.esc(rows[j][1]) + "</b></div>";
    }
    if (it.longitude && it.latitude) {
      html += '<div class="gd-detail-row"><span>导航</span><b><a class="gd-link" target="_blank" rel="noopener" href="https://uri.amap.com/marker?position=' + encodeURIComponent(it.longitude) + "," + encodeURIComponent(it.latitude) + "&name=" + encodeURIComponent(it.name || "") + '">高德地图</a> · <a class="gd-link" target="_blank" rel="noopener" href="https://map.baidu.com/map/marker?location=' + encodeURIComponent(it.latitude) + "," + encodeURIComponent(it.longitude) + "&title=" + encodeURIComponent(it.name || "") + '">百度地图</a></b></div>';
    }
    html += "</div>";
    if (it.photos && it.photos.length) {
      html += '<div class="gd-photo-strip">';
      for (var k = 0; k < it.photos.length; k++) {
        html += '<img src="' + U.esc(it.photos[k]) + '" alt="设备照片" loading="lazy"/>';
      }
      html += "</div>";
    }
    if (it.diagramData || it.diagramUrl) {
      html += '<div class="gd-detail-row"><span>一次接线图</span><b>' + (it.diagramData ? '<img class="diagram-preview" src="' + U.esc(it.diagramData) + '" alt="一次接线图"/>' : "") + (it.diagramUrl ? '<a class="gd-link" target="_blank" rel="noopener" href="' + U.esc(it.diagramUrl) + '">查看原图</a>' : "") + "</b></div>";
    }
    html += '<div class="gd-detail-btns">';
    html += '<button class="gd-btn primary" data-act="dev-edit-device" data-id="' + U.esc(it.id) + '">' + U.icon("edit") + "编辑</button>";
    html += '<button class="gd-btn danger" data-act="dev-del-device" data-id="' + U.esc(it.id) + '">' + U.icon("trash") + "删除</button>";
    html += "</div></div>";
    return html;
  }
  /* ==================== 相册 ==================== */
  var photoState = { albumId: null, path: [], search: "" };
  function renderPhotos() {
    var albums = S.getAlbums();
    var photos = S.getPhotos();
    var html = '<div class="gd-toolbar">';
    html += '<button class="gd-btn primary small" data-act="album-new">' + U.icon("plus") + "新建相册</button>";
    html += '<button class="gd-btn ghost small" data-act="album-upload">' + U.icon("upload") + "上传照片</button>";
    html += '<span class="gd-flex1"></span>';
    html += '<button class="gd-btn ghost small" data-act="album-more">' + U.icon("more") + "</button>";
    html += "</div>";
    html += '<div class="crumb-bar">';
    html += '<button class="crumb" data-act="album-root">根目录</button>';
    for (var i = 0; i < photoState.path.length; i++) {
      html += U.icon("right", "chev") + '<button class="crumb" data-act="album-enter" data-id="' + U.esc(photoState.path[i].id) + '" data-name="' + U.esc(photoState.path[i].name) + '">' + U.esc(photoState.path[i].name) + "</button>";
    }
    html += "</div>";

    html += '<div class="gd-search-bar">' + U.icon("search") + '<input id="photo-search" placeholder="搜索相册或照片" value="' + U.esc(photoState.search) + '"/></div>';

    var kw = photoState.search.trim().toLowerCase();
    if (photoState.albumId === null) {
      var topAlbums = albums.filter(function (a) { return !a.parentId && (!kw || (a.name || "").toLowerCase().indexOf(kw) >= 0); });
      var topPhotos = photos.filter(function (p) { return !p.albumId && (!kw || (p.name || "").toLowerCase().indexOf(kw) >= 0); });
      if (topAlbums.length === 0 && topPhotos.length === 0) {
        html += '<div class="gd-empty">' + U.icon("image") + "<p>暂无相册，点击「新建相册」创建</p></div>";
        return html;
      }
      if (topAlbums.length) {
        html += '<div class="album-grid">';
        for (var a = 0; a < topAlbums.length; a++) {
          var al = topAlbums[a];
          html += '<div class="album-item" data-act="album-enter" data-id="' + U.esc(al.id) + '" data-name="' + U.esc(al.name) + '">';
          html += '<div class="album-cover">' + U.icon("image") + "</div>";
          html += "<span>" + U.esc(al.name) + "</span></div>";
        }
        html += "</div>";
      }
      if (topPhotos.length) {
        html += '<div class="photo-grid">';
        for (var p = 0; p < topPhotos.length; p++) {
          html += '<div class="photo-item" data-act="photo-view" data-id="' + U.esc(topPhotos[p].id) + '"><img src="' + U.esc(topPhotos[p].dataUrl) + '" alt=""/></div>';
        }
        html += "</div>";
      }
    } else {
      var subAlbums = albums.filter(function (a) { return a.parentId === photoState.albumId && (!kw || (a.name || "").toLowerCase().indexOf(kw) >= 0); });
      var subPhotos = photos.filter(function (p) { return p.albumId === photoState.albumId && (!kw || (p.name || "").toLowerCase().indexOf(kw) >= 0); });
      if (subAlbums.length === 0 && subPhotos.length === 0) {
        html += '<div class="gd-empty">' + U.icon("image") + "<p>暂无照片，点击上传</p></div>";
        return html;
      }
      if (subAlbums.length) {
        html += '<div class="album-grid">';
        for (var a2 = 0; a2 < subAlbums.length; a2++) {
          var al2 = subAlbums[a2];
          html += '<div class="album-item" data-act="album-enter" data-id="' + U.esc(al2.id) + '" data-name="' + U.esc(al2.name) + '">';
          html += '<div class="album-cover">' + U.icon("image") + "</div>";
          html += "<span>" + U.esc(al2.name) + "</span></div>";
        }
        html += "</div>";
      }
      if (subPhotos.length) {
        html += '<div class="photo-grid">';
        for (var p2 = 0; p2 < subPhotos.length; p2++) {
          var ph = subPhotos[p2];
          html += '<div class="photo-item" data-act="photo-view" data-id="' + U.esc(ph.id) + '"><img src="' + U.esc(ph.dataUrl) + '" alt=""/></div>';
        }
        html += "</div>";
      }
    }
    return html;
  }

  function albumModal(parentId) {
    var body =
      '<div class="gd-modal-title">新建相册</div>' +
      '<form class="gd-form">' +
      U.field("相册名称", "name", "", "请输入相册名称", { required: true }) +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">创建</button></div></form>';
    U.openModal(body, { dismissible: true }).then(function (data) {
      if (!data || !data.name.trim()) return;
      var albums = S.getAlbums();
      albums.push({ id: U.uid(), name: data.name.trim(), parentId: parentId || null, createdAt: new Date().toISOString() });
      S.saveAlbums(albums);
      U.toast("相册创建成功");
      window.App.refresh();
    });
  }

  function compressImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var max = 1200;
        var w = img.width, h = img.height;
        if (w > max || h > max) {
          var ratio = Math.min(max / w, max / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        cb(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = function () { cb(null); };
      img.src = e.target.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  function uploadPhotos() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.display = "none";
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      var done = 0, ok = 0, fail = 0;
      files.forEach(function (f) {
        compressImage(f, function (dataUrl) {
          done++;
          if (dataUrl) {
            var photos = S.getPhotos();
            photos.push({ id: U.uid(), albumId: photoState.albumId, name: f.name, dataUrl: dataUrl, createdAt: new Date().toISOString() });
            try {
              S.savePhotos(photos);
              ok++;
            } catch (e) { fail++; }
          } else { fail++; }
          if (done === files.length) {
            U.toast("上传完成：成功 " + ok + " 张" + (fail ? "，" + fail + " 张失败" : ""));
            window.App.refresh();
          }
        });
      });
      document.body.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  }

  function photoView(id) {
    var photos = S.getPhotos();
    var ph = null;
    for (var i = 0; i < photos.length; i++) if (photos[i].id === id) { ph = photos[i]; break; }
    if (!ph) return;
    var html =
      '<div class="gd-modal-title">照片查看</div>' +
      '<div class="photo-view"><img src="' + U.esc(ph.dataUrl) + '" alt=""/></div>' +
      '<div class="gd-modal-btns">' +
      '<button class="gd-btn ghost" data-act="photo-save" data-id="' + U.esc(ph.id) + '">' + U.icon("download") + "保存</button>" +
      '<button class="gd-btn danger" data-act="photo-del" data-id="' + U.esc(ph.id) + '">' + U.icon("trash") + "删除</button>" +
      '<button class="gd-btn primary" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  function photoSave(id) {
    var photos = S.getPhotos();
    for (var i = 0; i < photos.length; i++) {
      if (photos[i].id === id) {
        var a = document.createElement("a");
        a.href = photos[i].dataUrl;
        a.download = photos[i].name || ("photo_" + id + ".jpg");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        U.toast("已保存到相册");
        return;
      }
    }
  }

  async function photoDel(id) {
    var ok = await U.confirmDialog("确定要删除这张照片吗？删除后无法恢复。", { title: "删除照片" });
    if (!ok) return;
    S.savePhotos(S.getPhotos().filter(function (p) { return p.id !== id; }));
    U.toast("已删除");
    window.App.refresh();
  }

  function albumOps() {
    var albums = S.getAlbums();
    var html = '<div class="gd-modal-title">相册管理</div><div class="gd-ops-list">';
    for (var i = 0; i < albums.length; i++) {
      html += '<div class="album-ops-item"><span>' + U.esc(albums[i].name) + "</span>" +
        '<button class="gd-mini-btn" data-act="album-rename" data-id="' + U.esc(albums[i].id) + '">' + U.icon("edit") + "</button>" +
        '<button class="gd-mini-btn danger" data-act="album-del" data-id="' + U.esc(albums[i].id) + '">' + U.icon("trash") + "</button></div>";
    }
    if (albums.length === 0) html += "<p class='gd-hint'>暂无相册</p>";
    html += '</div><div class="gd-modal-btns"><button class="gd-btn ghost" data-act="cancel">关闭</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  function albumRename(id) {
    var albums = S.getAlbums();
    var item = null;
    for (var i = 0; i < albums.length; i++) if (albums[i].id === id) { item = albums[i]; break; }
    if (!item) return;
    var body =
      '<div class="gd-modal-title">重命名相册</div>' +
      '<form class="gd-form">' +
      U.field("新名称", "name", item.name, "请输入新名称", { required: true }) +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">保存</button></div></form>';
    U.openModal(body, { dismissible: true }).then(function (data) {
      if (!data || !data.name.trim()) return;
      for (var j = 0; j < albums.length; j++) if (albums[j].id === id) albums[j].name = data.name.trim();
      S.saveAlbums(albums);
      U.toast("重命名成功");
      window.App.refresh();
    });
  }

  async function albumDel(id) {
    var ok = await U.confirmDialog("删除相册及其所有子相册和照片？此操作不可撤销。", { title: "删除相册" });
    if (!ok) return;
    var albums = S.getAlbums();
    var ids = [id];
    for (var i = 0; i < ids.length; i++) {
      for (var j = 0; j < albums.length; j++) {
        if (albums[j].parentId === ids[i] && ids.indexOf(albums[j].id) < 0) ids.push(albums[j].id);
      }
    }
    S.saveAlbums(albums.filter(function (a) { return ids.indexOf(a.id) < 0; }));
    S.savePhotos(S.getPhotos().filter(function (p) { return ids.indexOf(p.albumId) < 0; }));
    if (photoState.albumId === id) { photoState.albumId = null; photoState.path = []; }
    U.toast("已删除");
    window.App.refresh();
  }
  /* ==================== 表单 ==================== */
  function locModal(type, item) {
    var isEdit = !!item;
    item = item || {};
    var body =
      '<div class="gd-modal-title">' + (isEdit ? "编辑" : "新增") + (type === "section" ? "区间" : "站区") + "</div>" +
      '<form class="gd-form">' +
      U.field((type === "section" ? "区间名称" : "站区名称"), "name", item.name, "请输入名称", { required: true }) +
      U.field("描述", "description", item.description, "简介或备注信息", { type: "textarea", rows: 3 }) +
      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">保存</button></div></form>';
    U.openModal(body, { dismissible: true }).then(function (data) {
      if (!data || !data.name.trim()) return;
      var d = devices();
      if (type === "section") {
        if (isEdit) {
          for (var i = 0; i < d.sections.length; i++) if (d.sections[i].id === item.id) {
            d.sections[i].name = data.name.trim();
            d.sections[i].description = data.description || undefined;
          }
        } else {
          d.sections.push({ id: U.uid(), name: data.name.trim(), description: data.description || undefined });
        }
      } else {
        if (isEdit) {
          for (var j = 0; j < d.stations.length; j++) if (d.stations[j].id === item.id) {
            d.stations[j].name = data.name.trim();
            d.stations[j].description = data.description || undefined;
          }
        } else {
          d.stations.push({ id: U.uid(), name: data.name.trim(), description: data.description || undefined });
        }
      }
      saveDevices(d);
      U.toast("保存成功");
      window.App.refresh();
    });
  }

  function deviceModal(item) {
    var isEdit = !!item;
    item = item || {};
    var photosVal = (item.photos || []).join("\n");
    var locType = state.tab === "stations" ? "station" : "section";
    var body =
      '<div class="gd-modal-title">' + (isEdit ? "编辑设备" : "新增设备") + "</div>" +
      '<form class="gd-form">' +
      U.field("设备名称", "name", item.name, "请输入设备名称", { required: true }) +
            '<div class="gd-field"><label class="gd-label">设备分类</label><select name="category" id="device-category" class="gd-input" onchange="var f=document.getElementById(\'pole-type-field\');if(f)f.style.display=this.value===\'架空线\'?\'block\':\'none\';">' + CATEGORIES.map(function (cc) { return '<option value="' + cc + '"' + ((item.category || "配电所") === cc ? " selected" : "") + ">" + cc + "</option>"; }).join("") + '</select></div>' +
      '<div class="gd-field" id="pole-type-field" style="' + (item.category === "架空线" ? "block" : "none") + '"><label class="gd-label">杆型（架空线）</label><select name="poleType" class="gd-input">' + POLE_TYPES.map(function (pp) { return '<option value="' + pp + '"' + (item.poleType === pp ? " selected" : "") + ">" + pp + "</option>"; }).join("") + '</select></div>' +

      '<div class="gd-row2">' +
      U.field("型号", "model", item.model, "设备型号", {}) +
      U.field("投运日期", "commissionDate", item.commissionDate || "", "", { type: "date" }) +
      "</div>" +
      '<div class="gd-row2">' +
      U.field("经度", "longitude", item.longitude, "如 116.397", {}) +
      U.field("纬度", "latitude", item.latitude, "如 39.908", {}) +
      "</div>" +
      U.field("参数", "parameters", item.parameters, "额定电压、容量等参数，每行一项", { type: "textarea", rows: 3 }) +
      U.field("维护记录", "maintenanceRecords", item.maintenanceRecords, "维护历史记录，每行一条", { type: "textarea", rows: 3 }) +
      '<div class="gd-field"><label class="gd-label">设备照片</label><input type="file" multiple accept="image/*" id="dev-photo-file" onchange="window.__gdPhotoUpload(this)" style="font-size:13px"/><div class="photo-upload-box" id="dev-photo-preview">' + (item.photos || []).filter(function (p) { return p.indexOf("data:") === 0; }).map(function (p) { return '<img src="' + p + '" alt=""/>'; }).join("") + '</div><input type="hidden" name="photosData" id="dev-photo-data" value="' + ((item.photos || []).filter(function (p) { return p.indexOf("data:") === 0; }).join("||")) + '"/><textarea name="photos" class="gd-input" rows="2" placeholder="图片链接 URL，每行一个（可选）">' + U.esc((item.photos || []).filter(function (p) { return p.indexOf("data:") !== 0; }).join("\n")) + '</textarea><p class="gd-hint">可上传本地照片（自动压缩），也可粘贴图片链接</p></div>' +

      '<div class="gd-field"><label class="gd-label">一次接线图</label><input type="file" accept="image/*" id="dev-diagram-file" onchange="window.__gdDiagramUpload(this)" style="font-size:13px"/><div class="photo-upload-box" id="dev-diagram-preview">' + (item.diagramData ? '<img src="' + U.esc(item.diagramData) + '" alt=""/>' : "") + '</div><input type="hidden" name="diagramData" id="dev-diagram-data" value="' + (item.diagramData || "") + '"/><input name="diagramUrl" class="gd-input" placeholder="一次图图片链接 URL（可选）" value="' + U.esc(item.diagramUrl || "") + '"/><p class="gd-hint">可上传本地一次接线图，也可粘贴图片链接</p></div>' +

      '<div class="gd-modal-btns">' +
      '<button type="button" class="gd-btn ghost" data-act="cancel">取消</button>' +
      '<button type="submit" class="gd-btn primary">' + (isEdit ? "保存" : "添加") + "</button></div></form>";
    U.openModal(body, { dismissible: true }).then(function (data) {
      if (!data || !data.name.trim()) return;
      var d = devices();
      var photos = (data.photos || "").split(/[\n,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
      var photosData = (data.photosData || "").split("||").map(function (x) { return x.trim(); }).filter(Boolean);
      photos = photosData.concat(photos);
      var rec = {
        name: data.name.trim(),
        category: data.category || "其他",
        model: data.model || undefined,
        commissionDate: data.commissionDate || null,
        longitude: data.longitude || undefined,
        latitude: data.latitude || undefined,
        parameters: data.parameters || undefined,
        maintenanceRecords: data.maintenanceRecords || undefined,
        photos: photos.length ? photos : undefined,
        diagramUrl: data.diagramUrl || undefined,
        diagramData: data.diagramData || undefined,
        poleType: data.category === "架空线" ? (data.poleType || undefined) : undefined,
        locationType: locType
      };
      if (locType === "station") rec.stationId = state.stationId; else rec.sectionId = state.sectionId;
      if (isEdit) {
        for (var i = 0; i < d.items.length; i++) if (d.items[i].id === item.id) {
          d.items[i] = Object.assign({}, d.items[i], rec);
        }
      } else {
        rec.id = U.uid();
        d.items.push(rec);
      }
      saveDevices(d);
      U.toast("保存成功");
      window.App.refresh();
    });
  }

  async function removeLoc(type, id) {
    var d = devices();
    var name = "";
    if (type === "section") {
      for (var i = 0; i < d.sections.length; i++) if (d.sections[i].id === id) name = d.sections[i].name;
    } else {
      for (var j = 0; j < d.stations.length; j++) if (d.stations[j].id === id) name = d.stations[j].name;
    }
    var ok = await U.confirmDialog("确定要删除" + (type === "section" ? "区间「" : "站区「") + name + "」吗？该" + (type === "section" ? "区间" : "站区") + "下的设备也会被删除，此操作不可撤销。", { title: "确认删除" });
    if (!ok) return;
    if (type === "section") {
      d.sections = d.sections.filter(function (s) { return s.id !== id; });
      d.items = d.items.filter(function (it) { return !(it.locationType === "section" && it.sectionId === id); });
      if (state.sectionId === id) { state.sectionId = null; state.view = "list"; }
    } else {
      d.stations = d.stations.filter(function (s) { return s.id !== id; });
      d.items = d.items.filter(function (it) { return !(it.locationType === "station" && it.stationId === id); });
      if (state.stationId === id) { state.stationId = null; state.view = "list"; }
    }
    saveDevices(d);
    U.toast("已删除");
    window.App.refresh();
  }

  async function removeDevice(id) {
    var d = devices();
    var it = null;
    for (var i = 0; i < d.items.length; i++) if (d.items[i].id === id) { it = d.items[i]; break; }
    if (!it) return;
    var ok = await U.confirmDialog("确定要删除设备「" + it.name + "」吗？", { title: "确认删除" });
    if (!ok) return;
    d.items = d.items.filter(function (x) { return x.id !== id; });
    saveDevices(d);
    state.device = null;
    state.view = "devices";
    U.toast("已删除");
    window.App.refresh();
  }

  function exportJson() {
    U.downloadJson({ app: "供电工区工作台", type: "设备资料", exportedAt: new Date().toISOString(), data: devices() }, "设备资料_" + U.fmtYmd(new Date()) + ".json");
    U.toast("已导出 JSON");
  }

  // 本地照片/一次图上传（供设备表单 onchange 调用）
  window.__gdPhotoUpload = function (input) {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length) return;
    var results = [];
    var done = 0;
    files.forEach(function (f) {
      compressImage(f, function (dataUrl) {
        done++;
        if (dataUrl) results.push(dataUrl);
        if (done === files.length) {
          var hid = document.getElementById("dev-photo-data");
          var prev = hid ? (hid.value ? hid.value.split("||") : []) : [];
          var all = prev.concat(results);
          if (hid) hid.value = all.join("||");
          var box = document.getElementById("dev-photo-preview");
          if (box) box.innerHTML = all.map(function (d) { return '<img src="' + d + '" alt=""/>'; }).join("");
          U.toast("已添加 " + results.length + " 张照片");
        }
      });
    });
    input.value = "";
  };
  window.__gdDiagramUpload = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    compressImage(file, function (dataUrl) {
      if (dataUrl) {
        var hid = document.getElementById("dev-diagram-data");
        if (hid) hid.value = dataUrl;
        var box = document.getElementById("dev-diagram-preview");
        if (box) box.innerHTML = '<img src="' + dataUrl + '" alt=""/>';
        U.toast("一次接线图已添加");
      } else {
        U.toast("图片读取失败", "error");
      }
    });
    input.value = "";
  };

  /* ==================== 图纸上传/下载/删除 ==================== */
  function uploadDrawing() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".dwg,.dxf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*";
    input.style.display = "none";
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) { document.body.removeChild(input); return; }
      if (file.size > 3 * 1024 * 1024) {
        U.toast("文件过大（单文件最大 3MB），建议使用「数据管理」导出备份", "error");
        document.body.removeChild(input);
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var list = S.getDrawings();
          list.push({ id: U.uid(), name: file.name, type: file.type || "", typeLabel: drawingTypeLabel(file.name), size: file.size, dataUrl: String(e.target.result), createdAt: new Date().toISOString() });
          S.saveDrawings(list);
          U.toast("图纸导入成功");
          window.App.refresh();
        } catch (err) {
          U.toast("保存失败，存储空间可能不足", "error");
        }
      };
      reader.readAsDataURL(file);
      document.body.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  }

  function downloadDrawing(id) {
    var list = S.getDrawings();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var a = document.createElement("a");
        a.href = list[i].dataUrl;
        a.download = list[i].name || "drawing";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        U.toast("已开始下载");
        return;
      }
    }
  }

  async function removeDrawing(id) {
    var ok = await U.confirmDialog("确定要删除这份图纸吗？删除后无法恢复。", { title: "删除图纸" });
    if (!ok) return;
    S.saveDrawings(S.getDrawings().filter(function (d) { return d.id !== id; }));
    U.toast("已删除");
    window.App.refresh();
  }

  /* ==================== 事件 ==================== */
  var actions = {
    "dev-tab": function (el) {
      state.tab = el.getAttribute("data-v");
      state.view = "list";
      state.search = "";
      state.sectionId = state.stationId = null;
      state.category = "";
      window.App.refresh();
    },
    "dev-back": function () {
      if (state.view === "detail") { state.view = "devices"; }
      else if (state.view === "devices") { state.view = "categories"; state.category = ""; state.search = ""; }
      else if (state.view === "categories") { state.view = "list"; state.search = ""; }
      else { state.tab = "overview"; state.view = "list"; }
      window.App.refresh();
    },
    "dev-section-enter": function (el) {
      state.sectionId = el.getAttribute("data-id");
      state.sectionName = el.getAttribute("data-name");
      state.view = "categories";
      state.search = "";
      window.App.refresh();
    },
    "dev-station-enter": function (el) {
      state.stationId = el.getAttribute("data-id");
      state.stationName = el.getAttribute("data-name");
      state.view = "categories";
      state.search = "";
      window.App.refresh();
    },
    "dev-view-all-cat": function (el) {
      var cat = el.getAttribute("data-cat");
      var d = devices();
      var it = d.items.filter(function (x) { return (x.category || "其他") === cat; })[0];
      if (!it) return;
      if (it.locationType === "station") {
        state.tab = "stations"; state.stationId = it.stationId;
        var st = d.stations.filter(function (s) { return s.id === it.stationId; })[0];
        state.stationName = st ? st.name : "";
      } else {
        state.tab = "sections"; state.sectionId = it.sectionId;
        var se = d.sections.filter(function (s) { return s.id === it.sectionId; })[0];
        state.sectionName = se ? se.name : "";
      }
      state.category = cat;
      state.view = "devices";
      window.App.refresh();
    },
    "dev-view-cat": function (el) {
      state.category = el.getAttribute("data-cat");
      state.view = "devices";
      window.App.refresh();
    },
    "dev-detail": function (el) {
      state.view = "detail";
      state.deviceId = el.getAttribute("data-id");
      state.device = null;
      window.App.refresh();
    },
    "dev-add-section": function () { locModal("section", null); },
    "dev-add-station": function () { locModal("station", null); },
    "dev-section-edit": function (el) {
      var d = devices();
      for (var i = 0; i < d.sections.length; i++) if (d.sections[i].id === el.getAttribute("data-id")) { locModal("section", d.sections[i]); return; }
    },
    "dev-station-edit": function (el) {
      var d = devices();
      for (var i = 0; i < d.stations.length; i++) if (d.stations[i].id === el.getAttribute("data-id")) { locModal("station", d.stations[i]); return; }
    },
    "dev-section-del": function (el) { removeLoc("section", el.getAttribute("data-id")); },
    "dev-station-del": function (el) { removeLoc("station", el.getAttribute("data-id")); },
    "dev-add-device": function () { deviceModal(null); },
    "dev-edit-device": function (el) {
      var d = devices();
      for (var i = 0; i < d.items.length; i++) if (d.items[i].id === el.getAttribute("data-id")) { deviceModal(d.items[i]); return; }
    },
    "dev-del-device": function (el) { removeDevice(el.getAttribute("data-id")); },
    "dev-export": exportJson,
    "album-new": function () { albumModal(photoState.albumId); },
    "album-upload": uploadPhotos,
    "album-more": albumOps,
    "album-root": function () { photoState.albumId = null; photoState.path = []; window.App.refresh(); },
    "album-enter": function (el) {
      var id = el.getAttribute("data-id");
      var name = el.getAttribute("data-name");
      photoState.path.push({ id: id, name: name });
      photoState.albumId = id;
      window.App.refresh();
    },
    "album-rename": function (el) { albumRename(el.getAttribute("data-id")); },
    "album-del": function (el) { albumDel(el.getAttribute("data-id")); },
    "photo-view": function (el) { photoView(el.getAttribute("data-id")); },
    "photo-save": function (el) { photoSave(el.getAttribute("data-id")); },
    "photo-del": function (el) { photoDel(el.getAttribute("data-id")); },
    "drawing-upload": uploadDrawing,
    "drawing-download": function (el) { downloadDrawing(el.getAttribute("data-id")); },
    "drawing-del": function (el) { removeDrawing(el.getAttribute("data-id")); }
  };

  function bind() {
    var page = document.getElementById("gd-page");
    if (!page) return;
    var search = page.querySelector("#dev-search");
    if (search) {
      search.addEventListener("input", function () { state.search = this.value; window.App.refresh(); });
    }
    var psearch = page.querySelector("#photo-search");
    if (psearch) {
      psearch.addEventListener("input", function () { photoState.search = this.value; window.App.refresh(); });
    }
  }

  return { render: render, bind: bind, actions: actions };
})();











