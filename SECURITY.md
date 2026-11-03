# Security policy

Altera runs inside signed-in CourseLink pages and makes CourseLink's
session-extend request with the page's anti-forgery token, so security issues
matter even though the extension is small.

## Reporting a vulnerability

Please don't open a public issue. Report it privately instead: on GitHub, go
to the repository's **Security** tab and choose **Report a vulnerability**.
Include what an attacker could do, the steps to reproduce, and the browser
version. You'll get a reply as soon as the maintainer can look at it, and
credit in the fix if you'd like it.

## In scope

- Anything that sends data from CourseLink anywhere other than CourseLink
  itself.
- Ways for a web page or another extension to read or misuse the session
  token, the keep-alive request or Altera's stored settings.
- Ways for page content (an announcement, an instructor's file) to run code
  through Altera.

## Out of scope

- Problems in CourseLink, Brightspace or the University's sign-in. Report those
  to the University of Guelph.
- Styling bugs. Use the bug report form instead.

## Supported versions

Only the latest version on the `main` branch gets fixes.
