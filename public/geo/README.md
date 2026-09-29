Place Survey of India–compliant boundary files here:

- `india_outline.geojson` — national outline (Polygon/MultiPolygon, lon/lat, WGS84)
- `districts/<slug>.geojson` — one file per district, slug = lower-case name with spaces as hyphens
  (e.g. `districts/khordha.geojson`, `districts/north-24-parganas.geojson`)

If a file is missing the console draws no boundary and falls back to labelled markers at the
approximate district headquarters (`src/data/districtHQ.ts`).
Never substitute OpenStreetMap, Carto, Mapbox, Natural Earth or GADM boundaries.
