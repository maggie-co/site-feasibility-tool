# Dallas Site Feasibility Tool

A web tool for quickly evaluating a Dallas property. Search an address or click the map to instantly see its **zoning**, what the zoning allows, and whether it sits inside a **historic district** — with official City of Dallas sources linked.

Built to collapse the hours developers and architects normally spend cross-referencing separate city GIS portals and code documents into a single lookup.

**Live demo:** _(add your Vercel URL here)_

---

## What it does

- **Click anywhere** on the map → see that parcel's zoning
- **Search an address** → fly to it and read its zoning
- **Plain-English decoding** — translates codes like `MF-2(A)` into "Multifamily District"
- **Color-coded** by building-standard use convention (yellow = single-family, red = commercial, etc.)
- **Historic overlay** — flags whether a site is in a designated historic district and what that means
- **Source attribution** — every result links back to the official city data

---

## Tech stack

| Layer | Tool |
|-------|------|
| Frontend | React + Vite |
| Mapping & geocoding | Mapbox GL JS |
| Spatial logic | Ray-casting point-in-polygon |
| Data | City of Dallas ArcGIS feature services (GeoJSON) |
| Hosting | Vercel |

---

## Data pipeline

Zoning and historic district data come from the City of Dallas's public ArcGIS services. A Node script (`scripts/fetchZoning.js`) pulls each layer as GeoJSON, handles the server's 2,000-record pagination cap, and reprojects coordinates to standard lat/lng. Re-running the script refreshes the data when the city updates it.

```bash
node scripts/fetchZoning.js
```

---

## Running locally

```bash
npm install
# add a Mapbox token to .env.local:
# VITE_MAPBOX_TOKEN=your_token_here
npm run dev
```

---

## Roadmap

- [x] Zoning layer (lookup, color-coding, plain-English)
- [x] Historic district overlay
- [ ] Flood risk (FEMA National Flood Hazard Layer)
- [ ] Opportunity Zones (HUD)
- [ ] Additional cities

---

## Data sources

- [City of Dallas Zoning](https://dallascityhall.com/departments/sustainabledevelopment/planning/Pages/zoning-districts.aspx)
- [Dallas Historic Preservation](https://dallascityhall.com/departments/sustainabledevelopment/historicpreservation/Pages/default.aspx)