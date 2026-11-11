// Tidies CourseLink's organisation homepage (top frame only).
//
// The column beside My Courses is mostly notices that never change. With
// "Tidy homepage" on, every widget except the ones in KEEP_OPEN is folded
// down to its title, which becomes the control that opens and closes it, and
// the ones you open stay open on your next visit. A folded widget is
// CourseLink's own collapsed widget (the same class and attribute its
// "Collapse this widget" action sets), set here in the page only: nothing is
// sent to CourseLink, whose own saved state is put back when the setting is
// turned off. home.css holds the few rules this needs.

(() => {
  if (window !== window.top) return;
  const root = document.documentElement;
  // The widgets people come to the homepage for
  const KEEP_OPEN = new Set(["My Courses", "Announcements", "Web Tools"]);
  const OPENED_KEY = "altera.home"; // titles of the widgets left open, in CourseLink's localStorage

  // Course homepages share the address pattern; CourseLink marks the
  // organisation's own with an org unit that is the organisation itself.
  const isOrgHome = (() => {
    if (!/^\/d2l\/home(\/\d+)?\/?$/.test(location.pathname)) return false;
    try {
      const context = JSON.parse(root.getAttribute("data-global-context"));
      return Boolean(context.orgId) && context.orgUnitId === context.orgId;
    } catch {
      return false;
    }
  })();
  if (!isOrgHome) return;

  // All state is declared before the first apply(), as in theme.js.
  let settings = alteraReadMirror() || ALTERA_DEFAULTS;
  let active = false;
  let observer;
  const opened = readOpened();
  const shipped = new WeakMap(); // widget -> the state CourseLink rendered it in

  // After an update this copy is orphaned and a new one takes over.
  const orphaned = () => !chrome.runtime?.id;

  apply();

  alteraGetSettings().then((fresh) => {
    settings = fresh;
    apply();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.tidyHome) return;
    settings = { ...settings, tidyHome: changes.tidyHome.newValue ?? ALTERA_DEFAULTS.tidyHome };
    apply();
  });

  // One listener for every header: the title is a real button, so Enter and
  // Space arrive here as clicks too.
  document.addEventListener("click", (event) => {
    if (!active || orphaned()) return;
    const header = event.target.closest?.(".d2l-widget[data-altera-widget] > .d2l-widget-header");
    if (!header) return;
    const widget = header.parentElement;
    const open = widget.getAttribute("data-altera-widget") !== "open";
    set(widget, open);
    const title = titleOf(widget);
    if (open) opened.add(title);
    else opened.delete(title);
    try {
      localStorage.setItem(OPENED_KEY, JSON.stringify([...opened]));
    } catch {
      // Storage blocked; the choice just lasts for this page.
    }
  });

  function apply() {
    if (orphaned()) return;
    const on = Boolean(settings.tidyHome);
    if (on === active) return;
    active = on;
    if (on) {
      root.setAttribute("data-altera-home", "tidy");
      tidyAll();
      // Widgets arrive as the page is parsed; folding them in the observer's
      // callback happens before the browser paints them open.
      observer = new MutationObserver(() => {
        if (orphaned()) observer.disconnect();
        else tidyAll();
      });
      observer.observe(root, { childList: true, subtree: true });
    } else {
      observer?.disconnect();
      root.removeAttribute("data-altera-home");
      for (const widget of document.querySelectorAll(".d2l-widget[data-altera-widget]")) restore(widget);
    }
  }

  function tidyAll() {
    for (const widget of document.querySelectorAll(".d2l-widget:not([data-altera-widget])")) tidy(widget);
  }

  function tidy(widget) {
    const heading = widget.querySelector(":scope > .d2l-widget-header h2");
    // The content follows the header, so once it's there the title is whole.
    const content = widget.querySelector(":scope > .d2l-widget-content");
    const title = heading?.textContent.trim();
    if (!title || !content || KEEP_OPEN.has(title) || heading.closest("a")) return;
    shipped.set(widget, { collapsed: widget.classList.contains("d2l-widget-collapsed"), expanded: content.hasAttribute("expanded") });
    // A heading holding a button is the pattern for a section that opens.
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-altera-toggle", "");
    if (content.id) button.setAttribute("aria-controls", content.id);
    button.append(...heading.childNodes);
    heading.append(button);
    set(widget, opened.has(title));
  }

  function set(widget, open) {
    widget.setAttribute("data-altera-widget", open ? "open" : "closed");
    widget.classList.toggle("d2l-widget-collapsed", !open);
    widget.querySelector(":scope > .d2l-widget-content")?.toggleAttribute("expanded", open);
    widget.querySelector("[data-altera-toggle]")?.setAttribute("aria-expanded", String(open));
  }

  // Put a widget back the way CourseLink rendered it.
  function restore(widget) {
    const button = widget.querySelector("[data-altera-toggle]");
    button?.replaceWith(...button.childNodes);
    // A widget tidied by a copy of this script from before an update has no
    // record here; it opens.
    const was = shipped.get(widget) ?? { collapsed: false, expanded: true };
    widget.classList.toggle("d2l-widget-collapsed", was.collapsed);
    widget.querySelector(":scope > .d2l-widget-content")?.toggleAttribute("expanded", was.expanded);
    widget.removeAttribute("data-altera-widget");
  }

  function titleOf(widget) {
    return widget.querySelector(":scope > .d2l-widget-header h2")?.textContent.trim() ?? "";
  }

  function readOpened() {
    try {
      const titles = JSON.parse(localStorage.getItem(OPENED_KEY));
      return new Set(Array.isArray(titles) ? titles : []);
    } catch {
      return new Set();
    }
  }
})();
