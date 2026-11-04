## What this changes

<!-- One or two sentences. Link the issue if there is one: Fixes #123 -->

## Pages touched

<!-- e.g. /d2l/home (My Courses tiles), the PDF viewer -->

## Screenshots

<!-- Before and after in dark mode, plus light mode showing it's unchanged.
     Crop or blur names, grades and anything else personal. -->

## Checklist

From the verification list in [AGENTS.md](https://github.com/P541M/altera/blob/main/AGENTS.md):

- [ ] `node --check` passes on every changed `.js` file
- [ ] `node tools/check-tokens.js` passes
- [ ] `node tools/check-contrast.js` passes
- [ ] Reloaded Altera and checked every page this touches, in dark mode
- [ ] Light mode is unchanged from CourseLink without Altera
- [ ] Checked at 390px wide (and the burger menu, if navigation is involved)
- [ ] Opened every menu, dropdown, dialog, tab and hover state on those pages
- [ ] Checked inside frames on those pages (homepage widgets, legacy tools, the PDF viewer)
- [ ] Measured text contrast on the real page, not just the palette
- [ ] Any gradient or border in the result also exists with the theme off
- [ ] No flash when loading the page or switching themes
- [ ] Didn't submit, post, send, save or start anything on CourseLink while testing
- [ ] README and AGENTS.md updated if this changes how something works
- [ ] No AI co-author trailers, "Generated with …" footers or other tool watermarks in the commits or this description
