(function () {
  "use strict";

  var API_BASE = "https://subtle-galliform-d9e89d1ceff81bc.api.tcloudbasegateway.com";
  var DEVICE_KEY = "nn29_photos_device_v1";
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

  async function getToken() {
    var res = await fetch(API_BASE + "/auth/v1/signin/anonymously", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId() },
      body: "{}"
    });
    if (!res.ok) throw new Error("加载失败");
    var data = await res.json();
    if (!data.access_token) throw new Error("加载失败");
    token = data.access_token;
  }

  async function load() {
    var grid = document.getElementById("photo-public-grid");
    var empty = document.getElementById("photo-public-empty");
    if (!grid) return;
    try {
      await getToken();
      var res = await fetch(API_BASE + "/v1/rdb/rest/rpc/get_selected_photos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: "{}"
      });
      if (!res.ok) throw new Error("加载失败");
      var photos = await res.json();
      if (!photos.length) {
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      grid.innerHTML = photos.map(function (photo) {
        var name = photo.submitter || "匿名同学";
        var caption = photo.caption || "校园瞬间";
        return '<figure class="photo-public-card">' +
          '<img src="' + photo.preview_data.replace(/"/g, "&quot;") + '" alt="' + caption.replace(/</g, "&lt;") + '" loading="lazy">' +
          '<figcaption><strong>' + caption.replace(/</g, "&lt;") + '</strong><span>' + name.replace(/</g, "&lt;") + '</span></figcaption>' +
        '</figure>';
      }).join("");
    } catch (err) {
      if (empty) {
        empty.hidden = false;
        empty.querySelector("strong").textContent = "校园图片暂时加载失败。";
        empty.querySelector("p").textContent = "请稍后刷新。";
      }
    }
  }

  load();
})();
