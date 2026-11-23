(function () {
  "use strict";

  var API_BASE = "https://subtle-galliform-d9e89d1ceff81bc.api.tcloudbasegateway.com";
  var ID_KEY = "nn29_community_id_v1";
  var DEVICE_KEY = "nn29_community_device_v1";
  var MAX_IMAGES = 3;
  var MAX_TEXT = 800;
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  var state = {
    posts: [],
    cat: "all",
    sort: "latest",
    images: [],
    loading: false,
    token: "",
    error: ""
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function nl2br(value) {
    return esc(value).replace(/\n/g, "<br>");
  }

  function code() {
    var out = "";
    for (var i = 0; i < 6; i++) out += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    return out;
  }

  function getAnonId() {
    var id = "";
    try { id = localStorage.getItem(ID_KEY) || ""; } catch (e) {}
    if (!/^学生[A-Z2-9]{6}$/.test(id)) {
      id = "学生" + code();
      try { localStorage.setItem(ID_KEY, id); } catch (e) {}
    }
    return id;
  }

  function setAnonId(id) {
    try { localStorage.setItem(ID_KEY, id); } catch (e) {}
    syncAnonId();
  }

  function getDeviceId() {
    var id = "";
    try { id = localStorage.getItem(DEVICE_KEY) || ""; } catch (e) {}
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "dev-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    }
    return id;
  }

  function avatarColor(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return "linear-gradient(135deg, hsl(" + h + " 62% 48%), hsl(" + ((h + 38) % 360) + " 74% 62%))";
  }

  function syncAnonId() {
    var id = getAnonId();
    var avatars = doc.querySelectorAll("[data-avatar]");
    for (var i = 0; i < avatars.length; i++) {
      avatars[i].textContent = "学";
      avatars[i].style.background = avatarColor(id);
    }
    var names = doc.querySelectorAll("[data-anon-name]");
    for (var j = 0; j < names.length; j++) names[j].textContent = id;
  }

  var doc = document;

  function toast(text) {
    var el = doc.querySelector(".toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove("is-on"); }, 2800);
  }

  function timeAgo(value) {
    var ts = typeof value === "number" ? value : Date.parse(value);
    if (!ts || Number.isNaN(ts)) return "";
    var diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
    if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + " 天前";
    var d = new Date(ts);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  async function getToken(force) {
    if (state.token && !force) return state.token;
    var res = await fetch(API_BASE + "/auth/v1/signin/anonymously", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
      body: "{}"
    });
    var body = await res.text();
    if (!res.ok) throw new Error("匿名登录失败");
    var data = JSON.parse(body);
    if (!data.access_token) throw new Error("匿名登录未返回 token");
    state.token = data.access_token;
    return state.token;
  }

  async function api(path, options, retried) {
    var token = await getToken();
    var opts = options || {};
    opts.headers = Object.assign({}, opts.headers || {}, { Authorization: "Bearer " + token });
    var res = await fetch(API_BASE + path, opts);
    if (res.status === 401 && !retried) {
      state.token = "";
      await getToken(true);
      return api(path, options, true);
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

  function normalizePost(row) {
    return {
      id: row.id,
      anon: row.anon_name,
      cat: row.category,
      title: row.title || "",
      text: row.content || "",
      images: Array.isArray(row.images) ? row.images : [],
      isAdmin: row.is_admin === true,
      createdAt: Date.parse(row.created_at) || Date.now(),
      replies: []
    };
  }

  async function loadFeed() {
    state.loading = true;
    state.error = "";
    render();
    try {
      var posts = await api("/v1/rdb/rest/community_posts?select=id,anon_name,category,title,content,images,is_admin,created_at&status=eq.approved&order=created_at.desc&limit=50");
      var replies = await api("/v1/rdb/rest/community_replies?select=id,post_id,anon_name,content,created_at&status=eq.approved&order=created_at.asc&limit=300");
      var byPost = {};
      (replies || []).forEach(function (reply) {
        var id = reply.post_id;
        if (!byPost[id]) byPost[id] = [];
        byPost[id].push({
          id: reply.id,
          anon: reply.anon_name,
          text: reply.content,
          createdAt: Date.parse(reply.created_at) || Date.now()
        });
      });
      state.posts = (posts || []).map(function (row) {
        var post = normalizePost(row);
        post.replies = byPost[post.id] || [];
        return post;
      });
    } catch (err) {
      state.posts = [];
      state.error = err && err.message ? err.message : "加载失败";
      toast("讨论区加载失败：" + state.error);
    } finally {
      state.loading = false;
      render();
    }
  }

  function postImagesHtml(images) {
    if (!images || !images.length) return "";
    var cls = images.length === 1 ? " post__images--one" : images.length === 2 ? " post__images--two" : "";
    return '<div class="post__images' + cls + '">' + images.map(function (src) {
      return '<img src="' + esc(src) + '" alt="帖子配图" loading="lazy" data-img="' + esc(src) + '">';
    }).join("") + "</div>";
  }

  function repliesHtml(post) {
    return (post.replies || []).map(function (reply) {
      return '<div class="reply"><strong>' + esc(reply.anon) + '</strong><time>' + esc(timeAgo(reply.createdAt)) + '</time><br>' + nl2br(reply.text) + "</div>";
    }).join("");
  }

  function postHtml(post) {
    return '<article class="post" data-post="' + esc(post.id) + '">' +
      '<div class="post__head">' +
        '<span class="anon-avatar" style="background:' + avatarColor(post.anon) + '" aria-hidden="true">学</span>' +
        '<div class="post__meta"><strong>' + esc(post.anon) + (post.isAdmin ? ' <span class="post__admin-badge">管理员</span>' : '') + '</strong><span>' + esc(post.cat) + " · " + esc(timeAgo(post.createdAt)) + '</span></div>' +
        '<button class="post__report" type="button" data-report="' + esc(post.id) + '">举报</button>' +
      '</div>' +
      (post.title ? '<h3 class="post__title">' + esc(post.title) + '</h3>' : "") +
      (post.text ? '<p class="post__text">' + nl2br(post.text) + '</p>' : "") +
      postImagesHtml(post.images) +
      '<div class="post__foot">' +
        '<button type="button" data-focus-reply="' + esc(post.id) + '">回复 ' + ((post.replies || []).length || "") + '</button>' +
      '</div>' +
      '<div class="replies">' + repliesHtml(post) + '</div>' +
      '<form class="reply-form" data-reply="' + esc(post.id) + '">' +
        '<input type="text" maxlength="200" placeholder="匿名回复一句…" aria-label="回复内容" autocomplete="off">' +
        '<button type="submit">回复</button>' +
      '</form>' +
    '</article>';
  }

  function visiblePosts() {
    var posts = state.posts.slice();
    if (state.cat !== "all") posts = posts.filter(function (p) { return p.cat === state.cat; });
    if (state.sort === "hot") {
      posts.sort(function (a, b) { return (b.replies || []).length - (a.replies || []).length; });
    } else {
      posts.sort(function (a, b) { return b.createdAt - a.createdAt; });
    }
    return posts;
  }

  function render() {
    var list = doc.getElementById("post-list");
    var empty = doc.getElementById("community-empty");
    var count = doc.getElementById("post-count");
    var head = doc.querySelector(".feed-head h2");
    var posts = visiblePosts();
    if (count) count.textContent = state.loading ? "加载中…" : posts.length + " 条讨论";
    if (head) head.textContent = "大家在聊";
    if (!list) return;
    if (state.loading) {
      list.innerHTML = '<div class="community-loading">正在加载讨论…</div>';
      if (empty) empty.hidden = true;
      return;
    }
    list.innerHTML = posts.map(postHtml).join("");
    if (empty) {
      empty.hidden = posts.length !== 0;
      var strong = empty.querySelector("strong");
      var p = empty.querySelector("p");
      if (state.error) {
        if (strong) strong.textContent = "暂时没能加载讨论区。";
        if (p) p.textContent = state.error + "，请稍后刷新。";
      } else {
        if (strong) strong.textContent = "还没有通过审核的帖子。";
        if (p) p.textContent = "你提交的内容会先进入审核队列，通过后才会出现在这里。";
      }
    }
  }

  function resetComposer() {
    var form = doc.getElementById("post-form");
    if (form) form.reset();
    state.images = [];
    renderPreviews();
    var hint = doc.getElementById("image-hint");
    if (hint) hint.textContent = "最多 3 张，自动压缩";
  }

  function renderPreviews() {
    var wrap = doc.getElementById("image-previews");
    if (!wrap) return;
    wrap.innerHTML = state.images.map(function (src, i) {
      return '<span class="preview"><img src="' + src + '" alt="待发布图片"><button type="button" data-remove-image="' + i + '" aria-label="移除图片">×</button></span>';
    }).join("");
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("not-image"));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("read-failed")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("decode-failed")); };
        img.onload = function () {
          var max = 900;
          var w = img.naturalWidth;
          var h = img.naturalHeight;
          if (w > max || h > max) {
            var scale = Math.min(max / w, max / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          var canvas = doc.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = label || "提交中…";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || "发布";
      button.disabled = false;
    }
  }

  function bind() {
    syncAnonId();
    var form = doc.getElementById("post-form");
    if (form) form.setAttribute("novalidate", "novalidate");

    var change = doc.getElementById("change-id");
    if (change) {
      change.addEventListener("click", function () {
        if (!window.confirm("换一个匿名身份？之前发的帖子仍显示旧编号。")) return;
        setAnonId("学生" + code());
        toast("已换新身份：" + getAnonId());
      });
    }

    var input = doc.getElementById("image-input");
    if (input) {
      input.addEventListener("change", function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.value = "";
        if (!files.length) return;
        var room = MAX_IMAGES - state.images.length;
        if (room <= 0) { toast("最多只能放 3 张图片"); return; }
        files.slice(0, room).forEach(function (file) {
          if (file.size > 8 * 1024 * 1024) { toast("单张图片不要超过 8MB"); return; }
          compressImage(file).then(function (src) {
            if (state.images.length >= MAX_IMAGES) return;
            state.images.push(src);
            renderPreviews();
            var hint = doc.getElementById("image-hint");
            if (hint) hint.textContent = "已选 " + state.images.length + " / 3 张";
          }).catch(function () { toast("这张图片读取失败，换一张试试"); });
        });
      });
    }

    var previews = doc.getElementById("image-previews");
    if (previews) {
      previews.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-remove-image]");
        if (!btn) return;
        state.images.splice(Number(btn.getAttribute("data-remove-image")), 1);
        renderPreviews();
        var hint = doc.getElementById("image-hint");
        if (hint) hint.textContent = "已选 " + state.images.length + " / 3 张";
      });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var titleEl = doc.getElementById("post-title");
        var bodyEl = doc.getElementById("post-content");
        var catEl = doc.getElementById("post-category");
        var title = (titleEl.value || "").trim();
        var text = (bodyEl.value || "").trim();
        if (!text && !state.images.length) {
          toast("写点什么，或者放一张图片吧");
          bodyEl.focus();
          return;
        }
        if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
        var button = form.querySelector(".composer__submit");
        setBusy(button, true, "提交中…");
        try {
          await api("/v1/rdb/rest/rpc/create_community_post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              p_anon_name: getAnonId(),
              p_category: catEl ? catEl.value : "校园日常",
              p_title: title,
              p_content: text,
              p_images: state.images.slice()
            })
          });
          resetComposer();
          toast("已提交审核，通过后才会公开");
        } catch (err) {
          toast("提交失败：" + (err && err.message ? err.message : "请稍后重试"));
        } finally {
          setBusy(button, false, "发布");
        }
      });
    }

    var tabs = doc.querySelectorAll(".community-tabs button");
    Array.prototype.forEach.call(tabs, function (btn) {
      btn.addEventListener("click", function () {
        state.cat = btn.getAttribute("data-cat") || "all";
        syncToolbar();
        render();
      });
    });

    var sorts = doc.querySelectorAll(".community-sort button");
    Array.prototype.forEach.call(sorts, function (btn) {
      btn.addEventListener("click", function () {
        state.sort = btn.getAttribute("data-sort") || "latest";
        syncToolbar();
        render();
      });
    });

    var list = doc.getElementById("post-list");
    if (list) {
      list.addEventListener("click", function (e) {
        var report = e.target.closest("[data-report]");
        if (report) { toast("举报功能还在建设中，请先联系管理员"); return; }
        var focusReply = e.target.closest("[data-focus-reply]");
        if (focusReply) {
          var article = focusReply.closest(".post");
          var field = article ? article.querySelector(".reply-form input") : null;
          if (field) field.focus();
          return;
        }
        var img = e.target.closest("[data-img]");
        if (img) openLightbox(img.getAttribute("data-img"));
      });

      list.addEventListener("submit", async function (e) {
        var form = e.target.closest("[data-reply]");
        if (!form) return;
        e.preventDefault();
        var postId = form.getAttribute("data-reply");
        var input = form.querySelector("input");
        var text = (input.value || "").trim();
        if (!text) { input.focus(); return; }
        var button = form.querySelector("button");
        setBusy(button, true, "提交中…");
        try {
          await api("/v1/rdb/rest/rpc/create_community_reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ p_post_id: postId, p_anon_name: getAnonId(), p_content: text })
          });
          input.value = "";
          toast("回复已提交审核，通过后才会公开");
        } catch (err) {
          toast("回复失败：" + (err && err.message ? err.message : "请稍后重试"));
        } finally {
          setBusy(button, false, "回复");
        }
      });
    }

    var lightbox = doc.getElementById("lightbox");
    if (lightbox) {
      lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox || e.target.closest(".community-lightbox__close")) closeLightbox();
      });
      doc.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeLightbox();
      });
    }

    var refresh = doc.getElementById("refresh-feed");
    if (refresh) refresh.addEventListener("click", loadFeed);

    syncToolbar();
    loadFeed();
  }

  function syncToolbar() {
    var tabs = doc.querySelectorAll(".community-tabs button");
    Array.prototype.forEach.call(tabs, function (btn) {
      var active = btn.getAttribute("data-cat") === state.cat;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    var sorts = doc.querySelectorAll(".community-sort button");
    Array.prototype.forEach.call(sorts, function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-sort") === state.sort);
    });
  }

  function openLightbox(src) {
    var box = doc.getElementById("lightbox");
    if (!box) return;
    var img = box.querySelector("img");
    if (img) img.src = src;
    box.classList.add("is-on");
    box.setAttribute("aria-hidden", "false");
    doc.body.classList.add("is-locked");
  }

  function closeLightbox() {
    var box = doc.getElementById("lightbox");
    if (!box) return;
    box.classList.remove("is-on");
    box.setAttribute("aria-hidden", "true");
    doc.body.classList.remove("is-locked");
  }

  bind();
})();
