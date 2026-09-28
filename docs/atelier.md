# Atelier — 2026-09-28

The storefront groups the live Gelato catalogue into poster, premium print, phone case and calendar families. The variant selector changes the actual product UID and price. Product descriptions, specifications and variant names have explicit English fields; static labels are mirrored in translations.json and the i18n fallback.

Previews composite the selected photo onto an illustrative paper, case or calendar shape. They are not Gelato production proofs. Prints explicitly exclude frames; cases exclude phones and specify the compatible model; calendars require agreement on year, images and layout before production. `previewEnabled: false` hides the main preview. The store remains empty when the existing master Gelato flag is off.

Favorites use the authenticated `MSAccount.request` Response and parse its JSON. A cart entry stores photo ID, exact Gelato UID, variant, price and quantity. The contact request includes those references. Checkout remains a request for approval, with no automatic payment or Gelato order submission. Catalog changes prevent stale-price requests. Local storage is a convenience, not a trusted payment source.

Desktop keeps the four product-family selectors across the top, then places the black-and-gold product preview on the left and configuration on the right. The mockup retains its scale while the preview panel is slightly narrower; product description and specifications appear beneath it in the natural page scroll. The top cards are the only product switcher. Mobile stacks the same sections without a fixed-height viewport. Keyboard focus is retained in the photo picker and cart. The page supports reduced motion.

Verification: the production page was checked at desktop and 390 px, in FR and EN. All four family cards remain above the preview; product details follow the mockup; previous/next arrows are absent; and the mobile content fits the viewport. The 10-print minimum and 14 distinct calendar slots still gate cart addition. Earlier checks covered variant selection, favorite selection, quantity, total and contact-prefill with isolated synthetic data; no test message or production order was sent.

Disabled/unavailable state hides the empty configuration and preview panels and provides a gallery return link; it never exposes a purchase action.
