import fs from 'fs';

const URL =
  'https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Opportunity_Zones/FeatureServer/13/query';

async function main() {
  const params = new URLSearchParams({
    where: "STATE='48' AND COUNTY='113'",
    outFields: '*',
    outSR: '4326',
    f: 'geojson',
  });

  console.log('Fetching Dallas County Opportunity Zones...');
  const res = await fetch(`${URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = await res.json();

  fs.writeFileSync('src/data/opportunity-zones.json', JSON.stringify(data));
  console.log(`Saved ${data.features.length} OZ features to src/data/opportunity-zones.json`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});