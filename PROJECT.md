# PROJECT.md — div.DICOM Project Definition

## 1. Project Identity

- **Project Name:** div.DICOM
- **Version:** 0.7.0 (per `package.json`)
- **Type:** Zero-Footprint In-Browser DICOM Medical Image Viewer
- **Repository:** `div.DICOM`
- **Target Platform:** Modern Web Browsers (Chrome, Firefox, Safari, Edge)
- **Status:** Existing application under active development

div.DICOM is a high-performance, client-side DICOM medical image viewer built with **Next.js (App Router)**, **TypeScript**, **Cornerstone.js (v2)**, and **Tailwind CSS**. It is architected for local, privacy-preserving review, measurement, and reporting of medical imaging datasets without uploading sensitive patient data to any remote server.

---

## 2. Core Architectural Principles

1. **Zero-Footprint & Privacy-First**: All DICOM parsing, pixel decompression, rendering, measurements, and clinical report generation occur strictly inside the user's browser runtime. Patient health information (PHI) and DICOM binaries are never transmitted to a backend or external service.
2. **Medical Imaging & Geometric Correctness**: Diagnostic accuracy requires mathematically precise spatial representations. Transformations between 2D pixel space and the 3D DICOM Patient Reference Coordinate System (RCS) strictly follow the DICOM standard (PS 3.3 / PS 3.6).
3. **Responsive Multi-Viewport Architecture**: Supports dynamic recursive layout tree splits (1x1, 1x2, 1x3, 2x2, spine MRI 1+2 hanging protocol) with independent viewport controls (WW/WC, Pan, Zoom, Slice scrolling) and cross-viewport spatial synchronization (linked scrolling, reference lines, 3D cursor probe).

---

## 3. Technology Stack Inventory

| Layer | Technologies | Version (Active) | Role |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `15.4.9` (runtime `15.5.23`) | Application scaffolding, client layout & routing (`output: standalone`) |
| **Runtime / UI** | React / React DOM | `19.2.1` | UI component tree, state orchestration, modular UI dialogs/toolbars |
| **Language** | TypeScript | `5.9.3` | Type definitions (`strict: true`, target `ES2017`) |
| **Imaging Engine**| `cornerstone-core` | `2.6.1` | HTML5 Canvas 2D image rendering, viewport coordinate transforms |
| **DICOM Loader**  | `cornerstone-wado-image-loader` | `4.13.2` | WADO-URI scheme, local File manager, codec web workers |
| **DICOM Parser**  | `dicom-parser` | `1.8.21` | Byte parsing, dataset element extraction in Web Workers |
| **Data Dict**     | `dicom-data-dictionary` | `0.3.1` | DICOM tag dictionary lookup for human-readable tag names |
| **Styling**       | Tailwind CSS | `4.1.11` | Utility-first styling via `@tailwindcss/postcss` |
| **Icons & UI**    | `lucide-react`, Custom SVG | `0.553.0` | Toolbar, status, and custom medical tool icons |
| **Animation**     | `motion` | `12.23.24` | Sidebar and UI transitions |
| **Testing**       | `vitest` | `4.1.11` | Automated unit testing framework for geometry, layouts, sync, & reporting |
| **Incidental / Unused** | `cornerstone-tools` (`6.0.10`), `@hookform/resolvers` (`5.2.1`), `ts-morph` (`28.0.0`) | N/A | Present in `package.json` dependencies; not imported in active source code |

---

## 4. Current vs. Planned vs. Unknown Capabilities

### CURRENT (Verified from Source)
- **Local DICOM Loading**: Drag & drop or folder selection (`webkitdirectory`) with recursive directory traversal (`utils/dicomFiles.ts`).
- **Concurrency-Throttled Web Worker Pool**: Dedicated worker pool (`utils/workerPool.ts`, `DicomWorkerPool`) bounded by hardware concurrency (2–8 threads) executing `app/workers/dicom.worker.ts` with zero-copy `ArrayBuffer` transfers.
- **Anatomical Spatial Slice Ordering**: Automatic sorting of slice stacks along slice normal vectors (`sortInstancesAnatomically` in `utils/dicomGeometry.ts`) with fallbacks to `sliceLocation` and `instanceNumber`.
- **Intelligent Hanging Protocols**: Automatic viewport layouts and series assignments (1x1, 1x2, 1x3, 2x2, Spine MRI 1+2 T2 Ax / T2 Sag / T1 Sag) via `utils/layoutHelpers.ts`.
- **Modular Component Architecture**: Decoupled UI components under `components/toolbar/`, `components/sidebar/`, `components/viewport/`, and `components/dialogs/`.
- **Cornerstone Lifecycle & Image Management**: Centralized loader initialization (`utils/cornerstoneInit.ts`), image rendering sequencing (`renderRequestSeqRef`), and transform preservation across slice changes.
- **Explicit Memory & Cache Lifecycle**: Explicit cache purging on series and study removal (`cornerstone.imageCache.removeImageLoadObject`, `loader.wadouri.fileManager.remove`, `purgeCache()`).
- **Interactive Tools & Mouse Chords**:
  - Window Width / Window Center (WW/WC) interactive drag (or Right-Click drag).
  - Pan (middle mouse button drag / tool drag) with center-crosshair HUD.
  - Zoom (Left+Right dual button drag / mouse wheel / tool drag).
- **Calibrated Diagnostic Measurements**:
  - Calibrated 2-point Length ($L = \sqrt{(\Delta x \cdot ps_{col})^2 + (\Delta y \cdot ps_{row})^2}$ mm).
  - 3-point / 4-point Angle tool with intersecting vector calculation in degrees.
  - ROI Polygon tool: Shoelace area calculation in $\text{mm}^2$, pixel sampling with Rescale Slope/Intercept for Mean HU, Standard Deviation, Min, Max.
  - Measurement drawer, item selection, and drag-to-trash support.
- **3D Spatial Synchronization & Localization**:
  - Linked Parallel Scrolling: Projects slice origins onto slice normals to synchronize comparative/parallel series.
  - Scout / Cross-Reference Lines: Intersecting plane lines drawn between orthogonal viewports.
  - 3D Cursor & Pixel Probe: Interactive 3D Patient Coordinate localization ($X, Y, Z$) that auto-scrolls orthogonal viewports to matching anatomical slices and displays CT Hounsfield Units (HU).
- **Structured Reporting**: Findings editor, plain-text export (`.txt` download with sanitized patient name and timestamps), and clipboard copy (`utils/reportGenerator.ts`).
- **DICOM Header Inspector**: Full raw tag explorer modal with tag search, human-readable names, and copy support.
- **Automated Unit Testing**: 4 test suites and 40 unit tests passing via Vitest (`tests/`).

### PLANNED (Not Yet Implemented)
- Multi-Planar Reconstruction (MPR) / Oblique reslicing (coronal/sagittal synthetic reconstruction from axial stacks).
- 3D Volume rendering (MIP, MinIP, Raymarching).
- DICOM RT Structure Sets & Segmentation overlays.
- DICOM SR (Structured Reporting) export.
- Keyboard shortcut customization modal.
- CI/CD automated test workflow (GitHub Actions).

### UNKNOWN / HISTORICAL UNCERTAINTIES
- Historical rationale for unused dependencies in `package.json` (`cornerstone-tools`, `@hookform/resolvers`, `ts-morph`).
- Historical background on whether Cornerstone3D migration was previously evaluated.

---

## 5. Medical Disclaimer

This software is developed for **educational, research, and demonstration purposes only**. It is **not** a certified medical device (FDA 510(k), CE mark) and must **not** be used for clinical diagnosis, primary interpretation, patient care, or medical decision-making.

---

## 6. Development Philosophy & Maturity

- **Current Maturity:** Functional Alpha / Maturing Prototype (~v0.7.0). Core architecture is modularized, worker-pooled, and backed by a 40-test unit test baseline.
- **Priority Hierarchy:**
  1. Medical & Geometric Correctness
  2. Data Privacy & Zero-Footprint Integrity
  3. Stability & Memory Lifecycle
  4. Maintainability & Modular Architecture
  5. UI Performance & Fluidity
  6. New Feature Breadth

