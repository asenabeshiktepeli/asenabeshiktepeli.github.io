// Small, dependency-free enhancements:
// header shrink, mobile menu, live clock, spotlight cards, scroll reveal,
// count-up stats, copy email and the Ctrl/Cmd+K command palette.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  // ---------- Header shrinks on scroll ----------
  var header = $("[data-header]");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Full-screen mobile menu ----------
  var menuToggle = $("[data-menu-toggle]");
  var menu = $("[data-mobile-menu]");

  function setMenu(open) {
    if (!menuToggle || !menu) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("is-locked", open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(function () { menu.classList.add("is-open"); });
      var first = $("a", menu);
      if (first) first.focus();
    } else {
      menu.classList.remove("is-open");
      menu.hidden = true;
    }
  }

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", function () {
      setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
    });
    $$("a", menu).forEach(function (link) {
      link.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !menu.hidden) {
        setMenu(false);
        menuToggle.focus();
      }
    });
  }

  // ---------- Live local clock ----------
  var clock = $("[data-clock]");
  if (clock) {
    var formatter;
    try {
      formatter = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: clock.dataset.tz
      });
    } catch (error) {
      formatter = null;
    }
    var tick = function () {
      if (!formatter) return;
      var now = new Date();
      clock.textContent = formatter.format(now);
      clock.setAttribute("datetime", now.toISOString());
    };
    tick();
    setInterval(tick, 15000);
  }

  // ---------- Spotlight follows the pointer ----------
  if (finePointer && !reduceMotion) {
    $$(".spotlight").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--x", (event.clientX - rect.left) + "px");
        card.style.setProperty("--y", (event.clientY - rect.top) + "px");
      });
    });
  }

  // ---------- Count-up stats ("120%" -> 0…120%) ----------
  var NUMBER = /^(\D*)(\d+(?:\.\d+)?)(\D*)$/;

  // Start numeric stats at zero so they don't flash the final value first.
  function prepareCount(element) {
    var final = element.textContent.trim();
    var match = final.match(NUMBER);
    if (!match) return false; // placeholders and free text stay as they are
    element.dataset.final = final;
    element.setAttribute("aria-label", final);
    element.textContent = match[1] + (0).toFixed((match[2].split(".")[1] || "").length) + match[3];
    return true;
  }

  function countUp(element) {
    var match = (element.dataset.final || "").match(NUMBER);
    if (!match) return;
    var prefix = match[1];
    var target = parseFloat(match[2]);
    var suffix = match[3];
    var decimals = (match[2].split(".")[1] || "").length;
    var duration = 1600;
    var start = null;

    function frame(time) {
      if (start === null) start = time;
      var progress = Math.min((time - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 4);
      element.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Scroll reveal + count-up trigger ----------
  var revealItems = $$(".reveal");
  var counters = $$("[data-count]");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (item) { item.classList.add("is-visible"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
    revealItems.forEach(function (item) { revealObserver.observe(item); });

    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (counter) {
      if (prepareCount(counter)) countObserver.observe(counter);
    });
  }

  // ---------- Toast + copy email ----------
  var toast = $("[data-toast]");
  var toastTimer;
  function showToast(message) {
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2200);
  }

  var palette = $("[data-palette]");
  var email = palette ? palette.dataset.email : "";
  var copiedMessage = palette ? palette.dataset.copied : "";

  function copyEmail() {
    if (!email) return;
    var done = function () { showToast(copiedMessage); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var field = document.createElement("textarea");
      field.value = email;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try { document.execCommand("copy"); done(); } catch (error) { /* ignore */ }
      field.remove();
    }
  }

  $$("[data-copy-email]").forEach(function (button) {
    button.addEventListener("click", copyEmail);
  });

  // ---------- Command palette ----------
  if (!palette || typeof palette.showModal !== "function") return;

  var input = $("[data-palette-input]", palette);
  var list = $("[data-palette-list]", palette);
  var empty = $("[data-palette-empty]", palette);
  var items = $$(".palette-item", list);
  var groups = $$(".palette-group", list);
  var openers = $$("[data-palette-open]");
  var active = -1;
  var lastFocus = null;

  openers.forEach(function (button) {
    var kbd = $("kbd", button);
    if (kbd && !isMac && button.dataset.hintOther) kbd.textContent = button.dataset.hintOther;
    button.addEventListener("click", openPalette);
  });

  function visibleItems() {
    return items.filter(function (item) { return !item.hidden; });
  }

  function setActive(index) {
    var visible = visibleItems();
    items.forEach(function (item) { item.setAttribute("aria-selected", "false"); });
    if (!visible.length) {
      active = -1;
      input.removeAttribute("aria-activedescendant");
      return;
    }
    active = (index + visible.length) % visible.length;
    var current = visible[active];
    current.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", current.id);
    current.scrollIntoView({ block: "nearest" });
  }

  function filter() {
    var query = input.value.trim().toLowerCase();
    items.forEach(function (item) {
      item.hidden = query !== "" && item.textContent.toLowerCase().indexOf(query) === -1;
    });
    // Hide a group heading when none of its items match.
    groups.forEach(function (group) {
      var next = group.nextElementSibling;
      var any = false;
      while (next && !next.classList.contains("palette-group")) {
        if (!next.hidden) any = true;
        next = next.nextElementSibling;
      }
      group.hidden = !any;
    });
    if (empty) empty.hidden = visibleItems().length > 0;
    setActive(0);
  }

  function openPalette() {
    if (palette.open) return;
    if (menu && !menu.hidden) setMenu(false);
    lastFocus = document.activeElement;
    input.value = "";
    filter();
    palette.showModal();
    input.focus();
  }

  function closePalette() {
    if (palette.open) palette.close();
  }

  palette.addEventListener("close", function () {
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  });

  // Click on the backdrop closes the palette.
  palette.addEventListener("click", function (event) {
    if (event.target === palette) closePalette();
  });

  function run(item) {
    if (!item) return;
    var action = item.dataset.action;
    closePalette();
    if (action === "goto") {
      var target = document.querySelector(item.dataset.target);
      if (target) {
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", item.dataset.target);
      }
    } else if (action === "copy") {
      copyEmail();
    } else if (action === "mail" && email) {
      window.location.href = "mailto:" + email;
    } else if (action === "download" && item.dataset.href) {
      var link = document.createElement("a");
      link.href = item.dataset.href;
      link.download = item.dataset.filename || "";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }

  input.addEventListener("input", filter);
  input.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(active - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(visibleItems()[active]);
    }
  });

  items.forEach(function (item) {
    item.addEventListener("mousemove", function () {
      var index = visibleItems().indexOf(item);
      if (index !== active) setActive(index);
    });
    item.addEventListener("click", function () { run(item); });
  });

  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (palette.open) closePalette(); else openPalette();
    }
  });
})();
