# Dunnio Touch design system

Verified local UI/UX Pro Max search: `analytics dashboard heatmap --design-system --density 8`, retried `business intelligence dashboard` on 2026-10-11. Matching style: Data-Dense Dashboard; matching palette: blue data / amber highlights. The returned Enterprise Gateway landing pattern remained off-topic after retry and was not persisted. Layout below is a project-specific fallback, based on the skill's dashboard and accessibility priorities.

- Vanilla HTML/CSS/Canvas; no framework or CDN. Local Segoe UI / Arial and monospace exports substitute for the suggested remote Fira fonts.
- Ink #172b4d; muted #475569; primary #1e40af; background #f4f6fa; white panels; border #d5dde9. Amber #8b4b06 on #fff7e9 for warnings. Green #146749 and red #a42222 always accompany signed numbers.
- Fixed desktop navigation; responsive wrapped navigation; scope, periods, small multiples, grouped comparison, setup. 8px rhythm, 14px panels, restrained borders/shadows, visible 3px keyboard focus. Native labeled controls >=44px.
- Chart search `heatmap chart accessible counts --domain chart`: top verified result Heatmap / Intensity. Shared numeric legends, explicit counts and accessible tables, click for exact values; divergent delta text. Never encode meaning with color alone.
- Geometry: screenshot overlays only on matching layout/width/document height. Otherwise independent coordinates labeled visibly. Fixed plane separate. No synthetic pages in measured mode.
- Demo explicitly labeled synthetic, deterministic May–August fixture, enabled only through `?demo=1`.
- Reduced-motion preference respected. Mobile tested at 390px and 375px; table scrolling contained within panel.
