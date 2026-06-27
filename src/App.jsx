import { useRef, useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import zoningData from './data/zoning.json'
import historicData from './data/historic.json'
import { lookupZoning } from './data/zoningInfo'
import CollapsibleRow from './CollapsibleRow'
import './App.css'
import demolitionData from './data/demolition.json'
import nsoData from './data/nso.json'
import ozData from './data/opportunity-zones.json'

// Ray-casting point-in-polygon test.
function pointInRing(point, ring) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

function findHistoricDistrict(lngLat) {
  for (const feature of historicData.features) {
    const geom = feature.geometry
    if (!geom) continue
    const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
    for (const polygon of polygons) {
      if (pointInRing(lngLat, polygon[0])) {
        return feature.properties
      }
    }
  }
  return null
}

function findDemolitionDelay(lngLat) {
  for (const feature of demolitionData.features) {
    const geom = feature.geometry
    if (!geom) continue
    const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
    for (const polygon of polygons) {
      if (pointInRing(lngLat, polygon[0])) {
        return feature.properties
      }
    }
  }
  return null
}

function findNSO(lngLat) {
  for (const feature of nsoData.features) {
    const geom = feature.geometry
    if (!geom) continue
    const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
    for (const polygon of polygons) {
      if (pointInRing(lngLat, polygon[0])) {
        return feature.properties
      }
    }
  }
  return null
}

// Live-query Dallas's floodplain service for the flood zone at a point.
const FLOOD_URL =
  'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/ArcGIS/rest/services/Current_Floodplain/FeatureServer/0/query'

async function fetchFloodZone(lng, lat) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF',
    returnGeometry: 'false',
    f: 'json',
  })

  try {
    const res = await fetch(`${FLOOD_URL}?${params.toString()}`)
    const data = await res.json()
    if (data.features && data.features.length > 0) {
      return data.features[0].attributes
    }
    return null
  } catch (err) {
    console.error('Flood lookup failed:', err)
    return null
  }
}

function interpretFlood(attrs) {
  if (!attrs) return null
  const zone = (attrs.FLD_ZONE || '').toUpperCase()
  const sfha = attrs.SFHA_TF

  if (zone.includes('FLOODWAY')) {
    return { level: 'Highest risk', plain: 'Floodway, building is heavily restricted.', sfha: true }
  }
  if (zone.includes('1 PCT') || sfha === 'T') {
    return { level: 'High risk', plain: '100-year floodplain (1% annual chance). Flood insurance typically required.', sfha: true }
  }
  if (zone.includes('0.2 PCT')) {
    return { level: 'Moderate risk', plain: '500-year floodplain (0.2% annual chance). Lower risk, but not zero.', sfha: false }
  }
  if (zone.includes('STORMWATER')) {
    return { level: 'Moderate risk', plain: 'Stormwater hazard area (1% annual chance).', sfha: false }
  }
  if (zone.includes('LEVEE')) {
    return { level: 'Reduced risk', plain: 'Protected by levee, but residual risk remains.', sfha: false }
  }
  return { level: 'Mapped zone', plain: `Flood zone: ${attrs.FLD_ZONE}`, sfha: false }
}

// Live-query HUD for Opportunity Zone status at a point.
const OZ_URL =
  'https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Opportunity_Zones/FeatureServer/13/query'

async function fetchOpportunityZone(lng, lat) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'GEOID10,TRACT,Rural',
    returnGeometry: 'false',
    f: 'json',
  })

  try {
    const res = await fetch(`${OZ_URL}?${params.toString()}`)
    const data = await res.json()
    if (data.features && data.features.length > 0) {
      return data.features[0].attributes
    }
    return null
  } catch (err) {
    console.error('Opportunity Zone lookup failed:', err)
    return null
  }
}

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const DALLAS_CENTER = [-96.7970, 32.7767]

export default function App() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markerRef = useRef(null)

  const [input, setInput] = useState('')
  const [showIntro, setShowIntro] = useState(true)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [historic, setHistoric] = useState(null)
  const [flood, setFlood] = useState(null)
  const [oz, setOz] = useState(null)
  const [demo, setDemo] = useState(null)
  const [nso, setNso] = useState(null)
  const [layers, setLayers] = useState({
    zoning: true,
    historic: false,
    nso: false,
    oz: false,
  })

  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: DALLAS_CENTER,
      zoom: 11,
    })

    map.current.on('load', () => {
      map.current.addSource('zoning', { type: 'geojson', data: zoningData })

      map.current.addLayer({
        id: 'zoning-fill',
        type: 'fill',
        source: 'zoning',
        paint: { 'fill-color': '#577590', 'fill-opacity': 0.25 },
      })

      map.current.addLayer({
        id: 'zoning-outline',
        type: 'line',
        source: 'zoning',
        paint: { 'line-color': '#577590', 'line-width': 0.5 },
      })

      map.current.addLayer({
        id: 'zoning-highlight',
        type: 'line',
        source: 'zoning',
        paint: { 'line-color': '#F94144', 'line-width': 3 },
        filter: ['==', 'OBJECTID', -1],
      })

      map.current.addSource('historic', { type: 'geojson', data: historicData })

      map.current.addLayer({
        id: 'historic-fill',
        type: 'fill',
        source: 'historic',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#B5179E', 'fill-opacity': 0.3 },
      })

      map.current.addLayer({
        id: 'historic-outline',
        type: 'line',
        source: 'historic',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#B5179E', 'line-width': 1.5 },
      })

      // Neighborhood Stabilization Overlay layer (hidden by default)
      map.current.addSource('nso', { type: 'geojson', data: nsoData })

      map.current.addLayer({
        id: 'nso-fill',
        type: 'fill',
        source: 'nso',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#E9A23B', 'fill-opacity': 0.3 },
      })

      map.current.addLayer({
        id: 'nso-outline',
        type: 'line',
        source: 'nso',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#E9A23B', 'line-width': 1.5 },
      })

      // Opportunity Zone layer (hidden by default)
      map.current.addSource('oz', { type: 'geojson', data: ozData })

      map.current.addLayer({
        id: 'oz-fill',
        type: 'fill',
        source: 'oz',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#2A9D8F', 'fill-opacity': 0.3 },
      })

      map.current.addLayer({
        id: 'oz-outline',
        type: 'line',
        source: 'oz',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#2A9D8F', 'line-width': 1.2 },
      })
    })

    map.current.on('click', (e) => {
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['zoning-fill'],
      })
      if (features.length > 0) {
        handleFeature(features[0], [e.lngLat.lng, e.lngLat.lat])
      } else {
        setMessage('No zoning data at that spot. Try clicking within Dallas city limits.')
        setResult(null)
      }
    })

    map.current.on('mouseenter', 'zoning-fill', () => {
      map.current.getCanvas().style.cursor = 'pointer'
    })
    map.current.on('mouseleave', 'zoning-fill', () => {
      map.current.getCanvas().style.cursor = ''
    })
  }, [])

  const handleFeature = (feature, lngLat) => {
    const zoneDist = feature.properties.ZONE_DIST
    const info = lookupZoning(zoneDist)

    setResult({
      code: zoneDist,
      ...info,
      notes: feature.properties.NOTES,
      caseNumber: feature.properties.CASE_NUMBER,
    })
    setMessage('')

    if (map.current.getLayer('zoning-highlight')) {
      map.current.setFilter('zoning-highlight', [
        '==',
        'OBJECTID',
        feature.properties.OBJECTID,
      ])
    }

    if (lngLat) {
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = new mapboxgl.Marker({ color: '#F94144' })
        .setLngLat(lngLat)
        .addTo(map.current)

      const histProps = findHistoricDistrict(lngLat)
      if (histProps) {
        setHistoric({
          name: histProps.NAME,
          notes: histProps.NOTES,
          ordinance: histProps.ORD_NUM,
        })
      } else {
        setHistoric(null)
      }

      const demoProps = findDemolitionDelay(lngLat)
      if (demoProps) {
        setDemo({ name: demoProps.NAME, notes: demoProps.NOTES })
      } else {
        setDemo(null)
      }

      const nsoProps = findNSO(lngLat)
      if (nsoProps) {
        setNso({ name: nsoProps.COMMON_NAME, notes: nsoProps.NOTES })
      } else {
        setNso(null)
      }

      setFlood({ loading: true })
      fetchFloodZone(lngLat[0], lngLat[1]).then((attrs) => {
        setFlood(interpretFlood(attrs) || { none: true })
      })

      setOz({ loading: true })
      fetchOpportunityZone(lngLat[0], lngLat[1]).then((attrs) => {
        if (attrs) {
          setOz({ tract: attrs.GEOID10, rural: attrs.Rural === 'Y' })
        } else {
          setOz({ none: true })
        }
      })
    }
  }

  const search = async () => {
    if (!input.trim()) return
    setShowIntro(false)
    setMessage('Searching...')

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        input
      )}.json?access_token=${mapboxgl.accessToken}&proximity=${DALLAS_CENTER[0]},${DALLAS_CENTER[1]}&limit=1`

      const res = await fetch(url)
      const data = await res.json()

      if (!data.features || data.features.length === 0) {
        setMessage('Address not found. Try adding "Dallas, TX".')
        return
      }

      const [lng, lat] = data.features[0].center
      map.current.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 })

      map.current.once('moveend', () => {
        const point = map.current.project([lng, lat])
        const features = map.current.queryRenderedFeatures(point, {
          layers: ['zoning-fill'],
        })
        if (features.length > 0) {
          handleFeature(features[0], [lng, lat])
        } else {
          setMessage('Found the address, but no Dallas zoning data there.')
          setResult(null)
        }
      })
    } catch (err) {
      setMessage(`Error: ${err.message}`)
    }
  }

  const toggleLayer = (key) => {
    const newState = !layers[key]
    setLayers({ ...layers, [key]: newState })
    const visibility = newState ? 'visible' : 'none'
    const layerIds = {
      zoning: ['zoning-fill', 'zoning-outline'],
      historic: ['historic-fill', 'historic-outline'],
      nso: ['nso-fill', 'nso-outline'],
      oz: ['oz-fill', 'oz-outline'],
    }
    layerIds[key].forEach((id) => {
      if (map.current.getLayer(id)) {
        map.current.setLayoutProperty(id, 'visibility', visibility)
      }
    })
  }

  return (
    <div className="app">
      <div ref={mapContainer} className="map" />

      <div className="legend">
        <div className="legend-title">Map Layers</div>
        <label className="legend-item">
          <input type="checkbox" checked={layers.zoning} onChange={() => toggleLayer('zoning')} />
          <span className="legend-swatch" style={{ background: '#577590' }} />
          Zoning
        </label>
        <label className="legend-item">
          <input type="checkbox" checked={layers.historic} onChange={() => toggleLayer('historic')} />
          <span className="legend-swatch" style={{ background: '#B5179E' }} />
          Historic Districts
        </label>
        <label className="legend-item">
          <input type="checkbox" checked={layers.nso} onChange={() => toggleLayer('nso')} />
          <span className="legend-swatch" style={{ background: '#E9A23B' }} />
          Neighborhood Overlays
        </label>
        <label className="legend-item">
          <input type="checkbox" checked={layers.oz} onChange={() => toggleLayer('oz')} />
          <span className="legend-swatch" style={{ background: '#2A9D8F' }} />
          Opportunity Zones
        </label>
        <div className="legend-note">Flood risk: click any point to check</div>
      </div>

      {showIntro && (
        <div className="intro-overlay">
          <div className="intro-card">
            <button className="intro-close" onClick={() => setShowIntro(false)} aria-label="Close">
              ×
            </button>
            <div className="intro-eyebrow">Dallas, Texas</div>
            <h2 className="intro-title">Site Feasibility</h2>
            <p className="intro-lede">
              This Site Feasibility Tool compiles important information from scattered public records, providing a quick snapshot of a searchable site. I made this tool to practice my geospatial coding skills, any implementation of this tool should be cross-referenced and verified. 
              - Maggie Coleman
            </p>
            <div className="intro-search">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Search an address, or close to explore the map"
              />
              <button onClick={search}>Search</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="panel">
        <h1>Dallas Site Feasibility</h1>
        <p className="subtitle">Click the map or search an address</p>

        <div className="search-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="e.g. 1500 Marilla St, Dallas, TX"
          />
          <button onClick={search}>Search</button>
        </div>

        {message && <div className="message">{message}</div>}

        {result && (
          <div className="result">
            <div className="code-row">
              <span
                className={`swatch ${
                  result.useGroup === 'special' || result.useGroup === 'mixed'
                    ? 'swatch-striped'
                    : ''
                }`}
                style={
                  result.useGroup === 'special' || result.useGroup === 'mixed'
                    ? undefined
                    : { background: result.color }
                }
              />
              <span className="zone-code-text">{result.code}</span>
            </div>

            <div className="rows">
              <CollapsibleRow label={result.label}>
                <p className="crow-desc">{result.description}</p>
                {result.caseNumber && result.caseNumber.trim() && (
                  <p className="crow-meta"><strong>Zoning case:</strong> {result.caseNumber}</p>
                )}
                {result.notes && result.notes.trim() && (
                  <p className="crow-meta"><strong>Notes:</strong> {result.notes}</p>
                )}
                <a className="crow-source" href="https://experience.arcgis.com/experience/c1ac5a0d0c4044f6976e6294409185a2/page/Dallas-Zoning" target="_blank" rel="noreferrer">
                  Verify on Dallas Zoning Map →
                </a>
              </CollapsibleRow>

              {historic ? (
                <CollapsibleRow label="Historic District:" value={`Yes (${historic.name})`}>
                  <p className="crow-desc">
                    Exterior changes, demolition, and new construction require a
                    Certificate of Appropriateness from the Landmark Commission.
                  </p>
                  {historic.ordinance && historic.ordinance.trim() && (
                    <p className="crow-meta"><strong>Ordinance:</strong> {historic.ordinance}</p>
                  )}
                  <a className="crow-source" href="https://egisdata-dallasgis.hub.arcgis.com/maps/DallasGIS::dallas-landmark-historic-districts/explore" target="_blank" rel="noreferrer">
                    Verify on Dallas Historic Preservation →
                  </a>
                </CollapsibleRow>
              ) : (
                <CollapsibleRow label="Historic District:" value="No">
                  <p className="crow-desc">
                    This site is not in a designated historic district. Historic overlay
                    districts protect areas with notable architecture or history by
                    requiring a Certificate of Appropriateness for exterior changes,
                    demolition, or new construction. Without one, those extra design
                    reviews do not apply here.
                  </p>
                  <a className="crow-source" href="https://egisdata-dallasgis.hub.arcgis.com/maps/DallasGIS::dallas-landmark-historic-districts/explore" target="_blank" rel="noreferrer">
                    Learn about Dallas Historic Districts →
                  </a>
                </CollapsibleRow>
              )}

              {demo && (
                <CollapsibleRow label="Demolition Delay:" value={`Yes (${demo.name})`}>
                  <p className="crow-desc">
                    A Demolition Delay Overlay is a preservation tool. It does not stop
                    demolition, but it adds a waiting period (typically up to 45 days)
                    before a demolition permit is issued, giving the city and community
                    time to explore alternatives for older or historically significant
                    buildings. For a developer, it means a teardown here takes longer to
                    permit.
                  </p>
                  {demo.notes && demo.notes.trim() && (
                    <p className="crow-meta"><strong>Notes:</strong> {demo.notes}</p>
                  )}
                  <a className="crow-source" href="https://experience.arcgis.com/experience/c1ac5a0d0c4044f6976e6294409185a2/page/Dallas-Zoning" target="_blank" rel="noreferrer">
                    Verify on Dallas Zoning Map →
                  </a>
                </CollapsibleRow>
              )}

{nso ? (
                <CollapsibleRow label="Neighborhood Overlay:" value={`Yes (${nso.name})`}>
                  <p className="crow-desc">
                    A Neighborhood Stabilization Overlay (NSO) protects an established
                    neighborhood's character. It locks in standards like minimum lot size,
                    setbacks, height, and building bulk so new construction or major
                    remodels stay in scale with the existing homes. For a developer, it
                    means you cannot simply build the largest structure the base zoning
                    would otherwise allow, there are extra neighborhood-fit rules to meet.
                  </p>
                  {nso.notes && nso.notes.trim() && (
                    <p className="crow-meta"><strong>Notes:</strong> {nso.notes}</p>
                  )}
                  <a className="crow-source" href="https://dallascityhall.com/departments/sustainabledevelopment/Pages/neighborhood_overlay.aspx" target="_blank" rel="noreferrer">
                    Verify on Dallas Neighborhood Overlays →
                  </a>
                </CollapsibleRow>
              ) : (
                <CollapsibleRow label="Neighborhood Overlay:" value="None">
                  <p className="crow-desc">
                    This site is not in a Neighborhood Stabilization Overlay (NSO). An NSO
                    is a light-touch zoning tool that protects an established single-family
                    neighborhood's character by setting standards for things like lot size,
                    setbacks, garage placement, and height. Without one, only the base
                    zoning rules apply here.
                  </p>
                  <a className="crow-source" href="https://dallascityhall.com/departments/sustainabledevelopment/Pages/neighborhood_overlay.aspx" target="_blank" rel="noreferrer">
                    Learn about Dallas Neighborhood Overlays →
                  </a>
                </CollapsibleRow>
              )}

              {flood && flood.loading && (
                <CollapsibleRow label="Flood Risk:" value="Checking..." />
              )}

{flood && flood.none && (
                <CollapsibleRow label="Flood Risk:" value="Minimal">
                  <p className="crow-desc">
                    This site is not in a mapped floodplain, so flood risk is minimal.
                    Floodplain designations identify areas with a meaningful annual chance
                    of flooding, which affects building requirements, insurance, and cost.
                    A point outside the mapped zones has the lowest regulatory flood risk,
                    though no location is entirely risk-free.
                  </p>
                  <a className="crow-source" href="https://www.arcgis.com/apps/webappviewer/index.html?id=8b0adb51996444d4879338b5529aa9cd" target="_blank" rel="noreferrer">
                    Verify on FEMA Flood Map →
                  </a>
                </CollapsibleRow>
              )}

              {flood && !flood.loading && !flood.none && (
                <CollapsibleRow label="Flood Risk:" value={flood.level}>
                  <p className="crow-desc">{flood.plain}</p>
                  {flood.sfha && (
                    <p className="crow-meta"><strong>Special Flood Hazard Area:</strong> Yes</p>
                  )}
                  <a className="crow-source" href="https://www.arcgis.com/apps/webappviewer/index.html?id=8b0adb51996444d4879338b5529aa9cd" target="_blank" rel="noreferrer">
                    Verify on FEMA Flood Map →
                  </a>
                </CollapsibleRow>
              )}

              {oz && oz.loading && (
                <CollapsibleRow label="Opportunity Zone:" value="Checking..." />
              )}

              {oz && oz.none && (
                <CollapsibleRow label="Opportunity Zone:" value="No">
                  <p className="crow-desc">
                    This site is not in a current Opportunity Zone. These are OZ 1.0
                    designations. A new OZ 2.0 map takes effect January 1, 2027 with
                    stricter eligibility. The two maps overlap through December 31, 2028
                    (both valid), after which OZ 1.0 zones expire. This site could
                    potentially qualify under the new 2027 map.
                  </p>
                  <a className="crow-source" href="https://hudgis-hud.opendata.arcgis.com/maps/HUD::opportunity-zones/explore" target="_blank" rel="noreferrer">
                    Verify on HUD Opportunity Zones →
                  </a>
                </CollapsibleRow>
              )}

              {oz && !oz.loading && !oz.none && (
                <CollapsibleRow label="Opportunity Zone:" value={oz.rural ? 'Yes (Rural)' : 'Yes'}>
                  <p className="crow-desc">
                    This site is in a federally designated Qualified Opportunity Zone.
                    Investors who reinvest capital gains into a Qualified Opportunity Fund
                    here can defer and potentially reduce taxes on those gains.
                    {oz.rural && ' Rural zones may qualify for enhanced tax benefits under OZ 2.0.'}
                  </p>
                  <p className="crow-meta"><strong>Census tract:</strong> {oz.tract}</p>
                  <p className="crow-meta">
                    These are OZ 1.0 designations. A new OZ 2.0 map takes effect
                    January 1, 2027 with stricter eligibility. The two maps overlap
                    through December 31, 2028 (both valid), after which OZ 1.0 zones
                    expire. This tract's status may change in the new map.
                  </p>
                  <a className="crow-source" href="https://hudgis-hud.opendata.arcgis.com/maps/HUD::opportunity-zones/explore" target="_blank" rel="noreferrer">
                    Verify on HUD Opportunity Zones →
                  </a>
                </CollapsibleRow>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}