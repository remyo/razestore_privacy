# Website asset notes

## Actual app screenshots

`screenshots/home.png`, `checkout.png`, `gcash.png`, `sales.png`, and `receipt.png`
are unchanged 1236 × 2460 PNG captures from the app's refreshed promotional
projects. The website refresh uses these sources under `raze_store/output/`:

- `home.png`: `voice-assistant-feature-2026-10-17/screens/01-home-mascot.png`.
- `checkout.png`: `facebook-voice-promo-2026-10-17/screens/07-cart-cash-change.png`.
- `receipt.png`: `facebook-voice-promo-2026-10-17/screens/09-completed-receipt.png`.
- `gcash.png`: `gcash-feature-2026-10-17/screens/21-history-two.png`.
- `sales.png`: `play-store-v2/screenshots/05-sales.png` (October 10 capture).

The October 17 captures include the current Home mascot, checkout, completed
sample receipt, and grouped GCash history. These are actual Flutter app screens
with fictitious data from disposable in-memory databases, existing sample
product photos, and demonstration customer records. The Home mascot uses its
bundled static fallback pose. No microphone demonstration is shown here.
GCash amounts and service fees are illustrative store records, not verified
payments or official fees. No connected phone or real customer database was
read for this website refresh.

The capture harnesses and provenance notes remain in each source project's
`source/` folder. The five website PNGs are approximately 1.9 MB combined.

## Brand

`brand/app-icon.png` is the existing 180 × 180 iOS export of the app icon,
copied unchanged from `ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-60x60@3x.png`.
Using the already-exported small version avoids downloading the large master
for a navigation icon. The 1024 × 1024 branding master was used only as the
3D artwork reference.

## Supporting 3D artwork

`images/raze-store-3d.png` is generated supporting artwork using the built-in
image-generation tool and the imagegen skill. The existing app icon is the
visual reference. It is not an app screenshot and does not replace the app icon.
The earlier realistic storefront image was rejected and is not used or shipped.

Final generation prompt:

> Use case: style-transfer. Asset type: a premium minimal 3D brand icon illustration for the Raze Store website. Input image is the exact Raze Store app icon and brand reference. Transform its friendly cream shopping-bag/store-awning face with amber center stripe and small R tag into a beautifully polished soft 3D icon. Keep those recognizable shapes and the friendly smile. Single centered sculpted icon, slight three-quarter perspective, cream ceramic or soft matte clay material, deep teal accents and amber accent matching the reference. Rounded beveled edges, subtle ambient occlusion, clean soft studio shadows, sophisticated and extremely minimal. The object is self-contained and fully visible with plenty of breathing room on a plain warm ivory background matching #f8f7f0, square composition. This is supporting artwork, NOT a replacement app icon: keep the reference recognizable but give it genuine dimensional volume. No realistic shop, storefront building, neighborhood scenery, shelves, products, people, phone screens, UI, extra floating objects, gradients across background, or clutter. No new text; only the existing R tag letter is allowed. No watermark.
