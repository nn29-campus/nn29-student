(function () {
  "use strict";

  var doc = document;
  var ID_KEY = "nn29_community_id_v1";
  var POSTS_KEY = "nn29_community_posts_v1";
  var MAX_IMAGES = 3;
  var MAX_TEXT = 800;
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  var state = {
    posts: [],
    cat: "all",
    sort: "latest",
    images: []
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function nl2br(value) {
    return esc(value).replace(/\n/g, "<br>");
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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

  function toast(text) {
    var el = doc.querySelector(".toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove("is-on"); }, 2400);
  }

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
    if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + " 天前";
    var d = new Date(ts);
    return (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function seedPosts() {
    var now = Date.now();
    return [
      {
        id: "seed-lost",
        anon: "学生K7M2Q9",
        cat: "失物招领",
        title: "有人在操场看台捡到一副黑框眼镜吗？",
        text: "今天下午最后一节体育课落在看台第二排了，镜腿上有白色贴纸。捡到的同学可以在这里回我，谢谢！",
        images: [],
        likes: 6,
        liked: false,
        createdAt: now - 26 * 60000,
        replies: [
          { id: "r1", anon: "学生A3F8N2", text: "刚才路过看台好像看到了，帮你放到体育器材室门口的值班台了。", createdAt: now - 18 * 60000 }
        ]
      },
      {
        id: "seed-sunset",
        anon: "学生M4Q8T2",
        cat: "校园日常",
        title: "今天操场看台的晚霞",
        text: "放学路过随手拍的。二十九中的天空有时候真的很像电影。",
        images: ["assets/img/campus-sunset.webp"],
        likes: 23,
        liked: false,
        createdAt: now - 2 * 3600000,
        replies: [
          { id: "r2", anon: "学生C9L5V1", text: "好看！我也拍到了，可惜跑慢了没赶上最红的时候。", createdAt: now - 80 * 60000 },
          { id: "r3", anon: "学生H2W7B4", text: "这是在哪一层拍的？视角好棒。", createdAt: now - 42 * 60000 }
        ]
      },
      {
        id: "seed-study",
        anon: "学生Q5N8D3",
        cat: "学习互助",
        title: "求推荐适合高一读的课外书",
        text: "最近想利用晚自习前的时间读点书，除了必读名著，有没有那种读起来不累、又能学到东西的？小说、散文、科普都可以。",
        images: [],
        likes: 11,
        liked: false,
        createdAt: now - 5 * 3600000,
        replies: [
          { id: "r4", anon: "学生T6R2K9", text: "《人类简史》和《万物简史》都挺好读的，可以先从感兴趣的章节开始。", createdAt: now - 4 * 3600000 }
        ]
      },
      {
        id: "seed-club",
        anon: "学生F8Y3J6",
        cat: "社团活动",
        title: "这学期社团招新大概什么时候？",
        text: "想报篮球社和校园电视台，不知道会不会撞时间。有学长学姐知道大概安排吗？",
        images: ["assets/img/campus-basketball.webp"],
        likes: 9,
        liked: false,
        createdAt: now - 8 * 3600000,
        replies: [
          { id: "r5", anon: "学生B4C7X2", text: "一般开学第三周，电视台会在周一和周三下午活动，篮球社是周二周四，应该不冲突。", createdAt: now - 7 * 3600000 }
        ]
      },
      {
        id: "seed-canteen",
        anon: "学生V2G9P5",
        cat: "校园日常",
        title: "食堂二楼的新窗口有人试过吗？",
        text: "中午看到排了好长的队，不知道值不值得等。吃过的同学来分享一下。",
        images: [],
        likes: 14,
        liked: false,
        createdAt: now - 11 * 3600000,
        replies: []
      }
    ];
  }

  function loadPosts() {
    var raw = "";
    try { raw = localStorage.getItem(POSTS_KEY) || ""; } catch (e) {}
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    var seeded = seedPosts();
    savePosts(seeded);
    return seeded;
  }

  function savePosts(posts) {
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
      return true;
    } catch (e) {
      toast("本机存储空间不足，请减少图片后再试");
      return false;
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
    var liked = post.liked ? " is-liked" : "";
    var heart = post.liked ? "♥" : "♡";
    return '<article class="post" data-post="' + esc(post.id) + '">' +
      '<div class="post__head">' +
        '<span class="anon-avatar" style="background:' + avatarColor(post.anon) + '" aria-hidden="true">学</span>' +
        '<div class="post__meta"><strong>' + esc(post.anon) + '</strong><span>' + esc(post.cat) + " · " + esc(timeAgo(post.createdAt)) + '</span></div>' +
        '<button class="post__report" type="button" data-report="' + esc(post.id) + '">举报</button>' +
      '</div>' +
      (post.title ? '<h3 class="post__title">' + esc(post.title) + '</h3>' : "") +
      (post.text ? '<p class="post__text">' + nl2br(post.text) + '</p>' : "") +
      postImagesHtml(post.images) +
      '<div class="post__foot">' +
        '<button type="button" class="' + liked.trim() + '" data-like="' + esc(post.id) + '">' + heart + ' <span>' + (post.likes || 0) + '</span></button>' +
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
      posts.sort(function (a, b) {
        return (b.likes + (b.replies || []).length * 2) - (a.likes + (a.replies || []).length * 2);
      });
    } else {
      posts.sort(function (a, b) { return b.createdAt - a.createdAt; });
    }
    return posts;
  }

  function render() {
    var list = doc.getElementById("post-list");
    var empty = doc.getElementById("community-empty");
    var count = doc.getElementById("post-count");
    var posts = visiblePosts();
    if (count) count.textContent = posts.length + " 条讨论";
    if (!list) return;
    list.innerHTML = posts.map(postHtml).join("");
    if (empty) empty.hidden = posts.length !== 0;
  }

  function updateNameAndAvatar() {
    syncAnonId();
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
          var max = 1100;
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
          resolve(canvas.toDataURL("image/jpeg", 0.76));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function bind() {
    updateNameAndAvatar();

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
      form.addEventListener("submit", function (e) {
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
        var post = {
          id: uid("p_"),
          anon: getAnonId(),
          cat: catEl ? catEl.value : "校园日常",
          title: title,
          text: text,
          images: state.images.slice(),
          likes: 0,
          liked: false,
          createdAt: Date.now(),
          replies: []
        };
        state.posts.unshift(post);
        if (!savePosts(state.posts)) {
          state.posts.shift();
          return;
        }
        state.cat = "all";
        state.sort = "latest";
        syncToolbar();
        resetComposer();
        render();
        toast("已发布 · 管理员会事后审核");
        var feed = doc.getElementById("post-list");
        if (feed) feed.scrollIntoView({ behavior: "smooth", block: "start" });
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
        var like = e.target.closest("[data-like]");
        if (like) {
          var post = state.posts.find(function (p) { return p.id === like.getAttribute("data-like"); });
          if (!post) return;
          post.liked = !post.liked;
          post.likes = Math.max(0, (post.likes || 0) + (post.liked ? 1 : -1));
          savePosts(state.posts);
          render();
          return;
        }
        var report = e.target.closest("[data-report]");
        if (report) {
          toast("已记录举报，管理员会尽快处理");
          return;
        }
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

      list.addEventListener("submit", function (e) {
        var form = e.target.closest("[data-reply]");
        if (!form) return;
        e.preventDefault();
        var postId = form.getAttribute("data-reply");
        var post = state.posts.find(function (p) { return p.id === postId; });
        if (!post) return;
        var input = form.querySelector("input");
        var text = (input.value || "").trim();
        if (!text) { input.focus(); return; }
        post.replies = post.replies || [];
        post.replies.push({ id: uid("r_"), anon: getAnonId(), text: text.slice(0, 200), createdAt: Date.now() });
        savePosts(state.posts);
        render();
        toast("回复成功");
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

    window.addEventListener("storage", function (e) {
      if (e.key === POSTS_KEY) {
        state.posts = loadPosts();
        render();
      }
      if (e.key === ID_KEY) syncAnonId();
    });

    render();
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

  state.posts = loadPosts();
  bind();
})();
