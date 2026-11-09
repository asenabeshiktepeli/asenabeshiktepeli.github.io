// Small, dependency-free enhancements:
// header + scroll progress, active nav link, mobile menu, live clock, spotlight cards,
// scroll reveal, count-up stats, email menus, copy email, Services toggles and screenshot lightbox.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var touchOnly = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  // ---------- Header state + reading progress ----------
  var header = $("[data-header]");
  var progress = $("[data-progress]");
  var ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    if (header) header.classList.toggle("is-scrolled", y > 8);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty("--progress", max > 0 ? Math.min(y / max, 1).toFixed(4) : 0);
    }
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // ---------- Active section in the top bar ----------
  var navLinks = $$("[data-nav-link]");
  if (navLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    navLinks.forEach(function (link) {
      var id = (link.getAttribute("href") || "").slice(1);
      var section = id && document.getElementById(id);
      if (section) byId[id] = link;
    });
    // The hero has no menu link: when it is back in view (scrolling up, "Back to top"),
    // no link is marked, so the last section's highlight does not stay on.
    var hero = $(".hero");
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) { link.removeAttribute("aria-current"); });
        var link = byId[entry.target.id];
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { sectionObserver.observe(document.getElementById(id)); });
    if (hero) sectionObserver.observe(hero);
  }

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
      if (menu.hidden) return;
      if (event.key === "Escape") {
        setMenu(false);
        menuToggle.focus();
      } else if (event.key === "Tab") {
        // Focus trap: Tab / Shift+Tab cycle through the menu toggle (the close button) and the menu links.
        var stops = [menuToggle].concat($$("a[href], button:not([disabled])", menu));
        var index = stops.indexOf(document.activeElement);
        var next = event.shiftKey ? index - 1 : index + 1;
        if (index === -1 || next < 0 || next >= stops.length) {
          event.preventDefault();
          stops[event.shiftKey ? stops.length - 1 : 0].focus();
        }
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

  // The final value ("60%") stays in the HTML. It only drops to zero at the moment the
  // animation starts, and a timer always restores it, so a stat never stays at 0%.
  function prepareCount(element) {
    var final = element.textContent.trim();
    if (!NUMBER.test(final)) return false; // free text stays as it is
    element.dataset.final = final;
    element.setAttribute("aria-label", final);
    return true;
  }

  function countUp(element) {
    var final = element.dataset.final || "";
    var match = final.match(NUMBER);
    if (!match) return;
    var prefix = match[1];
    var target = parseFloat(match[2]);
    var suffix = match[3];
    var decimals = (match[2].split(".")[1] || "").length;
    var duration = 1600;
    var start = null;
    var done = false;

    function finish() {
      done = true;
      element.textContent = final;
    }

    function frame(time) {
      if (done) return;
      if (start === null) start = time;
      var progress = Math.min((time - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 4);
      element.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(frame); else finish();
    }
    requestAnimationFrame(frame);
    // Safety net: if frames stop (background tab, throttling), show the final value anyway.
    setTimeout(finish, duration + 400);
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
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
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
  var email = toast ? toast.dataset.email : "";
  var copiedMessage = toast ? toast.dataset.copied : "";

  function showToast(message) {
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2200);
  }

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

  // ---------- Email menus (Gmail / Outlook / default app / copy) ----------
  // On touch-only devices the button stays a plain mailto: link.
  var openEmail = null;

  function emailParts(wrapper) {
    return { trigger: $("[data-email-trigger]", wrapper), panel: $("[data-email-panel]", wrapper) };
  }

  function emailItems(panel) {
    return $$(".email-menu-item", panel);
  }

  function closeEmailMenu(wrapper, restoreFocus) {
    if (!wrapper) return;
    var parts = emailParts(wrapper);
    parts.panel.hidden = true;
    parts.panel.classList.remove("is-up", "is-end");
    parts.trigger.setAttribute("aria-expanded", "false");
    if (openEmail === wrapper) openEmail = null;
    if (restoreFocus) parts.trigger.focus();
  }

  function openEmailMenu(wrapper) {
    if (openEmail && openEmail !== wrapper) closeEmailMenu(openEmail, false);
    var parts = emailParts(wrapper);
    parts.panel.hidden = false;
    parts.trigger.setAttribute("aria-expanded", "true");
    openEmail = wrapper;

    // Keep the panel on screen: flip up near the bottom, align right near the edge.
    var rect = parts.panel.getBoundingClientRect();
    var triggerRect = parts.trigger.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8 && triggerRect.top > rect.height + 16) {
      parts.panel.classList.add("is-up");
    }
    if (rect.right > window.innerWidth - 8) parts.panel.classList.add("is-end");

    var first = emailItems(parts.panel)[0];
    if (first) first.focus();
  }

  $$("[data-email-menu]").forEach(function (wrapper) {
    var parts = emailParts(wrapper);
    if (!parts.trigger || !parts.panel) return;

    parts.trigger.addEventListener("click", function (event) {
      if (touchOnly) return;
      event.preventDefault();
      if (openEmail === wrapper) closeEmailMenu(wrapper, false); else openEmailMenu(wrapper);
    });

    parts.trigger.addEventListener("keydown", function (event) {
      if (touchOnly) return;
      // Space activates it like a button; ArrowDown opens it.
      if (event.key === " " || (event.key === "ArrowDown" && openEmail !== wrapper)) {
        event.preventDefault();
        openEmailMenu(wrapper);
      }
    });

    parts.panel.addEventListener("keydown", function (event) {
      var items = emailItems(parts.panel);
      var index = items.indexOf(document.activeElement);
      var next = null;
      if (event.key === "ArrowDown") next = items[(index + 1) % items.length];
      else if (event.key === "ArrowUp") next = items[(index - 1 + items.length) % items.length];
      else if (event.key === "Home") next = items[0];
      else if (event.key === "End") next = items[items.length - 1];
      if (next) {
        event.preventDefault();
        next.focus();
      }
    });

    // Choosing an option closes the menu; copy returns focus to the button.
    emailItems(parts.panel).forEach(function (item) {
      item.addEventListener("click", function () {
        closeEmailMenu(wrapper, item.hasAttribute("data-copy-email"));
      });
    });

    // Tabbing out closes it.
    wrapper.addEventListener("focusout", function (event) {
      if (openEmail === wrapper && event.relatedTarget && !wrapper.contains(event.relatedTarget)) {
        closeEmailMenu(wrapper, false);
      }
    });
  });

  document.addEventListener("click", function (event) {
    if (openEmail && !openEmail.contains(event.target)) closeEmailMenu(openEmail, false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && openEmail) {
      event.preventDefault();
      closeEmailMenu(openEmail, true);
    }
  });

  // ---------- Services: "What's included" closed on phones ----------
  // The <details> is open in the HTML (so it stays open without JS). Under 640px it starts closed;
  // on larger screens it is always open (its summary is hidden by CSS).
  var phoneWidth = window.matchMedia("(max-width: 639px)");
  function syncIncludes() {
    $$(".includes-toggle").forEach(function (details) { details.open = !phoneWidth.matches; });
  }
  syncIncludes();
  if (phoneWidth.addEventListener) phoneWidth.addEventListener("change", syncIncludes);

  // ---------- Screenshot lightbox (gallery) ----------
  // Links with data-lightbox-open="<dialog id>" open that <dialog> as a modal at its first screenshot.
  // Without JS (or without <dialog> support) they stay normal links to the first full image.
  // Each screenshot is a .lightbox-slide <figure>; ‹ › buttons and the ←/→ keys switch between them.
  function setupLightbox(dialog) {
    var slides = $$(".lightbox-slide", dialog);
    var current = $(".lightbox-current", dialog);
    var index = 0;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (slide, k) { slide.hidden = k !== index; });
      if (current) current.textContent = String(index + 1);
      var img = $(".lightbox-img", slides[index]);
      if (img && img.alt) dialog.setAttribute("aria-label", img.alt);
      dialog.classList.remove("is-zoomed");
      dialog.scrollTop = 0;
      dialog.scrollLeft = 0;
    }

    $(".lightbox-close", dialog).addEventListener("click", function () { dialog.close(); });

    dialog.addEventListener("click", function (event) {
      // dark area around the image (the dialog itself or an empty part of a slide)
      if (event.target === dialog || event.target.classList.contains("lightbox-slide")) dialog.close();
    });

    $$(".lightbox-img", dialog).forEach(function (img) {
      img.addEventListener("click", function () {
        dialog.classList.toggle("is-zoomed");
      });
    });

    if (slides.length > 1) {
      var prev = $(".lightbox-prev", dialog);
      var next = $(".lightbox-next", dialog);
      if (prev) prev.addEventListener("click", function () { show(index - 1); });
      if (next) next.addEventListener("click", function () { show(index + 1); });
      dialog.addEventListener("keydown", function (event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft") { event.preventDefault(); show(index - 1); }
        else if (event.key === "ArrowRight") { event.preventDefault(); show(index + 1); }
      });
    }

    return show;
  }

  $$("[data-lightbox-open]").forEach(function (trigger) {
    var dialog = document.getElementById(trigger.getAttribute("data-lightbox-open"));
    if (!dialog || typeof dialog.showModal !== "function") return;
    // One setup per dialog (the card image and the button share it).
    if (!dialog._lightboxShow) dialog._lightboxShow = setupLightbox(dialog);
    // Focus target after closing: the card's "View screenshots" button (the image link is not in the tab order).
    var returnFocus = $(".btn[data-lightbox-open]", dialog.closest(".project")) || trigger;
    trigger.setAttribute("aria-haspopup", "dialog");

    trigger.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return; // new-tab clicks
      event.preventDefault();
      dialog._lightboxShow(0);
      dialog.showModal();
    });

    if (dialog.dataset.lightboxReady) return;
    dialog.dataset.lightboxReady = "1";

    // Esc closes natively; focus always goes back to the "View screenshots" button.
    dialog.addEventListener("close", function () {
      dialog.classList.remove("is-zoomed");
      returnFocus.focus({ preventScroll: true });
    });
  });
})();
