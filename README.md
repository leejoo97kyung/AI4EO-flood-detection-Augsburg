# AI4EO
# Flood Detection and Green Space Recovery Analysis — Augsburg 2024

Sentinel-1 SAR-based flood mapping and post-flood vegetation recovery analysis for the Augsburg region (June 2024 flood event), combining threshold-based detection, U-Net deep learning segmentation, and LSTM triplet network embedding for green space classification.

---

## Project Overview

**Study area**: Augsburg, Bavaria, Germany (10.75–11.05°E, 48.25–48.50°N)  
**Event**: June 2024 Lech/Wertach river flood  
**Satellite**: Sentinel-1 GRD, descending orbit, VV+VH polarization

Three research hypotheses:

- **H1**: U-Net achieves F1 ≥ 0.75, outperforming threshold baseline → **Confirmed** (F1 = 0.829)
- **H2**: Riparian forests recover faster than wetlands in VH backscatter → **Partially supported**
- **H3**: LSTM triplet network clusters green spaces by recovery behavior without OSM labels → **Partially supported**

---

## Repository Structure

```
.
├── AI4EO_Final_clean.ipynb        # U-Net + LSTM Triplet Network (Python/PyTorch)
├── gee/
│   ├── step1_flood_detection.js       # Threshold-based flood mask
│   ├── step2_accuracy_zki.js          # Accuracy evaluation vs ZKI ground truth
│   ├── step3_timeseries_recovery.js   # Post-flood VH backscatter time series
│   └── threshold_sensitivity.js       # Threshold sensitivity analysis (-1 to -7 dB)
├── README.md
└── LICENSE
```

---

## Installation

```bash
pip install segmentation-models-pytorch albumentations rasterio torch torchvision scikit-learn matplotlib pandas
```

Google Earth Engine scripts run in the [GEE Code Editor](https://code.earthengine.google.com) — no local install required.

---

## Data

| Dataset | Source | License |
|---|---|---|
| Sentinel-1 GRD | Google Earth Engine (`COPERNICUS/S1_GRD`) | Copernicus open access |
| ZKI ACT163 flood mask | DLR ZKI (2024-06-02, 16.81 km²) | Copernicus EMS open access |
| SAR chips (21 chips, 256×256 px) | Exported from GEE → Google Drive | — |
| Green space time series (40 patches × 5 dates) | Extracted via GEE → CSV | — |

Raw data files are not included. Run the GEE scripts and export to your own Google Drive at path `AI4EO_chips/`.

---

## Reproducing Results

1. Run GEE scripts in `gee/` to generate flood masks and export chips/CSV to Google Drive
2. Open `AI4EO_Final_clean.ipynb` in Google Colab and mount Drive
3. Run cells sequentially:
   - Cells 0–7: dependency install, data loading, U-Net training
   - Cells 8–11: evaluation and visualization
   - Cells 12–15: LSTM triplet training and t-SNE analysis

---

## Results

**Flood Detection**

| Method | Precision | Recall | F1 | IoU |
|---|---|---|---|---|
| Threshold (−4 dB) | 83.4% | 40.0% | 0.541 | 0.371 |
| **U-Net (ResNet-34)** | **89.0%** | **77.6%** | **0.829** | **0.708** |

**Green Space Recovery (VH backscatter, peak → +12 days)**

| Patch | Type | Recovery (dB) | Speed |
|---|---|---|---|
| Lech-Auen Nord | Riparian forest | +1.555 | Fast (<12 days) |
| Lech-Auen Sued | Riparian forest | +0.845 | Fast (<12 days) |
| Lech-Wertach Mitte | Wetland | +0.780 | Moderate |
| Wertach-Auen | Wetland | −0.616 | Slow (>36 days) |

**LSTM Triplet Network**: Urban park cluster purity 80% (8/10 patches). Natural vegetation types (wetland, riparian, grassland) partially overlap in embedding space.

