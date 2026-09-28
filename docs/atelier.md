# Atelier — 2026-09-28

The storefront groups the live Gelato catalogue into poster, premium print, phone case and calendar families. The variant selector changes the actual product UID and price. Product descriptions, specifications and variant names have explicit English fields; static labels are mirrored in translations.json and the i18n fallback.

Previews composite the selected photo onto an illustrative paper, case or calendar shape. They are not Gelato production proofs. Prints explicitly exclude frames; cases exclude phones and specify the compatible model; calendars require agreement on year, images and layout before production. `previewEnabled: false` hides the main preview. The store remains empty when the existing master Gelato flag is off.

Favorites use the authenticated `MSAccount.request` Response and parse its JSON. A cart entry stores photo ID, exact Gelato UID, variant, price and quantity. The contact request includes those references. Checkout remains a request for approval, with no automatic payment or Gelato order submission. Catalog changes prevent stale-price requests. Local storage is a convenience, not a trusted payment source.

Desktop presents four family selectors above a preview and product configuration. Mobile stacks these elements without a fixed-height viewport. Product detail, shipping/payment explanation and product names remain visible. Keyboard focus is retained in the photo picker and cart. The page supports reduced motion.

Verification: desktop and 390 px Chrome, FR/EN, actual variant selection, favorite photo selection, quantity two, cart total and contact-prefill checks using isolated synthetic account data. No test message or production order was sent.

Disabled/unavailable state hides the empty configuration and preview panels and provides a gallery return link; it never exposes a purchase action.
