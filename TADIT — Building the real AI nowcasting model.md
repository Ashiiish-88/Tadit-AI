# TADIT — Building the real AI nowcasting model

Sep 29, 2026 · @Ash

## Summary

The real TADIT is a 10-minute-cycle system that fuses Doppler radar, INSAT-3DR/3DS satellite imagery, lightning detections and NWP fields into calibrated probabilities of thunderstorm (radar reflectivity ≥ 45 dBZ) and lightning (a flash within 10 km) for every 10-minute step out to 3 hours on a 2 km grid over India.

It is built from five parts:

1. **Ingest and harmonisation** — quality-controls each feed and puts them on one 2 km, 10-minute grid.
2. **Extrapolation baseline** — optical-flow advection (pySTEPS). It is the fallback and the benchmark to beat.
3. **Multimodal nowcasting network** — a spatio-temporal U-Net that forecasts growth, decay and new storms, not just motion.
4. **Storm-cell model** — tracks each cell and predicts the onset of its first lightning, with a per-cell explanation.
5. **Calibration, warnings and forecaster approval** — turns probabilities into IMD district colours and CAP 1.2 alerts, which a forecaster approves.

The model is trained first on a public benchmark (SEVIR) to prove the method. It is then fine-tuned on Indian data — IMD radar mosaics, INSAT and lightning — and judged against persistence and pySTEPS with the standard nowcasting skill scores.

## System components

&#91;embedded content: TADIT architecture · 4 feeds, 3 models, forecaster approval\]

The multimodal network is the core model. The baseline's motion field is one of its inputs and its fallback, and only the forecaster console can release a warning.

## Data sources

Four Indian feeds drive the model; one public dataset lets us train and prove the method before Indian data access is in place.

| Source | What it gives the model | Resolution / cadence | Access |
| --- | --- | --- | --- |
| IMD Doppler Weather Radars (DWR) | Reflectivity (dBZ), radial velocity; the core "where is the storm now" signal and the training target | 48 radars, about 92% of India covered ([The Environment, Feb 2026](https://www.theenvironment.in/2026/02/12/imds-doppler-weather-radar-network-overs-92-of-india/)); volume scans roughly every 10 min | IMD data request / MoU (radar volumes or CAPPI/MAX-Z products) |
| INSAT-3DR / [INSAT-3DS Imager](https://mosdac.gov.in/insat-3s-payloads) | Cloud-top cooling (TIR-1 10.2–11.2 µm), water vapour (6.5–7.0 µm), visible; sees new storms before radar and fills radar gaps | 1 km VIS/SWIR, 4 km TIR/MWIR, 8 km WV; staggered 3DR + 3DS imaging gives a new image about every 15 min | [MOSDAC](https://mosdac.gov.in/insat-3ds) (free registration) |
| IITM Lightning Location Network | Flash time, location, polarity, peak current; label for P(lightning) and the lightning-jump feature | Sensors at 83 sites with under 500 m location accuracy ([ThePrint, 2020](https://theprint.in/india/iitm-pune-installs-83-lightning-location-networks-to-detect-locate-lightning-strikes/905593/)); since expanded | IITM / IMD data sharing (the network behind the Damini app) |
| NWP — NOAA GFS 0.25° (and IMD / NCMRWF models) | Instability and environment: CAPE, CIN, shear, precipitable water, freezing level | GFS: 0.25°, hourly to 120 h | GFS open via NOAA NOMADS; IMD/NCMRWF on request |
| [SEVIR](https://registry.opendata.aws/sevir/) (public benchmark) | Aligned radar (VIL), GOES-16 satellite (3 channels) and GLM lightning for over 10,000 US storm events, 384 km × 384 km, 4 h each ([paper](https://proceedings.neurips.cc/paper/2020/hash/fa78a16157fed00d7a80515818432169-Abstract.html)) | 5-min frames | AWS S3 bucket `sevir`, no restrictions |

Ground truth for evaluation: radar echo ≥ 45 / 54 dBZ for thunderstorm, and lightning-network flashes within 10 km for lightning. IMD's station thunderstorm reports are an independent cross-check.

## Data processing pipeline

Every input is turned into the same tensor: a stack of 2 km × 2 km, 10-minute frames over the forecast domain, with a mask saying where each source is valid.

1. **Radar quality control** — remove ground clutter, anomalous propagation, sea clutter and beam blockage; correct attenuation. Tools: [Py-ART](https://arm-doe.github.io/pyart/) or wradlib.
2. **Multi-radar mosaic** — build a composite MAX-Z (or CAPPI at about 2–3 km height) from all radars. Where radars overlap, take the nearest or best-quality beam. Keep a per-pixel *radar quality* layer (distance from radar, beam height, radar offline).
3. **Satellite processing** — calibrate INSAT TIR and WV to brightness temperature and parallax-correct cloud tops. Derive *cooling rate* (ΔT over 15–30 min) and cold-top masks (< 220 K), the early signal of new storms.
4. **Lightning gridding** — count flashes per pixel per 10 min, split cloud-to-ground and intra-cloud where available, and build a *lightning-jump* feature (rate change over 20 min).
5. **NWP fields** — interpolate CAPE, CIN, 0–6 km shear, precipitable water and freezing level to the grid and time. They change slowly, so hourly fields are held constant within the hour.
6. **Space-time alignment** — reproject everything to one equal-area grid and snap timestamps to the 10-minute cycle. Record each input's latency so training mimics what is actually available at forecast time.
7. **Normalisation** — dBZ to 0–1 (15–75 dBZ), brightness temperature standardised per channel, lightning as log(1 + count), NWP standardised with climatology.
8. **Dataset building** — cut samples of 60 min of history (7 frames) → 180 min of future (18 frames). Oversample convective events (echoes ≥ 45 dBZ or flashes present), because clear-sky frames dominate.
9. **Labels** — thunderstorm = radar ≥ 45 dBZ (severe ≥ 54 dBZ); lightning = at least one flash within 10 km in the 10-min step; storm cells = tracked 45 dBZ objects (TITAN/TINT-style tracking) with their first-flash time.

Storage: Zarr (or NetCDF) chunked by time and tile, so training reads only the patches it needs.

## Models

Three models run side by side each cycle: the baseline guarantees a forecast, the network adds growth and new storms, and the cell model turns fields into per-storm answers.

| Model | Job | Design | Why this choice |
| --- | --- | --- | --- |
| **Extrapolation baseline** | Motion-only nowcast; fallback when the network fails; benchmark to beat | Optical flow (Lucas–Kanade / VET) + semi-Lagrangian advection; STEPS ensemble for probabilities, via [pySTEPS](https://gmd.copernicus.org/articles/12/4185/2019/) | Proven operationally in Europe and Australia; open source |
| **Multimodal nowcasting network** | P(≥ 45 dBZ), P(≥ 54 dBZ), P(lightning within 10 km) for each 10-min step to +180 min | Encoder per modality (radar, satellite, lightning, NWP) → fused latent → spatio-temporal U-Net or space-time transformer decoder; the advection field from the baseline is an extra input, as in [NowcastNet](https://www.nature.com/articles/s41586-023-06184-4) (Nature 2023, 3 h leads) | U-Nets and [Earthformer](https://github.com/amazon-science/earth-forecasting-transformer) lead the SEVIR benchmark; [MetNet-3](https://research.google/blog/metnet-3-a-state-of-the-art-neural-weather-model-available-in-google-products/) shows radar + satellite + NWP fusion works in operations |
| **Storm-cell and onset model** | Per cell: P(first lightning within 30 min), track, arrival time per district | Cells tracked as 45 dBZ objects; features = echo growth, cloud-top cooling, CAPE, flash rate and lightning jump; gradient-boosted trees (LightGBM) | Small, fast, and explainable per cell |
| **Calibration** | Makes a stated 30% happen about 30% of the time | Isotonic regression or temperature scaling per lead time, fitted on a held-out month | Warnings depend on thresholds, so probabilities must be honest |
| **Explainability** | "Why is this cell flagged?" | SHAP values on the cell model; saliency maps for the network | Forecasters trust what they can check |

**Radar gaps and outages.** The network is trained with random radar dropout: whole radars are masked, and the radar-quality layer is an input. It learns to lean on satellite and lightning where radar is missing, and its probabilities spread out there, as the demo shows.

**Output head.** Per-pixel sigmoid probabilities for each threshold and lead time. Optionally a small ensemble (3–5 seeds or MC-dropout) to widen uncertainty at long leads.

## Training strategy

Train in two stages: prove the method on SEVIR, then adapt it to India.

- **Stage 1: pre-train on SEVIR.** Radar VIL, GOES IR/WV and GLM lightning map directly onto our radar, INSAT and lightning inputs. This gives a working model and published baselines to compare against before Indian data arrives.
- **Stage 2: fine-tune on Indian data.** Use two or more pre-monsoon and monsoon seasons (March–October) of IMD mosaics, INSAT-3DR/3DS and IITM lightning. Put more weight on the storm-prone belts: east and north-east India, the Indo-Gangetic plain, central India and Kerala.
- **Splits by date, never random.** For example, 2022–2023 for training, 2024 for validation, 2025 for test. Keep whole days together so no storm appears in both train and test.
- **Losses.** Weighted binary cross-entropy per threshold, plus a Dice/CSI-style term so rare heavy cores are not ignored. A spectral or adversarial term reduces blur at long leads (the main weakness of plain U-Nets).
- **Augmentation.** Random crops and rotations (storms have no preferred compass direction in the loss), radar dropout, satellite and lightning latency jitter.
- **Compute.** Pre-training fits on a single 40–80 GB GPU in days; this is an estimate to confirm in stage 1. Inference is a forward pass per cycle. Mixed precision (bf16) is used throughout.

## Evaluation plan

TADIT is judged on held-out dates against persistence and pySTEPS, per lead time from +10 to +180 min.

| Question | Metric | Detail |
| --- | --- | --- |
| Does it put storms in the right place? | CSI, POD, FAR | At 33, 45 and 54 dBZ, per lead time |
| Is it right at the scale that matters for a district? | Fractions Skill Score (FSS) | 10, 20 and 40 km neighbourhoods |
| Are the probabilities trustworthy? | Brier skill score, reliability diagram | For P(thunderstorm) and P(lightning) |
| Does it warn early enough? | Lead time before first flash | Minutes between the onset alert and the first detected flash, per cell |
| Is it better than today? | Skill vs baselines | Persistence and pySTEPS on the same cases |
| Would forecasters use it? | Forecaster review | Blind side-by-side ranking on past events, as in the NowcastNet study |

No scores are claimed until this runs; the console's Verification tab stays empty until then.

## From forecast to warning

The model never issues anything by itself: it drafts, a forecaster approves.

1. **District rasterisation** — Survey of India district polygons are rasterised once onto the 2 km grid.
2. **District maxima** — for each district, take the maximum of P(lightning), P(≥ 45 dBZ) and P(≥ 54 dBZ) over the next 3 hours, the share of area above 50%, and the first lead time above 30% (ETA).
3. **IMD colour rules** — yellow if P(lightning) or P(≥ 45 dBZ) ≥ 0.3; orange if P(≥ 45 dBZ) ≥ 0.6 or P(≥ 54 dBZ) ≥ 0.3; red if P(≥ 54 dBZ) ≥ 0.6. The thresholds are tunable and re-fitted after verification.
4. **Text drafting** — IMD-style English and Hindi templates (intensity, "at one or two / a few / many places", validity). Regional languages are added after native-speaker review.
5. **Forecaster loop** — the forecaster edits the draft, adds gust speed and hail notes (the model does not forecast wind or hail), then approves or rejects. Every action is written to an audit trail.
6. **Dissemination** — approved warnings become CAP 1.2 XML for IMD's existing channels (SACHET, cell broadcast, SMS, the Damini/Mausam apps).

## Deployment and operations

The whole cycle must finish within about 3 minutes of data arrival so warnings keep a useful lead.

| Stage | Target time | Runs on |
| --- | --- | --- |
| Ingest + QC + mosaic | ≤ 60 s | CPU workers |
| Extrapolation baseline | ≤ 10 s | CPU |
| Multimodal network, India domain | ≤ 40 s | 1 GPU |
| Cell model + calibration | ≤ 20 s | CPU |
| District rules + drafts + CAP | ≤ 10 s | CPU |

All times are targets to be measured, not results.

- **Infrastructure:** containerised services on IMD or MeghRaj cloud, with a message queue between stages. Model files are versioned (MLflow), and the console is a web app like the demo.
- **Monitoring:** feed latency and missing-radar alarms, drift checks on input statistics, and nightly verification against observed lightning and radar. The model is retrained each season.
- **Fail-safe:** if the network or a feed fails, the system falls back to pySTEPS extrapolation and says so on screen.

## Roadmap

&#91;embedded content: Proposed roadmap · 4 phases, 4 gates\]

Phase 2 is the proof point: a model that beats pySTEPS on SEVIR before any Indian data is needed. The week counts are a proposal to adjust once data access dates are known.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Indian radar/lightning data access is slow | Start on SEVIR; request IMD/IITM data through the problem-statement owner early; MOSDAC satellite data is open |
| Radar quality varies (clutter, calibration, beam blockage) | QC pipeline + per-pixel quality layer as a model input |
| Blurry forecasts at long leads | Spectral/adversarial loss terms; report FSS at district scales |
| Rare severe events are under-represented | Event oversampling, weighted loss, separate ≥ 54 dBZ head |
| Too many false alarms erode trust | Calibration + tunable thresholds + forecaster approval before anything is issued |
| New storms with no radar echo yet | Satellite cooling and NWP instability inputs; onset model on cells |

## 60-second script for the video

> Every 10 minutes TADIT pulls in IMD's Doppler radar mosaic, INSAT-3DR and 3DS cloud-top imagery, lightning detections and NWP instability fields, and puts them on one 2-kilometre grid.
>
> A multimodal deep network — a space-time U-Net built on the ideas behind NowcastNet and MetNet — predicts the probability of thunderstorms and lightning for every 10-minute step out to three hours. Unlike radar extrapolation, it can grow, weaken and start new storms, because satellite cooling shows a storm 20 to 30 minutes before radar does.
>
> A storm-cell model tracks each cell, predicts its first lightning, and explains why with SHAP attributions.
>
> Probabilities are calibrated and turned into IMD district colours and a CAP alert. A forecaster edits and approves every warning.
>
> We pre-train on the public SEVIR dataset, fine-tune on Indian seasons, and will report CSI, FSS and Brier skill against pySTEPS on held-out dates.

## References

- Zhang, Y. et al. (2023). [Skilful nowcasting of extreme precipitation with NowcastNet](https://www.nature.com/articles/s41586-023-06184-4). *Nature* 619, 526–532.
- Veillette, M. et al. (2020). [SEVIR: A Storm Event Imagery Dataset for Deep Learning Applications in Radar and Satellite Meteorology](https://proceedings.neurips.cc/paper/2020/hash/fa78a16157fed00d7a80515818432169-Abstract.html). NeurIPS 2020. Data: [AWS Open Data registry](https://registry.opendata.aws/sevir/).
- Gao, Z. et al. (2022). [Earthformer: Exploring Space-Time Transformers for Earth System Forecasting](https://arxiv.org/pdf/2207.05833). NeurIPS 2022. [Code](https://github.com/amazon-science/earth-forecasting-transformer).
- Andrychowicz, M. et al. (2023). [Deep Learning for Day Forecasts from Sparse Observations (MetNet-3)](https://arxiv.org/pdf/2306.06079). [Google Research blog](https://research.google/blog/metnet-3-a-state-of-the-art-neural-weather-model-available-in-google-products/).
- Pulkkinen, S. et al. (2019). [Pysteps: an open-source Python library for probabilistic precipitation nowcasting (v1.0)](https://gmd.copernicus.org/articles/12/4185/2019/). *Geosci. Model Dev.* 12, 4185–4219.
- MOSDAC. [INSAT-3DS payloads](https://mosdac.gov.in/insat-3s-payloads) and [INSAT-3DS data](https://mosdac.gov.in/insat-3ds).
- The Environment (Feb 2026). [IMD's Doppler weather radar network covers 92% of India](https://www.theenvironment.in/2026/02/12/imds-doppler-weather-radar-network-overs-92-of-india/).
- ThePrint (2020). [IITM Pune installs lightning location network at 83 places](https://theprint.in/india/iitm-pune-installs-83-lightning-location-networks-to-detect-locate-lightning-strikes/905593/).
