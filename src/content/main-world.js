// Runs in the page's own JavaScript world (manifest "world": "MAIN").
//
// 1. Dark mode inside web components. Brightspace builds its UI from web
//    components whose shadow roots page CSS can't reach. We adopt one shared
//    stylesheet into every shadow root as it's created and switch it on and
//    off with the data-altera-theme attribute that theme.js sets on <html>.
// 2. Wordmark logos. The CourseLink and University of Guelph logos are
//    black text beside a coloured graphic. We recolour just the text pixels
//    and leave the crest exactly as designed.
// 3. Session hand-off. session.js (isolated world) can call the extend
//    endpoint but can't reach D2L's session manager; we relay its result.

(() => {
  if (window.__alteraMainWorld) return;
  window.__alteraMainWorld = true;

  const SHADOW_CSS = `
    :host {
      color-scheme: dark;
      /* Dropdowns and menus float one step above the surface they open from */
      --d2l-popover-default-background-color: var(--alt-surface-float);
      --d2l-popover-default-border-color: var(--alt-border-strong);
      --d2l-popover-default-foreground-color: var(--alt-text);
      --d2l-popover-default-shadow-color: rgba(0, 0, 0, 0.5);
    }

    /* Menu items are filled with the base colour (the nav bar's), a shade
       darker than the dropdown they open in; in light mode both are white.
       Menus with Brightspace's own dark theme keep it. */
    :host(d2l-menu:not([theme="dark"])) {
      --d2l-menu-background-color: var(--alt-surface-float);
    }

    /* Tooltips take their fill from the text colour, which the palette flips
       to near-white under hard-coded white text. Give them a raised fill. */
    :host(d2l-tooltip) {
      --d2l-tooltip-background-color: var(--alt-tooltip);
      --d2l-tooltip-border-color: var(--alt-border-heavy);
      --d2l-tooltip-outline-color: transparent;
    }
    :host(d2l-tooltip[state="error"]) {
      --d2l-tooltip-background-color: #a8232d;
      --d2l-tooltip-border-color: #a8232d;
    }

    /* Translucent icon buttons (the "..." on course tiles) sit on photos:
       white icon on a dark scrim, deepening on hover, as in light mode */
    :host([translucent]) {
      --d2l-theme-icon-color-inverted: #ffffff;
      --d2l-theme-background-color-interactive-translucent-hover: rgba(0, 0, 0, 0.8);
    }

    /* Course tiles and other cards. Only the card itself is filled, as in
       light mode: past and future courses put their faded image behind the
       card's inner layers (z-index: -1), so a fill there hides the photo. */
    d2l-card {
      background-color: var(--alt-surface-2) !important;
      border-color: var(--alt-border-strong) !important;
    }
    .d2l-card-container, .d2l-card-link-container {
      border-color: var(--alt-border-strong) !important;
    }
    .d2l-organization-image {
      background-color: var(--alt-surface-3) !important;
    }

    /* Status badges: the course card gives its "Closed" badge a white fill
       and a 2px white ring, the card's own colour, so it reads over course
       photos; the bold variant puts white text on its state colour, which
       the palette lightens */
    .d2l-enrollment-card-status-indicator:not([bold]) {
      background-color: var(--alt-surface-2) !important;
      box-shadow: 0 0 0 2px var(--alt-surface-2) !important;
    }
    :host(d2l-status-indicator[bold]) {
      color: var(--alt-bg) !important;
    }

    /* Selected rows in selectable lists (the Roles filter in All courses):
       a literal light blue, under a label in the text colour */
    :host([selected]:not([selection-disabled]):not([skeleton])) [slot="outside-control-container"] {
      background-color: var(--alt-accent-tint) !important;
    }

    /* Form fields rendered inside components */
    input.d2l-input, textarea.d2l-input, select.d2l-input-select, .d2l-input {
      background-color: var(--alt-input) !important;
      color: var(--alt-text) !important;
      border-color: var(--alt-control-border) !important;
    }
    input.d2l-input:hover:not(:focus):not(:disabled),
    textarea.d2l-input:hover:not(:focus):not(:disabled) {
      border-color: var(--alt-control-border-hover) !important;
    }
    .d2l-input::placeholder { color: var(--alt-text-3) !important; opacity: 1; }

    /* Tables inside components (rubrics) share the table styles whose body
       is hard-coded white */
    .d2l-table > tbody, .d2l-table > tfoot {
      background-color: var(--alt-surface) !important;
    }

    /* Rich-text editor frame (Email, Discussions) */
    .d2l-htmleditor-container {
      background-color: var(--alt-input) !important;
      border-color: var(--alt-control-border) !important;
    }
    /* The writing area's frame is white until its document paints */
    .tox .tox-edit-area__iframe {
      background-color: var(--alt-input) !important;
    }
    /* A toolbar toggle that's on (Format Painter) turns a literal light blue
       under the pointer */
    button[aria-pressed="true"]:hover .d2l-htmleditor-button-background {
      background-color: var(--alt-accent-tint) !important;
    }
    /* The editor's own panels (Accessibility Checker) come from TinyMCE's
       stylesheet: white, with black text and a fixed blue button */
    .tox .tox-dialog,
    .tox .tox-dialog__header,
    .tox .tox-dialog__footer {
      background-color: var(--alt-surface-float) !important;
      border-color: var(--alt-border-strong) !important;
      color: var(--alt-text) !important;
    }
    .tox .tox-dialog__title,
    .tox .tox-dialog__body,
    .tox .tox-dialog__body-content :is(p, label, li) {
      color: var(--alt-text) !important;
    }
    .tox .tox-dialog .tox-button--naked,
    .tox .tox-dialog .tox-button--naked svg {
      color: var(--alt-icon) !important;
      fill: var(--alt-icon) !important;
    }
    .tox .tox-dialog .tox-button:not(.tox-button--naked, .tox-button--secondary) {
      background-color: var(--alt-accent) !important;
      border-color: var(--alt-accent) !important;
      color: var(--alt-on-accent) !important;
    }
    .tox .tox-dialog .tox-button--secondary {
      background-color: var(--alt-surface-4) !important;
      border-color: var(--alt-surface-4) !important;
      color: var(--alt-text) !important;
    }
    .tox .tox-dialog :is(.tox-textfield, .tox-textarea, .tox-listbox) {
      background-color: var(--alt-input) !important;
      border-color: var(--alt-control-border) !important;
      color: var(--alt-text) !important;
    }
    .tox .tox-dialog a {
      color: var(--alt-accent) !important;
    }
    /* Its results keep their meaning: each state's heading and icon in its
       colour, lifted to read on dark, on a deep tint of the same hue */
    .tox .accessibility-issue__description,
    .tox .accessibility-issue__description :is(p, span, div) {
      color: var(--alt-text) !important;
    }
    .tox .accessibility-issue--success :is(h2, .tox-icon svg) { color: var(--alt-success) !important; fill: var(--alt-success) !important; }
    .tox .accessibility-issue--error :is(h2, .tox-icon svg) { color: var(--alt-error) !important; fill: var(--alt-error) !important; }
    .tox .accessibility-issue--warn :is(h2, .tox-icon svg) { color: var(--alt-warning) !important; fill: var(--alt-warning) !important; }
    .tox .accessibility-issue--info :is(h2, .tox-icon svg) { color: var(--alt-accent) !important; fill: var(--alt-accent) !important; }
    .tox .accessibility-issue--success .accessibility-issue__description { background-color: var(--d2l-color-olivine-plus-1) !important; }
    .tox .accessibility-issue--error .accessibility-issue__description { background-color: var(--d2l-color-cinnabar-plus-2) !important; }
    .tox .accessibility-issue--warn .accessibility-issue__description { background-color: var(--d2l-color-carnelian-plus-1) !important; }
    .tox .accessibility-issue--info .accessibility-issue__description { background-color: var(--alt-accent-tint) !important; }

    /* The small toolbar that floats over a table or image being edited */
    .tox .tox-pop__dialog {
      background-color: var(--alt-surface-float) !important;
      border-color: var(--alt-border-strong) !important;
    }
    .tox .tox-pop .tox-tbtn {
      background-color: transparent !important;
      color: var(--alt-icon) !important;
    }
    .tox .tox-pop .tox-tbtn svg {
      fill: var(--alt-icon) !important;
    }
    .tox .tox-pop .tox-tbtn:is(:hover, :focus) {
      background-color: var(--alt-surface-3) !important;
    }
    /* Its pointer is two CSS triangles, one for the fill and one for the edge */
    .tox .tox-pop.tox-pop--bottom::after { border-top-color: var(--alt-surface-float) !important; }
    .tox .tox-pop.tox-pop--bottom::before { border-top-color: var(--alt-border-strong) !important; }
    .tox .tox-pop.tox-pop--top::after { border-bottom-color: var(--alt-surface-float) !important; }
    .tox .tox-pop.tox-pop--top::before { border-bottom-color: var(--alt-border-strong) !important; }

    /* The Source Code dialog is a code editor in its own light colours, under
       class names generated per build. Inverted as one piece, like other
       authored content; the literal dark text colour is what the filter
       flips for plain text. */
    .d2l-htmleditor-sourcecode-container .cm-scroller {
      color: #202122 !important;
      filter: invert(0.93) hue-rotate(180deg);
    }

    /* Loading spinner. The arc animation is drawn by rotating wedges with
       hard-coded fill attributes: #FFF matches the disc, #E6EAF0 the track. */
    .outer-circle,
    .slice path[fill="#fff" i] { fill: var(--alt-surface-float) !important; }
    .slice path[fill="#e6eaf0" i] { fill: var(--alt-surface-4) !important; }

    /* Unread dot on the nav icons: CourseLink's orange, with its ring cut out
       of the nav bar colour as it is in light mode (the ring is hard-coded white) */
    .d2l-labs-navigation-notification-icon-indicator {
      background: #e87511 !important;
      border-color: var(--alt-surface) !important;
    }

    /* Sticky action bars (Save / Cancel) use a translucent white backing */
    .d2l-floating-buttons-container {
      background-color: color-mix(in srgb, var(--alt-surface) 92%, transparent) !important;
      border-color: var(--alt-border) !important;
    }

    /* Black glyph icons used in homepage widgets */
    img[src*="/glyphicons-"] { filter: invert(0.9); }

    /* Inline colours in authored HTML (announcements, discussion posts),
       tagged by theme.js as the page's are (see theme.css) */
    [data-altera-bg="white"] { background-color: var(--alt-surface) !important; }
    [data-altera-bg="neutral"] { background-color: var(--alt-surface-2) !important; }
    [data-altera-bg="mid"] { background-color: var(--alt-border-strong) !important; }
    [data-altera-bg="tint"] {
      background-color: var(--altera-tint) !important;
      color: var(--alt-text) !important;
    }
    [data-altera-fg="dark"] { color: var(--alt-text) !important; }
  `;

  const sheet = new CSSStyleSheet();
  // Recoloured logos live in their own sheet, adopted by the document as well
  // as every shadow root (the sign-in page logos aren't in a component).
  const logoSheet = new CSSStyleSheet();
  const ours = [sheet, logoSheet];
  sheet.replaceSync(SHADOW_CSS);
  sheet.disabled = true; // until theme.js turns dark mode on (see bottom)
  logoSheet.disabled = true;

  // Keep our sheet last in every shadow root's adoptedStyleSheets, even when a
  // component (Lit does this) replaces the list after attaching its root.
  const adopted = Object.getOwnPropertyDescriptor(ShadowRoot.prototype, "adoptedStyleSheets");
  if (adopted && adopted.set) {
    Object.defineProperty(ShadowRoot.prototype, "adoptedStyleSheets", {
      configurable: true,
      enumerable: adopted.enumerable,
      get() {
        return adopted.get.call(this);
      },
      set(sheets) {
        const list = Array.from(sheets).filter((s) => !ours.includes(s));
        adopted.set.call(this, [...list, ...ours]);
      },
    });

    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const shadow = attachShadow.call(this, init);
      try {
        adopted.set.call(shadow, [...adopted.get.call(shadow), ...ours]);
      } catch {
        // Some roots refuse constructed sheets; they just stay light.
      }
      // d2l-html-block renders instructor-written HTML inside its shadow root,
      // out of reach of theme.js's observer. Tell theme.js when it renders so
      // it can tag the inline colours (the event crosses the shadow boundary).
      if (this.localName === "d2l-html-block") {
        const notify = () => shadow.dispatchEvent(new Event("altera:authored-html", { bubbles: true, composed: true }));
        new MutationObserver(notify).observe(shadow, { childList: true, subtree: true });
      }
      return shadow;
    };
  }

  // Shadow roots that existed before we ran (rare at document_start, but
  // possible in about:blank frames).
  const adoptExisting = (node) => {
    for (const el of node.querySelectorAll("*")) {
      if (el.shadowRoot) {
        el.shadowRoot.adoptedStyleSheets = el.shadowRoot.adoptedStyleSheets;
        adoptExisting(el.shadowRoot);
      }
    }
  };
  adoptExisting(document);

  // ---------------------------------------------------------------------------
  // Wordmark logos
  //
  // Each processed logo becomes a rule in the logo sheet:
  //   img[src="<original>"] { content: url(<recoloured copy>) }
  // so it follows the theme on and off and survives component re-renders.
  // Results are cached in localStorage so later pages show them immediately.

  // Versioned: logos recoloured by an earlier algorithm are dropped
  // (the old key is removed on the next cache write).
  const LOGO_CACHE = "altera.logos.v2";
  const LOGO_CACHE_BUDGET = 300_000; // characters of data URL, all logos together
  const LOGO_SELECTOR = [
    ".d2l-labs-navigation-link-image-container img", // nav bar wordmarks
    'img[src*="/shared/login/images/CourseLink"]', // sign-in page
    ".campus_container img",
    'img[src*="/shared/logos/"]', // University lockups placed on course homepages
  ].join(", ");
  const TEXT_RGB = [232, 236, 241]; // --alt-text
  const logos = new Map(); // src -> data URL, or null while processing

  const readLogoCache = () => {
    try {
      return JSON.parse(localStorage.getItem(LOGO_CACHE)) || {};
    } catch {
      return {};
    }
  };

  const addLogoRule = (src, dataUrl) => {
    logos.set(src, dataUrl);
    const selector = `img[src="${CSS.escape(src)}"]`;
    logoSheet.insertRule(`${selector} { content: url("${dataUrl}"); }`, logoSheet.cssRules.length);
  };

  // Logos live in the top frame (nav bar, sign-in page, homepage widgets), so
  // only it pays for loading the cache before first paint.
  if (window === window.top) {
    for (const [src, dataUrl] of Object.entries(readLogoCache())) addLogoRule(src, dataUrl);
  }

  let scanTimer;
  function scheduleLogoScan() {
    clearTimeout(scanTimer);
    const scan = () => {
      for (const img of findAll(document, LOGO_SELECTOR)) {
        const src = img.getAttribute("src");
        if (src && !logos.has(src)) {
          logos.set(src, null);
          recolorLogo(src).catch(() => {});
        }
      }
    };
    // Navigation and homepage widgets render late, some well after load;
    // look again a few times as things settle. A scan only walks the DOM.
    scanTimer = setTimeout(scan, 300);
    window.addEventListener("load", () => {
      for (const delay of [300, 1500, 4000, 8000]) setTimeout(scan, delay);
    }, { once: true });
  }

  function findAll(node, selector, out = []) {
    out.push(...node.querySelectorAll(selector));
    for (const el of node.querySelectorAll("*")) {
      if (el.shadowRoot) findAll(el.shadowRoot, selector, out);
    }
    return out;
  }

  async function recolorLogo(src) {
    const response = await fetch(src, { credentials: "same-origin" });
    const bitmap = await createImageBitmap(await response.blob());
    const { width: w, height: h } = bitmap;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, w, h);
    const px = image.data;

    const saturation = (r, g, b) => {
      const max = Math.max(r, g, b);
      return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    };

    // Opaque backgrounds can't be recoloured cleanly; leave those logos alone.
    let transparent = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 20) transparent++;
    if (transparent < (w * h) / 10) return;

    // Columns containing coloured pixels form the graphic (crest, "Link").
    // Runs of such columns, bridging gaps of a few pixels, are left untouched.
    const coloured = new Uint8Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        if (a > 128 && saturation(r, g, b) > 0.35 && Math.max(r, g, b) > 60) coloured[x] = 1;
      }
    }
    const graphic = new Uint8Array(w);
    let runStart = -1;
    let last = -10;
    const closeRun = () => {
      if (runStart < 0) return;
      for (let x = Math.max(0, runStart - 1); x <= Math.min(w - 1, last + 1); x++) graphic[x] = 1;
    };
    for (let x = 0; x < w; x++) {
      if (!coloured[x]) continue;
      if (runStart < 0 || x - last > 4) {
        closeRun();
        runStart = x;
      }
      last = x;
    }
    closeRun();

    // Recolour the lettering, keeping alpha so anti-aliased edges stay smooth:
    // dark neutral pixels outside the graphic become the text colour, and dark
    // brand colours anywhere (Guelph-Humber's navy) keep their hue but are
    // lifted so they read on dark. Bright crest colours are untouched.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (px[i + 3] === 0) continue;
        const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
        const max = Math.max(r, g, b);
        if (max < 120 && max - Math.min(r, g, b) >= 40) {
          [px[i], px[i + 1], px[i + 2]] = liftLightness(r, g, b);
        } else if (!graphic[x] && max < 140 && saturation(r, g, b) < 0.3) {
          [px[i], px[i + 1], px[i + 2]] = TEXT_RGB;
        }
      }
    }
    ctx.putImageData(image, 0, 0);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    addLogoRule(src, dataUrl);
    try {
      // This is CourseLink's own localStorage (D2L keeps its session state
      // there too), so keep the newest logos within a small budget and never
      // cache a large one; it's recoloured again on the next page instead.
      const older = readLogoCache(); // oldest first
      delete older[src];
      const kept = [];
      let size = 0;
      for (const entry of [[src, dataUrl], ...Object.entries(older).reverse()]) {
        if (size + entry[1].length > LOGO_CACHE_BUDGET) continue;
        size += entry[1].length;
        kept.unshift(entry);
      }
      localStorage.setItem(LOGO_CACHE, JSON.stringify(Object.fromEntries(kept)));
      localStorage.removeItem("altera.logos");
    } catch {
      // Storage full or blocked; we just recolour again next time.
    }
  }

  // Same hue at 75% lightness (saturation capped at 55%): navy becomes a
  // steel blue around 9:1 on the page surface.
  function liftLightness(r, g, b) {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B);
    const d = max - Math.min(R, G, B);
    const l0 = max - d / 2;
    const s = Math.min(0.55, d / (1 - Math.abs(2 * l0 - 1)));
    const h = ((max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4) * 60 + 360) % 360;
    const c = (1 - Math.abs(2 * 0.75 - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = 0.75 - c / 2;
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r1, g1, b1].map((v) => Math.round((v + m) * 255));
  }

  const docAdopted = Object.getOwnPropertyDescriptor(Document.prototype, "adoptedStyleSheets");
  if (docAdopted && docAdopted.set) {
    Object.defineProperty(Document.prototype, "adoptedStyleSheets", {
      configurable: true,
      enumerable: docAdopted.enumerable,
      get() {
        return docAdopted.get.call(this);
      },
      set(sheets) {
        const list = Array.from(sheets).filter((s) => s !== logoSheet);
        docAdopted.set.call(this, [...list, logoSheet]);
      },
    });
    document.adoptedStyleSheets = document.adoptedStyleSheets;
  }

  // ---------------------------------------------------------------------------
  // Follow the theme attribute that theme.js sets on <html>.

  const root = document.documentElement;
  const sync = () => {
    sheet.disabled = logoSheet.disabled = root.getAttribute("data-altera-theme") !== "dark";
    if (!sheet.disabled) scheduleLogoScan();
  };
  sync();
  new MutationObserver(() => {
    sync();
    refreshTabBackgrounds();
  }).observe(root, {
    attributes: true,
    attributeFilter: ["data-altera-theme"],
  });

  // d2l-tabs copies the colour behind it into an inline custom property when
  // it connects (unless it's white), and its scroll arrows fade into that
  // colour. After a theme switch the copy is stale: a dark block behind the
  // arrows in light mode until the page reloads. Redo it the way the
  // component does; if that method ever goes away, drop the stale copy.
  function refreshTabBackgrounds() {
    for (const tabs of findAll(document, "d2l-tabs")) {
      const color = tabs._getComputedBackgroundColor?.();
      if (color && color !== "rgb(255, 255, 255)" && color !== "rgba(255, 255, 255, 1)") {
        tabs.style.setProperty("--d2l-tabs-background-color", color);
      } else {
        tabs.style.removeProperty("--d2l-tabs-background-color");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pass a successful keep-alive to D2L's session manager. This is the same
  // handler D2L runs after its own requests: it records the activity in
  // localStorage, which resets the timeout warning in every CourseLink tab.
  document.addEventListener("altera:session", (event) => {
    try {
      const session = JSON.parse(event.detail);
      window.D2L?.PT?.Auth?.SessionTimeout?.RpcReceivePayloadProvider(session);
    } catch {
      // Not a page with D2L's session manager; nothing to reset.
    }
  });
})();
