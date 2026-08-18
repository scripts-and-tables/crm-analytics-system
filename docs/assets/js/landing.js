/* CRM Analytics — landing page motion.
 *
 * Three small jobs, no dependencies:
 *   1. reveal sections as they scroll into view
 *   2. count the headline numbers up once, when they are first seen
 *   3. shadow the nav once the page has scrolled
 *
 * PROGRESSIVE, NOT REQUIRED. The stylesheet paints the finished page; the
 * `.anim` class only displaces an element, and `.in` puts it back. If this
 * file never runs, a visitor sees the page complete rather than a column of
 * invisible sections — which is the usual way a scroll-reveal breaks.
 *
 * Reduced motion is honoured by doing nothing at all: every element is
 * revealed immediately and the counters print their final value.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var animated = Array.prototype.slice.call(document.querySelectorAll(".anim"));
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));

  function showAll() {
    animated.forEach(function (el) { el.classList.add("in"); });
    counters.forEach(function (el) { el.textContent = format(el, Number(el.dataset.count)); });
  }

  // No IntersectionObserver (or no appetite for motion): finish immediately.
  if (reduce || !("IntersectionObserver" in window)) {
    showAll();
    return;
  }

  function format(el, value) {
    var decimals = Number(el.dataset.decimals || 0);
    var out = value.toFixed(decimals);
    if (!el.dataset.raw) out = Number(out).toLocaleString("en-US", {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    });
    return (el.dataset.prefix || "") + out + (el.dataset.suffix || "");
  }

  // easeOutCubic — fast first, settles rather than stops.
  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function countUp(el) {
    var target = Number(el.dataset.count);
    var ms = Number(el.dataset.ms || 1100);
    var started = null;
    function frame(now) {
      if (started === null) started = now;
      var t = Math.min((now - started) / ms, 1);
      el.textContent = format(el, target * ease(t));
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = format(el, target);   // land exactly on the number
    }
    requestAnimationFrame(frame);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      // Counters inside a revealed block start with it, so the number and the
      // panel it sits in arrive together.
      var inside = e.target.matches("[data-count]")
        ? [e.target]
        : Array.prototype.slice.call(e.target.querySelectorAll("[data-count]"));
      inside.forEach(function (c) {
        if (c.dataset.done) return;
        c.dataset.done = "1";
        countUp(c);
      });
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });

  animated.forEach(function (el) { io.observe(el); });
  // A counter that is not inside an .anim block still needs watching.
  counters.forEach(function (el) { if (!el.closest(".anim")) io.observe(el); });

  // Anything already on screen at load should not wait for a scroll event.
  requestAnimationFrame(function () {
    animated.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9) el.classList.add("in");
    });
  });

  var nav = document.querySelector(".nav");
  if (nav) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        nav.classList.toggle("stuck", window.scrollY > 8);
        ticking = false;
      });
    }, { passive: true });
  }
})();
