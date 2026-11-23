(function () {
  "use strict";

  var API_BASE = "https://subtle-galliform-d9e89d1ceff81bc.api.tcloudbasegateway.com";
  var DEVICE_KEY = "nn29_feedback_device_v1";
  var token = "";

  function deviceId() {
    var id = "";
    try { id = localStorage.getItem(DEVICE_KEY) || ""; } catch (e) {}
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "dev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    }
    return id;
  }

  function toast(text) {
    var el = document.querySelector(".toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove("is-on"); }, 2800);
  }

  async function getToken(force) {
    if (token && !force) return token;
    var res = await fetch(API_BASE + "/auth/v1/signin/anonymously", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId() },
      body: "{}"
    });
    if (!res.ok) throw new Error("提交服务暂时不可用");
    var data = await res.json();
    if (!data.access_token) throw new Error("提交服务暂时不可用");
    token = data.access_token;
    return token;
  }

  async function submitFeedback(payload) {
    var t = await getToken();
    var res = await fetch(API_BASE + "/v1/rdb/rest/rpc/create_feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify(payload)
    });
    var text = await res.text();
    if (!res.ok) {
      var msg = "提交失败";
      try {
        var parsed = JSON.parse(text);
        msg = parsed.message || parsed.error_description || parsed.error || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return text;
  }

  var form = document.getElementById("feedback-form");
  if (!form) return;
  var success = document.getElementById("feedback-success");
  var msg = document.getElementById("f-msg");
  var err = document.getElementById("f-msg-err");
  var button = document.getElementById("feedback-submit");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var content = (msg.value || "").trim();
    var contact = (document.getElementById("f-contact").value || "").trim();
    var type = document.getElementById("f-type").value;
    if (err) err.textContent = "";
    if (content.length < 5) {
      if (err) err.textContent = "请至少写 5 个字，方便我们理解问题。";
      msg.focus();
      return;
    }
    if (content.length > 1000) {
      if (err) err.textContent = "最多 1000 个字。";
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = "提交中…";
    }
    try {
      await submitFeedback({ p_category: type, p_content: content, p_contact: contact });
      form.reset();
      if (success) success.hidden = false;
      toast("反馈已提交，管理员会在后台看到");
    } catch (ex) {
      toast("提交失败：" + (ex && ex.message ? ex.message : "请稍后重试"));
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "提交反馈";
      }
    }
  });
})();
