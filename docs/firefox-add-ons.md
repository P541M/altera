# Firefox Add-ons

Everything needed to publish Altera on addons.mozilla.org (AMO) from the
[Developer Hub](https://addons.mozilla.org/developers/). Altera isn't listed
yet. Until it is, people can load the Firefox build temporarily, as the README's
Install section describes.

## What's different from Chrome

- **The add-on ID is `altera@p541m`** (`browser_specific_settings.gecko.id`
  in `manifest.json`). AMO ties every update to it, so it never changes.
- **Firefox 128 or later** (`strict_min_version`). That's the first version
  that runs `world: "MAIN"` content scripts, which `main-world.js` needs.
- **Its own manifest.** Firefox doesn't run extension service workers, so
  `python tools/package.py` writes the Firefox zip with `background.scripts`
  (`settings.js`, then `background.js`) in place of `service_worker`, and
  without `minimum_chrome_version`. Always upload the `-firefox.zip`.
- **Data collection** is declared in the manifest as
  `data_collection_permissions: { required: ["none"] }`, which AMO requires
  for new add-ons. Firefox shows it as "The developer says this extension
  doesn't require data collection".
- **Site access.** Firefox grants CourseLink access at install, but people can
  turn it off in `about:addons` under **Permissions and data**. Altera then
  does nothing, and its popup says "Altera needs access to CourseLink" with
  an **Allow** button.
- **Signing.** Firefox only installs signed add-ons, apart from temporary
  ones. AMO signs every version it accepts, listed or not.

## Releasing a version

The same steps for the first upload and every update after it:

1. Merge the changes into `main` and pull.
2. Raise `version` in `manifest.json`. AMO, like the Chrome Web Store, rejects
   a version that isn't higher than the last one.
3. Run the checks and the verification list in [AGENTS.md](../AGENTS.md).
4. Build the zips:

   ```sh
   python tools/package.py   # writes dist/altera-<version>-firefox.zip (and the Chrome one)
   ```

5. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary
   Add-on…** and choose the Firefox zip. Check that it loads without warnings
   and works on CourseLink. That's exactly what users will get. Remove it
   again afterwards: while Firefox has the zip loaded, Windows won't let the
   next build overwrite it.
6. In the Developer Hub, choose **Submit a New Add-on** (the first time) or
   **Upload New Version**. Pick **On this site** to list it on AMO, then
   upload the zip. AMO validates it straight away; fix anything it flags as
   an error before going on.
7. When asked whether the add-on needs source code to review, answer **No**.
   The zip is the source, with nothing minified, bundled or generated.
8. Paste the release notes and the reviewer notes below, then submit. Listed
   add-ons are signed and published after automated review, and may get a
   human review later. Firefox updates everyone automatically.
9. Attach the same zip to the GitHub release next to the Chrome one.

To produce a signed file without listing it, choose **On your own** in step 6.
AMO signs it and gives back an `.xpi`, which people can install by opening it
in Firefox. They then update by hand, so listing is the better choice.

## Listing

**Name:** Altera for CourseLink

**Summary** (from the manifest, 250 characters at most): CourseLink, refined.

**Categories:** Appearance

**Description:** the same text as the Chrome Web Store listing in
[chrome-web-store.md](chrome-web-store.md#store-listing).

**Support site:** https://github.com/P541M/altera/issues

**Homepage:** https://github.com/P541M/altera

**License:** MIT

**Privacy policy:** paste [PRIVACY.md](../PRIVACY.md), or link to
https://github.com/P541M/altera/blob/main/PRIVACY.md.

**Screenshots:** the same five as for the Chrome Web Store, taken in Firefox,
with anything personal blurred or cropped.

## Notes to reviewers

> Altera themes the University of Guelph's CourseLink (D2L Brightspace) in dark mode, folds the information widgets on its homepage, and keeps the CourseLink session from timing out. It runs only on https://courselink.uoguelph.ca/*.
>
> - main-world.js runs in the page's world because it styles CourseLink's shadow roots and passes keep-alive results to CourseLink's own session manager. It reads no extension storage.
> - session.js sends POST /d2l/lp/auth/session/extend, the same request as CourseLink's "Continue session" button, with the anti-forgery token CourseLink keeps in localStorage. The token is never stored or sent anywhere else.
> - home.js folds widgets on the homepage by changing the page only; it makes no requests.
> - The only other requests are for CourseLink's own logo images, loaded again to recolour their lettering.
> - No analytics, no remote code, no third-party requests.
>
> Signed-in pages need a University of Guelph account. The sign-in page (https://courselink.uoguelph.ca/) and the toolbar popup work without one.

## Not covered

Firefox for Android isn't declared (`gecko_android`) or tested.
