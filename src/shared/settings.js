// Settings shared by the popup, the background worker and content scripts.
// Loaded as a classic script (content scripts, popup) or via importScripts
// (service worker), so it only declares globals.

const ALTERA_DEFAULTS = Object.freeze({
  theme: "dark", // "dark" | "light" | "system"
  accent: "blue", // "blue" | "gryphon" | "gold" | "violet" | "mint"
  darkContent: true, // also darken instructor-authored course content
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
