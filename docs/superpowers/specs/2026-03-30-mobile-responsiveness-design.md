# Mobile Responsiveness Design
**Date:** 2026-03-30
**Breakpoints:** 375px (iPhone), 768px (tablet)
**Approach:** Hybrid — Tailwind classes for Layout and page grids, CSS media query overrides in `index.css` for complex components (Pomodoro ring, Calendario grid)

---

## 1. Layout (`src/components/Layout.jsx`)

### Bottom nav — cap at 5 items
- Filter `NAV_ITEMS` for mobile bottom nav to only: Dashboard, Exámenes, Flashcards, Tests, Predicciones
- Pomodoro and Calendario remain in desktop sidebar only
- No hamburger menu needed (they're accessible from Dashboard quick actions)

### Content area padding
- `<main>` content area: ensure pages have `px-4` minimum horizontal padding on mobile
- This is handled per-page (pages already have their own padding containers)

### General
- Sidebar: already `hidden md:flex` — no change needed
- Bottom nav: already `md:hidden` — just needs item filtering
- `pb-20 md:pb-0` already applied to content to avoid bottom nav overlap — keep as-is

---

## 2. Dashboard (`src/pages/Dashboard/index.jsx`)

| Element | Current | Mobile fix |
|---------|---------|------------|
| Stat cards grid | `grid-cols-3` | `grid-cols-1 sm:grid-cols-3` |
| Quick actions grid | varies | `grid-cols-2` (2×2) |
| Subject progress cards | `grid-cols-3` | `grid-cols-2 sm:grid-cols-3` |
| Repaso rápido flip cards | fixed width | `w-full` on mobile |

---

## 3. Exámenes (`src/pages/ExamenesOficiales/index.jsx`)

| Element | Mobile fix |
|---------|------------|
| Subject selector grid | `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` |
| Exam mode layout (PDF + textarea) | Stack vertically: PDF viewer `height: 50vh`, textarea below, full width |
| PDF viewer | `overflow-y-auto` at 50vh |

The exam mode currently uses a flex row for the PDF viewer and answer textarea. On mobile, switch to `flex-col`.

---

## 4. Flashcards (`src/pages/Flashcards/index.jsx`)

| Element | Mobile fix |
|---------|------------|
| Subject grid | Already `grid-cols-2 md:grid-cols-4` — no change |
| Flash card | `w-full max-w-md mx-auto` |
| Answer buttons (No lo sabía / Más o menos / Lo sabía) | `flex-wrap` with `min-h-[44px]` per button; shrink text on mobile |

---

## 5. Predicciones 2026 (`src/pages/Predicciones2026/index.jsx`)

| Element | Mobile fix |
|---------|------------|
| Subject sidebar list | `hidden md:block` |
| Subject selector | Add `<select>` dropdown visible only on mobile (`block md:hidden`) |
| Prediction cards | Already full-width once sidebar hidden |

The dropdown mirrors the same subject list and drives the same state as the sidebar.

---

## 6. Pomodoro (`src/pages/Pomodoro/index.jsx`)

| Element | Mobile fix |
|---------|------------|
| Timer ring (SVG) | CSS: `@media (max-width: 480px) { .pomodoro-ring { transform: scale(0.72); } }` |
| Subject grid | `grid-cols-2 sm:grid-cols-4` |

Add `className="pomodoro-ring"` to the timer container div, then override scale in `index.css`.

---

## 7. Calendario (`src/pages/Calendario/index.jsx`)

| Element | Mobile fix |
|---------|------------|
| Calendar grid | Wrap in `overflow-x-auto` container; grid has `min-width: 600px` so it scrolls horizontally |
| Plan days list | `flex-col` stack on mobile (currently side-by-side) |

---

## 8. General

- **Touch targets:** All interactive buttons/links must have `min-height: 44px`. Applied via targeted CSS in `index.css` or `min-h-[44px]` Tailwind class per component.
- **Font sizes:** Audit and fix any text below 14px on mobile. Key suspects: badge labels, metadata text in cards (currently `text-[10px]` or `font-size: 11px`). Override with `@media` rules to ensure `min-font-size: 14px` for body text.
- **No horizontal scroll:** Add `overflow-x: hidden` to `body` in `index.css`. Exception: Calendario grid wrapper uses `overflow-x: auto` intentionally.

---

## Implementation Order

1. `Layout.jsx` — bottom nav item filtering (quick, isolated)
2. `index.css` — global rules (overflow-x, font-size minimums, touch targets, Pomodoro ring scale)
3. `Dashboard/index.jsx` — grid class additions
4. `ExamenesOficiales/index.jsx` — subject grid + exam mode flex-col
5. `Flashcards/index.jsx` — card width + button touch targets
6. `Predicciones2026/index.jsx` — sidebar hide + dropdown
7. `Pomodoro/index.jsx` — subject grid + ring class name
8. `Calendario/index.jsx` — overflow wrapper + flex-col plans

---

## Files to Modify

- `src/components/Layout.jsx`
- `src/index.css`
- `src/pages/Dashboard/index.jsx`
- `src/pages/ExamenesOficiales/index.jsx`
- `src/pages/Flashcards/index.jsx`
- `src/pages/Predicciones2026/index.jsx`
- `src/pages/Pomodoro/index.jsx`
- `src/pages/Calendario/index.jsx`
