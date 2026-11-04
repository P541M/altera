# Privacy policy

*Last updated: November 3, 2026*

Altera is a browser extension for the University of Guelph's CourseLink. It
collects no personal information, and it never sends anything to the
developer or to any third party.

## What Altera can access

Altera runs only on pages at `courselink.uoguelph.ca`. On those pages it:

- **Changes how the page looks.** It reads the page's colours and styles so it
  can show them in the dark theme. That happens entirely in your browser.
- **Keeps you signed in, if you leave that on.** Every 5 minutes it asks
  CourseLink to extend your session, using the same request and the same
  anti-forgery token CourseLink's own "Continue session" button uses. The
  token is read from the page, used for that one request to CourseLink, and
  never stored or sent anywhere else.

Altera doesn't read or keep your courses, grades, messages, files or
anything you type.

## What Altera stores

All of it stays in your browser:

| What | Where |
| --- | --- |
| Your four settings (theme, accent, darken course files, keep me signed in) | Chrome's extension storage, synced between your own browsers if you use Chrome sync |
| The result of the last keep-alive request (signed in, expired, and when) | Chrome's local extension storage |
| Whether your system is set to dark mode, so the keyboard shortcut knows what "System" means | Chrome's local extension storage |
| A copy of your settings, and a few recoloured logo images | CourseLink's own storage in your browser, so pages appear in the right theme straight away |

Removing Altera deletes its extension storage. The copy in CourseLink's
storage is cleared with your browsing data for `courselink.uoguelph.ca`.

## What Altera sends

Altera only ever talks to CourseLink itself. It makes the keep-alive request
described above, and it loads CourseLink's logo images again (usually
straight from your browser's cache) so it can recolour their lettering for
the dark theme. It has no analytics, no tracking, no ads and no remote code.

## Permissions

| Permission | Why Altera needs it |
| --- | --- |
| Access to `courselink.uoguelph.ca` | To apply the theme and make the keep-alive request on CourseLink, and nowhere else |
| `storage` | To remember your settings and the last keep-alive result |
| `alarms` | To make the keep-alive request every 5 minutes |
| `scripting` | To apply Altera to CourseLink tabs that were already open when it was installed or updated, without reloading them |

## Shared computers

While "Keep me signed in" is on, CourseLink won't sign you out after 3 idle
hours. On a shared or public computer, sign out of CourseLink when you're
done, or turn that setting off in Altera's popup.

## Changes and contact

Changes to this policy are published in this file, and its history is public
on GitHub. Questions can go to the project's
[issues](https://github.com/P541M/altera/issues), and security problems can
be reported privately as described in [SECURITY.md](SECURITY.md).

Altera is an independent project and isn't affiliated with the University of
Guelph or D2L.
