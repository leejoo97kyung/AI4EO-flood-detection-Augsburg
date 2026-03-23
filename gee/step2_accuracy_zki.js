// ============================================================
// AI4EO --- Step 2: Accuracy Evaluation vs ZKI ACT163
// ============================================================

var region = ee.Geometry.Rectangle([10.75, 48.25, 11.05, 48.50]);
Map.centerObject(region, 11);
Map.setOptions('SATELLITE');

var zkiRaw = ee.Image('projects/ee-leejoo97kyung/assets/20240602T0526_water');
var zkiBinary = zkiRaw.select('b1').eq(1).unmask(0).rename('flood');
Map.addLayer(zkiBinary.selfMask(), {palette: ['red']}, 'ZKI Ground Truth');

var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(region)
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .select('VH');

var applySpeckle = function(img) {
  return img.select('VH')
    .focal_mean({radius: 50, kernelType: 'circle', units: 'meters'})
    .rename('VH')
    .copyProperties(img, img.propertyNames());
};

var pre  = s1.filterDate('2024-05-15', '2024-05-31').map(applySpeckle).mean().clip(region);
var peak = s1.filterDate('2024-06-01', '2024-06-04').map(applySpeckle).mean().clip(region);

var diffCorrected = peak.subtract(pre)
  .subtract(ee.Image.constant(1.12)).rename('diffCorrected');

var s1Binary = diffCorrected.lt(-4).unmask(0).or(peak.lt(-18).unmask(0)).rename('flood');
Map.addLayer(s1Binary.selfMask(), {palette: ['cyan']}, 'S1 Flood');

var zkiAligned = zkiBinary.reproject({crs: s1Binary.projection(), scale: 10}).clip(region);
var tp = s1Binary.eq(1).and(zkiAligned.eq(1)).selfMask().rename('flood');
var fp = s1Binary.eq(1).and(zkiAligned.eq(0)).selfMask().rename('flood');
var fn = s1Binary.eq(0).and(zkiAligned.eq(1)).selfMask().rename('flood');

Map.addLayer(tp, {palette: ['#00ff00']}, 'TP');
Map.addLayer(fp, {palette: ['#ffff00']}, 'FP');
Map.addLayer(fn, {palette: ['#ff6600']}, 'FN');

var pixelArea = ee.Image.pixelArea().divide(1e6);
var tpKm = ee.Number(tp.multiply(pixelArea).reduceRegion({reducer: ee.Reducer.sum(), geometry: region, scale: 10, maxPixels: 1e9}).get('flood'));
var fpKm = ee.Number(fp.multiply(pixelArea).reduceRegion({reducer: ee.Reducer.sum(), geometry: region, scale: 10, maxPixels: 1e9}).get('flood'));
var fnKm = ee.Number(fn.multiply(pixelArea).reduceRegion({reducer: ee.Reducer.sum(), geometry: region, scale: 10, maxPixels: 1e9}).get('flood'));
var zkiKm = ee.Number(zkiAligned.multiply(pixelArea).reduceRegion({reducer: ee.Reducer.sum(), geometry: region, scale: 10, maxPixels: 1e9}).get('flood'));

var precision = tpKm.divide(tpKm.add(fpKm)).multiply(100);
var recall    = tpKm.divide(tpKm.add(fnKm)).multiply(100);
var iou       = tpKm.divide(tpKm.add(fpKm).add(fnKm)).multiply(100);
var f1        = precision.multiply(recall).multiply(2).divide(precision.add(recall));

print('ZKI flood (km2):', zkiKm.format('%.2f'));
print('TP:', tpKm.format('%.2f'), 'FP:', fpKm.format('%.2f'), 'FN:', fnKm.format('%.2f'));
print('Precision (%):', precision.format('%.2f'));
print('Recall (%):', recall.format('%.2f'));
print('IoU (%):', iou.format('%.2f'));
print('F1 Score (%):', f1.format('%.2f'));

Export.image.toDrive({
  image: ee.Image(0).where(tp.unmask(0).eq(1),1).where(fp.unmask(0).eq(1),2).where(fn.unmask(0).eq(1),3).rename('error_map').clip(region),
  description: 'Augsburg_ErrorMap_vs_ZKI',
  folder: 'AI4EO_Project', region: region, scale: 10,
  maxPixels: 1e10, fileFormat: 'GeoTIFF'
});
