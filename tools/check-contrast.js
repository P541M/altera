// Checks every colour pairing Altera relies on against WCAG 2.x AA, in both
// dark styles. Reads the palettes straight from src/styles/theme.css and
// popup/popup.css, and runs the custom-accent maths from
// src/shared/settings.js, so it can't drift from the code.
//
// Usage: node tools/check-contrast.js [--verbose]
// Exits 1 if any pair fails.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const themeCss = read("src/styles/theme.css");
const popupCss = read("popup/popup.css");
const { alteraCustomAccent } = new Function(`${read("src/shared/settings.js")}; return { alteraCustomAccent };`)();
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

const graphite = block(themeCss, "html[data-altera-theme]");
const styles = {
  graphite,
  black: { ...graphite, ...block(themeCss, 'html[data-altera-theme][data-altera-style="black"]') },
};
const mapped = block(themeCss, 'html[data-altera-theme="dark"]');
const tintShare = Number(themeCss.match(/--alt-accent-tint:\s*color-mix\(in srgb, var\(--alt-accent\) (\d+)%/)[1]) / 100;
const accents = { blue: { accent: graphite["--alt-accent"], hover: graphite["--alt-accent-hover"], on: graphite["--alt-on-accent"] } };
for (const name of ["gryphon", "gold", "violet", "mint"]) {
  const v = block(themeCss, `html[data-altera-theme][data-altera-accent="${name}"]`);
  accents[name] = { accent: v["--alt-accent"], hover: v["--alt-accent-hover"], on: v["--alt-on-accent"] };
}
const popupLight = block(popupCss, ":root");
const popupDark = block(popupCss, ':root[data-theme="dark"]');
const popups = {
  light: popupLight,
  graphite: popupDark,
  black: { ...popupDark, ...block(popupCss, ':root[data-theme="dark"][data-style="black"]') },
};

// ----- Checks -----

let failures = 0;
let checked = 0;
function check(label, fg, bg, min) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  checked++;
  if (!ok) failures++;
  if (!ok || verbose) console.log(`${ok ? "  ok " : "FAIL "} ${r.toFixed(2).padStart(5)} >= ${min}  ${label}  (${fg} on ${bg})`);
}

// An accent as link text on every surface and on its own highlight tint, as a
// filled control with on-accent text, and as a focus ring.
function checkAccent(label, a, surfaces) {
  const tint = mix(a.accent, surfaces.surface, tintShare);
  for (const [s, bg] of Object.entries({ ...surfaces, "accent-tint": tint })) {
    check(`${label} accent on ${s}`, a.accent, bg, 4.5);
    check(`${label} hover on ${s}`, a.hover, bg, 4.5);
  }
  check(`${label} on-accent on accent`, a.on, a.accent, 4.5);
  check(`${label} on-accent on hover`, a.on, a.hover, 4.5);
  check(`${label} focus ring on bg`, a.accent, surfaces.bg, 3);
}

// Colours across the whole picker: every 10 degrees of hue at several
// saturations and lightnesses, plus black, white and the greys between.
const picks = [];
const hsl = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const base = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + base.map((v) => Math.round((v + l - c / 2) * 255).toString(16).padStart(2, "0")).join("");
};
for (let h = 0; h < 360; h += 10) for (const s of [0.25, 0.6, 1]) for (const l of [0.1, 0.35, 0.6, 0.85]) picks.push(hsl(h, s, l));
for (const l of [0, 0.25, 0.5, 0.75, 1]) picks.push(hsl(0, 0, l));

for (const [style, p] of Object.entries(styles)) {
  const surfaces = {
    bg: p["--alt-bg"],
    surface: p["--alt-surface"],
    "surface-2": p["--alt-surface-2"],
    "surface-3": p["--alt-surface-3"],
    "surface-float": p["--alt-surface-float"],
    input: p["--alt-input"],
  };

  // Text and status colours: 4.5:1 on every surface
  for (const token of ["--alt-text", "--alt-text-2", "--alt-text-3", "--alt-error", "--alt-success", "--alt-warning"]) {
    for (const [name, bg] of Object.entries(surfaces)) check(`${style}: ${token} on ${name}`, p[token], bg, 4.5);
  }
  // Button labels on secondary buttons, at rest and hovered, and tooltip text
  for (const token of ["--alt-surface-4", "--alt-surface-5"]) check(`${style}: --alt-text on ${token}`, p["--alt-text"], p[token], 4.5);
  check(`${style}: tooltip text`, "#ffffff", p["--alt-tooltip"], 4.5);
  // Icons and control edges: 3:1 (WCAG 1.4.11, non-text contrast)
  for (const token of ["--alt-icon", "--alt-control-border", "--alt-control-border-hover"]) {
    for (const [name, bg] of Object.entries(surfaces)) check(`${style}: ${token} on ${name}`, p[token], bg, 3);
  }
  check(`${style}: unread indicator on nav`, mapped["--d2l-color-primary-accent-indicator"], surfaces.surface, 3);

  for (const [name, a] of Object.entries(accents)) checkAccent(`${style}: ${name}`, a, surfaces);
  for (const pick of picks) checkAccent(`${style}: custom ${pick}`, alteraCustomAccent(pick), surfaces);
}
check("notification badge text", "#ffffff", mapped["--d2l-theme-notification-background-color"], 4.5);

// Popup, in light and both dark styles
for (const [theme, p] of Object.entries(popups)) {
  check(`popup ${theme} text`, p["--text"], p["--bg"], 4.5);
  check(`popup ${theme} muted`, p["--muted"], p["--bg"], 4.5);
  check(`popup ${theme} accent`, p["--accent"], p["--bg"], 4.5);
  check(`popup ${theme} switch track`, p["--control"], p["--bg"], 3);
  for (const status of ["--ok", "--warn", "--bad"]) check(`popup ${theme} ${status} dot`, p[status], p["--bg"], 3);
  check(`popup ${theme} error text`, p["--bad"], p["--bg"], 4.5);
  if (theme === "light") continue;
  for (const [name, a] of Object.entries(accents)) check(`popup ${theme} accent (${name})`, a.accent, p["--bg"], 4.5);
  for (const pick of picks) check(`popup ${theme} accent (custom ${pick})`, alteraCustomAccent(pick).accent, p["--bg"], 4.5);
}

console.log(failures ? `\n${failures} of ${checked} pairs fail` : `\nAll ${checked} pairs pass WCAG AA`);
process.exit(failures ? 1 : 0);
