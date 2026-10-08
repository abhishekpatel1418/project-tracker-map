<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## ROAD-TRACK decisions
- Demo projects live in src/lib/demo-data.ts and complaints in src/lib/complaints.ts (localStorage) — single swap points for a future database.
- The map is a browser-only lazy component (src/components/ProjectMap.tsx, Leaflet + OSM) — Leaflet breaks SSR; swap tiles there for Mapbox later.
