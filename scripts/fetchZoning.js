import fs from 'fs';

const SERVICE =
  'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/Dallas_Zoning/FeatureServer';

const PAGE_SIZE = 2000;

// Each layer we want to download: [layerId, outputFilename]
const LAYERS = [
  { id: 15, file: 'zoning.json' },
  { id: 2, file: 'historic.json' },
];

async function fetchPage(layerId, offset) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    outSR: '4326',
    f: 'geojson',
    resultOffset: offset,
    resultRecordCount: PAGE_SIZE,
  });

  const url = `${SERVICE}/${layerId}/query?${params.toString()}`;
  console.log(`  Fetching layer ${layerId} at offset ${offset}...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchLayer(layerId, outFile) {
  let allFeatures = [];
  let offset = 0;
  let keepGoing = true;

  while (keepGoing) {
    const data = await fetchPage(layerId, offset);
    const features = data.features || [];
    allFeatures = allFeatures.concat(features);

    if (features.length < PAGE_SIZE) {
      keepGoing = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  const geojson = {
    type: 'FeatureCollection',
    features: allFeatures,
  };

  fs.writeFileSync(`src/data/${outFile}`, JSON.stringify(geojson));
  console.log(`Saved ${allFeatures.length} features to src/data/${outFile}\n`);
}

async function main() {
  for (const layer of LAYERS) {
    console.log(`Downloading layer ${layer.id} -> ${layer.file}`);
    await fetchLayer(layer.id, layer.file);
  }
  console.log('Done with all layers.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});