// ============================================================
// AI4EO --- Threshold Sensitivity Analysis (-1 to -7 dB)
// ============================================================

var region = ee.Geometry.Rectangle([10.75, 48.25, 11.05, 48.50]);
Map.centerObject(region, 11);
Map.setOptions('SATELLITE');

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

var pre  = s1.filterDate('2024-05-15','2024-05-31').map(applySpeckle).mean().clip(region);
var peak = s1.filterDate('2024-06-01','2024-06-04').map(applySpeckle).mean().clip(region);
var diffCorrected = peak.subtract(pre).subtract(ee.Image.constant(1.12)).rename('diffCorrected');

var zkiBinary = ee.Image('projects/ee-leejoo97kyung/assets/20240602T0526_water')
  .select('b1').eq(1).unmask(0)
  .reproject({crs: 'EPSG:4326', scale: 10})
  .clip(region).rename('flood');

var pixelArea = ee.Image.pixelArea().divide(1e6);

print('thresh | DetArea | TP | FP | FN | Prec | Recall | IoU | F1');
[-1,-2,-3,-4,-5,-6,-7].forEach(function(thr) {
  var s1b = diffCorrected.lt(thr).unmask(0).rename('flood');
  var tp  = s1b.eq(1).and(zkiBinary.eq(1)).rename('flood');
  var fp  = s1b.eq(1).and(zkiBinary.eq(0)).rename('flood');
  var fn  = s1b.eq(0).and(zkiBinary.eq(1)).rename('flood');

  var get = function(img) {
    return ee.Number(img.multiply(pixelArea).reduceRegion({
      reducer: ee.Reducer.sum(), geometry: region, scale: 10, maxPixels: 1e9
    }).get('flood'));
  };

  var tpK = get(tp), fpK = get(fp), fnK = get(fn), dA = get(s1b);
  var pr = tpK.divide(tpK.add(fpK)).multiply(100);
  var re = tpK.divide(tpK.add(fnK)).multiply(100);
  var io = tpK.divide(tpK.add(fpK).add(fnK)).multiply(100);
  var f1 = pr.multiply(re).multiply(2).divide(pr.add(re));

  ee.List([thr,dA,tpK,fpK,fnK,pr,re,io,f1]).evaluate(function(v) {
    print(v[0].toFixed(0)+' dB | '+v[1].toFixed(1)+' | '+v[2].toFixed(2)+' | '+
          v[3].toFixed(2)+' | '+v[4].toFixed(2)+' | '+v[5].toFixed(1)+'% | '+
          v[6].toFixed(1)+'% | '+v[7].toFixed(1)+'% | '+v[8].toFixed(1)+'%');
  });
});

Map.addLayer(zkiBinary.selfMask(), {palette:['red']},  'ZKI Ground Truth');
Map.addLayer(diffCorrected.lt(-4).unmask(0).selfMask(), {palette:['cyan']}, 'Best Flood (-4 dB)');
