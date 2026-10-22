// Keyboard audit for the harness pages. Load it in a page and call `rzKeyboardAudit()`; it returns the list of problems (empty = clean).
// It checks what a script can check: every control a keyboard can reach has a name and a visible focus indicator, nothing uses a positive tabindex,
// nothing that looks clickable is out of the tab order, and focus can move through every stop. It does not replace a walk-through with a real keyboard.
window.rzKeyboardAudit = function () {
  const problems = [];
  const visible = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const name = (el) => (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") && [...el.getAttribute("aria-labelledby").split(" ")].map((i) => document.getElementById(i)?.textContent ?? "").join(" ") || el.getAttribute("title") || el.labels?.[0]?.textContent || el.textContent || el.getAttribute("placeholder") || "").trim();
  const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""}`;
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex],[role=button],[role=menuitem],[role=tab],[role=checkbox],[role=switch],[role=option],[role=treeitem],[contenteditable=true]';
  const all = [...document.querySelectorAll(sel)].filter(visible);
  // A composite widget (a tree, a tab list) keeps one tab stop and moves focus inside it: its container is not a stop itself.
  const stops = all.filter((el) => !el.disabled && el.getAttribute("tabindex") !== "-1" && el.getAttribute("aria-hidden") !== "true" && !el.querySelector("[tabindex]"));
  for (const el of document.querySelectorAll("[tabindex]")) if (Number(el.getAttribute("tabindex")) > 0) problems.push(`positive tabindex on ${desc(el)}`);
  for (const el of stops) if (!name(el)) problems.push(`no accessible name: ${desc(el)}`);
  // Focus indicator: after focus() the element must show an outline or a box-shadow ring (or be a native control the browser outlines).
  const seen = new Set();
  for (const el of stops) {
    el.focus({ preventScroll: true });
    if (document.activeElement !== el) { problems.push(`cannot take focus: ${desc(el)}`); continue; }
    // A field wrapped in a styled box may show the ring on the box (:focus-within), so look at the element and its two nearest ancestors.
    const shows = [el, el.parentElement, el.parentElement?.parentElement].some((n) => { if (!n) return false; const s = getComputedStyle(n); return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"; });
    if (!shows && !seen.has(desc(el))) { seen.add(desc(el)); problems.push(`no visible focus indicator: ${desc(el)}`); }
  }
  // Looks clickable but cannot be reached with Tab.
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || stops.includes(el) || el.closest(sel) && el.closest(sel) !== el) continue;
    if (getComputedStyle(el).cursor === "pointer" && !el.closest("button,a,label,summary,[role=button],[tabindex],select,input")) problems.push(`clickable but not keyboard reachable: ${desc(el)}`);
  }
  (document.activeElement)?.blur?.();
  return { stops: stops.length, problems };
};
