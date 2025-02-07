// Inject the settings cog into Courselink
const cog = document.createElement("img");
cog.src = chrome.runtime.getURL("icons/cog-icon.png");
cog.id = "altera-cog";
document.body.appendChild(cog);

// Open settings panel on cog click
cog.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "openSettings" });
});

// Apply stored settings on page load
chrome.storage.sync.get(["darkMode", "customImage"], (data) => {
  if (data.darkMode) applyDarkMode();
  if (data.customImage) replaceCourseImages(data.customImage);
});

// Listen for real-time changes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleDarkMode") {
    request.value ? applyDarkMode() : removeDarkMode();
  }
  if (request.action === "updateCourseImage") {
    replaceCourseImages(request.value);
  }
});

// Dark Mode Functions
function applyDarkMode() {
  const style = document.createElement("style");
  style.id = "altera-dark-mode";
  style.textContent = `
      body { background: #1a1a1a !important; color: #e0e0e0 !important; }
      /* Add more D2L-specific selectors here */
    `;
  document.head.appendChild(style);
}

function removeDarkMode() {
  const style = document.getElementById("altera-dark-mode");
  if (style) style.remove();
}

// Image Replacement
function replaceCourseImages(imageURL) {
  document.querySelectorAll(".course-image-class").forEach((img) => {
    // Update selector for D2L
    img.src = imageURL;
  });
}
