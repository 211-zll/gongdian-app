/**
 * settings.js —— 数据管理页面
 * 数据备份（导出 JSON）/ 数据恢复（导入）/ 数据重置 / 关于
 */
window.PageSettings = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  function render() {
    var html = '<div class="gd-page-head">';
    html += "<div><h1>数据管理</h1><p class='gd-sub'>备份、恢复和重置您的数据</p></div>";
    html += "</div>";


    html += '<div class="gd-card settings-card">';
    html += '<div class="gd-card-head"><span>' + U.icon("database") + " 数据备份</span></div>";
    html += "<p class='gd-card-desc'>导出全部数据为 JSON 文件，可用于备份或迁移。</p>";
    html += '<button class="gd-btn primary block" data-act="set-export">' + U.icon("download") + "导出备份</button>";
    html += "</div>";

    html += '<div class="gd-card settings-card">';
    html += '<div class="gd-card-head"><span>' + U.icon("upload") + " 数据恢复</span></div>";
    html += "<p class='gd-card-desc'>从备份文件恢复数据，将覆盖现有所有数据，请谨慎操作。</p>";
    html += '<button class="gd-btn ghost block" data-act="set-import">' + U.icon("upload") + "选择备份文件并恢复</button>";
    html += "</div>";

    html += '<div class="gd-card settings-card danger-card">';
    html += '<div class="gd-card-head"><span>' + U.icon("alert") + " 数据重置</span></div>";
    html += "<p class='gd-card-desc'>所有业务数据（花名册、排班表、工分、待办、备忘录、设备资料、学习资料）将被永久删除，且无法撤销。</p>";
    html += '<button class="gd-btn danger block" data-act="set-reset">' + U.icon("trash") + "重置数据</button>";
    html += "</div>";

    html += '<div class="gd-card settings-card">';
    html += '<div class="gd-card-head"><span>' + U.icon("share") + " 换浏览器 / 设备迁移</span></div>";
    html += "<p class='gd-card-desc'>数据保存在本机。换手机/重装后，先在旧设备「导出备份」下载 JSON 文件，再在新设备「数据恢复」导入即可恢复全部数据。</p>";
    html += "</div>";

    html += '<div class="gd-card settings-card">';
    html += '<div class="gd-card-head"><span>' + U.icon("home") + " 关于</span></div>";
    html += '<div class="gd-detail-grid">';
    html += '<div class="gd-detail-row"><span>应用名称</span><b>供电工区班组长工作台</b></div>';
    html += '<div class="gd-detail-row"><span>版本号</span><b>v1.0.0</b></div>';
    html += '<div class="gd-detail-row"><span>数据说明</span><b>数据保存在本机浏览器，无需登录</b></div>';
    html += '<div class="gd-detail-row"><span>安装</span><b><a class="gd-link" href="javascript:void(0)" data-act="set-install">添加到主屏幕（PWA）</a></b></div>';
    html += "</div>";
    html += "<p class='gd-hint'>由飞书妙搭「供电工区工作台」复刻，支持离线使用。</p>";
    html += "</div>";

    html += "<p class='gd-tip'>提示：本地文件仅保存在当前浏览器，更换设备或清除缓存后将丢失，请定期导出备份。</p>";
    return html;
  }

  function exportData() {
    var data = S.exportAll();
    var name = "供电工区数据备份_" + U.fmtYmd(new Date()) + ".json";
    U.downloadJson(data, name);
    U.toast("备份文件已下载到本地");
  }

  function importData() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(String(e.target.result));
          if (!data || typeof data !== "object" || (!data.roster && !data.schedule && !data.todos)) {
            U.toast("请选择有效的 JSON 备份文件", "error");
            return;
          }
          confirmRestore(data);
        } catch (err) {
          U.toast("文件格式错误，请选择有效的 JSON 备份文件", "error");
        }
      };
      reader.readAsText(file);
      document.body.removeChild(input);
    };
    document.body.appendChild(input);
    input.click();
  }

  async function confirmRestore(data) {
    var ok = await U.confirmDialog("恢复后当前所有业务数据将被备份文件中的数据替换，且无法撤销。确定继续？", { title: "确认数据恢复", okText: "确认恢复" });
    if (!ok) return;
    try {
      S.importAll(data);
      U.toast("数据恢复成功");
      window.App.refresh();
    } catch (err) {
      U.toast("恢复失败：" + (err && err.message ? err.message : "请稍后重试"), "error");
    }
  }

  async function resetData() {
    var ok = await U.confirmDialog("此操作不可恢复，所有数据将被永久删除。请确保已导出重要数据备份。确定重置？", { title: "确认数据重置", okText: "确认重置" });
    if (!ok) return;
    S.resetAll();
    U.toast("所有业务数据已清空");
    window.App.refresh();
  }

  function installGuide() {
    var html =
      '<div class="gd-modal-title">安装到主屏幕</div>' +
      '<div class="gd-modal-msg">将应用安装到手机桌面，即可像原生 APP 一样使用，离线也能查看数据，操作更便捷。</div>' +
      '<div class="gd-modal-msg small">方法：在浏览器底部菜单中选择「添加到主屏幕 / 安装应用」（Chrome 或 Safari）。</div>' +
      '<div class="gd-modal-btns"><button class="gd-btn primary" data-act="cancel">知道了</button></div>';
    U.openModal(html, { dismissible: true }).then(function () {});
  }

  var actions = {
    "set-export": exportData,
    "set-import": importData,
    "set-reset": resetData,
    "set-install": installGuide
  };

  return { render: render, bind: function () {}, actions: actions };
})();




