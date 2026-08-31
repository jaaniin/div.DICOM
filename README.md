# < div🔵DICOM /> | Zero-Footprint Viewer

A modern, high-performance, web-based DICOM medical image viewer built with **Next.js (App Router)**, **TypeScript**, **Cornerstone.js (v2)**, and **Tailwind CSS**.

It follows a strict **zero-footprint** architecture: all DICOM parsing, image decoding, rendering, and reporting occur locally inside the browser. No patient data or DICOM binaries are ever uploaded to a remote server.

---

## 🌟 Key Features

### 🔒 Zero-Footprint & Privacy First
- **100% Client-Side Processing**: Files and directories are parsed entirely in the user's browser via dedicated Web Workers.
- **Data Privacy**: No medical data, patient records, or images leave the local device.

### 🖼️ Multi-Viewport & Layout Management
- Flexible viewports: **1x1**, **1x2**, **1x3**, and **2x2** grid configurations plus specialized hanging protocols (Spine MRI 1+2).
- Independent series loading, scrolling, panning, zooming, and windowing per viewport.
- Series thumbnail list with quick study/series navigation and instant viewport assignment.

### 📐 Diagnostic & Measurement Tools
- **Window Level / Window Center (WW/WC)**: Interactive drag adjustments.
- **Pan & Zoom**: Smooth translation (middle mouse / tool) and magnification (wheel / dual mouse chord).
- **Length Measurement**: Calibrated distance in millimeters using DICOM Pixel Spacing.
- **Angle Tool**: 3-point / 4-point angle measurement in degrees.
- **ROI (Region of Interest)**: Area calculation (mm²), Mean Hounsfield Units (HU), Standard Deviation, Min, and Max values.
- **Pixel Probe & 3D Cursor**: Spatial cross-referencing that calculates 3D patient coordinates ($X, Y, Z$) and automatically synchronizes perpendicular/orthogonal slice viewports to the exact anatomical intersection point.
- **Measurement Management**: Overlay toggle, individual selection/deletion, and clear-all capabilities.

### 📝 Structured Reporting
- Integrated **Reporting Panel** for writing diagnostic findings.
- **One-Click Save & Export**: Downloads a formatted `.txt` report file containing:
  - Report date and save timestamp
  - Detailed study metadata (Patient Name, Patient ID, Study Date/Time, Description, Institution, etc.)
  - Structured findings text
- **Clipboard Support**: Direct one-click copy of the formatted report text.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+ (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Medical Imaging**:
  - `cornerstone-core` (2.6.1)
  - `cornerstone-wado-image-loader` (4.13.2)
  - `dicom-parser` (1.8.21)
  - `dicom-data-dictionary` (0.3.1)
- **Concurrency**: Web Worker Pool (`utils/workerPool.ts`) for non-blocking asynchronous file parsing
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

---

## 📁 Project Structure

```text
├── app/
│   ├── layout.tsx             # Root application layout
│   ├── page.tsx               # Primary DICOM viewer & viewport orchestration
│   ├── globals.css            # Tailwind styling setup
│   └── workers/
│       └── dicom.worker.ts    # Dedicated Web Worker for off-thread DICOM parsing
├── components/
│   ├── dialogs/               # Modals (disclaimer, help, raw metadata, patient mismatch)
│   ├── sidebar/               # Study list, series cards, thumbnails, reporting panel
│   ├── toolbar/               # Tools, layout preset picker, trash drawer
│   ├── viewport/              # Layout renderer, overlay HUD, orientation markers, action bar
│   └── Icons.tsx              # Custom medical and measurement SVG icons
├── utils/
│   ├── cornerstoneInit.ts     # Centralized Cornerstone & loader initialization
│   ├── dicomFiles.ts          # Directory traversal & file system filters
│   ├── dicomGeometry.ts       # 3D spatial transforms, slice intersection & patient orientation
│   ├── formatters.ts          # DICOM dates, times, and string formatters
│   ├── layoutHelpers.ts       # Layout tree splitting, closing, and hanging protocols
│   ├── measurements.ts        # Length, angle, and ROI measurement calculations
│   ├── reportGenerator.ts     # Structured report generation and file download utilities
│   ├── syncScroll.ts          # Linked parallel scrolling & 3D cursor localization
│   ├── types.ts               # Core TypeScript definitions (DICOM metadata, instances, tools)
│   └── workerPool.ts          # Concurrency-throttled Web Worker pool
├── tests/                     # Automated Vitest test suites
├── public/                    # Static assets
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ installed
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/jaaniin/div.DICOM.git
cd div.DICOM
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### Running Automated Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm run start
```

---

## 📖 How to Use

1. **Load Data**: Drag & drop a DICOM file or an entire folder of DICOM slices into the viewer window (or click to select files).
2. **Navigate Series**: The left sidebar organizes files into **Studies** and **Series**. Drag or select a series into any active viewport.
3. **Select Tools**: Use the top toolbar to switch between **WW/WC**, **Pan**, **Zoom**, **Length**, **Angle**, **ROI**, or **Pixel Probe**.
4. **Synchronize Views**: Select **Pixel Probe** and click on an anatomical feature in any viewport to auto-align other orthogonal views to that exact 3D point.
5. **Create Report**: Click the **Reporting** tab on the sidebar, type your clinical notes, and click **Save Report** or **Copy Full Report Text**.

---

## ⚠️ Medical Disclaimer

This software is developed for **educational, research, and demonstration purposes only**. It is **not** a certified medical device and must **not** be used for clinical diagnosis, patient care, or medical decision-making.

---

## 📄 License

MIT License. See `LICENSE` for details.
