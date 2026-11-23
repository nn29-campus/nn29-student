(function () {
  "use strict";

  var API_BASE = "https://subtle-galliform-d9e89d1ceff81bc.api.tcloudbasegateway.com";
  var PASS_KEY = "nn29_admin_pass";
  var DEVICE_KEY = "nn29_admin_device_v1";
  var state = { token: "", pass: "", loading: false, approvedLoading: false, photosLoading: false, posts: [], replies: [], feedback: [], approved: [], photos: [], tab: "pending" };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function nl2br(value) {
    return esc(value).replace(/\n/g, "<br>");
  }

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
    toast.timer = setTimeout(function () { el.classList.remove("is-on"); }, 2600);
  }

  function timeAgo(value) {
    var ts = Date.parse(value);
    if (!ts || Number.isNaN(ts)) return "";
    var diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
    var d = new Date(ts);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  async function getToken(force) {
    if (state.token && !force) return state.token;
    var res = await fetch(API_BASE + "/auth/v1/signin/anonymously", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": deviceId() },
      body: "{}"
    });
    if (!res.ok) throw new Error("匿名登录失败");
    var data = await res.json();
    if (!data.access_token) throw new Error("匿名登录失败");
    state.token = data.access_token;
    return state.token;
  }

  async function api(path, body, retried) {
    var token = await getToken();
    var res = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body || {})
    });
    if (res.status === 401 && !retried) {
      state.token = "";
      await getToken(true);
      return api(path, body, true);
    }
    var text = await res.text();
    if (!res.ok) {
      var message = "请求失败";
      try {
        var parsed = JSON.parse(text);
        message = parsed.message || parsed.error_description || parsed.error || message;
      } catch (e) {}
      throw new Error(message);
    }
    return text ? JSON.parse(text) : null;
  }

  function imageHtml(images) {
    if (!images || !images.length) return "";
    return '<div class="admin-images">' + images.slice(0, 3).map(function (src) {
      return '<img src="' + esc(src) + '" alt="待审核图片">';
    }).join("") + "</div>";
  }

  function postHtml(post) {
    return '<article class="admin-item" data-kind="post" data-id="' + esc(post.id) + '">' +
      '<div class="admin-item__head"><div><span class="admin-type">帖子</span><strong>' + esc(post.anon_name) + '</strong></div><time>' + esc(timeAgo(post.created_at)) + '</time></div>' +
      (post.title ? '<h3>' + esc(post.title) + '</h3>' : "") +
      '<p>' + nl2br(post.content) + '</p>' +
      imageHtml(post.images) +
      '<div class="admin-item__meta">' + esc(post.category) + '</div>' +
      '<div class="admin-item__actions">' +
        '<button type="button" class="admin-approve" data-action="approve">通过</button>' +
        '<button type="button" class="admin-reject" data-action="reject">拒绝</button>' +
      '</div>' +
    '</article>';
  }

  function replyHtml(reply) {
    return '<article class="admin-item admin-item--reply" data-kind="reply" data-id="' + esc(reply.id) + '">' +
      '<div class="admin-item__head"><div><span class="admin-type">回复</span><strong>' + esc(reply.anon_name) + '</strong></div><time>' + esc(timeAgo(reply.created_at)) + '</time></div>' +
      '<p>' + nl2br(reply.content) + '</p>' +
      '<div class="admin-item__meta">回复：' + esc(reply.post_title || "（帖子）") + '</div>' +
      '<div class="admin-item__actions">' +
        '<button type="button" class="admin-approve" data-action="approve">通过</button>' +
        '<button type="button" class="admin-reject" data-action="reject">拒绝</button>' +
      '</div>' +
    '</article>';
  }

  function feedbackHtml(item) {
    var done = item.status === "resolved";
    return '<article class="admin-item admin-item--feedback" data-kind="feedback" data-id="' + esc(item.id) + '">' +
      '<div class="admin-item__head"><div><span class="admin-type">反馈</span><strong>' + esc(item.category) + (done ? ' <span class="admin-done-badge">已处理</span>' : '') + '</strong></div><time>' + esc(timeAgo(item.created_at)) + '</time></div>' +
      '<p>' + nl2br(item.content) + '</p>' +
      '<div class="admin-item__meta">' + (item.contact ? "联系方式：" + esc(item.contact) : "未留联系方式") + '</div>' +
      '<div class="admin-item__actions">' +
        (done ? '' : '<button type="button" class="admin-approve" data-action="resolve">标记已处理</button>') +
        '<button type="button" class="admin-reject" data-action="delete">删除</button>' +
      '</div>' +
    '</article>';
  }

  function approvedHtml(post) {
    return '<article class="admin-item" data-approved-id="' + esc(post.id) + '">' +
      '<div class="admin-item__head"><div><span class="admin-type">已通过</span><strong>' + esc(post.anon_name) + (post.is_admin ? ' · 网站管理员' : '') + (post.is_pinned ? ' <span class="admin-pin-badge">置顶</span>' : '') + '</strong></div><time>' + esc(timeAgo(post.created_at)) + '</time></div>' +
      (post.title ? '<h3>' + esc(post.title) + '</h3>' : "") +
      '<p>' + nl2br(post.content) + '</p>' +
      imageHtml(post.images) +
      '<div class="admin-item__meta">' + esc(post.category) + '</div>' +
      '<div class="admin-item__actions">' +
        (post.is_admin ? '<button type="button" class="admin-approve" data-pin-post="' + esc(post.id) + '" data-pinned="' + (post.is_pinned ? "true" : "false") + '">' + (post.is_pinned ? "取消置顶" : "置顶") + '</button>' : '') +
        '<button type="button" class="admin-delete" data-delete-post="' + esc(post.id) + '">删除帖子</button>' +
      '</div>' +
    '</article>';
  }

  function renderApproved() {
    var list = document.getElementById("admin-posts-list");
    var empty = document.getElementById("admin-posts-empty");
    var count = document.getElementById("admin-posts-count");
    var tabCount = document.getElementById("tab-posts-count");
    if (count) count.textContent = state.approved.length;
    if (tabCount) tabCount.textContent = state.approved.length;
    if (!list) return;
    if (state.approvedLoading) {
      list.innerHTML = '<div class="admin-loading">正在读取已通过帖子…</div>';
      if (empty) empty.hidden = true;
      return;
    }
    list.innerHTML = state.approved.map(approvedHtml).join("");
    if (empty) empty.hidden = state.approved.length !== 0;
  }

  function photoHtml(photo) {
    var selected = photo.status === "selected";
    return '<article class="admin-photo" data-photo-id="' + esc(photo.id) + '">' +
      '<img src="' + esc(photo.preview_data) + '" alt="投稿预览" loading="lazy">' +
      '<div class="admin-photo__body">' +
        '<div class="admin-photo__head"><strong>' + esc(photo.submitter || "匿名同学") + '</strong><span class="' + (selected ? "is-selected" : "") + '">' + (selected ? "已选中" : "待筛选") + '</span></div>' +
        '<p>' + esc(photo.caption || "未写图片说明") + '</p>' +
        '<small>' + esc(photo.filename) + ' · ' + Math.round((photo.size_bytes || 0) / 1024) + ' KB · 原图</small>' +
        '<div class="admin-photo__actions">' +
          '<button type="button" class="admin-approve" data-photo-status="' + (selected ? "pending" : "selected") + '">' + (selected ? "取消选中" : "选中展示") + '</button>' +
          '<button type="button" class="admin-download" data-download-photo="' + esc(photo.id) + '">下载原图</button>' +
          '<button type="button" class="admin-delete" data-delete-photo="' + esc(photo.id) + '">删除</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderPhotos() {
    var list = document.getElementById("admin-photo-list");
    var empty = document.getElementById("admin-photo-empty");
    var count = document.getElementById("admin-photos-count");
    var tabCount = document.getElementById("tab-photos-count");
    var total = state.photos.length;
    if (count) count.textContent = total;
    if (tabCount) tabCount.textContent = total;
    if (!list) return;
    if (state.photosLoading) {
      list.innerHTML = '<div class="admin-loading">正在读取投稿…</div>';
      if (empty) empty.hidden = true;
      return;
    }
    list.innerHTML = state.photos.map(photoHtml).join("");
    if (empty) empty.hidden = total !== 0;
  }

  function render() {
    var list = document.getElementById("admin-list");
    var empty = document.getElementById("admin-empty");
    var count = document.getElementById("admin-count");
    var total = state.posts.length + state.replies.length;
    if (count) count.textContent = total;
    var tabPending = document.getElementById("tab-pending-count");
    if (tabPending) tabPending.textContent = total;
    if (!list) return;
    if (state.loading) {
      list.innerHTML = '<div class="admin-loading">正在读取待审核内容…</div>';
      if (empty) empty.hidden = true;
      return;
    }
    list.innerHTML = state.posts.map(postHtml).join("") + state.replies.map(replyHtml).join("");
    renderFeedback();
    if (empty) empty.hidden = total !== 0;
  }

  function renderFeedback() {
    var list = document.getElementById("admin-feedback-list");
    var empty = document.getElementById("admin-feedback-empty");
    var count = document.getElementById("admin-feedback-count");
    var tabCount = document.getElementById("tab-feedback-count");
    var total = state.feedback.length;
    if (count) count.textContent = total;
    if (tabCount) tabCount.textContent = total;
    if (!list) return;
    list.innerHTML = state.feedback.map(feedbackHtml).join("");
    if (empty) empty.hidden = total !== 0;
  }

  async function loadPending() {
    if (!state.pass) return;
    state.loading = true;
    render();
    try {
      var data = await api("/v1/rdb/rest/rpc/admin_list_pending", { p_pass: state.pass });
      state.posts = (data && data.posts) || [];
      state.replies = (data && data.replies) || [];
      state.feedback = (data && data.feedback) || [];
    } catch (err) {
      state.posts = [];
      state.replies = [];
      state.feedback = [];
      if (String(err.message).toLowerCase().indexOf("forbidden") !== -1) {
        state.pass = "";
        sessionStorage.removeItem(PASS_KEY);
        showLogin("口令不正确，请重新输入。");
      } else {
        toast("读取失败：" + (err.message || "请稍后重试"));
      }
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadApproved() {
    if (!state.pass) return;
    state.approvedLoading = true;
    renderApproved();
    try {
      var data = await api("/v1/rdb/rest/rpc/admin_list_posts", { p_pass: state.pass });
      state.approved = Array.isArray(data) ? data : [];
    } catch (err) {
      state.approved = [];
      toast("读取已通过帖子失败：" + (err.message || "请稍后重试"));
    } finally {
      state.approvedLoading = false;
      renderApproved();
    }
  }

  async function loadPhotos() {
    if (!state.pass) return;
    state.photosLoading = true;
    renderPhotos();
    try {
      var data = await api("/v1/rdb/rest/rpc/admin_list_photos", { p_pass: state.pass });
      state.photos = Array.isArray(data) ? data : [];
    } catch (err) {
      state.photos = [];
      toast("读取图片投稿失败：" + (err.message || "请稍后重试"));
    } finally {
      state.photosLoading = false;
      renderPhotos();
    }
  }

  function showLogin(message) {
    document.getElementById("admin-login").hidden = false;
    document.getElementById("admin-panel").hidden = true;
    var hint = document.getElementById("admin-hint");
    if (hint) hint.textContent = message || "";
    var input = document.getElementById("admin-pass");
    if (input) setTimeout(function () { input.focus(); }, 100);
  }

  function showPanel() {
    document.getElementById("admin-login").hidden = true;
    document.getElementById("admin-panel").hidden = false;
  }

  function bind() {
    var form = document.getElementById("admin-login");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = document.getElementById("admin-pass");
        var pass = (input.value || "").trim();
        if (!pass) { input.focus(); return; }
        state.pass = pass;
        sessionStorage.setItem(PASS_KEY, pass);
        showPanel();
        loadPending();
        loadApproved();
        loadPhotos();
      });
    }

    var refresh = document.getElementById("admin-refresh");
    if (refresh) refresh.addEventListener("click", loadPending);
    var postsRefresh = document.getElementById("admin-posts-refresh");
    if (postsRefresh) postsRefresh.addEventListener("click", loadApproved);
    var feedbackRefresh = document.getElementById("admin-feedback-refresh");
    if (feedbackRefresh) feedbackRefresh.addEventListener("click", loadPending);
    var photosRefresh = document.getElementById("admin-photos-refresh");
    if (photosRefresh) photosRefresh.addEventListener("click", loadPhotos);

    var tabs = document.querySelectorAll("[data-admin-tab]");
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab.getAttribute("data-admin-tab"));
        if (tab.getAttribute("data-admin-tab") === "posts") loadApproved();
        if (tab.getAttribute("data-admin-tab") === "photos") loadPhotos();
      });
    });

    var logout = document.getElementById("admin-logout");
    if (logout) {
      logout.addEventListener("click", function () {
        state.pass = "";
        state.posts = [];
        state.replies = [];
        state.feedback = [];
        state.approved = [];
        state.photos = [];
        sessionStorage.removeItem(PASS_KEY);
        showLogin("已退出审核台。");
      });
    }

    var list = document.getElementById("admin-list");
    if (list) {
      list.addEventListener("click", async function (e) {
        var btn = e.target.closest("[data-action]");
        if (!btn) return;
        var item = btn.closest(".admin-item");
        if (!item) return;
        var kind = item.getAttribute("data-kind");
        var id = item.getAttribute("data-id");
        var action = btn.getAttribute("data-action");
        var status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "resolve" ? "resolved" : "deleted";
        if (action === "delete" && !window.confirm("删除这条反馈？删除后后台不再显示。")) return;
        var buttons = item.querySelectorAll("button");
        Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
        try {
          await api("/v1/rdb/rest/rpc/admin_moderate", {
            p_pass: state.pass,
            p_kind: kind,
            p_id: id,
            p_status: status
          });
          item.remove();
          if (kind === "post") state.posts = state.posts.filter(function (p) { return p.id !== id; });
          else if (kind === "reply") state.replies = state.replies.filter(function (r) { return r.id !== id; });
          else state.feedback = state.feedback.filter(function (f) { return f.id !== id; });
          render();
          if (kind === "feedback") toast(status === "resolved" ? "反馈已标记为已处理" : "反馈已删除");
          else toast(status === "approved" ? "已通过，内容现在会公开" : "已拒绝，内容不会公开");
        } catch (err) {
          Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
          toast("操作失败：" + (err.message || "请稍后重试"));
        }
      });
    }

    var approvedList = document.getElementById("admin-posts-list");
    if (approvedList) {
      approvedList.addEventListener("click", async function (e) {
        var pinBtn = e.target.closest("[data-pin-post]");
        if (pinBtn) {
          var pinId = pinBtn.getAttribute("data-pin-post");
          var nextPinned = pinBtn.getAttribute("data-pinned") !== "true";
          pinBtn.disabled = true;
          try {
            await api("/v1/rdb/rest/rpc/admin_set_pin", { p_pass: state.pass, p_id: pinId, p_pinned: nextPinned });
            await loadApproved();
            toast(nextPinned ? "已置顶" : "已取消置顶");
          } catch (err) {
            pinBtn.disabled = false;
            toast("操作失败：" + (err.message || "请稍后重试"));
          }
          return;
        }
        var btn = e.target.closest("[data-delete-post]");
        if (!btn) return;
        if (!window.confirm("删除这条帖子？帖子和回复会一起删除，无法恢复。")) return;
        var id = btn.getAttribute("data-delete-post");
        var item = btn.closest(".admin-item");
        btn.disabled = true;
        try {
          await api("/v1/rdb/rest/rpc/admin_delete_post", { p_pass: state.pass, p_id: id });
          state.approved = state.approved.filter(function (p) { return p.id !== id; });
          if (item) item.remove();
          renderApproved();
          toast("帖子已删除");
        } catch (err) {
          btn.disabled = false;
          toast("删除失败：" + (err.message || "请稍后重试"));
        }
      });
    }

    var compose = document.getElementById("admin-compose-form");
    if (compose) {
      compose.addEventListener("submit", async function (e) {
        e.preventDefault();
        var title = (document.getElementById("admin-post-title").value || "").trim();
        var category = document.getElementById("admin-post-category").value;
        var content = (document.getElementById("admin-post-content").value || "").trim();
        var hint = document.getElementById("admin-post-hint");
        var button = document.getElementById("admin-post-submit");
        if (hint) hint.textContent = "";
        if (!content) {
          if (hint) hint.textContent = "请写一点内容再发布。";
          return;
        }
        button.disabled = true;
        button.textContent = "发布中…";
        try {
          await api("/v1/rdb/rest/rpc/admin_create_post", {
            p_pass: state.pass,
            p_category: category,
            p_title: title,
            p_content: content,
            p_images: [],
            p_pinned: document.getElementById("admin-post-pinned").checked
          });
          compose.reset();
          toast("已发布，所有同学都能看到");
          switchTab("posts");
          loadApproved();
        } catch (err) {
          if (hint) hint.textContent = "发布失败：" + (err.message || "请稍后重试");
        } finally {
          button.disabled = false;
          button.textContent = "发布信息";
        }
      });
    }

    function switchTab(name) {
      state.tab = name;
      var panes = document.querySelectorAll("[data-admin-panel]");
      Array.prototype.forEach.call(panes, function (pane) {
        pane.hidden = pane.getAttribute("data-admin-panel") !== name;
      });
      var allTabs = document.querySelectorAll("[data-admin-tab]");
      Array.prototype.forEach.call(allTabs, function (tab) {
        var active = tab.getAttribute("data-admin-tab") === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    var feedbackList = document.getElementById("admin-feedback-list");
    if (feedbackList) {
      feedbackList.addEventListener("click", async function (e) {
        var btn = e.target.closest("[data-action]");
        if (!btn) return;
        var item = btn.closest(".admin-item");
        if (!item) return;
        var id = item.getAttribute("data-id");
        var action = btn.getAttribute("data-action");
        var status = action === "resolve" ? "resolved" : "deleted";
        if (action === "delete" && !window.confirm("删除这条反馈？删除后后台不再显示。")) return;
        var buttons = item.querySelectorAll("button");
        Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
        try {
          await api("/v1/rdb/rest/rpc/admin_moderate", { p_pass: state.pass, p_kind: "feedback", p_id: id, p_status: status });
          state.feedback = state.feedback.filter(function (f) { return f.id !== id; });
          item.remove();
          renderFeedback();
          toast(status === "resolved" ? "反馈已标记为已处理" : "反馈已删除");
        } catch (err) {
          Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
          toast("操作失败：" + (err.message || "请稍后重试"));
        }
      });
    }

    var photoList = document.getElementById("admin-photo-list");
    if (photoList) {
      photoList.addEventListener("click", async function (e) {
        var statusBtn = e.target.closest("[data-photo-status]");
        if (statusBtn) {
          var card = statusBtn.closest("[data-photo-id]");
          var photoId = card.getAttribute("data-photo-id");
          var next = statusBtn.getAttribute("data-photo-status");
          statusBtn.disabled = true;
          try {
            await api("/v1/rdb/rest/rpc/admin_set_photo_status", { p_pass: state.pass, p_id: photoId, p_status: next });
            await loadPhotos();
            toast(next === "selected" ? "已选中，会出现在校园图片页" : "已取消选中");
          } catch (err) {
            statusBtn.disabled = false;
            toast("操作失败：" + (err.message || "请稍后重试"));
          }
          return;
        }
        var downloadBtn = e.target.closest("[data-download-photo]");
        if (downloadBtn) {
          var downloadId = downloadBtn.getAttribute("data-download-photo");
          downloadBtn.disabled = true;
          downloadBtn.textContent = "读取中…";
          try {
            var original = await api("/v1/rdb/rest/rpc/admin_get_photo_original", { p_pass: state.pass, p_id: downloadId });
            var link = document.createElement("a");
            link.href = original.image_data;
            link.download = original.filename || "photo.jpg";
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast("已开始下载原图");
          } catch (err) {
            toast("下载失败：" + (err.message || "请稍后重试"));
          } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = "下载原图";
          }
          return;
        }
        var deleteBtn = e.target.closest("[data-delete-photo]");
        if (deleteBtn) {
          if (!window.confirm("删除这张投稿？原图也会一起删除，无法恢复。")) return;
          var deleteId = deleteBtn.getAttribute("data-delete-photo");
          deleteBtn.disabled = true;
          try {
            await api("/v1/rdb/rest/rpc/admin_delete_photo", { p_pass: state.pass, p_id: deleteId });
            state.photos = state.photos.filter(function (p) { return p.id !== deleteId; });
            renderPhotos();
            toast("投稿已删除");
          } catch (err) {
            deleteBtn.disabled = false;
            toast("删除失败：" + (err.message || "请稍后重试"));
          }
        }
      });
    }

    var saved = "";
    try { saved = sessionStorage.getItem(PASS_KEY) || ""; } catch (e) {}
    if (saved) {
      state.pass = saved;
      showPanel();
      loadPending();
      loadApproved();
      loadPhotos();
    } else {
      showLogin("");
    }
  }

  bind();
})();
