// Apply stored settings on page load
chrome.storage.sync.get(["darkMode", "customImage"], (data) => {
  if (data.darkMode) {
    applyDarkMode();
  }
  if (data.customImage) {
    replaceCourseImages(data.customImage);
  }
});

// Listen for real-time changes from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleDarkMode") {
    if (request.value) {
      applyDarkMode();
    } else {
      removeDarkMode();
    }
  }
  if (request.action === "updateCourseImage") {
    replaceCourseImages(request.value);
  }
});

// DARK MODE FUNCTIONS

// Global dark mode: add a style element with overrides.
function applyDarkMode() {
  if (!document.getElementById("altera-dark-mode")) {
    const globalStyle = document.createElement("style");
    globalStyle.id = "altera-dark-mode";
    globalStyle.textContent = `
      body, .d2l-container, .d2l-header, .d2l-footer {
        background: #121212 !important;
        color: #e0e0e0 !important;
      }
      a {
        color: #bb86fc !important;
      }
      :root {
        --d2l-color-regolith: #1e1e1e;
        --d2l-color-sylvite: #2c2c2e;
        --d2l-color-gypsum: #444444;
        --d2l-color-mica: #555555;
        --d2l-color-corundum: #666666;
        --d2l-color-chromite: #777777;
        --d2l-color-galena: #888888;
        --d2l-color-tungsten: #999999;
        --d2l-color-ferrite: #aaaaaa;
        --d2l-branding-primary-color: #bb86fc;
      }
    `;
    document.head.appendChild(globalStyle);
  }
  // Inject dark mode styles into any open shadow DOM.
  applyDarkModeRecursive();
}

// Recursively process all elements and inject dark styles into shadow roots.
function applyDarkModeRecursive() {
  document.querySelectorAll("*").forEach((el) => {
    injectDarkStyle(el);
  });
}

// For an element with an open shadowRoot, append a dark-mode style if not already added.
function injectDarkStyle(element) {
  if (element.shadowRoot) {
    if (!element.shadowRoot.getElementById("dark-mode-style")) {
      const darkStyle = document.createElement("style");
      darkStyle.id = "dark-mode-style";
      darkStyle.textContent = `
        :host {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
        }
        a {
          color: #bb86fc !important;
        }
        /* Additional component-specific overrides can be added here */
      `;
      element.shadowRoot.appendChild(darkStyle);
    }
    // Process nested shadow roots.
    element.shadowRoot.querySelectorAll("*").forEach((child) => {
      injectDarkStyle(child);
    });
  }
}

// Remove global dark mode styles and any injected shadow DOM styles.
function removeDarkMode() {
  const globalStyle = document.getElementById("altera-dark-mode");
  if (globalStyle) {
    globalStyle.remove();
  }
  // Remove dark-mode styles from shadow roots.
  document.querySelectorAll("*").forEach((el) => {
    removeInjectedDarkStyles(el);
  });
}

// Recursively remove dark mode style elements from any shadow roots.
function removeInjectedDarkStyles(element) {
  if (element.shadowRoot) {
    const darkStyle = element.shadowRoot.getElementById("dark-mode-style");
    if (darkStyle) {
      darkStyle.remove();
    }
    element.shadowRoot.querySelectorAll("*").forEach((child) => {
      removeInjectedDarkStyles(child);
    });
  }
}

// IMAGE REPLACEMENT FUNCTION (unchanged)
function replaceCourseImages(imageURL) {
  document.querySelectorAll(".course-image-class").forEach((img) => {
    img.src = imageURL;
  });
}

// Use a MutationObserver to watch for dynamically added elements and process them.
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        injectDarkStyle(node);
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });
