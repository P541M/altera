# Contributing to Altera

Thanks for helping make CourseLink better. Altera is small and has no build
step, so you can go from a fresh copy to a working change in a few minutes.

Bug reports, fixes for pages that still look wrong, accessibility
improvements and documentation are all welcome. Please follow the
[code of conduct](CODE_OF_CONDUCT.md), and report security issues privately
as described in [SECURITY.md](SECURITY.md), not as public issues. For anything bigger, such as
a new feature or setting, open an issue first so we can agree on the approach
before you put in the work.

## Before you start

- **A Chromium browser:** Chrome, Edge or Brave.
- **A University of Guelph CourseLink account** to test anything behind the
  sign-in. Without one you can still work on the sign-in page, the popup, the
  icon, the tools and the docs.
- **Node.js** for the checks in `tools/`.
- **Python with Pillow**, only if you change the icon.

Read [AGENTS.md](AGENTS.md) before changing code. It holds the rules every
change follows: how the theme is scoped, where a fix goes, the palette and
contrast requirements, and the checklist a change must pass.
[README.md](README.md) explains how everything works and why.

## Set up

1. Fork the repository on GitHub and clone your fork.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load
   unpacked** and choose the cloned folder (the one containing
   `manifest.json`).
3. Open CourseLink. If you have another copy of Altera installed, turn it off
   so the two don't both run.

After editing, click the reload icon on Altera's card in
`chrome://extensions`, then reload the CourseLink page. Open tabs pick up the
new CSS and `theme.js` straight away, but `main-world.js` only refreshes on
the next page load.

## Making a change

1. Create a branch for one focused change, for example `fix/grades-table` or
   `docs/install-steps`.
2. Find where the problem comes from. The "Fixing something that's still
   light" table in the README and "Where a fix goes" in AGENTS.md cover most
   cases.
3. Keep to the surface language: recolour, don't redraw. Don't add borders,
   gradients or animations that CourseLink doesn't have, and nothing Altera
   adds should be visible on the page.
4. Run the checks:

   ```sh
   node --check src/content/theme.js   # every .js file you changed
   node tools/check-tokens.js
   node tools/check-contrast.js
   ```

5. Work through the verification checklist in AGENTS.md: both themes, 390px
   width, every menu, dialog and hover state on the page, and inside its
   frames.

## Testing on CourseLink

- **Look, don't act.** Never submit, post, send, save or start anything while
  testing: no quiz attempts, no Dropbox submissions, no messages. Open things
  and close them.
- **Keep screenshots private.** CourseLink pages show your name, courses,
  grades and classmates. Crop or blur them before attaching them to an issue
  or pull request.

## Commit messages

Short, with a prefix, matching the existing history:

```
fix: restore past course images
feat: add an accent colour
docs: explain the keep-alive request
```

## Pull requests

Open the pull request against `main` and fill in the template. Include before
and after screenshots in dark mode, plus one in light mode showing it's
unchanged. Keep each pull request to one change; it's much easier to review
and to undo if something goes wrong.

## Reporting a bug

Use the bug report form on the Issues tab. The most useful details are the
page (you can remove the numbers from the address), the theme and accent, the
window width, a screenshot, and whether it still happens with Altera turned
off. That last one tells us straight away whether it's Altera or CourseLink.

## License

Altera is released under the [MIT License](LICENSE). By contributing, you
agree that your contributions are released under the same license.
