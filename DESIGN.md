---
name: MS Comm Atelier
description: Photograph-led merchandising within the existing MS Comm identity
colors:
  shop-bg: "#090909"
  shop-panel: "#111111"
  shop-text: "#f5f2eb"
  shop-muted: "#b2b2ad"
  shop-gold: "#d6b344"
  preview-ground: "#dadbd6"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.7
  display:
    fontFamily: "Poppins, Inter, sans-serif"
    fontSize: "40px"
    lineHeight: 1.1
    letterSpacing: "-0.03em"
rounded:
  panel: "12px"
  control: "8px"
spacing:
  compact: "12px"
  regular: "24px"
components:
  purchase-button:
    backgroundColor: "{colors.shop-gold}"
    textColor: "{colors.shop-bg}"
    height: "52px"
---

## Overview

This record covers the Atelier storefront. It inherits MS Comm’s dark surfaces, gold action color and existing typefaces. Other routes keep their own established layouts.

## Colors

Restrained black and off-white, with gold for the selected family and primary action. A neutral light preview surface separates the physical product from dark configuration controls.

## Typography

Poppins headings and Inter body copy follow the existing brand. Mobile headings reduce to 30px. Product descriptions remain readable at 14px. Prices use locale-aware currency formatting.

## Layout

Four product families precede a two-column preview/configuration layout in a 1540px maximum container. Family tiles become two columns below 1100px. Below 760px the page stacks into natural document scrolling. No product information depends on a fixed viewport height.

## Elevation & Depth

Interface panels use thin borders. Offset shadows belong to product simulations, distinguishing paper and case shapes from the preview surface.

## Shapes

Panels use 12px corners, controls 8px. Phone silhouettes and calendar binding are product-specific illustrative geometry, not reusable interface decoration.

## Components

Family selectors show the photo on its support and the minimum real price. The variant selector changes the underlying UID. A single add-to-cart action follows photo selection and specifications. Cart and favorite picker support focus restoration and keyboard containment.

## Do's and Don'ts

Do keep product exclusions, compatible model and preview limitations visible. Do show real variant prices and translate visitor copy. Do not imply that a simulation is a print proof or that the contact request has charged the customer. Do not hide descriptions on mobile.
