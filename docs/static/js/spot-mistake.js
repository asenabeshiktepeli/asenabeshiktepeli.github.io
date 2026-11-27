/* "Spot the mistake" (homepage, How I use AI). Texts come from the page (content.yaml "ai_spot").
   Each draft sentence becomes a <button>; a click shows its feedback under it and updates
   "Found n of 3". Nothing is stored or sent anywhere. Without this script the draft stays plain
   text and the <details> under it lists the mistakes.

   The state logic (createSpot) has no DOM code, so it can be tested in Node:
   module.exports = { createSpot } when loaded outside a browser. */
(function () {
  "use strict";

  // kinds: one entry per sentence, "mistake" or "fine"
  function createSpot(kinds) {
    var total = kinds.filter(function (k) { return k === "mistake"; }).length;
    var found = {};      // index -> true for mistakes the visitor clicked
    var revealed = {};   // index -> true for every sentence whose feedback is shown
    var shownAll = false;

    function foundCount() { return Object.keys(found).length; }

    return {
      total: total,
      // Click on sentence i: returns what to show
      choose: function (i) {
        var kind = kinds[i];
        var isNew = !revealed[i];
        revealed[i] = true;
        if (kind === "mistake") found[i] = true;
        return { kind: kind, isNew: isNew, found: foundCount(), total: total, done: foundCount() === total };
      },
      // "Show all mistakes": reveals every mistake, does not count them as found
      showAll: function () {
        shownAll = true;
        kinds.forEach(function (k, i) { if (k === "mistake") revealed[i] = true; });
        return { found: foundCount(), total: total, done: foundCount() === total };
      },
      reset: function () { found = {}; revealed = {}; shownAll = false; return { found: 0, total: total, done: false }; },
      isRevealed: function (i) { return !!revealed[i]; },
      isFound: function (i) { return !!found[i]; },
      showSend: function () { return shownAll || foundCount() === total; },
      foundCount: foundCount
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createSpot: createSpot };
  }
  if (typeof document === "undefined") return;

  function fill(template, found, total) {
    return template.replace("{found}", found).replace("{total}", total);
  }

  function setup(root) {
    var items = Array.prototype.slice.call(root.querySelectorAll("[data-spot-item]"));
    if (!items.length) return;
    var progress = root.querySelector("[data-spot-progress]");
    var announce = root.querySelector("[data-spot-announce]");
    var controls = root.querySelector("[data-spot-controls]");
    var send = root.querySelector("[data-spot-send]");
    var showBtn = root.querySelector("[data-spot-show]");
    var resetBtn = root.querySelector("[data-spot-reset]");
    var progressTpl = root.getAttribute("data-progress") || "";
    var doneText = root.getAttribute("data-done") || "";

    var kinds = items.map(function (item) { return item.hasAttribute("data-mistake") ? "mistake" : "fine"; });
    var spot = createSpot(kinds);

    // Plain sentence -> button (keeps the same text)
    var buttons = items.map(function (item, i) {
      var text = item.querySelector("[data-spot-text]");
      var feedback = item.querySelector("[data-spot-feedback]");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "spot-sentence";
      button.textContent = text.textContent;
      button.setAttribute("aria-controls", feedback.id);
      button.setAttribute("aria-expanded", "false");
      text.replaceWith(button);
      button.addEventListener("click", function () { choose(i); });
      return button;
    });

    function progressText(state) {
      return state.done ? doneText : fill(progressTpl, state.found, state.total);
    }

    function render() {
      items.forEach(function (item, i) {
        var shown = spot.isRevealed(i);
        var feedback = item.querySelector("[data-spot-feedback]");
        feedback.hidden = !shown;
        item.classList.toggle("is-revealed", shown);
        item.classList.toggle("is-mistake", shown && kinds[i] === "mistake");
        item.classList.toggle("is-fine", shown && kinds[i] === "fine");
        buttons[i].setAttribute("aria-expanded", shown ? "true" : "false");
      });
      if (send) send.hidden = !spot.showSend();
    }

    function choose(i) {
      var state = spot.choose(i);
      render();
      var feedback = items[i].querySelector("[data-spot-feedback]");
      var message = feedback.textContent.replace(/\s+/g, " ").trim();
      progress.textContent = progressText(state);
      // One announcement: the feedback for this sentence (the progress line is a live region too)
      announce.textContent = message;
    }

    if (showBtn) {
      showBtn.addEventListener("click", function () {
        var state = spot.showAll();
        render();
        progress.textContent = progressText(state);
        announce.textContent = "";
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        var state = spot.reset();
        render();
        progress.textContent = progressText(state);
        announce.textContent = "";
      });
    }

    controls.hidden = false;
    root.classList.add("is-ready");
    render();
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-spot]"), setup);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
