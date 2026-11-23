(function () {
  "use strict";

  var API_BASE = "https://subtle-galliform-d9e89d1ceff81bc.api.tcloudbasegateway.com";
  var DEVICE_KEY = "nn29_photo_device_v1";
  var MAX_SIZE = 8 * 1024 * 1024;
  var token = "";
  var originalData = "";
  var previewData = "";
  var selectedFile = null;

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
    toast.timer = setTimeout(function () { el.classList.remove("is-on"); }, 3000);
  }

  async function getToken(force) {
    if (token && !force) return token;
    var res = await fetch(API_BASE + "/auth/v1/signin/anonymously", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId() },
      body: "{}"
    });
    if (!res.ok) throw new Error("投稿服务暂时不可用");
    var data = await res.json();
    if (!data.access_token) throw new Error("投稿服务暂时不可用");
    token = data.access_token;
    return token;
  }

  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("图片读取失败")); };
      reader.onload = function () { resolve(reader.result); };
      reader.readAsDataURL(file);
    });
  }

  function compressPreview(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onerror = function () { reject(new Error("图片解析失败")); };
      img.onload = function () {
        var max = 1200;
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w > max || h > max) {
          var scale = Math.min(max / w, max / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = dataUrl;
    });
  }

  async function submitPhoto(payload) {
    var t = await getToken();
    var res = await fetch(API_BASE + "/v1/rdb/rest/rpc/create_photo_submission", {
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

  var form = document.getElementById("photo-form");
  if (!form) return;
  var fileInput = document.getElementById("p-file");
  var errorEl = document.getElementById("p-file-err");
  var preview = document.getElementById("p-preview");
  var previewImg = document.getElementById("p-preview-img");
  var fileName = document.getElementById("p-file-name");
  var fileSize = document.getElementById("p-file-size");
  var success = document.getElementById("p-success");
  var submitBtn = document.getElementById("p-submit");

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  fileInput.addEventListener("change", async function () {
    var file = fileInput.files && fileInput.files[0];
    if (errorEl) errorEl.textContent = "";
    if (success) success.hidden = true;
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      if (errorEl) errorEl.textContent = "请选择图片文件。";
      fileInput.value = "";
      return;
    }
    if (file.size > MAX_SIZE) {
      if (errorEl) errorEl.textContent = "这张图片超过 8MB，请先换一张更小的原图。";
      fileInput.value = "";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "读取原图…";
    try {
      originalData = await readAsDataURL(file);
      previewData = await compressPreview(originalData);
      selectedFile = file;
      if (previewImg) previewImg.src = previewData;
      if (preview) preview.hidden = false;
      if (fileName) fileName.textContent = file.name;
      if (fileSize) fileSize.textContent = formatSize(file.size) + " · 原图不压缩";
    } catch (err) {
      originalData = "";
      previewData = "";
      selectedFile = null;
      if (errorEl) errorEl.textContent = err.message || "图片读取失败，请换一张。";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "提交投稿";
    }
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";
    if (success) success.hidden = true;
    if (!selectedFile || !originalData || !previewData) {
      if (errorEl) errorEl.textContent = "请先选择一张图片。";
      return;
    }
    var consent = document.getElementById("p-consent");
    if (!consent.checked) {
      if (errorEl) errorEl.textContent = "请先确认照片由你拍摄或已获得授权。";
      return;
    }
    var name = (document.getElementById("p-name").value || "").trim();
    var caption = (document.getElementById("p-caption").value || "").trim();
    submitBtn.disabled = true;
    submitBtn.textContent = "上传中…";
    try {
      await submitPhoto({
        p_submitter: name,
        p_caption: caption,
        p_filename: selectedFile.name,
        p_mime: selectedFile.type,
        p_size: selectedFile.size,
        p_preview: previewData,
        p_image: originalData
      });
      form.reset();
      selectedFile = null;
      originalData = "";
      previewData = "";
      if (preview) preview.hidden = true;
      if (success) success.hidden = false;
      toast("投稿已提交，管理员会在后台看到原图");
    } catch (err) {
      if (errorEl) errorEl.textContent = "提交失败：" + (err.message || "请稍后重试");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "提交投稿";
    }
  });
})();
