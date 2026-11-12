# Appendix D — Images, Covers and Quote-Card Backgrounds

Part of the [Noetia Complete Ecosystem UX, Content and Legal Assessment](../2026-11-12-noetia-complete-ecosystem-ux-content-legal-assessment.md). **No image was generated, replaced or modified.**

## 1. Inventory (`main@6a5e5c0`)

| Group | Path | Count | Dimensions / format | Size | Inspection |
|---|---|---|---|---|---|
| Quote-card backgrounds | `services/web/public/backgrounds/imagen-1…18.jpg` | 18 | progressive JPEG; 1200×1200 (14), 1200×800 (imagen-3, imagen-18), 1200×960 (imagen-17), 1200×1174 (imagen-12) | 50–384 KB each, 3.0 MB total | **Viewed** (labelled contact sheet) and **measured** |
| Book covers (local) | `services/web/public/covers/*.png` | 11 | 400×600 PNG | 8–19 KB each, 184 KB total | **Viewed** (contact sheet) |
| Font previews | `services/web/public/presets/*.png` | 5 | 240×80 PNG (Dancing Script, Lato, Merriweather, Montserrat, Playfair) | 20 KB total | Dimensions only |
| Web logo, favicon, Open Graph image | — | 0 | — | — | Absence VERIFIED |
| Mobile app assets | `services/mobile/assets/{icon,adaptive-icon,splash,favicon}.png` | 4 | — | — | **Listed only, not viewed** |
| Remote covers | Open Library CDN (`seed-covers.ts`) | — | — | — | **Not inspected** |
| Rendered share cards | `services/image-gen/templates/*` | — | — | — | **Not rendered** |

## 2. Backgrounds — qualitative review (viewed)

- **Cohesion:** a cohesive "calm nature" family that fits a reading product. The images look photographic or AI-generated. Their provenance and licence were **not verified** in this assessment.
- **Two tone families:**
  - **dark:** 1 (underwater light), 2 (misty forest), 3 (orchid on a dark ground), 4 (candles), 9 (wet leaf), 13 (owl), 17 (whale);
  - **light:** 5 (blossom), 6 (dunes), 7 (shallow water), 8 (arch with plant), 10 (clouds and sun), 11 (leaf shadow on blue), 12 (elephant at sunrise), 14 (gull at sunset), 15 (cat with leaf shadows), 16 (wolf above mist), 18 (butterfly on flowers).
- **Subjects:** animal subjects (13, 14, 15, 16, 17, 12, 18) sit off-centre, usually lower right, so text placement must avoid them.

## 3. Backgrounds — measured legibility

**Method.**
1. Take the central 60% of each image (a typical text-safe area) and downsample it to 60×60.
2. Compute WCAG relative luminance per pixel.
3. Measure **worst case** as contrast against the 95th-percentile pixel (white text) and the 5th-percentile pixel (black text), and **median** as contrast against the median pixel.
4. Treat a ratio below 4.5:1 as failing.
5. Record "busy" as the standard deviation of greyscale values.

| Image | White worst / median | Black worst / median | Busy | Recommended text treatment |
|---|---|---|---|---|
| 1 | 3.56 / 16.71 | 1.07 / 1.26 | 35.8 | White + light scrim over the light rays |
| 2 | 2.16 / 10.52 | 1.06 / 2.00 | 52.0 | White + scrim (busy) |
| 3 | 4.93 / 11.31 | 1.30 / 1.86 | 25.3 | White |
| 4 | 2.44 / 20.15 | 1.00 / 1.04 | 50.3 | White + scrim (candle highlights) |
| 5 | 1.20 / 1.52 | 7.74 / 13.79 | 25.3 | Black |
| 6 | 1.60 / 2.61 | 5.21 / 8.06 | 26.2 | Black |
| 7 | 1.32 / 2.21 | 6.23 / 9.49 | 25.6 | Black (watch glitter) |
| 8 | 1.42 / 2.44 | 4.28 / 8.62 | 37.1 | Black + light scrim |
| 9 | 6.06 / 15.87 | 1.08 / 1.32 | 26.4 | White |
| 10 | 1.29 / 1.94 | 4.36 / 10.84 | 32.5 | Black + scrim over the sun |
| 11 | 1.92 / 2.28 | 3.05 / 9.21 | 34.3 | Black + scrim |
| 12 | 1.22 / 1.39 | 1.85 / 15.14 | 56.0 | Revise or remove (busiest) |
| 13 | 7.97 / 11.26 | 1.16 / 1.87 | 18.3 | White |
| 14 | 1.28 / 1.50 | 9.72 / 13.99 | 21.0 | Black |
| 15 | 1.23 / 1.95 | 3.26 / 10.74 | 41.8 | Black + scrim |
| 16 | 1.69 / 1.92 | 3.91 / 10.96 | 32.4 | Black + scrim |
| 17 | 5.85 / 15.15 | 1.13 / 1.39 | 23.8 | White |
| 18 | 1.54 / 2.07 | 6.28 / 10.13 | 20.9 | Black |

**Reading the table.** Worst case is deliberately strict: it models text crossing the brightest or darkest 5% of the area. Median contrast shows each image has one clearly suitable text colour, except 12.

**Correction to the in-session summary:** the images where *both* colours fail the worst case are **1, 2, 4, 8, 10, 11, 12, 15 and 16**, not only 2, 4, 11, 12, 15 and 16.

**Format and cropping:**
- Story and reel formats (1080×1920) cut about 44% of a square image's width and must upscale to 1920 px of height. The 1200×800 sources (3, 18) give about a 450 px-wide strip: visibly soft (INFERRED; not rendered).
- Off-centre subjects risk being cropped out.

**Recommendations (PROPOSED):**

| Action | Detail |
|---|---|
| **Retain** | 3, 5, 6, 9, 13, 14, 17, 18 |
| **Retain with a mandatory scrim token** (about 35–45% navy or white overlay under the text block) | 1, 2, 4, 7, 8, 10, 11, 15, 16 |
| **Revise or remove** | 12 |
| **Masters** | portrait masters at 1920 px or taller for every retained image |
| **Supplement** | 2 abstract, text-first textures (one dark, one light) |
| **Metadata** | `{tone, textColor, safeArea, focalPoint}` per image, so the editor positions text and chooses its colour, complementing `getTextColor` in `lib/share-utils.ts` |
| **Delivery** | WebP/AVIF through `next/image`; lazy-load the gallery |
| **Provenance** | record the source and licence of each background (not verified here) |

## 4. Covers (viewed)

**Shared system:** serif title on a dark band, author line and collection label. Used by *Holy Bible*, *Santa Biblia*, *Don Quijote* I/II, *La Edad de Oro*, *Fábulas y Verdades*, *La Divina Comedia* and *Don Juan Tenorio*.

**Off-system covers:**
- *El líder que no tenía cargo*: blue bar chart, sans serif.
- *Literatura infantil*: four-quadrant grid.

**Defects:**
- *Cuentos de la Selva*: the second title line overlaps the author line, a visible text collision.
- Small labels ("Literatura Infantil") are unreadable at thumbnail size.
- At 400×600 the covers fall below 2× for displays around 300 px wide.

**Grid consistency:** local generated covers are mixed with Open Library covers (not inspected), so a consistent frame is needed (INFERRED).

**Recommendations (PROPOSED):**
- one cover template: title zone, author zone, collection badge **outside** the artwork;
- regenerate at 800×1200;
- fix *Cuentos de la Selva*;
- display remote covers inside the same frame.

## 5. Missing visual evidence (must be captured before high-fidelity approval)

- Rendered quote cards from `image-gen` in every format: 1200×627, 1200×675, 1080×1080, 1080×1920, 1000×1500, 1000×1000.
- The cover grid as displayed (library, discover, collections), including Open Library covers.
- Mobile app icon, adaptive icon and splash.
- Dark-mode renders of the reader and share editor.
- Provenance and licence records for the 18 backgrounds.
