const $ = (id) => document.getElementById(id);
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const ACCENT_NAMES = { blue: "Blue", gryphon: "Gryphon red", gold: "Gryphon gold", violet: "Violet", mint: "Mint", custom: "Custom" };
const COURSELINK_ACCESS = { origins: ["https://courselink.uoguelph.ca/*"] };

let settings = { ...ALTERA_DEFAULTS };
let lastSession;
let hasAccess = true;
// Changes made here that aren't in storage yet (see updateSoon)
let unsaved = {};
let saveTimer;

alteraGetSettings().then((loaded) => {
  settings = loaded;
  render();
});
chrome.storage.local.get("session", ({ session }) => renderSession(session));
// Firefox lets people take back CourseLink access in about:addons (and Chrome
// can limit it to "on click"); without it Altera does nothing, so say so.
const checkAccess = async () => {
  try {
    hasAccess = await chrome.permissions.contains(COURSELINK_ACCESS);
  } catch {
    hasAccess = true;
  }
  render();
};
checkAccess();
chrome.permissions?.onAdded.addListener(checkAccess);
chrome.permissions?.onRemoved.addListener(checkAccess);
// The version number is the popup's one way out: a quiet link to the source.
const manifest = chrome.runtime.getManifest?.() ?? {};
$("version").textContent = `v${manifest.version ?? ""}`;
if (manifest.homepage_url) {
  $("version").href = manifest.homepage_url;
  $("version").setAttribute("aria-label", `Altera ${manifest.version} on GitHub`);
}

// Offer a shortcut to CourseLink only when we aren't already on it. (Tab URLs
// are only visible to us for CourseLink pages, thanks to host permissions.)
chrome.tabs?.query({ active: true, currentWindow: true }, ([tab]) => {
  $("openCourseLink").hidden = Boolean(tab?.url?.startsWith("https://courselink.uoguelph.ca/"));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.session) renderSession(changes.session.newValue);
  if (area === "sync") {
    for (const [key, { newValue }] of Object.entries(changes)) {
      // An echo of an earlier write mustn't undo what's being dragged now.
      if (key in unsaved) continue;
      settings[key] = newValue ?? ALTERA_DEFAULTS[key];
    }
    render();
  }
});
// The worker has no matchMedia; the shortcut reads this for "System".
const recordSystemDark = () => chrome.storage.local.set({ systemDark: systemDark.matches });
recordSystemDark();
systemDark.addEventListener("change", () => {
  recordSystemDark();
  render();
});
// Keep "refreshed N minutes ago" current while the popup is open.
setInterval(() => renderSession(), 30000);

function update(patch) {
  settings = { ...settings, ...patch };
  render();
  alteraSetSettings(patch);
}

// For a control that changes many times a second (the hue slider): the popup
// follows at once, storage a little behind. chrome.storage.sync allows 120
// writes a minute.
function updateSoon(patch) {
  settings = { ...settings, ...patch };
  unsaved = { ...unsaved, ...patch };
  render();
  saveTimer ??= setTimeout(save, 600);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  if (!Object.keys(unsaved).length) return;
  alteraSetSettings(unsaved);
  unsaved = {};
}

// ----- Controls -----

$("keepAlive").addEventListener("change", (e) => update({ keepAlive: e.target.checked }));
$("darkContent").addEventListener("change", (e) => update({ darkContent: e.target.checked }));
$("tidyHome").addEventListener("change", (e) => update({ tidyHome: e.target.checked }));
document.addEventListener("change", (e) => {
  if (["theme", "darkStyle", "accent"].includes(e.target.name)) update({ [e.target.name]: e.target.value });
});

// The slider turns the hue of the custom colour and keeps its saturation (a
// grey has no hue to turn, so it gains some). What it stores is already the
// readable accent, so the "lightened" note is only for typed colours.
$("customHue").addEventListener("input", (e) => {
  const [, s] = hsl(settings.customAccent) ?? [0, 0.9];
  updateSoon({ customAccent: alteraCustomAccent(hex(Number(e.target.value), Math.max(s, 0.6), 0.68)).accent });
});
$("customHue").addEventListener("change", save);
addEventListener("pagehide", save);

$("customHex").addEventListener("input", (e) => {
  const colour = parseHex(e.target.value);
  e.target.setAttribute("aria-invalid", String(!colour));
  if (colour) updateSoon({ customAccent: colour });
});
// Leaving the field puts back the colour in use, in its full form.
$("customHex").addEventListener("blur", () => {
  save();
  render();
});

$("pingNow").addEventListener("click", async () => {
  const button = $("pingNow");
  button.disabled = true;
  button.classList.remove("is-spinning");
  void button.offsetWidth; // restart the animation
  button.classList.add("is-spinning");
  try {
    renderSession(await chrome.runtime.sendMessage({ type: "altera:ping-now" }));
  } finally {
    button.disabled = false;
  }
});

$("allowAccess").addEventListener("click", async () => {
  try {
    await chrome.permissions.request(COURSELINK_ACCESS);
  } catch {
    // The prompt was dismissed or couldn't open; the line keeps asking.
  }
  checkAccess();
});

// ----- Rendering -----

function render() {
  const dark = settings.theme === "dark" || (settings.theme === "system" && systemDark.matches);
  const custom = alteraCustomAccent(settings.customAccent) ?? alteraCustomAccent(ALTERA_DEFAULTS.customAccent);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.style = settings.darkStyle;
  root.dataset.accent = settings.accent;
  root.style.setProperty("--custom-accent", custom.accent);

  for (const input of document.querySelectorAll('input[name="theme"], input[name="darkStyle"], input[name="accent"]')) {
    input.checked = input.value === settings[input.name];
  }
  $("keepAlive").checked = settings.keepAlive;
  $("darkContent").checked = settings.darkContent;
  $("tidyHome").checked = settings.tidyHome;
  $("accentName").textContent = ACCENT_NAMES[settings.accent] ?? "";

  // Dark style, accent and course files only apply in dark mode.
  for (const [group, why] of [[$("darkStyles"), "Dark styles apply in dark mode"], [$("accents"), "Accent colours apply in dark mode"]]) {
    group.setAttribute("aria-disabled", String(!dark));
    group.title = dark ? "" : why;
    for (const input of group.querySelectorAll("input")) input.disabled = !dark;
  }
  $("darkContent").disabled = !dark;

  const isCustom = settings.accent === "custom";
  $("customRow").hidden = !isCustom;
  $("customHue").disabled = $("customHex").disabled = !dark;
  $("customRow").title = dark ? "" : "Accent colours apply in dark mode";
  // Don't rewrite either control under the pointer or the caret.
  if (document.activeElement !== $("customHue")) $("customHue").value = Math.round((hsl(settings.customAccent) ?? [0])[0]);
  if (document.activeElement !== $("customHex")) {
    $("customHex").value = parseHex(settings.customAccent) ?? ALTERA_DEFAULTS.customAccent;
    $("customHex").setAttribute("aria-invalid", "false");
  }
  $("customNote").hidden = !isCustom || custom.accent === parseHex(settings.customAccent);

  $("pingNow").hidden = !settings.keepAlive || !hasAccess;
  $("allowAccess").hidden = hasAccess;
  renderSession();
}

function renderSession(session = lastSession) {
  lastSession = session;
  const row = document.querySelector(".status-row");
  const text = $("sessionStatus");
  if (!hasAccess) {
    row.dataset.state = "no-access";
    text.textContent = "Altera needs access to CourseLink";
    return;
  }
  if (!settings.keepAlive) {
    row.dataset.state = "disabled";
    text.textContent = "Off. CourseLink signs you out after 3 idle hours";
    return;
  }
  const state = session?.status ?? "pending";
  row.dataset.state = state;
  text.textContent = {
    active: `Signed in · refreshed ${timeAgo(session?.at)}`,
    expired: "Session expired. Sign in to CourseLink again",
    idle: "Open CourseLink to stay signed in",
    "no-session": "Not signed in to CourseLink",
    unreachable: "Reload your CourseLink tab to reconnect",
    error: `Couldn't reach CourseLink${session?.detail ? ` (${session.detail})` : ""}`,
    disabled: "Off",
    pending: "Waiting for the first check",
  }[state];
}

function timeAgo(at) {
  if (!at) return "just now";
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  return `at ${new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

// ----- Colour -----

// "#abc", "abc", "#aabbcc" or "aabbcc" as "#aabbcc"; anything else is null.
function parseHex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? "").trim());
  if (!m) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${digits.toLowerCase()}`;
}

// [hue 0-360, saturation 0-1, lightness 0-1] of a hex colour
function hsl(value) {
  const colour = parseHex(value);
  if (!colour) return null;
  const n = parseInt(colour.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const l = max - d / 2;
  if (d === 0) return [0, 0, l];
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1)), l];
}

function hex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const base = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + base.map((v) => Math.round((v + l - c / 2) * 255).toString(16).padStart(2, "0")).join("");
}
