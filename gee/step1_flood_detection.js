// ============================================================
// AI4EO --- Step 1: Flood Detection (Threshold -4 dB)
// Augsburg, June 2024 Lech/Wertach flood event
// ============================================================

var region = ee.Geometry.Rectangle([10.75, 48.25, 11.05, 48.50]);
Map.centerObject(region, 12);
Map.setOptions('SATELLITE');

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(region)
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .select(['VV', 'VH']);

var applySpeckleFilter = function(img) {
  return img.select('VH')
    .focal_mean({radius: 50, kernelType: 'circle', units: 'meters'})
    .rename('VH')
    .copyProperties(img, img.propertyNames());
};

var preFiltered = s1.filterDate('2024-05-15', '2024-05-31')
  .map(applySpeckleFilter).mean().clip(region);

var peakFiltered = s1.filterDate('2024-06-01', '2024-06-04')
  .map(applySpeckleFilter).mean().clip(region);

var diffCorrected = peakFiltered.select('VH')
  .subtract(preFiltered.select('VH'))
  .subtract(ee.Image.constant(1.12))
  .rename('diffCorrected');

var floodChange = diffCorrected.lt(-4).selfMask().rename('flood');
var permWater = peakFiltered.select('VH').lt(-18).selfMask().rename('flood');
var combined = floodChange.unmask(0).or(permWater.unmask(0)).selfMask().rename('flood');

Map.addLayer(diffCorrected,
  {min: -6, max: 4, palette: ['#0000ff','#8888ff','white','#ff8888','#ff0000']}, 'VH Diff');
Map.addLayer(combined, {palette: ['cyan']}, 'Flood Mask (-4 dB)');

var pixelArea = ee.Image.pixelArea().divide(1e6);
var floodArea = combined.multiply(pixelArea).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: region, scale: 10, maxPixels: 1e9
});
print('Flood area (km2):', ee.Number(floodArea.get('flood')).format('%.2f'));

Export.image.toDrive({
  image: combined, description: 'Augsburg_FloodMask_step1',
  folder: 'AI4EO_Project', region: region, scale: 10,
  maxPixels: 1e10, fileFormat: 'GeoTIFF'
});
