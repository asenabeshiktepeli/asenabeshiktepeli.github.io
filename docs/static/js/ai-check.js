// AI shopping assistant self-check (/ai-ready/): score, top 3 gaps and a prefilled email link.
// Runs only in this browser tab: no storage, no cookies, nothing sent except anonymous GoatCounter
// events (ai-check-start, ai-check-complete with the score band; ai-check-upwork is a data-goatcounter-click).
(function () {
  "use strict";

  // Links to a closed <details> (the policy templates) open it, also when the page loads with
  // that #hash. Without JS the link still scrolls to the template's summary.
  function openDetails(hash) {
    var target = hash && hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    var details = target && target.closest("details");
    if (details) details.open = true;
  }
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest('a[href^="#"]');
    if (link) openDetails(link.getAttribute("href"));
  });
  window.addEventListener("hashchange", function () { openDetails(location.hash); });
  openDetails(location.hash);

  var form = document.querySelector("[data-ai-check]");
  var result = document.querySelector("[data-result]");
  if (!form || !result) return;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function fill(template, values) {
    return (template || "").replace(/\{(\w+)\}/g, function (match, key) { return key in values ? values[key] : match; });
  }

  var questions = $$("[data-question]", form);
  var total = questions.length;
  var progress = $("[data-progress-text]", form);
  var errorBox = $("[data-error]", form);
  var resultTitle = $("[data-result-title]", result);
  var scoreText = $("[data-score]", result);
  var bands = $$("[data-band]", result);
  var gapsBlock = $("[data-gaps]", result);
  var gapList = $("[data-gap-list]", result);
  var noGaps = $("[data-no-gaps]", result);
  var emailLink = $("[data-email-link]", result);
  var restart = $("[data-restart]", result);
  var PRIORITY = { critical: 0, important: 1 };
  var sent = { start: false, complete: false };

  // GoatCounter custom event; skipped when the counter is blocked or not loaded (and on localhost).
  function track(path, title) {
    var gc = window.goatcounter;
    if (gc && typeof gc.count === "function") gc.count({ path: path, title: title, event: true });
  }

  function answer(question) {
    var checked = $("input:checked", question);
    return checked ? checked.value : "";
  }

  function unanswered() {
    return questions.filter(function (question) { return !answer(question); });
  }

  // Missing-answer note: visible text plus aria-describedby on the radios only while it applies.
  function setMissing(question, on) {
    var note = $("[data-missing-note]", question);
    question.classList.toggle("is-missing", on);
    note.hidden = !on;
    $$("input", question).forEach(function (input) {
      if (on) input.setAttribute("aria-describedby", note.id);
      else input.removeAttribute("aria-describedby");
    });
  }

  function updateProgress() {
    if (progress) progress.textContent = fill(progress.dataset.template, { answered: total - unanswered().length, total: total });
  }

  function showError(missing) {
    var numbers = missing.map(function (question) { return question.dataset.number; }).join(", ");
    errorBox.textContent = fill(errorBox.dataset.template, { list: numbers });
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  // Score = Yes answers. Gaps = No answers, critical first, then question order; the first 3 are shown.
  function render() {
    var score = 0;
    var gaps = [];
    questions.forEach(function (question, index) {
      if (answer(question) === "yes") score += 1;
      else gaps.push({ question: question, index: index });
    });
    gaps.sort(function (a, b) {
      return (PRIORITY[a.question.dataset.priority] || 0) - (PRIORITY[b.question.dataset.priority] || 0) || a.index - b.index;
    });
    var top = gaps.slice(0, 3);

    scoreText.textContent = score;
    var band = { min: 0, max: total };
    bands.forEach(function (element) {
      var on = score >= Number(element.dataset.min) && score <= Number(element.dataset.max);
      element.hidden = !on;
      if (on) band = { min: element.dataset.min, max: element.dataset.max };
    });

    gapList.textContent = "";
    top.forEach(function (gap) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + gap.question.dataset.fix;
      link.textContent = gap.question.dataset.topic;
      item.appendChild(link);
      // Second link to the matching policy template, e.g. "Returns page · template"
      var templateId = gap.question.dataset.template;
      var templateLabel = gapList.dataset.templateLabel;
      if (templateId && templateLabel) {
        var templateLink = document.createElement("a");
        var hidden = document.createElement("span");
        templateLink.href = "#" + templateId;
        templateLink.className = "ai-gap-template";
        templateLink.textContent = templateLabel;
        hidden.className = "visually-hidden";
        hidden.textContent = " for " + gap.question.dataset.topic;
        templateLink.appendChild(hidden);
        item.appendChild(document.createTextNode(" · "));
        item.appendChild(templateLink);
      }
      gapList.appendChild(item);
    });
    gapsBlock.hidden = top.length === 0;
    noGaps.hidden = top.length > 0;

    if (emailLink) {
      var values = {
        score: score,
        total: total,
        // "; " because a topic may contain commas ("Material, size and care")
        gaps: top.map(function (gap) { return gap.question.dataset.topic; }).join("; ") || "none"
      };
      emailLink.href = "mailto:" + emailLink.dataset.email +
        "?subject=" + encodeURIComponent(fill(emailLink.dataset.subject, values)) +
        "&body=" + encodeURIComponent(fill(emailLink.dataset.body, values));
    }
    return band;
  }

  form.addEventListener("change", function (event) {
    if (!sent.start) {
      sent.start = true;
      track("ai-check-start", "AI check started");
    }
    var question = event.target.closest("[data-question]");
    if (question) setMissing(question, false);
    updateProgress();
    if (!errorBox.hidden) {
      var missing = unanswered();
      if (missing.length) showError(missing);
      else clearError();
    }
    // Changing an answer after the result is shown updates it in place (focus stays put).
    if (!result.hidden) render();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var missing = unanswered();
    questions.forEach(function (question) { setMissing(question, missing.indexOf(question) > -1); });
    if (missing.length) {
      showError(missing);
      $("input", missing[0]).focus();
      return;
    }
    clearError();
    var band = render();
    result.hidden = false;
    resultTitle.focus();
    if (!sent.complete) {
      sent.complete = true;
      track("ai-check-complete", "AI check completed – score " + band.min + "–" + band.max);
    }
  });

  if (restart) {
    restart.addEventListener("click", function () {
      form.reset();
      questions.forEach(function (question) { setMissing(question, false); });
      clearError();
      result.hidden = true;
      updateProgress();
      $("input", questions[0]).focus();
    });
  }

  updateProgress();
})();
