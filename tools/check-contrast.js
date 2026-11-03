// Checks every colour pairing Altera relies on against WCAG 2.x AA.
// Reads the palette straight from src/styles/theme.css and popup/popup.css,
// so it can't drift from the code.
//
// Usage: node tools/check-contrast.js [--verbose]
// Exits 1 if any pair fails.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const themeCss = fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8");
const popupCss = fs.readFileSync(path.join(root, "popup/popup.css"), "utf8");
const verbose = process.argv.includes("--verbose");

// ----- Colour maths -----

const channels = (hex) => hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// color-mix(in srgb, a t, b)
const mix = (a, b, t) =>
  "#" + channels(a).map((v, i) => Math.round((v * t + channels(b)[i] * (1 - t)) * 255).toString(16).padStart(2, "0")).join("");

// ----- Read the palettes -----

// Hex custom properties declared in the first block that matches `selector`.
function block(css, selector) {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error(`Missing block: ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  const vars = {};
  for (const [, name, hex] of body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\b/gi)) vars[name] = hex.toLowerCase();
  return vars;
}

const dark = block(themeCss, 'html[data-altera-theme="dark"]');
const tintShare = Number(themeCss.match(/--alt-accent-tint:\s*color-mix\(in srgb, var\(--alt-accent\) (\d+)%/)[1]) / 100;
const accents = { blue: { accent: dark["--alt-accent"], hover: dark["--alt-accent-hover"], on: dark["--alt-on-accent"] } };
for (const name of ["gryphon", "gold", "violet", "mint"]) {
  const v = block(themeCss, `html[data-altera-theme][data-altera-accent="${name}"]`);
  accents[name] = { accent: v["--alt-accent"], hover: v["--alt-accent-hover"], on: v["--alt-on-accent"] };
}
const popupLight = block(popupCss, ":root");
const popupDark = block(popupCss, ':root[data-theme="dark"]');

// ----- Checks -----

let failures = 0;
function check(label, fg, bg, min) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failures++;
  if (!ok || verbose) console.log(`${ok ? "  ok " : "FAIL "} ${r.toFixed(2).padStart(5)} >= ${min}  ${label}  (${fg} on ${bg})`);
}

const surfaces = {
  bg: dark["--alt-bg"],
  surface: dark["--alt-surface"],
  "surface-2": dark["--alt-surface-2"],
  "surface-3": dark["--alt-surface-3"],
  "surface-float": dark["--alt-surface-float"],
  input: dark["--alt-input"],
};

// Text and status colours: 4.5:1 on every surface
for (const token of ["--alt-text", "--alt-text-2", "--alt-text-3", "--alt-error", "--alt-success", "--alt-warning"]) {
  for (const [name, bg] of Object.entries(surfaces)) check(`${token} on ${name}`, dark[token], bg, 4.5);
}
// Icons and control edges: 3:1 (WCAG 1.4.11, non-text contrast)
for (const token of ["--alt-icon", "--alt-control-border"]) {
  for (const [name, bg] of Object.entries(surfaces)) check(`${token} on ${name}`, dark[token], bg, 3);
}
check("unread indicator on nav", dark["--d2l-color-primary-accent-indicator"], surfaces.surface, 3);
check("notification badge text", "#ffffff", dark["--d2l-theme-notification-background-color"], 4.5);

// Accents: as link text on every surface and on their own highlight tint,
// as a filled control with on-accent text, and as a focus ring.
for (const [name, a] of Object.entries(accents)) {
  const tint = mix(a.accent, surfaces.surface, tintShare);
  for (const [s, bg] of Object.entries({ ...surfaces, "accent-tint": tint })) {
    check(`${name} accent on ${s}`, a.accent, bg, 4.5);
    check(`${name} hover on ${s}`, a.hover, bg, 4.5);
  }
  check(`${name} on-accent on accent`, a.on, a.accent, 4.5);
  check(`${name} on-accent on hover`, a.on, a.hover, 4.5);
  check(`${name} focus ring on bg`, a.accent, surfaces.bg, 3);
}

// Popup, both themes
for (const [theme, p] of Object.entries({ light: popupLight, dark: popupDark })) {
  check(`popup ${theme} text`, p["--text"], p["--bg"], 4.5);
  check(`popup ${theme} muted`, p["--muted"], p["--bg"], 4.5);
  check(`popup ${theme} accent`, p["--accent"] || popupLight["--preview-accent"], p["--bg"], 4.5);
  check(`popup ${theme} switch track`, p["--control"], p["--bg"], 3);
  for (const status of ["--ok", "--warn", "--bad"]) check(`popup ${theme} ${status} dot`, p[status], p["--bg"], 3);
  check(`popup ${theme} error text`, p["--bad"], p["--bg"], 4.5);
}
for (const [name, a] of Object.entries(accents)) check(`popup dark accent (${name})`, a.accent, popupDark["--bg"], 4.5);

console.log(failures ? `\n${failures} failing pair(s)` : "\nAll pairs pass WCAG AA");
process.exit(failures ? 1 : 0);
