/* ============================================================
   南宁市第二十九中学 · 站点交互
   原生 JS，无依赖
   ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;
  var head = doc.querySelector("[data-head]");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 年份 ---------- */
  doc.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- 滚动进度 / 页头 / 回到顶部 ---------- */
  var progress = doc.querySelector(".scroll-progress span");
  var toTop = doc.querySelector(".to-top");
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    var h = doc.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    if (head) {
      if (head.dataset.solid === "true") {
        head.classList.add("is-solid");
      } else {
        head.classList.toggle("is-solid", y > 48);
      }
    }
    if (toTop) toTop.classList.toggle("is-on", y > window.innerHeight * 0.75);
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---------- 移动端菜单 ---------- */
  var menuBtn = doc.querySelector(".menu-btn");
  var drawer = doc.getElementById("drawer");
  var openDrawer = false;

  function setDrawer(open) {
    if (!drawer || !menuBtn) return;
    openDrawer = open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    body.classList.toggle("menu-open", open);
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    body.classList.toggle("is-locked", open);
    var links = drawer.querySelectorAll(".drawer-nav a");
    links.forEach(function (a, i) {
      a.style.transitionDelay = open ? 90 + i * 55 + "ms" : "0ms";
    });
    if (open) {
      var first = drawer.querySelector(".drawer-nav a");
      window.setTimeout(function () {
        if (first) first.focus({ preventScroll: true });
      }, 420);
    } else if (menuBtn) {
      menuBtn.focus({ preventScroll: true });
    }
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      setDrawer(!openDrawer);
    });
  }
  if (drawer) {
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setDrawer(false);
      });
    });
  }

  /* ---------- 搜索 ---------- */
  var panel = doc.querySelector(".search-panel");
  var input = panel ? panel.querySelector("input") : null;
  var resultsBox = panel ? panel.querySelector(".search-results") : null;
  var hint = panel ? panel.querySelector(".search-hint") : null;
  var searchBtn = doc.querySelector("[data-search-open]");
  var searchClose = panel ? panel.querySelector(".search-close") : null;
  var lastFocus = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderSearch(q) {
    if (!resultsBox) return;
    var data = window.SEARCH_INDEX || [];
    var key = q.trim().toLowerCase();
    var list = key
      ? data.filter(function (item) {
          return (item.t + " " + item.d + " " + item.k).toLowerCase().indexOf(key) !== -1;
        })
      : data.slice(0, 6);
    if (!key && hint) hint.textContent = "推荐内容";
    else if (hint) hint.textContent = key ? "找到 " + list.length + " 条相关内容" : "";
    if (!list.length) {
      resultsBox.innerHTML =
        '<p class="search-empty">没有找到「' +
        esc(q) +
        '」相关内容，试试“招生”“新闻”“地址”。</p>';
      return;
    }
    resultsBox.innerHTML = list
      .slice(0, 8)
      .map(function (item) {
        return (
          '<a class="search-result" href="' +
          esc(item.u) +
          '"><div><h3>' +
          esc(item.t) +
          "</h3><p>" +
          esc(item.d) +
          "</p></div><span>" +
          esc(item.k) +
          "</span></a>"
        );
      })
      .join("");
  }

  function openSearch() {
    if (!panel) return;
    lastFocus = doc.activeElement;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    body.classList.add("is-locked");
    if (!input.value) renderSearch("");
    window.setTimeout(function () {
      input.focus({ preventScroll: true });
    }, 120);
  }
  function closeSearch() {
    if (!panel) return;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    if (!openDrawer) body.classList.remove("is-locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  if (searchBtn) searchBtn.addEventListener("click", openSearch);
  if (searchClose) searchClose.addEventListener("click", closeSearch);
  if (input) {
    input.addEventListener("input", function () {
      renderSearch(input.value);
    });
  }
  doc.addEventListener("keydown", function (e) {
    if (e.key === "/" && !openDrawer && !panel.classList.contains("is-open")) {
      var tag = (doc.activeElement.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        openSearch();
      }
    }
    if (e.key === "Escape") {
      if (panel && panel.classList.contains("is-open")) closeSearch();
      if (openDrawer) setDrawer(false);
    }
  });


  /* ---------- 首页照片轮播 ---------- */
  var heroSlider = doc.querySelector("[data-hero-slider]");
  if (heroSlider) {
    var heroSlides = Array.prototype.slice.call(heroSlider.querySelectorAll(".hero-slide"));
    var heroDots = Array.prototype.slice.call(heroSlider.querySelectorAll(".hero-dot"));
    var heroIndex = 0;
    var heroTimer = null;

    function loadSlide(slide) {
      var img = slide ? slide.querySelector("img[data-src]") : null;
      if (img) {
        img.src = img.getAttribute("data-src");
        img.removeAttribute("data-src");
      }
    }

    var heroPrev = heroSlider.querySelector(".hero-arrow--prev");
    var heroNext = heroSlider.querySelector(".hero-arrow--next");
    var heroToken = 0;

    function activateSlide(target) {
      heroIndex = target;
      heroSlides.forEach(function (slide, n) {
        slide.classList.toggle("is-active", n === heroIndex);
        if (heroDots[n]) {
          heroDots[n].classList.toggle("is-active", n === heroIndex);
          heroDots[n].setAttribute("aria-pressed", n === heroIndex ? "true" : "false");
        }
      });
      loadSlide(heroSlides[(heroIndex + 1) % heroSlides.length]);
    }

    function showSlide(i, immediate) {
      var target = (i + heroSlides.length) % heroSlides.length;
      var slide = heroSlides[target];
      loadSlide(slide);

      var img = slide.querySelector("img");
      var token = ++heroToken;
      var ready = immediate || (img && img.complete && img.naturalWidth > 1);

      function finish() {
        if (token !== heroToken) return;
        heroSlider.classList.remove("is-loading");
        activateSlide(target);
      }

      if (ready) {
        finish();
        return;
      }

      heroSlider.classList.add("is-loading");
      var done = false;
      function once() {
        if (done) return;
        done = true;
        finish();
      }
      if (img) {
        img.addEventListener("load", once, { once: true });
        img.addEventListener("error", once, { once: true });
        if (img.complete && img.naturalWidth > 1) once();
      }
    }

    function startHero() {
      if (reduceMotion || heroSlides.length < 2) return;
      stopHero();
      heroTimer = window.setInterval(function () {
        showSlide(heroIndex + 1);
      }, 6500);
    }

    function stopHero() {
      if (heroTimer) window.clearInterval(heroTimer);
      heroTimer = null;
    }

    heroDots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        showSlide(i);
        startHero();
      });
    });
    if (heroPrev) {
      heroPrev.addEventListener("click", function () {
        showSlide(heroIndex - 1);
        startHero();
      });
    }
    if (heroNext) {
      heroNext.addEventListener("click", function () {
        showSlide(heroIndex + 1);
        startHero();
      });
    }

    var touchStartX = null;
    heroSlider.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.touches[0].clientX;
        stopHero();
      },
      { passive: true }
    );
    heroSlider.addEventListener(
      "touchend",
      function (e) {
        if (touchStartX === null) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(dx) > 42) {
          showSlide(heroIndex + (dx < 0 ? 1 : -1));
          startHero();
        }
      },
      { passive: true }
    );
    heroSlider.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        showSlide(heroIndex - 1);
        startHero();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        showSlide(heroIndex + 1);
        startHero();
      }
    });
    heroSlider.addEventListener("mouseenter", stopHero);
    heroSlider.addEventListener("mouseleave", startHero);
    heroSlider.addEventListener("focusin", stopHero);
    heroSlider.addEventListener("focusout", startHero);
    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden) stopHero();
      else startHero();
    });

    showSlide(0, true);
    startHero();

    function preloadHeroRest() {
      heroSlides.forEach(loadSlide);
    }
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preloadHeroRest, { timeout: 2600 });
    } else {
      window.setTimeout(preloadHeroRest, 2600);
    }
  }


  /* ---------- 首页免责声明 ---------- */
  var siteNotice = doc.getElementById("site-notice");
  if (siteNotice) {
    var noticeAck = doc.getElementById("site-notice-ack");
    var noticeKey = "nn29_site_notice_ack_v1";
    var noticeSeen = false;
    try { noticeSeen = sessionStorage.getItem(noticeKey) === "1"; } catch (e) {}

    function openNotice() {
      siteNotice.hidden = false;
      siteNotice.setAttribute("aria-hidden", "false");
      doc.body.classList.add("is-locked");
      requestAnimationFrame(function () {
        siteNotice.classList.add("is-on");
        if (noticeAck) noticeAck.focus();
      });
    }

    function closeNotice() {
      siteNotice.classList.remove("is-on");
      siteNotice.setAttribute("aria-hidden", "true");
      doc.body.classList.remove("is-locked");
      try { sessionStorage.setItem(noticeKey, "1"); } catch (e) {}
      setTimeout(function () { siteNotice.hidden = true; }, 360);
    }

    if (noticeAck) noticeAck.addEventListener("click", closeNotice);
    siteNotice.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusables = siteNotice.querySelectorAll("button, a[href]");
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && doc.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    if (!noticeSeen) openNotice();
  }

  /* ---------- 通知轮播 ---------- */
  var noticeList = doc.querySelector(".notice-list");
  if (noticeList) {
    var items = noticeList.querySelectorAll("a");
    var idx = 0;
    var timer = null;
    items.forEach(function (a, i) {
      a.classList.toggle("is-on", i === 0);
    });
    function tick() {
      if (!items.length) return;
      items[idx].classList.remove("is-on");
      idx = (idx + 1) % items.length;
      items[idx].classList.add("is-on");
    }
    function start() {
      if (reduceMotion || items.length < 2) return;
      timer = window.setInterval(tick, 4600);
    }
    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
    }
    start();
    noticeList.addEventListener("mouseenter", stop);
    noticeList.addEventListener("mouseleave", start);
    noticeList.addEventListener("focusin", stop);
    noticeList.addEventListener("focusout", start);
  }

  /* ---------- 滚动显现 ---------- */
  var revealEls = doc.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  /* ---------- 新闻筛选 ---------- */
  var filters = doc.querySelectorAll(".filter");
  var cards = doc.querySelectorAll("[data-cat]");
  var countEl = doc.querySelector("[data-visible-count]");
  if (filters.length && cards.length) {
    filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var f = btn.dataset.filter;
        filters.forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        var visible = 0;
        cards.forEach(function (card) {
          var show = f === "all" || card.dataset.cat === f;
          card.classList.toggle("is-hidden", !show);
          card.classList.remove("is-shown");
          if (show) {
            visible++;
            card.classList.add("is-in");
            void card.offsetWidth;
            card.classList.add("is-shown");
          }
        });
        if (countEl) countEl.textContent = visible;
      });
    });
  }

  /* ---------- 留言表单（演示） ---------- */
  var form = doc.querySelector("[data-contact-form]");
  if (form) {
    var showError = function (field, msg) {
      var wrap = field.closest(".field");
      if (!wrap) return;
      wrap.classList.toggle("has-error", !!msg);
      var err = wrap.querySelector(".err");
      if (err) err.textContent = msg || "";
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]');
      var phone = form.querySelector('[name="phone"]');
      var msg = form.querySelector('[name="message"]');
      var ok = true;
      if (!name.value.trim() || name.value.trim().length < 2) {
        showError(name, "请填写至少 2 个字的姓名");
        ok = false;
      } else showError(name, "");
      if (!/^(1[3-9]\d{9}|0\d{2,3}-?\d{7,8})$/.test(phone.value.trim())) {
        showError(phone, "请填写有效的手机或座机号码");
        ok = false;
      } else showError(phone, "");
      if (msg.value.trim().length < 5) {
        showError(msg, "请简单描述您的问题（至少 5 个字）");
        ok = false;
      } else showError(msg, "");
      if (!ok) return;
      var toast = doc.querySelector(".toast");
      if (toast) {
        toast.textContent = "留言已记录（演示）· 正式上线后将直达学校邮箱";
        toast.classList.add("is-on");
        window.setTimeout(function () {
          toast.classList.remove("is-on");
        }, 4200);
      }
      form.reset();
    });
  }

  /* ---------- 站内锚点平滑滚动（补偿固定头） ---------- */
  doc.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var target = doc.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 78;
      window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
      history.replaceState(null, "", id);
    });
  });
})();
