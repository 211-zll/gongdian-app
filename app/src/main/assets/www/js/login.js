/**
 * login.js —— 登录 / 注册 / 手机验证页面
 */
window.LoginPage = (function () {
  "use strict";
  var U = window.Util;
  var S = window.Store;

  var state = { tab: "login", codeBtn: null };

  function render() {
    var html = '<div class="login-wrap">';
    html += '<div class="login-brand">' + U.icon("calendar") + "<h1>供电工区工作台</h1><p>班组长工作台 · 账号登录</p></div>";
    html += '<div class="login-card">';
    html += '<div class="login-tabs">';
    var tabs = [["login", "账号登录"], ["register", "注册账号"], ["phone", "手机验证"]];
    for (var i = 0; i < tabs.length; i++) {
      html += '<button class="' + (state.tab === tabs[i][0] ? "active" : "") + '" data-act="login-tab" data-tab="' + tabs[i][0] + '">' + tabs[i][1] + "</button>";
    }
    html += "</div>";
    if (state.tab === "login") html += loginForm();
    else if (state.tab === "register") html += registerForm();
    else html += phoneForm();
    html += "</div>";
    html += '<p class="login-tip">数据按账号保存在本机浏览器；换设备请用「数据管理-导出备份」迁移。</p>';
    html += "</div>";
    return html;
  }

  function loginForm() {
    return '<form id="login-form" class="login-form">' +
      '<input name="loginId" class="gd-input" placeholder="用户名 / 手机号" required/>' +
      '<input name="password" type="password" class="gd-input" placeholder="密码" required/>' +
      '<label class="gd-check"><input type="checkbox" name="remember" checked/><span>记住密码（重新打开自动登录）</span></label>' +
      '<button type="submit" class="gd-btn primary block">登 录</button>' +
      "</form>";
  }

  function registerForm() {
    return '<form id="register-form" class="login-form">' +
      '<input name="username" class="gd-input" placeholder="用户名" required/>' +
      '<input name="phone" class="gd-input" placeholder="手机号（选填，用于手机验证登录）"/>' +
      '<input name="password" type="password" class="gd-input" placeholder="密码" required/>' +
      '<input name="password2" type="password" class="gd-input" placeholder="确认密码" required/>' +
      '<button type="submit" class="gd-btn primary block">注 册</button>' +
      "</form>";
  }

  function phoneForm() {
    return '<form id="phone-form" class="login-form">' +
      '<input name="phone" class="gd-input" placeholder="手机号" required/>' +
      '<div class="login-code-row"><input name="code" class="gd-input" placeholder="验证码" required/><button type="button" id="send-code" class="gd-btn ghost">获取验证码</button></div>' +
      '<button type="submit" class="gd-btn primary block">登录 / 注册</button>' +
      "</form>";
  }

  function bind() {
    var page = document.getElementById("gd-page");
    if (!page) return;
    var loginForm = page.querySelector("#login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var loginId = loginForm.querySelector('[name="loginId"]').value;
        var password = loginForm.querySelector('[name="password"]').value;
        var remember = loginForm.querySelector('[name="remember"]').checked;
        S.login(loginId, password).then(function (res) {
          if (res.ok) {
            S.startSession(res.account, remember);
            S.syncFromCloud().then(function () {
              U.toast("登录成功，欢迎 " + res.account.username);
              window.App.init();
            });
          } else {
            U.toast(res.msg, "error");
          }
        });
      });
    }
    var regForm = page.querySelector("#register-form");
    if (regForm) {
      regForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var username = regForm.querySelector('[name="username"]').value.trim();
        var phone = regForm.querySelector('[name="phone"]').value.trim();
        var password = regForm.querySelector('[name="password"]').value;
        var password2 = regForm.querySelector('[name="password2"]').value;
        if (password !== password2) { U.toast("两次密码不一致", "error"); return; }
        S.register(username, password, phone).then(function (res) {
          if (res.ok) {
            S.startSession(res.account, true);
            S.syncFromCloud().then(function () {
              U.toast("注册成功，已自动登录");
              window.App.init();
            });
          } else {
            U.toast(res.msg, "error");
          }
        });
      });
    }
    var phoneForm = page.querySelector("#phone-form");
    if (phoneForm) {
      var sendBtn = phoneForm.querySelector("#send-code");
      if (sendBtn) {
        sendBtn.addEventListener("click", function () {
          var phone = phoneForm.querySelector('[name="phone"]').value.trim();
          var res = S.sendCode(phone);
          if (res.ok) {
            U.toast("验证码已发送：" + res.code, "info");
          } else {
            U.toast(res.msg, "error");
          }
        });
      }
      phoneForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var phone = phoneForm.querySelector('[name="phone"]').value.trim();
        var code = phoneForm.querySelector('[name="code"]').value.trim();
        S.loginByPhone(phone, code).then(function (res) {
          if (res.ok) {
            S.startSession(res.account, true);
            S.syncFromCloud().then(function () {
              U.toast("登录成功，欢迎 " + res.account.username);
              window.App.init();
            });
          } else {
            U.toast(res.msg, "error");
          }
        });
      });
    }
  }

  var actions = {
    "login-tab": function (el) {
      state.tab = el.getAttribute("data-tab");
      window.App.refresh();
    }
  };

  return { render: render, bind: bind, actions: actions };
})();

