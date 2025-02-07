// Dark Mode Toggle
document.getElementById("darkModeToggle").addEventListener("change", (e) => {
  chrome.storage.sync.set({ darkMode: e.target.checked }, () => {
    // Send message to content script to apply changes
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "toggleDarkMode",
        value: e.target.checked,
      });
    });
  });
});

// Image Upload
document.getElementById("courseImageUpload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = (event) => {
    chrome.storage.sync.set({ customImage: event.target.result }, () => {
      // Update course images
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateCourseImage",
          value: event.target.result,
        });
      });
    });
  };
  reader.readAsDataURL(file);
});

// Load saved settings
chrome.storage.sync.get(["darkMode", "customImage"], (data) => {
  document.getElementById("darkModeToggle").checked = data.darkMode || false;
});
