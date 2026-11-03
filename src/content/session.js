// Keeps the CourseLink session alive (top frame only).
//
// CourseLink (D2L Brightspace) signs you out after 180 idle minutes. Its own
// "Continue session" button POSTs to /d2l/lp/auth/session/extend with the
// page's anti-forgery token; we make the same call when the background worker
// asks, then hand the server's answer to D2L's session manager (via
// main-world.js) so every open tab resets its timeout warning.

const EXTEND_URL = "/d2l/lp/auth/session/extend";

chrome.runtime.sendMessage({ type: "altera:hello" }).catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "altera:keepalive") return;
  extendSession().then(sendResponse);
  return true;
});

async function extendSession() {
  // The token D2L stores for its own requests. No token means this page isn't
  // a signed-in CourseLink page (e.g. the login screen).
  const token = localStorage.getItem("XSRF.Token");
  if (!token) return { status: "no-session" };

  let response;
  try {
    response = await fetch(EXTEND_URL, {
      method: "POST",
      credentials: "include",
      headers: { "X-Csrf-Token": token },
      // Once the University sign-in has lapsed, CourseLink redirects to it.
      redirect: "manual",
    });
  } catch {
    return { status: "error", detail: "network error" };
  }
  if (response.type === "opaqueredirect") return { status: "expired" };
  if (!response.ok) return { status: "error", detail: `HTTP ${response.status}` };

  try {
    // D2L prefixes JSON responses with "while(1);" to block JSON hijacking.
    const text = (await response.text()).replace(/^while\(1\);/, "");
    const session = JSON.parse(text)?.Data?.session;
    if (!session) return { status: "error", detail: "unexpected response" };

    if (session.HasExpired) return { status: "expired" };

    // Only report successes to D2L; on an expiry we let D2L find out on its own
    // rather than risk popping its "session expired" dialog over a false alarm.
    document.dispatchEvent(
      new CustomEvent("altera:session", { detail: JSON.stringify(session) })
    );
    return { status: "active" };
  } catch {
    // A sign-in or maintenance page served without a redirect isn't JSON.
    return { status: "error", detail: "unexpected response" };
  }
}
