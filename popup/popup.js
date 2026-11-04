const $ = (id) => document.getElementById(id);
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const ACCENT_NAMES = { blue: "Blue", gryphon: "Gryphon red", gold: "Gryphon gold", violet: "Violet", mint: "Mint" };
const COURSELINK_ACCESS = { origins: ["https://courselink.uoguelph.ca/*"] };

let settings = { ...ALTERA_DEFAULTS };
let lastSession;
let hasAccess = true;

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

// ----- Controls -----

$("keepAlive").addEventListener("change", (e) => update({ keepAlive: e.target.checked }));
$("darkContent").addEventListener("change", (e) => update({ darkContent: e.target.checked }));
document.addEventListener("change", (e) => {
  if (e.target.name === "theme") update({ theme: e.target.value });
  if (e.target.name === "accent") update({ accent: e.target.value });
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
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.accent = settings.accent;

  for (const input of document.querySelectorAll('input[name="theme"], input[name="accent"]')) {
    input.checked = input.value === settings[input.name];
  }
  $("keepAlive").checked = settings.keepAlive;
  $("darkContent").checked = settings.darkContent;
  $("accentName").textContent = ACCENT_NAMES[settings.accent] ?? "";

  // Accent and course files only apply in dark mode.
  const swatches = document.querySelector(".swatches");
  swatches.setAttribute("aria-disabled", String(!dark));
  swatches.title = dark ? "" : "Accent colours apply in dark mode";
  for (const input of swatches.querySelectorAll("input")) input.disabled = !dark;
  $("darkContent").disabled = !dark;
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
