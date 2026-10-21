import { HostToGuide } from "../../guideMessages.js";
import { tr } from "./i18n.js";
import { el, icon, iconButton, enableTips } from "./ui.js";
import type { IconName } from "./icons.js";
import { ICONS } from "./icons.js";

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const api = acquireVsCodeApi();
const send = (m: Record<string, unknown>) => api.postMessage({ v: 1, ...m });
const app = document.getElementById("app")!;
enableTips();

type Step = { id: string; icon: string; title: string; lead: string; points: string[]; tip?: string | undefined; actions: { id: string; label: string; icon: string }[] };
let steps: Step[] = [], done = new Set<string>(), at = 0;
const ic = (n: string, size = 18) => icon((n in ICONS ? n : "check") as IconName, size);

function render() {
  app.replaceChildren();
  const step = steps[at]!;
  const top = el("div", { class: "topbar" });
  const prog = el("div", { class: "guide-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(steps.length), "aria-valuenow": String(done.size), "aria-label": tr("Progress") });
  const fill = el("span"); fill.style.width = `${Math.round((done.size / steps.length) * 100)}%`; prog.append(fill);
  top.append(el("div", { class: "brand" }, ""), el("span", { class: "grow" }), el("span", { class: "chip" }, tr("{0} of {1} steps seen", done.size, steps.length)), prog,
    iconButton("refresh", tr("Start the guide over"), () => send({ type: "reset" })));
  top.firstElementChild!.append(ic("plug", 22), el("h1", { id: "title", tabindex: "-1" }, tr("RizomaDB guide")));

  const nav = el("nav", { class: "guide-nav", "aria-label": tr("Steps") });
  const ol = el("ol");
  steps.forEach((s, i) => {
    const b = el("button", { type: "button", class: "guide-step", "aria-current": i === at ? "step" : "false" });
    b.append(el("span", { class: "num" }, done.has(s.id) ? "✓" : String(i + 1)), el("span", {}, s.title.replace(/^\d+\.\s*/, "")));
    b.addEventListener("click", () => go(i));
    const li = el("li"); li.append(b); ol.append(li);
  });
  nav.append(ol);

  const body = el("section", { class: "guide-body", "aria-labelledby": "step-title" });
  const head = el("div", { class: "guide-head" }); head.append(ic(step.icon, 28), el("h2", { id: "step-title", tabindex: "-1" }, step.title));
  body.append(head, el("p", { class: "lead" }, step.lead));
  const ul = el("ul", { class: "points" }); for (const p of step.points) ul.append(el("li", {}, p)); body.append(ul);
  if (step.tip) { const tip = el("p", { class: "tip" }); tip.append(ic("check", 16), el("span", {}, step.tip)); body.append(tip); }
  if (step.actions.length) {
    const row = el("div", { class: "guide-actions" });
    for (const a of step.actions) row.append(iconButton((a.icon in ICONS ? a.icon : "plus") as IconName, a.label, () => send({ type: "action", id: a.id }), { text: a.label, primary: true }));
    body.append(el("h3", {}, tr("Try it")), row);
  }
  const pager = el("div", { class: "guide-pager" });
  const prev = iconButton("left", tr("Previous step"), () => go(at - 1), { text: tr("Back") }); prev.disabled = at === 0;
  const next = iconButton("down", at === steps.length - 1 ? tr("Finish") : tr("Next step"), () => go(Math.min(steps.length - 1, at + 1)), { text: at === steps.length - 1 ? tr("Finish") : tr("Next"), primary: true });
  next.classList.add("next");
  pager.append(prev, el("span", { class: "grow" }), next);
  body.append(pager);

  const layout = el("div", { class: "guide" }); layout.append(nav, body);
  app.append(top, layout);
  send({ type: "visit", id: step.id }); done.add(step.id);
  (document.getElementById("step-title") as HTMLElement).focus();
  fill.style.width = `${Math.round((done.size / steps.length) * 100)}%`; prog.setAttribute("aria-valuenow", String(done.size));
}
function go(i: number) { at = Math.max(0, Math.min(steps.length - 1, i)); render(); }

window.addEventListener("message", (ev: MessageEvent) => {
  const p = HostToGuide.safeParse(ev.data);
  if (!p.success) return;
  steps = p.data.steps; done = new Set(p.data.done);
  at = Math.max(0, steps.findIndex((s) => s.id === p.data.current));
  render();
});
app.setAttribute("role", "main");
send({ type: "ready" });
