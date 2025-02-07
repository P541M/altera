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
    request.value ? applyDarkMode() : removeDarkMode();
  }
  if (request.action === "updateCourseImage") {
    replaceCourseImages(request.value);
  }
});

// Dark Mode Functions
function applyDarkMode() {
  // Prevent multiple dark mode style elements
  if (document.getElementById("altera-dark-mode")) return;
  const style = document.createElement("style");
  style.id = "altera-dark-mode";
  style.textContent = `
    body, .d2l-container, .d2l-header, .d2l-footer {
      background: #1a1a1a !important;
      color: #e0e0e0 !important;
    }
    /* Add additional selectors as needed */
  `;
  console.log("Applying dark mode");
  document.head.appendChild(style);
}

function removeDarkMode() {
  const style = document.getElementById("altera-dark-mode");
  if (style) {
    console.log("Removing dark mode");
    style.remove();
  }
}

// Image Replacement Function
function replaceCourseImages(imageURL) {
  document.querySelectorAll(".course-image-class").forEach((img) => {
    img.src = imageURL;
  });
}
