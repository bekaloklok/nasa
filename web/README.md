# Field Shift — web app

Crop-rotation decision tool: NASA Earth data + SoilPlus probe readings → ranked rotation plans.
The rules live in [`../rotation/RULES.md`](../rotation/RULES.md).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## The probe

`src/lib/soil-device.js` (+ `.d.ts`) is the team's client from [`../device/web-client/`](../device/web-client/README.md), copied here as its README asks; update the copy when that file changes. `src/lib/useProbe.ts` wraps it for React and adds the demo stream.

- Without hardware: `python3 ../device/web-client/mock_probe.py`, then connect to `localhost:8081` in the "From the ground" panel.
- With the probe: same hotspot, enter the IP it prints (port 81 is added).
- "Measure this field" takes a 10 s snapshot (medians + GPS). Planning then uses it, and GPS loads NASA data for that spot.
- A live probe needs `http://localhost`: browsers block `ws://` from https pages, so the deployed site runs in demo mode.

## UI stack

| Task | Library |
|---|---|
| Accessible primitives (dialog, popover, menu, select…) | Base UI (`@base-ui/react`) |
| Styled components | shadcn/ui on Base UI (`components.json`, style `base-nova`) |
| Styling | Tailwind CSS v4, `cn()` from `@/lib/utils` |
| Toasts | Sonner |
| Drawers / bottom sheets (mobile) | Vaul |
| Command menu | cmdk |
| Animated numbers (probe readings, scores) | NumberFlow (`@number-flow/react`) |
| Charts (NASA climate data) | recharts |
| Animation | motion |
| Radix primitives (only if a component needs them) | `radix-ui` |

Library choice follows the `pick-ui-library` skill in [`../.claude/skills/`](../.claude/skills/pick-ui-library/SKILL.md).

## Adding components

```bash
npx shadcn@latest add dialog                 # shadcn/ui
npx shadcn@latest add @magicui/marquee       # Magic UI
npx shadcn@latest add @aceternity/bento-grid # Aceternity UI
npx shadcn@latest add @beautifului/shimmer   # Beautiful UI
npx shadcn@latest add "https://21st.dev/r/<author>/<component>"  # 21st.dev
npx rareui@latest add liquid-button          # RareUI (own CLI; do not run `rareui init`, it rewrites components.json)
```
