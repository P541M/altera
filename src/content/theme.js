// Applies the theme to one CourseLink frame (runs in every frame).
//
// Sets data-altera-theme / data-altera-accent on <html>; theme.css and the
// shadow-root sheet in main-world.js key everything off those attributes.
// On top of the static CSS it patches two kinds of colours we can't know in
// advance:
//   - per-page CSS classes D2L generates with literal colours (remapSheets)
//   - inline background/text colours in server-rendered markup (tagInline)

(() => {
  const root = document.documentElement;
  const MIRROR_KEY = "altera.settings";
  const P = 'html[data-altera-theme="dark"]';

  // Instructor-uploaded files (HTML topics in the content viewer) are served
  // from /content/, and University-authored pages shown in courses from
  // /shared/. They aren't Brightspace UI and bring their own stylesheets, so
  // they get a filter-based treatment instead of the palette swap. The
  // sign-in page also lives under /shared/ and is themed like the rest.
  const path = location.pathname;
  const isContentFrame = path.startsWith("/content/") || (path.startsWith("/shared/") && !path.startsWith("/shared/login/"));
  // CourseLink's PDF viewer (pdf.js) has its own colour variables.
  const isPdfViewer = path.includes("/pdfjs");
  const isTopFrame = window === window.top;
  const systemDark = matchMedia("(prefers-color-scheme: dark)");

  // All state is declared before the first apply(): injected into an already
  // loaded tab (after an update), apply() remaps and tags straight away.
  let settings = readMirror() || ALTERA_DEFAULTS;
  let patching = false;
  let printing = false;
  const remapped = new WeakMap(); // CSSStyleSheet -> rewritten CSS (remapSheets)
  let colorContext; // canvas context that normalises named colours (parseColor)

  // After an update this copy is orphaned (chrome.* stops working) and the
  // new copy injected by background.js takes over; this one stands down.
  const orphaned = () => !chrome.runtime?.id;

  apply();

  // Printouts use CourseLink's own light styles: browsers drop page
  // backgrounds when printing, so the dark theme would print light text on
  // white paper.
  addEventListener("beforeprint", () => {
    printing = true;
    apply();
  });
  addEventListener("afterprint", () => {
    printing = false;
    apply();
  });

  alteraGetSettings().then((fresh) => {
    settings = fresh;
    writeMirror();
    apply();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings = { ...settings, [key]: newValue ?? ALTERA_DEFAULTS[key] };
    }
    writeMirror();
    apply();
  });

  // The service worker has no matchMedia; the shortcut reads this to know
  // what "System" currently means.
  const recordSystemDark = () => {
    if (isTopFrame && !orphaned()) chrome.storage.local.set({ systemDark: systemDark.matches });
  };
  recordSystemDark();
  systemDark.addEventListener("change", () => {
    recordSystemDark();
    apply();
  });

  // Lets the worker skip tabs that already run this version when it injects
  // into open tabs (orphaned scripts from an old version can't answer).
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "altera:alive" && isTopFrame) sendResponse(true);
  });

  // d2l-html-block renders instructor-written HTML (announcements, discussion
  // posts) inside its shadow root, out of reach of the observer below, with
  // whatever inline colours the editor or a paste left behind. main-world.js
  // signals when one renders; its shadow root is open, so tag it from here.
  document.addEventListener("altera:authored-html", (event) => {
    if (!orphaned()) tagInline(event.composedPath()[0]);
  });

  function isDark() {
    return settings.theme === "dark" || (settings.theme === "system" && systemDark.matches);
  }

  function apply() {
    if (orphaned()) return;
    let mode = null;
    if (isDark() && !printing) {
      if (isContentFrame) mode = settings.darkContent ? "content" : null;
      else mode = isPdfViewer ? "pdf" : "dark";
    }

    if (mode) root.setAttribute("data-altera-theme", mode);
    else root.removeAttribute("data-altera-theme");
    root.setAttribute("data-altera-accent", settings.accent);

    if (mode === "dark") startPatching();
  }

  // A copy of the settings in the page's localStorage lets us read them
  // synchronously at document_start, so pages don't flash white while
  // chrome.storage answers.
  function readMirror() {
    try {
      return { ...ALTERA_DEFAULTS, ...JSON.parse(localStorage.getItem(MIRROR_KEY)) };
    } catch {
      return null;
    }
  }

  function writeMirror() {
    try {
      const { theme, accent, darkContent } = settings;
      localStorage.setItem(MIRROR_KEY, JSON.stringify({ theme, accent, darkContent }));
    } catch {
      // Storage blocked; we just lose the flash protection.
    }
  }

  // ---------------------------------------------------------------------------
  // Runtime patching (only once dark mode is first turned on in this frame).

  function startPatching() {
    if (patching) return;
    patching = true;

    // Remap stylesheets the moment they're added, inside the observer's
    // microtask, so the browser never paints a frame with their light
    // colours (components inject sheets like `.d2l-table > tbody { white }`
    // at runtime). Same-origin <link> sheets are remapped once they load.
    remapSheets();
    new MutationObserver((mutations, observer) => {
      if (orphaned()) return observer.disconnect();
      let sheetAdded = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE || node.id === "altera-remap") continue;
          if (node.tagName === "STYLE") sheetAdded = true;
          else if (node.tagName === "LINK") node.addEventListener("load", remapSheets, { once: true });
          else tagInline(node);
        }
      }
      if (sheetAdded) remapSheets();
    }).observe(root, { childList: true, subtree: true });

    const tagAll = () => tagInline(document.body);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        remapSheets();
        tagAll();
      }, { once: true });
    } else {
      tagAll();
    }
  }

  function luminance(color) {
    const c = parseColor(color);
    return c && c.a >= 0.5 ? relativeLuminance(c) : null;
  }

  // Map a literal light-theme text colour to the dark palette. Saturated
  // blues are link colours (#006fbf, #295376) and become the accent; the rest
  // keep their primary / secondary / muted rank.
  function textVar(color) {
    const c = parseColor(color);
    if (!c || c.a < 0.5) return null;
    const l = relativeLuminance(c);
    if (l >= 0.5) return null;
    const max = Math.max(c.r, c.g, c.b);
    const h = hue(c.r, c.g, c.b);
    if ((max - Math.min(c.r, c.g, c.b)) / max > 0.35 && h >= 195 && h <= 240) return "var(--alt-accent)";
    if (l < 0.2) return "var(--alt-text)";
    if (l < 0.4) return "var(--d2l-color-tungsten)";
    return "var(--alt-text-3)";
  }

  // Rewrites colour rules from the page's own (same-origin) stylesheets into
  // dark equivalents scoped under the theme attribute. D2L emits classes like
  // .d2l_3_13_579 { color: rgb(32, 33, 34) } per page, so this can't be static.
  // Each sheet is rewritten once (cached in `remapped`): pages keep adding
  // <style> elements as they load, and new content means a new sheet object.
  function remapSheets() {
    const visit = (rules, out) => {
      for (const rule of rules) {
        if (rule.cssRules && !rule.selectorText) {
          // Keep the condition, or a print-only rule (`* { color: #000 }`)
          // would come back as a screen rule. Groups whose condition can't
          // be carried over (@scope, @starting-style) are left alone.
          const prelude = groupPrelude(rule);
          if (!prelude) continue;
          const inner = visit(rule.cssRules, []);
          if (inner.length) out.push(`${prelude} { ${inner.join("\n")} }`);
          continue;
        }
        if (!rule.selectorText || !rule.style) continue;
        if (rule.selectorText.includes("data-altera")) continue; // our own rules
        const s = rule.style;
        const decls = [];

        const color = s.getPropertyValue("color");
        const fg = !color.includes("var(") ? textVar(color) : null;
        if (fg) decls.push(`color: ${fg} !important`);

        const bg = s.getPropertyValue("background-color");
        const bgL = !bg.includes("var(") ? luminance(bg) : null;
        if (bgL !== null && bgL > 0.85) decls.push("background-color: var(--alt-surface) !important");

        // Fades to white (overflow fades, header sheens) read as bands on dark.
        const image = s.getPropertyValue("background-image");
        if (image.includes("gradient")) {
          const stops = image.match(/rgba?\([^)]+\)/g) || [];
          if (stops.some((stop) => (luminance(stop) ?? 0) > 0.85)) decls.push("background-image: none !important");
        }

        for (const side of ["top", "right", "bottom", "left"]) {
          const bc = s.getPropertyValue(`border-${side}-color`);
          const bcL = !bc.includes("var(") ? luminance(bc) : null;
          if (bcL !== null && bcL > 0.7) decls.push(`border-${side}-color: var(--alt-border) !important`);
        }

        if (decls.length) out.push(`${scope(rule.selectorText)} { ${decls.join("; ")} }`);
      }
      return out;
    };

    const out = [];
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode?.id === "altera-remap") continue;
      let css = remapped.get(sheet);
      if (css === undefined) {
        try {
          const rules = visit(sheet.cssRules, []).join("\n");
          const media = sheet.media.mediaText; // <link media="print">
          css = media && media !== "all" && rules ? `@media ${media} { ${rules} }` : rules;
        } catch {
          css = ""; // Cross-origin (Brightspace CDN) sheets: covered by theme.css.
        }
        remapped.set(sheet, css);
      }
      if (css) out.push(css);
    }

    let style = document.getElementById("altera-remap");
    if (!style) {
      style = document.createElement("style");
      style.id = "altera-remap";
      (document.head || root).appendChild(style);
    }
    const css = out.join("\n");
    if (style.textContent !== css) style.textContent = css;
  }

  function groupPrelude(rule) {
    if (rule instanceof CSSMediaRule) return `@media ${rule.media.mediaText}`;
    if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}`;
    if (rule instanceof CSSContainerRule) return `@container ${rule.conditionText}`;
    if (rule instanceof CSSLayerBlockRule) return `@layer ${rule.name}`;
    return null;
  }

  function scope(selectorText) {
    return splitSelectors(selectorText)
      .map((sel) => (/^(html|:root)\b/.test(sel) ? sel.replace(/^(html|:root)/, P) : `${P} ${sel}`))
      .join(", ");
  }

  // Split a selector list on top-level commas (not those inside :is(), etc.).
  function splitSelectors(text) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(text.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(text.slice(start).trim());
    return parts.filter(Boolean);
  }

  // Tags elements whose inline styles (or legacy bgcolor attributes)
  // hard-code light-theme colours, for theme.css and SHADOW_CSS to restyle:
  //   data-altera-bg="white"   plain white panels -> dark surface
  //   data-altera-bg="neutral" light grey panels -> raised dark surface
  //   data-altera-bg="tint"    tinted chips (grade scheme colours, highlights)
  //                            -> a deep tint of the same hue (--altera-tint)
  //   data-altera-fg="dark"    near-black inline text -> light text
  function tagInline(node) {
    if (!node?.querySelectorAll) return;
    const selector = "[style], [bgcolor]";
    const els = node.matches?.(selector) ? [node, ...node.querySelectorAll(selector)] : node.querySelectorAll(selector);
    for (const el of els) {
      const bg = parseColor(el.style?.backgroundColor || el.getAttribute("bgcolor"));
      if (bg && bg.a >= 0.5) {
        const { r, g, b } = bg;
        const max = Math.max(r, g, b);
        const light = relativeLuminance(bg) > 0.7;
        if (r >= 245 && g >= 245 && b >= 245) el.setAttribute("data-altera-bg", "white");
        else if (light && (max - Math.min(r, g, b)) / max < 0.03) el.setAttribute("data-altera-bg", "neutral");
        else if (light) {
          // Keep the hue, which often means something (grade scheme
          // colours), as a deep tint that light text reads well on.
          el.style.setProperty("--altera-tint", `hsl(${hue(r, g, b)} 42% 21%)`);
          el.setAttribute("data-altera-bg", "tint");
        }
      }
      const fg = parseColor(el.style?.color);
      if (fg && fg.a >= 0.5 && relativeLuminance(fg) < 0.3) el.setAttribute("data-altera-fg", "dark");
    }
  }

  // Any CSS colour ("rgb(…)", "#F0F0F0", "white") as { r, g, b, a }, or null.
  // Inline styles keep named colours as written, so names go through a canvas
  // context to normalise them. Values that depend on context (currentcolor,
  // var(), inherit) can't be judged and return null.
  function parseColor(value) {
    if (!value || /current|var\(|inherit|initial|unset/i.test(value)) return null;
    let m = value.match(/^rgba?\(([^)]+)\)$/);
    if (!m) {
      colorContext ??= document.createElement("canvas").getContext("2d");
      colorContext.fillStyle = "#000";
      colorContext.fillStyle = value;
      const normalised = colorContext.fillStyle;
      colorContext.fillStyle = "#fff";
      colorContext.fillStyle = value;
      if (colorContext.fillStyle !== normalised) return null; // not a colour; the canvas kept its old value
      if (normalised.startsWith("#")) {
        const n = parseInt(normalised.slice(1), 16);
        return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
      }
      m = normalised.match(/^rgba?\(([^)]+)\)$/);
      if (!m) return null;
    }
    const [r, g, b, a = 1] = m[1].split(",").map(parseFloat);
    return { r, g, b, a };
  }

  function relativeLuminance({ r, g, b }) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  function hue(r, g, b) {
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (d === 0) return 0;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round((h * 60 + 360) % 360);
  }
})();
