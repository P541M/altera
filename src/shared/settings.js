// Settings shared by the popup, the background worker and content scripts.
// Loaded as a classic script (content scripts, popup) or via importScripts
// (service worker), so it only declares globals.

const ALTERA_DEFAULTS = Object.freeze({
  theme: "dark", // "dark" | "light" | "system"
  darkStyle: "graphite", // "graphite" | "black": which palette dark mode uses
  accent: "blue", // "blue" | "gryphon" | "gold" | "violet" | "mint" | "custom"
  customAccent: "#ff9d66", // the colour behind "custom", as picked (see alteraCustomAccent)
  darkContent: true, // also darken instructor-authored course content
  tidyHome: true, // fold the homepage's information widgets down to their titles
  keepAlive: true, // keep the CourseLink session from timing out
});

function alteraGetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (stored) => {
      const settings = { ...ALTERA_DEFAULTS, ...stored };
      // Migrate the v1 boolean setting.
      if (stored.theme === undefined && typeof stored.darkMode === "boolean") {
        settings.theme = stored.darkMode ? "dark" : "light";
      }
      resolve(settings);
    });
  });
}

function alteraSetSettings(patch) {
  return chrome.storage.sync.set(patch);
}

// theme.js keeps a copy of the settings in CourseLink's own localStorage,
// because content scripts need them at document_start and chrome.storage
// can't answer before the first paint. Null if that storage is blocked.
const ALTERA_MIRROR_KEY = "altera.settings";

function alteraReadMirror() {
  try {
    return { ...ALTERA_DEFAULTS, ...JSON.parse(localStorage.getItem(ALTERA_MIRROR_KEY)) };
  } catch {
    return null;
  }
}

// A custom accent from any colour: { accent, hover, on } as hex, or null if
// `hex` isn't a colour. The pick keeps its hue and saturation and is
// lightened only as far as it takes to read as link text (4.5:1) on the
// lightest surface accent text lands on and on its own highlight tint, so a
// navy becomes a readable blue instead of disappearing. `hover` and `on`
// follow the presets: 27% toward white, and a near-black of the same hue for
// text on a filled button. tools/check-contrast.js runs every hue through
// this against the real palette.
function alteraCustomAccent(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const l0 = max - d / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
  const h = d === 0 ? 0 : ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;

  const rgb = (hue, sat, light) => {
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const base = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
    return base.map((v) => Math.round((v + light - c / 2) * 255));
  };
  const linear = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = ([R, G, B]) => 0.2126 * linear(R) + 0.7152 * linear(G) + 0.0722 * linear(B);
  const contrast = (a, c) => {
    const [hi, lo] = [luminance(a), luminance(c)].sort((p, q) => q - p);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (a, c, share) => a.map((v, i) => Math.round(v * share + c[i] * (1 - share)));
  const toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

  // Graphite's --alt-surface-3 and --alt-surface (the tint is the accent mixed
  // 14% into the surface). Black's surfaces are darker, so they pass too.
  const HOVER_SURFACE = [35, 41, 50];
  const SURFACE = [21, 25, 32];
  let accent = rgb(h, s, l0);
  for (let l = l0; l <= 1; l += 0.005) {
    accent = rgb(h, s, Math.min(l, 1));
    if (contrast(accent, HOVER_SURFACE) >= 4.6 && contrast(accent, mix(accent, SURFACE, 0.14)) >= 4.6) break;
  }
  let on = rgb(h, Math.min(s, 0.7), 0.09);
  for (let l = 0.09; l > 0 && contrast(on, accent) < 4.6; l -= 0.01) on = rgb(h, Math.min(s, 0.7), l);
  return { accent: toHex(accent), hover: toHex(mix(accent, [255, 255, 255], 0.73)), on: toHex(on) };
}
