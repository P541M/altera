importScripts("shared/settings.js");

const COURSELINK = "https://courselink.uoguelph.ca";
const ALARM = "altera-keepalive";
// CourseLink's idle timeout is 180 minutes; pinging every 5 keeps a wide margin
// even if a few pings are skipped while the computer sleeps.
const PING_MINUTES = 5;

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.alarms.create(ALARM, { periodInMinutes: PING_MINUTES });
  // Not on chrome_update: open tabs already run this version's scripts.
  if (reason === "install" || reason === "update") injectIntoOpenTabs();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: PING_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) keepAlive();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-dark-mode") return;
  const { theme } = await alteraGetSettings();
  const isDark =
    theme === "dark" ||
    (theme === "system" && (await systemPrefersDark()));
  alteraSetSettings({ theme: isDark ? "light" : "dark" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "altera:hello" && sender.tab) {
    onCourseLinkTab(sender.tab);
  } else if (message.type === "altera:ping-now") {
    keepAlive().then(sendResponse);
    return true;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.keepAlive) {
    // Let the browser discard idle CourseLink tabs again when keep-alive is off.
    chrome.tabs.query({ url: `${COURSELINK}/*` }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.update(tab.id, { autoDiscardable: !changes.keepAlive.newValue });
      }
    });
  }
});

async function onCourseLinkTab(tab) {
  const { keepAlive: enabled } = await alteraGetSettings();
  // Memory Saver discards background tabs, which stops our pings and is the
  // usual way a forgotten CourseLink tab ends up signed out.
  if (enabled) chrome.tabs.update(tab.id, { autoDiscardable: false });
  // Make sure the alarm exists even if the worker was installed while Chrome
  // was already running (onStartup doesn't fire then).
  const existing = await chrome.alarms.get(ALARM);
  if (!existing) chrome.alarms.create(ALARM, { periodInMinutes: PING_MINUTES });
}

// Ask one open CourseLink tab to extend the session. The ping has to run in the
// page so it carries the page's cookies and anti-forgery token.
async function keepAlive() {
  const { keepAlive: enabled } = await alteraGetSettings();
  if (!enabled) return { status: "disabled" };

  const tabs = await chrome.tabs.query({ url: `${COURSELINK}/*` });
  if (tabs.length === 0) return recordStatus({ status: "idle" });

  // Prefer tabs that are loaded and not on the sign-in page.
  tabs.sort((a, b) => Number(Boolean(a.discarded)) - Number(Boolean(b.discarded)));
  let answered = false;
  for (const tab of tabs) {
    if (tab.discarded || tab.status !== "complete") continue;
    try {
      const result = await chrome.tabs.sendMessage(tab.id, { type: "altera:keepalive" });
      answered = true;
      if (result && result.status !== "no-session") return recordStatus(result);
    } catch {
      // No content script in this tab; try the next.
    }
  }
  return recordStatus({ status: answered ? "no-session" : "unreachable" });
}

// Content scripts only load with a page, so after an install or update the
// CourseLink tabs that are already open would stay light and unreachable
// until reloaded. Inject the same scripts into them now.
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: `${COURSELINK}/*` });
  for (const tab of tabs) {
    // A tab that loaded after the update already has the current scripts;
    // injecting again would double the keep-alive pings.
    if (tab.discarded || (await isLive(tab.id))) continue;
    const allFrames = { tabId: tab.id, allFrames: true };
    try {
      await chrome.scripting.insertCSS({ target: allFrames, files: ["src/styles/theme.css"] });
      await chrome.scripting.executeScript({ target: allFrames, world: "MAIN", files: ["src/content/main-world.js"] });
      await chrome.scripting.executeScript({ target: allFrames, files: ["src/shared/settings.js", "src/content/theme.js"] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content/session.js"] });
    } catch {
      // Tab closed or navigated mid-injection; it will load normally.
    }
  }
}

// Only content scripts from this version of the extension can answer.
async function isLive(tabId) {
  try {
    return (await chrome.tabs.sendMessage(tabId, { type: "altera:alive" }, { frameId: 0 })) === true;
  } catch {
    return false;
  }
}

function recordStatus(result) {
  const entry = { ...result, at: Date.now() };
  chrome.storage.local.set({ session: entry });
  return entry;
}

// Service workers have no matchMedia. CourseLink tabs and the popup record the
// system theme whenever they load or it changes.
async function systemPrefersDark() {
  const { systemDark } = await chrome.storage.local.get("systemDark");
  return systemDark ?? false;
}
