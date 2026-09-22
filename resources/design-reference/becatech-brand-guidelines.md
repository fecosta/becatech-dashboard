# BecaTech+ Brand Guidelines

## Authoritative Source

Official BecaTech+ Brand Manual:

<https://velezreyes.github.io/notion-content/becatech/becatech-brandbook.html>

Manual edition: *Manual de Marca Oficial · 2026* (© 2026 VélezReyes+).

This is the authoritative visual-brand reference for the Beca Tech+ Dashboard.

## Repository Role

This document summarizes the BecaTech+ brand identity for developers and AI agents working on the
dashboard. It does not replace the official brand manual.

Consult the official manual for complete logo rules, downloadable assets, examples, and
communication-piece guidance. Nothing here is a substitute for reading it before producing a
brand-facing piece.

## Source-of-Truth Boundaries

The official brand manual governs:

- BecaTech+ brand identity;
- approved colors;
- typography;
- logos and logo treatment;
- visual language;
- the modular brand system;
- brand communication conventions.

The dashboard's existing application design references govern:

- application layout;
- dashboard information architecture;
- dashboard interactions;
- existing component patterns;
- implemented application-specific UI behavior;

until those areas are explicitly changed through a separate UX/UI task. The current
application-specific reference is `MVP_Dashboard AUGUST 4.html` in this directory, mapped onto the
real app by `docs/prototype-comparison.md`.

Brand references never override:

- production data;
- calculations or metric definitions;
- authorization;
- routes;
- source spreadsheet mappings;
- domain logic.

A visual reference is never a reason to change a number, a permission check, or a route.

## Color System

Core:

| Role  | Hex       |
| ----- | --------- |
| Cream | `#EFEFE4` |
| Black | `#000000` |

Accents — three fixed stops per hue, not a numeric scale:

| Accent | Light     | Base      | Dark      |
| ------ | --------- | --------- | --------- |
| Yellow | `#F7FF66` | `#F3FF00` | `#C9D400` |
| Green  | `#6FE0A7` | `#27CF77` | `#1A9054` |
| Purple | `#C97AFF` | `#A62BFF` | `#6F15C4` |

Rules from the manual:

- **Hierarchy.** The Base tone predominates within each accent. If a piece uses a single tone of an
  accent, that tone is the Base. Light and Dark are reserved for gradient spots and secondary
  detail — they accompany the Base, they do not displace it.
- **Combination.** Maximum two accent colors per composition. The limit does not apply to subtle
  background gradient spots (blobs), which may blend all three hues because they are diffuse.
- **Brand spectrum.** `#F3FF00 → #27CF77 → #A62BFF` (yellow → green → purple).
- **Gradients are an accent, not structure.** A thin line or a detail accompanying a title or
  kicker — never a primary or structural design element.

The dashboard's existing tokens in `src/app/globals.css` already carry these exact values for
cream, black, and all three accent triads. The app additionally defines application-specific
values the manual does not cover (body-text ink, surface tints, the segmented risk scale). Those
are product decisions, documented in `docs/DESIGN_SYSTEM.md`, not brand deviations to "fix"
reflexively — but they have not been audited against the manual either.

## Typography

| Use                  | Face           | Source                                       |
| -------------------- | -------------- | -------------------------------------------- |
| Display / headlines  | BookmanJF Pro  | Downloadable TTF from the official manual     |
| Body · UI · labels   | Instrument Sans| Google Fonts                                  |

Weights shown in the manual: BookmanJF Pro 400/600/700/800; Instrument Sans 300/400/500/600.

BookmanJF Pro is a licensed brand face. It is **not** loaded by the application today — both the
app and the August dashboard mockup fall back to a serif stack, so they currently match each other
while diverging from the brand manual. Changing font loading is out of scope here; it belongs to
the brand-alignment task, together with the licensing and distribution decision that hosting a font
binary in this repository would require.

## Logo

- Two authorized versions: **positive** (light backgrounds) and **negative** (dark backgrounds),
  available as SVG and PNG from the manual.
- Construction is based on a module **X** — the stroke weight of the `+` sign. Total logo width is
  roughly `35X`.
- **Clear space: minimum `2X` on all four sides.** Nothing — text, image, border, graphic — may
  enter it.
- Prohibited: distorting or stretching proportions; recoloring outside the palette (cream or black
  only); placing it on low-contrast backgrounds; adding shadows, outlines, or effects; rotating or
  skewing it.
- **VélezReyes+ parent logo.** BecaTech+ is a VélezReyes+ program, so the parent logo is mandatory
  in every *brand communication piece*, at the exact size, proportion, and placement given in the
  manual's Piezas section. It is not replaced, omitted, or re-treated.

  This requirement is written for communication pieces. It is **not** an instruction to place the
  VélezReyes+ logo throughout the dashboard UI. Where and whether the parent logo appears in an
  interactive product screen is a separate UX/UI decision.

- Photography is always black and white, used whole and in proportion; the logo is never placed
  over a scholar's face.

Do not create unofficial logo variants, and do not reconstruct the logo by hand — take the approved
files from the manual.

## Visual Language

Modular system reference values from the manual:

```text
Base grid     48px
Gradient blur 90px
Radius        2–3px
```

These are brand-system values. They describe how brand pieces are built; they are not a mandate to
mechanically replace the dashboard's current spacing, radius, or layout system. A data-dense
application screen has constraints a poster does not.

Accent discipline carries over directly, though: base tones dominate, at most two accents per view,
gradients stay subtle.

## Application Guidance

The dashboard should progressively align with the official BecaTech+ identity while preserving:

- usability;
- accessibility;
- data readability;
- responsive behavior;
- product workflows;
- existing authorization and domain behavior.

Brand adaptation for an interactive data product requires application-specific decisions — legible
contrast on dense tables, distinguishable categorical series in charts, and focus/hover states a
static brand piece never has to solve. Those decisions belong in `docs/DESIGN_SYSTEM.md` and, when
substantial, a dedicated implementation task or spec.

The dashboard is **not** currently certified as brand-compliant. No audit has been performed.

## Assets

Use the official brand manual as the source for approved downloadable logos, palette files,
typography assets, and related brand materials.

Do not create unofficial logo variants.

Do not commit externally sourced font binaries without an explicit decision covering their use and
the licensing/distribution implications of storing them in this repository.
