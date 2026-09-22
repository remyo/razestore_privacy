# Raze Store website

A lightweight, responsive website for Raze Store: real app previews, features,
contact information, and the existing privacy policy. No build step, tracking,
external fonts, or frontend dependencies are required.

Suggested repository name: **`razestore_website`**. The current local directory
and GitHub remote are still `razestore_privacy`; they have not been renamed.

## Preview locally

```sh
cd /Users/rem/Desktop/rem_dev/razestore_privacy
python3 -m http.server 8766 --bind 127.0.0.1
```

Open `http://127.0.0.1:8766/`. The policy is at `/privacy.html`.
If the port is occupied, choose another port. This site is also usable by
opening `index.html` directly, although an HTTP preview is recommended.

## What's included

- `index.html`: product website, feature overview, screenshot gallery, contact.
- `privacy.html`: dedicated policy with a section index. The original legal
  wording and September 18, 2026 revision date have been preserved.
- `assets/site.css`: responsive cream/teal theme, with reduced-motion support.
- `assets/site.js`: keyboard-accessible screenshot tabs and an enlarging dialog.
- `assets/screenshots/`: five actual current Flutter app screens, rendered with
  disposable demonstration data. These are not generated mockups or live
  customer screenshots.
- `assets/brand/app-icon.png`: the existing app icon, unchanged.
- `assets/images/raze-store-3d.png`: supporting 3D brand illustration, not a
  replacement app icon. See [asset notes](assets/README.md).

The website does not include an invented store download URL, analytics, a
contact-data collection form, or a fake waitlist. Contact uses the existing
support email. Add a real verified store listing when ready.

## GitHub Pages and repository rename

All local page and asset links are relative, so they work at a GitHub Pages
project subpath after the repository is renamed.

After **you** rename the GitHub repository to `razestore_website`:

1. Update your local remote (this command is documentation, not already run):

   ```sh
   git remote set-url origin git@github.com:remyo/razestore_website.git
   ```

2. Check the repository's GitHub Pages settings. For branch-based publishing,
   use the branch containing these files and the `/ (root)` folder. The current
   local branch is `main`; no branch settings have been changed.
3. After you commit/push and publish, verify the expected website and policy:
   - `https://remyo.github.io/razestore_website/`
   - `https://remyo.github.io/razestore_website/privacy.html`
4. Update the Flutter app's policy URL in
   `lib/features/settings/presentation/settings_detail_screens.dart` to the
   verified **direct `privacy.html` URL**, and update any app-store policy
   links or other references. The app currently points to
   `https://remyo.github.io/razestore_privacy/`.
5. Existing installed apps still contain that old link. Preserve a policy or
   redirect at the old Pages location if old app versions must keep working;
   do not assume the GitHub repository redirect also preserves the Pages URL.

Until the rename, use the current repository path. The root page prominently
links to the full policy; for store-policy submissions, use the direct policy
page rather than the product landing page.

The suggested rename is optional. Keep the current remote and Pages path if
you retain the `razestore_privacy` repository name.

## Browser checks

```sh
node scripts/check.mjs
```

The runner needs Playwright and Chrome. It can use the bundled Codex runtime,
or set `RAZESTORE_NODE_MODULES` to a node_modules directory containing
`playwright` and `RAZESTORE_QA_CHROME` to your Chrome executable. No browser or
package installation is performed by the script.

It starts a temporary local server and checks desktop/tablet/mobile layouts,
images and anchors, screenshot tabs and keyboard controls, image dialog,
unchanged policy text, renamed project paths, and no-JavaScript navigation.
Screenshots and results are saved in the ignored `.preview/` directory.

## Updating content

Edit copy in the HTML files. Gallery labels/descriptions live in `assets/site.js`;
keep the initial Products panel in `index.html` consistent. To update screenshots,
capture the real app using an isolated demo database, then replace only the
public demo PNGs. Never publish real customer names, phone numbers, receipts,
payment QR codes, or backup files.

Review the policy separately if the app's data practices change. A visual
redesign alone should not change its legal wording or revision date.
