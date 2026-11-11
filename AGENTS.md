# Altera engineering and design standards

This file is the source of truth for how Altera's code is written and how it
looks. Read it before writing or reviewing a change. If a change conflicts
with it, either the change is wrong or this file is updated in the same
change; never let them drift. It holds current rules only. The *why* and the
mechanics behind them are in [README.md](README.md); history lives in git.

## The product in one line

**CourseLink, refined.** Altera makes the University of Guelph's CourseLink
(D2L Brightspace) look and behave the way it should, and stays invisible while
doing it. Every rule below serves the same test: *would a student forget an
extension is involved?*

- The tagline is "CourseLink, refined." everywhere it appears (manifest
  `description`, README header, GitHub repository description). Taglines never list features. Feature
  descriptions belong in the README body and the popup's own labels.
- Altera puts nothing of its own on CourseLink pages. No badges, toasts,
  banners, watermarks or "powered by". The toolbar popup is the only place
  Altera's name or icon appears.
- Where Altera changes how a page is laid out, not just its colours (the
  homepage tidy-up, Part 3), it does so with CourseLink's own shapes and
  controls, each change has a setting, and turning that setting off leaves
  the page exactly as CourseLink shipped it.

---

## Part 1: Code standards

### Architecture

| File | Owns | Never |
| --- | --- | --- |
| `src/styles/theme.css` | The palettes (`--alt-*`, both dark styles), Brightspace variable mapping, every page-level colour rule | Rules outside the theme attribute scope |
| `src/styles/home.css` | The homepage tidy-up's layout rules | Colour, or rules outside `html[data-altera-home]` |
| `src/content/main-world.js` | `SHADOW_CSS` (styles inside shadow roots), logo recolouring, the session hand-off to D2L | Reading extension storage (it runs in the page's world, with no `chrome.*`) |
| `src/content/theme.js` | Setting `data-altera-theme`, `data-altera-style`, `data-altera-accent` and `data-altera-frame`, a custom accent's three colours, writing the settings mirror, remapping generated stylesheets, tagging inline styles | Static colour rules (those go in `theme.css`) |
| `src/content/home.js` | Setting `data-altera-home`, folding and unfolding the homepage's widgets, remembering which are open | Requests to CourseLink (it changes the page only), or any page but the organisation homepage |
| `src/content/session.js` | The keep-alive request | Any request other than CourseLink's session-extend endpoint |
| `src/background.js` | The alarm, the shortcut, injection into open tabs, tab discard policy | DOM work or page requests (it asks a tab to do them) |
| `src/shared/settings.js` | Defaults, storage helpers, reading the settings mirror and the custom-accent maths, shared by every context | Context-specific logic |
| `popup/` | The toolbar popup | Talking to CourseLink directly (it goes through storage and the worker) |
| `tools/` | Dev-only checks and generators | Anything the extension loads at runtime |

- **No build step, no dependencies, no framework.** The folder that's loaded
  is the source. Plain JavaScript, one IIFE per content script, globals only in
  `settings.js` (prefixed `altera`/`ALTERA_`).
- **Chrome and Firefox 128+ run the same files.** `manifest.json` is
  Chrome's plus `browser_specific_settings`; `tools/package.py` writes
  Firefox's (an event page in place of the service worker). Use `chrome.*`,
  which both provide, and don't rely on what only one browser allows:
  Firefox lets content scripts read cross-origin stylesheets, and it orders
  extension CSS after the page's, so `theme.css` wins `!important` ties
  there that CourseLink's own sheets win in Chrome.
- **A file belongs to one content-script world.** Chrome injects a file only
  once per frame, so listing it in both the `MAIN` and the isolated entries
  silently drops it from the second. The worlds talk through DOM events
  (`altera:session`, `altera:authored-html`).
- **Permissions stay minimal:** `storage`, `alarms`, `scripting`, and host
  access to `https://courselink.uoguelph.ca/*` only. Adding one needs a reason
  in the README's Privacy section in the same change.
- **Altera talks only to CourseLink:** the keep-alive request, and loading
  CourseLink's logo images again to recolour them. No analytics, no remote
  code, no third-party requests. Never log or store tokens, cookies or page
  content. [PRIVACY.md](PRIVACY.md) promises this to users; a change that
  affects it updates that file too.

### Scoping

- **Every colour rule is scoped under the theme attribute**:
  `html[data-altera-theme="dark"]` (or `"pdf"`, `"content"`). Inside
  `SHADOW_CSS`, the sheet itself is enabled only in dark mode, so its rules
  need no prefix. Light mode's colours are CourseLink's exactly as shipped;
  Altera never recolours it. Neither does a printout: `theme.js` removes the
  attribute for the length of a print.
- **The palette tokens are declared under `html[data-altera-theme]`**, any
  value, so the PDF viewer's variables can use them too. Graphite is that
  block; Black overrides its surfaces and lines under
  `html[data-altera-theme][data-altera-style="black"]`. A rule never names a
  style: it uses a token, and the token follows the style. (The one rule that
  does is the content filter, which has no token to follow.)
- **Every layout rule is scoped under `html[data-altera-home]`**, in
  `home.css`. That attribute is set only on the organisation homepage while
  **Tidy homepage** is on, in light and dark alike.
- Rules generated at runtime (`#altera-remap`) are scoped the same way, and
  `theme.js` skips any selector containing `data-altera` so it never
  processes its own output.
- Attributes Altera writes into CourseLink's DOM are namespaced
  `data-altera-*`. The custom properties it sets inline are `--altera-tint`
  and, on `<html>` while a custom accent is in use, `--alt-accent`,
  `--alt-accent-hover` and `--alt-on-accent`. Storage keys in CourseLink's
  `localStorage` are namespaced `altera.*`.
- The homepage tidy-up is the one place Altera adds an element (a `<button>`
  round a widget's title, marked `data-altera-toggle`) and sets ARIA
  (`aria-expanded`, `aria-controls`) and CourseLink's own
  `d2l-widget-collapsed` class and `expanded` attribute. All of it is undone
  when the setting is turned off.
- **Altera never writes into what someone is writing.** The HTML editor's
  writing area is filtered, not tagged: an attribute or inline property set
  inside it would be saved with the post.

### Where a fix goes

Find where the light colour comes from, then:

| Source of the colour | Fix |
| --- | --- |
| A Brightspace variable | Remap the variable in the palette block of `theme.css` |
| Brightspace's CDN CSS, on a light-DOM element | A rule in the matching section of `theme.css` |
| Inside a shadow root | `SHADOW_CSS` in `main-world.js` (`:host(...)` for the host itself) |
| A same-origin `<style>` with literal colours | Layer 3 (`remapSheets`) handles it; adjust thresholds only with care |
| An inline `style=` or legacy `bgcolor` attribute | Layer 4 (`tagInline` in `theme.js`) tags it; style the tag in `theme.css`, and in `SHADOW_CSS` if it appears in authored HTML |
| A whole frame that isn't Brightspace UI | A new theme mode in `theme.js` (like `pdf` and `content`) |
| A glyph drawn as a data-URI SVG with the dark text colour baked in (a checkbox's tick) | Brightspace keeps these in variables (`--d2l-input-*-image`); remap the variable in `theme.css` with the same path in the icon colour |
| A fill a shade off the surface it sits on, where light mode has both white (menu items in a dropdown, a page framed in a dialog) | Point the inner fill at the outer surface's token: the component's variable in `SHADOW_CSS`, or the frame's `<html>` and `<body>` in `theme.css` |
| Content someone authored, where CourseLink's own tools read the computed colours (the HTML editor's writing area, its Source Code view) | Filter it (`content` mode, or a `filter` in `SHADOW_CSS`); never recolour or tag it |
| Colours that are the point (the editor's colour-picker swatches and its contrast preview) | Leave them alone: exempt them in `tagInline` and in the inline-colour selectors of `theme.css` |
| A component that copies a computed colour into an inline style when it loads (`d2l-tabs`) | Redo its computation on theme change in `main-world.js` (`refreshTabBackgrounds`), or it keeps the old theme until a reload |

Prefer the highest layer that works. A variable remap fixes every use at
once; a selector fixes one.

### Conventions

- **Colours come from tokens.** Use `var(--alt-*)` (or a Brightspace variable
  mapped to one), so a rule works in both dark styles. A literal colour needs
  a comment saying why it can't be a token (CourseLink's own orange, a fill
  inside a data URI, a colour a filter is about to flip).
- **Every `var(--alt-*)` must exist in the palette.** An undefined custom
  property invalidates the declaration silently. `tools/check-tokens.js`
  enforces it.
- **`!important` is expected** in `theme.css` and `SHADOW_CSS`, because
  CourseLink's own rules are often inline or very specific. Keep the selector
  as narrow as the problem, and never use broad ones like `* { … }` or
  `div { … }`.
- **Nothing waits before painting.** The theme is applied synchronously at
  `document_start` from the `localStorage` mirror. Colour fixes never go
  behind `setTimeout`, `requestAnimationFrame` or a debounce, because a delay
  is a visible flash (a 120ms debounce once flashed the Grades table grey).
  Runtime stylesheets are remapped inside the `MutationObserver` callback, and
  known runtime sheets are also covered statically.
- **Declare state before the first `apply()`.** `theme.js` applies the theme
  at the top of its IIFE, and after an update it is injected into fully loaded
  tabs, where that first call remaps stylesheets and tags inline colours
  immediately. A `let`/`const` declared further down is still in its temporal
  dead zone then, and the error aborts the whole script. Copies orphaned by an
  update check `chrome.runtime.id` and stand down.
- **Comments explain constraints** the code can't express: why a colour is
  literal, which CourseLink quirk a rule answers, why something is not done.
  They never narrate the next line. Match the density of the surrounding
  file.
- **No dead code.** Unused rules, tokens, settings and helpers are deleted,
  not commented out.
- **Default stored booleans with `??`**, never `||` toward `true`
  (`false || true` is `true`).
- **Storage access is wrapped in `try`/`catch`** in page contexts (it can be
  blocked); failure degrades quietly (no flash protection, logos recoloured
  again, opened widgets not remembered), never breaks the page.
- **Never throw into CourseLink.** Content scripts swallow their own failures.
  CourseLink's own console errors (Cache `put`, missing `label` warnings) are
  not ours to fix.

### Settings

A new setting is added in four places in one change:

1. `ALTERA_DEFAULTS` in `src/shared/settings.js`.
2. `writeMirror()` in `theme.js`, if it affects first paint (a content script
   reads it back with `alteraReadMirror()`).
3. A control in the popup (`popup.html`, `popup.js`).
4. The settings tables in the README.

Settings sync through `chrome.storage.sync`. The popup and content scripts
react to `storage.onChanged`, so there's never a Save button. A control that
changes many times a second (the hue slider) writes at most every 600ms;
`chrome.storage.sync` allows 120 writes a minute.

A value read from storage is checked before it reaches the page: a custom
accent goes through `alteraCustomAccent()`, which returns nothing for
anything but a six-digit hex colour.

### Keep-alive

- Use only `POST /d2l/lp/auth/session/extend` with the page's `XSRF.Token`,
  the request CourseLink's own "Continue session" button makes. Never
  simulate clicks or activity.
- Successful results go to `D2L.PT.Auth.SessionTimeout.RpcReceivePayloadProvider`
  so every tab's timer resets. Expiries are reported to the popup only.
- The ping interval stays well inside the 180-minute timeout (currently 5
  minutes) so pings skipped while the computer sleeps don't matter.

### Commits and pull requests

- **Commit messages are short**: a prefix and a one-line subject
  (`fix: …`, `feat: …`, `docs: …`, `chore: …`), matching the history.
- **No AI attribution in anything that lands in the repository.** That means
  no `Co-Authored-By:` trailers for AI tools, no "Generated with …" footers,
  and no tool signatures, badges or watermarks in commit messages, pull
  request titles and descriptions, code, comments or docs. This holds for
  every agent and tool, whatever its own default; agents turn their
  attribution off for this repository.
- **The person opening the pull request is its author** and answers for every
  line in it, however it was written.
- Saying in plain words in the pull request description that an AI assistant
  helped ("I used an assistant to draft this") is fine, and helps the
  reviewer. It's a sentence written by the author, never an automatic trailer
  or footer.
- **A check enforces it.** `.github/workflows/no-ai-attribution.yml` runs
  `tools/check-attribution.py` on every pull request's title, description,
  commit messages and added lines, from `main` so a pull request can't change
  it. Run it before pushing:
  `git log origin/main..HEAD --format=%B | python tools/check-attribution.py`.

---

## Part 2: UI system

### Surface language

These are what make Altera look like part of CourseLink rather than an
extension sitting on top of it:

- **Recolour, don't redraw.** Shapes, spacing, type, radii, shadows' geometry
  and motion are CourseLink's. Only colour changes. Two narrow exceptions: a
  light raster asset that can't be recoloured may be redrawn as the same shape
  in the theme's colour (the profile-card pointer), and an asset CourseLink
  ships broken in both themes may be repaired with CourseLink's own assets
  (the PDF viewer's fullscreen button gets pdf.js's icon).
- **No gradients unless CourseLink's light mode visibly has one.** Before
  adding or keeping any `background-image` gradient, turn the theme off and
  look. Fades to white or near-white are flattened (`background-image: none`).
  No glows, no decorative effects.
- **Tone, not lines.** Surfaces separate by elevation. Borders appear only where
  CourseLink already draws one, recoloured to `--alt-border` /
  `--alt-border-strong`. Never add a border CourseLink doesn't have.
- **No added motion.** No transitions or animations on CourseLink pages beyond
  CourseLink's own.
- **Meaningful colour survives.** Status colours, grade-scheme tints and
  unread indicators keep their hue. Only lightness moves.
- **Logos keep their colours.** Only wordmark lettering is recoloured; crests
  and brand graphics are never inverted or filtered. Black lettering becomes
  the text colour; dark brand-coloured lettering (navy) keeps its hue and
  only gains lightness.

### Palette

Defined once in the first block of `src/styles/theme.css`. Documented with
contrast figures in the README's Palette section; change both together.

| Group | Tokens | Rule |
| --- | --- | --- |
| Elevation | `--alt-bg` < `--alt-surface` < `--alt-surface-2` < `--alt-surface-float` < `--alt-surface-3` < `--alt-surface-4` < `--alt-surface-5` | Each step visibly distinct from its neighbours. Floating UI (menus, dialogs) uses `surface-float`, and so does everything inside it. Hover is one step up. |
| Inputs | `--alt-input` | Below the surface it sits on (darker), with a `--alt-control-border` edge. On Black's page it can only match it. |
| Other fills | `--alt-tooltip`, `--alt-backdrop` | Under a tooltip's white text; behind a dialog |
| Lines | `--alt-border`, `--alt-border-strong`, `--alt-border-heavy`, `--alt-control-border`, `--alt-control-border-hover` | Dividers, popover/card edges, the strongest rules and scrollbar thumbs, form controls (≥ 3:1) |
| Text | `--alt-text`, `--alt-text-2`, `--alt-text-3` | Primary, secondary, tertiary. `--alt-faint` is decorative only, never text. |
| Icons | `--alt-icon` | ≥ 3:1 on every surface |
| Accent | `--alt-accent`, `--alt-accent-hover`, `--alt-on-accent`, `--alt-accent-tint`, `--alt-accent-soft` | Links, primary buttons, focus, selection. Text on an accent fill uses `--alt-on-accent`. |
| Status | `--alt-error`, `--alt-success`, `--alt-warning` | Text-safe (≥ 4.5:1) on every surface |

- **Two dark styles share one set of tokens.** Graphite is the default.
  Black redefines the Elevation, Inputs, Other fills and Lines groups on
  near-black, neutral surfaces, and leaves Text, Icons, Accent and Status
  alone, so anything checked against Graphite's lighter surfaces also holds
  on Black. A new token is defined in both or in neither.
- **Brightspace's neutral scale maps by role**, not by inverted lightness:
  fills to surfaces, mica/corundum to borders, chromite → galena → tungsten →
  ferrite to the text ramp. Light tints become deep tints of the same hue; the
  shades used as text on them are lifted.
- **Accents** (Blue, Gryphon red, Gryphon gold, Violet, Mint) each define
  accent, hover and on-accent under
  `html[data-altera-theme][data-altera-accent="…"]`. A new accent must pass
  every accent check in `tools/check-contrast.js`.
- **A custom accent is derived, never used as picked.**
  `alteraCustomAccent()` keeps the pick's hue and saturation and lightens it
  only until it passes the same checks, so no colour someone can choose
  breaks contrast. `check-contrast.js` runs the whole hue wheel through it.
- **Shadows** keep Brightspace's geometry; only the colour deepens
  (`rgba(0,0,0,.5)` floating, `.35` attached).

### Contrast

WCAG 2.2 AA, measured, not eyeballed:

- 4.5:1 for all text, including placeholders, captions, text on tints and
  text on accent fills.
- 3:1 for control edges, icons, focus rings and status dots.
- Each pair holds on **every** surface the colour can land on, not just the
  one in the screenshot.

`node tools/check-contrast.js` checks both dark styles, every accent, custom
accents across the hue wheel, and the popup in light and both dark styles. It
must pass before a change is done.

### Popup

The popup is Altera's one branded surface.

- **It follows the chosen theme and dark style.** Light uses Brightspace's
  light values, dark uses the page palette (Graphite or Black), and its
  tokens live at the top of `popup.css`.
- **The layout** is one 320px column with four sections (Session,
  Appearance, Homepage, footer), separated by single rules. Section titles
  are small, semibold and muted.
- **Copy** uses sentence case and a quiet voice, with no exclamation marks
  and no emoji. Status lines are plain language ("Signed in · refreshed 2 min
  ago"); errors say what to do ("Reload your CourseLink tab to reconnect").
- **Controls apply instantly.** There's no Save button. A control that doesn't apply
  in the current theme is disabled and says why (`title`), never hidden. The
  hue slider and hex field belong to the Custom accent and show only while
  it's the one selected.
- **No native pickers or dialogs.** They can close an extension popup in
  Firefox. The custom accent is a range input and a text field.
- **Previews** are flat miniature CourseLink pages drawn with blocks, and
  the dark one uses the selected dark style and accent. They have no
  gradients and no images. The hue slider's track is twelve flat steps, not
  a blend.
- **Motion** is feedback only, at 150ms or less (switch slide), plus one
  spin on refresh. All of it is off under `prefers-reduced-motion`.
- **Accessibility:** radio groups for theme, dark style and accent,
  `aria-live` on the status line, visible `:focus-visible` rings, labels on
  icon-only buttons and on the slider and hex field, and `aria-invalid` on a
  hex code that isn't one.
- **One link out:** the footer's version number opens the repository
  (`homepage_url` from the manifest). The popup gets no other external links,
  badges or calls to action.

### Icon

- A single-storey **a** (ring and stem, shared stroke weight) in `--alt-text`
  on a squircle in `--alt-surface`. One colour, no gradient, shadow or
  second accent.
- Generated by `python tools/make-icons.py`; the PNGs are never edited by
  hand. A change to the mark is a change to that script.
- It must stay legible at 16px on both Chrome's light and dark toolbars
  (check the preview the script writes).

---

## Part 3: Homepage

The one place Altera changes layout. The column beside My Courses on the
organisation homepage is mostly notices that never change; **Tidy homepage**
(on by default) folds them down to their titles.

- **CourseLink's own collapsed widget, nothing redrawn.** A folded widget
  gets the class and attribute CourseLink sets when you collapse one
  yourself, so its shape, spacing and animation are CourseLink's. Altera's
  rules only make the title the control: CourseLink's chevron beside it, a
  focus ring, and a smaller gap between folded widgets in a row.
- **In the page only.** `home.js` never calls CourseLink's own collapse
  action, which saves to CourseLink's servers. What you open is remembered in
  CourseLink's `localStorage` (`altera.home`, a list of titles), and what
  CourseLink had saved comes back when the setting is turned off.
- **The widgets people come for stay open and untouched**: My Courses,
  Announcements and Web Tools (`KEEP_OPEN` in `home.js`). Anything else,
  including a widget the University adds later, starts folded.
- **Only the organisation homepage.** Course homepages share the address
  pattern, and their widgets are the instructor's; `home.js` checks
  CourseLink's own page context and leaves them alone.
- **The title is a real button** inside its heading, with `aria-expanded` and
  `aria-controls`. The widget's own "Actions" menu held only Collapse and
  Expand, so it's hidden while the title does that job.
- **Folded before the first paint.** Widgets are folded in the
  `MutationObserver` callback as the page is parsed, like every other change
  Altera makes; none is ever painted open and then closed.
- **Both themes.** Layout rules use CourseLink's own variables for colour, so
  light mode gets the same layout in CourseLink's colours.

A new layout change follows the same terms: its own setting, its own
attribute scope, CourseLink's own shapes, nothing sent to CourseLink, and
fully undone when off.

---

## Releases

- Every release raises `version` in `manifest.json`; the Chrome Web Store
  rejects an upload that doesn't.
- The packages are built only with `python tools/package.py`, which writes a
  Chrome zip and a Firefox zip, ships just `manifest.json`, `src`, `popup`
  and `icons` in each, and refuses to build if a manifest points at a
  missing file.
- The steps, listing text and privacy answers are in
  [docs/chrome-web-store.md](docs/chrome-web-store.md) and
  [docs/firefox-add-ons.md](docs/firefox-add-ons.md).

## Verification

A change is done when all of these pass:

1. `node --check` on every changed `.js` file.
2. `node tools/check-tokens.js`
3. `node tools/check-contrast.js`
4. Reload Altera in `chrome://extensions`, then check every page the change
   touches on CourseLink:
   - dark theme, in both dark styles, with each surface the element can sit on
   - light theme, which must be pixel-identical to CourseLink without Altera
     (with **Tidy homepage** off, on the homepage)
   - 390px width, including the burger menu if navigation is involved
   - every menu, dropdown, dialog, tab and hover state on the page, not just
     its resting state, and every view a tool offers (the Calendar's Day,
     Week, Month and List, not only Agenda)
   - lines as well as surfaces: borders, rules and thin bars lighter than
     the surface they sit on
   - inside every frame on the page (homepage widgets, legacy tools such as
     Self Registration, the PDF viewer, a dialog's page, the HTML editor's
     writing area), which page-level checks don't reach
   - what opens from a plain button, not only from a menu: Add a File, the
     HTML editor's toolbar and its dialogs
   - one surface against the next: a menu item against its dropdown, a
     framed page against its dialog. Light mode has both white, so a shade
     of difference on dark is a band CourseLink doesn't draw
   - in Firefox too (`dist/firefox/` from `python tools/package.py`), for a
     change to the manifest, the background, the popup or a script's logic
5. Contrast on the real page, not only the palette: CourseLink's CDN CSS
   still carries literal colours (a footer grey, a link blue) that pass on
   white and fail on dark. Measure text against its actual background.
6. For any gradient or border in the result: the same element with the theme
   off has it too.
7. No flash: navigate to the page and switch themes. No frame should show
   light colours.
8. For the homepage: folded on load with no jump, each title opens and
   closes by click and by keyboard, the choice survives a reload, and
   turning **Tidy homepage** off restores every widget to CourseLink's own
   state with no `data-altera-*` left in the page.
9. Testing never submits, posts, sends, saves or starts anything on
   CourseLink (no quiz attempts, no Dropbox submissions, no messages). Open
   and close only. Close a dialog with its own Cancel, never a button on the
   page behind it, and don't collapse or expand a widget through CourseLink's
   own menu, which saves to the account.
