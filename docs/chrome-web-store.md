# Chrome Web Store

Everything needed to publish Altera, ready to paste into the
[developer dashboard](https://chrome.google.com/webstore/devconsole). Altera
is live at
[Altera for CourseLink](https://chromewebstore.google.com/detail/altera-for-courselink/mhkmaaoiedfemcbpplbnlchmfejkoloe).

## Releasing a version

The same steps for the first upload and every update after it:

1. Merge the changes into `main` and pull.
2. Raise `version` in `manifest.json` (for example `2.0.0` → `2.0.1`). The
   store rejects an upload whose version isn't higher than the last one.
3. Run the checks and the verification list in [AGENTS.md](../AGENTS.md).
4. Build the zip:

   ```sh
   python tools/package.py   # writes dist/altera-<version>.zip
   ```

5. Unzip it into an empty folder, load that folder with **Load unpacked** and
   check it works. That's exactly what users will get.
6. Upload the zip in the dashboard and submit it for review. Review usually
   takes from a few hours to a few days; once it passes, Chrome updates
   everyone automatically.
7. Tag the release (`git tag v2.0.1 && git push --tags`) and attach the same
   zip to a GitHub release, for people who install by hand.

## Store listing

**Name:** Altera for CourseLink

**Summary** (from the manifest, 132 characters at most): CourseLink, refined.

**Category:** Education

**Language:** English

**Description:**

Paste it as plain text, one line per paragraph.

> A proper dark mode for the University of Guelph's CourseLink. It covers everything from grades and quizzes to the calendar and the PDF viewer, and it's built to feel like part of CourseLink, with no banners or extra buttons on the page.
>
> Altera also keeps you signed in while a CourseLink tab is open, so you're not logged out mid-assignment. On a shared computer, turn that off in the popup. Pick an accent colour or follow your system theme, and switch anytime with Alt+Shift+D.
>
> Altera collects nothing and only talks to CourseLink. It's open source at https://github.com/P541M/altera and isn't affiliated with the University of Guelph or D2L.

## Images

**Icon:** `icons/icon-128.png`. The store suggests keeping the artwork within
the middle 96×96 pixels with transparent padding around it. Ours fills almost
the whole square, so it will look slightly larger than other icons; that's
fine, or `tools/make-icons.py` can produce a padded copy for the store.

**Screenshots:** 1280×800, one to five, in dark mode with the Blue accent.
CourseLink shows your name, courses and grades, so blur or crop anything
personal before uploading.

1. **Homepage**, with My Courses showing the current semester's tiles and the
   navigation bar. Blur your name and avatar in the top bar.
2. **The popup** open over a CourseLink page, showing the session status and
   the theme previews.
3. **A course content page** with the sidebar and a topic open, ideally a
   course outline or reading list rather than anything personal.
4. **Discussions or the calendar**, to show tables, lists and menus. Blur
   classmates' names.
5. **The sign-in page**, which needs no account and shows the logos and the
   Sign In button.

**Small promo tile** (440×280, optional): the icon and "CourseLink, refined."
on the dark surface colour, `#151920`.

## Privacy practices tab

**Single purpose:** Altera improves how the University of Guelph's CourseLink
looks and behaves: a dark theme, and keeping the CourseLink session from
timing out while you use it.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| Host access to `courselink.uoguelph.ca` | Applies the dark theme to CourseLink pages and sends CourseLink's own session-extend request. Altera runs on no other site. |
| `storage` | Remembers the user's four settings and the result of the last keep-alive request. |
| `alarms` | Runs the keep-alive request every 5 minutes. |
| `scripting` | Applies Altera to CourseLink tabs that were already open when it was installed or updated, so they don't need reloading. |

**Remote code:** No. Everything Altera runs is in the package.

**Data usage:** Altera collects no user data, so none of the data categories
apply. It reads CourseLink's anti-forgery token from the page only to send it
back to CourseLink with the keep-alive request; the token is never stored or
sent anywhere else. Tick the three certifications (not sold, not used for
unrelated purposes, not used for creditworthiness).

**Privacy policy URL:** https://github.com/P541M/altera/blob/main/PRIVACY.md

## Distribution

- **Visibility:** consider **Unlisted** first. Only people with the link can
  install it, which is a good way to let a few classmates try it before
  making it public.
- **Regions:** all regions is fine, but students are in Canada.
- **Support URL:** https://github.com/P541M/altera/issues
