# Atelier — 2026-09-28

The storefront groups the live Gelato catalogue into poster, premium print, phone case and calendar families. The variant selector changes the actual product UID and price. Product descriptions, specifications and variant names have explicit English fields; static labels are mirrored in translations.json and the i18n fallback.

Previews composite the selected photo onto an illustrative paper, case or calendar shape. They are not Gelato production proofs. Prints explicitly exclude frames; cases exclude phones and specify the compatible model; calendars require agreement on year, images and layout before production. `previewEnabled: false` hides the main preview. The store remains empty when the existing master Gelato flag is off.

Favorites use the authenticated `MSAccount.request` Response and parse its JSON. A cart entry stores photo ID, exact Gelato UID, variant, price and quantity. The contact request includes those references. Checkout remains a request for approval, with no automatic payment or Gelato order submission. Catalog changes prevent stale-price requests. Local storage is a convenience, not a trusted payment source.

Desktop keeps the four product-family selectors across the top, then places the black-and-gold product preview on the left and configuration on the right. The mockup retains its scale while the preview panel is slightly narrower; product description and specifications appear beneath it in the natural page scroll. The top cards are the only product switcher. Mobile stacks the same sections without a fixed-height viewport. Keyboard focus is retained in the photo picker and cart. The page supports reduced motion.

Verification: the production page was checked at desktop and 390 px, in FR and EN. All four family cards remain above the preview; product details follow the mockup; previous/next arrows are absent; and the mobile content fits the viewport. The 10-print minimum and 14 distinct calendar slots still gate cart addition. Earlier checks covered variant selection, favorite selection, quantity, total and contact-prefill with isolated synthetic data; no test message or production order was sent.

Disabled/unavailable state hides the empty configuration and preview panels and provides a gallery return link; it never exposes a purchase action.

## Photo customization — 2026-09-29

The black-and-gold preview now has a soft animated yellow halo (disabled for reduced-motion preferences). The product mockup keeps its existing dimensions. A shared photo editor lets the visitor drag each image to set its crop and zoom for the selected product. The crop belongs to that image: every A6 print tile and each filled calendar slot can be adjusted independently. Captions up to 60 characters can be added below a poster/print, on a phone case, or on a calendar page.

Person cutout is opt-in. The first click loads the pinned MediaPipe 1.0.1 browser runtime and Google's 249 KB Selfie Segmenter model; the selected image is fetched to the browser and segmented there, without sending it to a segmentation service. The compressed transparent WebP is limited to preview resolution/size and stays in the local cart. It is not a production-resolution image and is not sent as a Gelato print file. Browser/network/CORS failures leave crop and captions available.

The approval message carries any non-default crop coordinates/zoom, custom text and whether a person cutout preview was requested, per photo. Requests still need manual review and confirmation of the final production artwork. The user can drag inside the crop frame, use the zoom slider or arrow keys, reset the crop, optionally cut out/restore the person, add text, then choose Apply. Single-image products use “Recadrer ou détourer”; print tiles and filled calendar slots have their own crop action.

New visitor copy is present in `assets/data/translations.json` and the inline fallback in `assets/js/i18n.js`. Check the live editor and contact-prefill metadata in both languages before treating the change as verified.
