// ============================================================
// AI4EO --- Step 3: Post-flood VH Backscatter Time Series
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

var d = 0.012;
var greenSpaces = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Rectangle([10.827-d,48.464-d,10.827+d,48.464+d]), {name:'Lech-Auen Nord',     type:'riparian_forest'}),
  ee.Feature(ee.Geometry.Rectangle([10.800-d,48.389-d,10.800+d,48.389+d]), {name:'Lech-Wertach Mitte', type:'wetland'}),
  ee.Feature(ee.Geometry.Rectangle([10.800-0.026,48.389-d,10.800-0.002,48.389+d]), {name:'Wertach-Auen', type:'wetland'}),
  ee.Feature(ee.Geometry.Rectangle([10.855-d,48.259-d,10.855+d,48.259+d]), {name:'Lech-Auen Sued',     type:'riparian_forest'}),
  ee.Feature(ee.Geometry.Rectangle([10.950,48.440,10.975,48.460]),          {name:'Dry Control',        type:'urban_dry'})
]);

var periods = [
  {label:'Pre-wet(05-21)', start:'2024-05-20', end:'2024-05-22'},
  {label:'Peak(06-02)',    start:'2024-06-01', end:'2024-06-04'},
  {label:'Post+11(06-13)', start:'2024-06-12', end:'2024-06-15'},
  {label:'Post+23(06-25)', start:'2024-06-24', end:'2024-06-27'},
  {label:'Post+35(07-07)', start:'2024-07-06', end:'2024-07-09'}
];

var allStats = periods.map(function(p) {
  var img = s1.filterDate(p.start, p.end).map(applySpeckle).mean().clip(region);
  return img.reduceRegions({collection: greenSpaces, reducer: ee.Reducer.mean(), scale: 10})
    .map(function(f) { return f.set('period', p.label).set('date', p.start); });
});
var flatStats = ee.FeatureCollection(allStats).flatten();

var peakImg   = s1.filterDate('2024-06-01','2024-06-04').map(applySpeckle).mean().clip(region);
var stableImg = s1.filterDate('2024-06-12','2024-07-10').map(applySpeckle).mean().clip(region);

var recoveryStats = stableImg.subtract(peakImg).rename('recovery').reduceRegions({
  collection: greenSpaces,
  reducer: ee.Reducer.mean().combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true}),
  scale: 10
});

print('=== Peak -> Stable Recovery (dB) ===');
recoveryStats.evaluate(function(fc) {
  fc.features.forEach(function(f) {
    var p = f.properties;
    var speed = p.mean > 0.5 ? 'FAST' : p.mean > 0 ? 'MODERATE' : 'SLOW';
    print(speed, p.name + ' [' + p.type + '] | ' + p.mean.toFixed(3) + ' dB');
  });
});

print(ui.Chart.feature.groups({
  features: flatStats, xProperty: 'period', yProperty: 'mean', seriesProperty: 'name'
}).setChartType('LineChart').setOptions({
  title: 'VH Backscatter Recovery --- Augsburg June 2024',
  hAxis: {title: 'Date', slantedText: true, slantedTextAngle: 30},
  vAxis: {title: 'Mean VH (dB)', viewWindow: {min: -21, max: -14}},
  lineWidth: 2, pointSize: 6
}));

Export.table.toDrive({
  collection: flatStats, description: 'AugsburgTimeSeries_v3',
  folder: 'AI4EO_Project', fileFormat: 'CSV'
});
