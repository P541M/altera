// background.js

// Create an alarm that fires every 4 minutes (adjust the interval as needed)
chrome.alarms.create("keepAlive", { periodInMinutes: 4 });

// Listen for the alarm and then execute a keep-alive function in every matching tab
chrome.alarms.onAlarm.addListener(() => {
  // Query for all tabs matching Courselink
  chrome.tabs.query({ url: "https://courselink.uoguelph.ca/*" }, (tabs) => {
    for (const tab of tabs) {
      // Use scripting API to run a function in the context of the tab
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: keepSessionAlive,
      });
    }
  });
});

// This function runs in the tab context to make a simple GET request.
// It leverages the browser's credentials (cookies) to refresh the session.
function keepSessionAlive() {
  // You may want to replace the URL with a lightweight endpoint known to extend the session.
  fetch(window.location.href, { credentials: "include" })
    .then((response) => {
      console.log("Keep alive ping sent", response.status);
    })
    .catch((err) => {
      console.error("Error in keep alive ping", err);
    });
}
