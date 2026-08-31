# DECISIONS.md — Architecture Decision Records (ADRs)

This document records established architectural decisions for div.DICOM. Only decisions verified from the repository implementation and commit history are documented.

---

## ADR-001: Client-Side Zero-Footprint Ingestion & Processing

- **Status**: ACCEPTED
- **Context**: Medical imaging data contains sensitive Patient Health Information (PHI). Transmitting DICOM binaries to backend servers creates substantial privacy risks and regulatory compliance burdens (HIPAA, GDPR).
- **Decision**: Execute 100% of DICOM parsing, pixel decompression, canvas rendering, quantitative measurements, and diagnostic reporting directly inside the client's browser runtime. Zero PHI is transmitted over the network.
- **Consequences**:
  - Eliminates server storage costs and data transmission liabilities.
  - Limits memory capacity to available workstation RAM.
  - Requires efficient in-browser memory management and Web Workers.

---

## ADR-002: Legacy Cornerstone.js (v2.6.1) as Primary 2D Canvas Engine

- **Status**: ACCEPTED
- **Context**: Fast, stable 2D HTML5 Canvas rendering for medical DICOM images is required.
- **Decision**: Utilize `cornerstone-core` (2.6.1) and `cornerstone-wado-image-loader` (4.13.2) for 2D viewport rendering and viewport transformations.
- **Historical Rationale**: Established in early project releases.
- **Consequences**:
  - Mature and battle-tested 2D canvas rendering with WADO-URI file manager support.
  - Does not support native WebGL volume rendering out of the box; MPR must be calculated in application memory.

---

## ADR-003: Off-Thread DICOM Parsing via Concurrency-Throttled Web Worker Pool

- **Status**: ACCEPTED
- **Context**: Ingesting large clinical series (e.g. 500+ CT/MR slices) on the main thread causes UI freezes and thread exhaustion.
- **Decision**: Implement `DicomWorkerPool` (`utils/workerPool.ts`) throttling worker creation to `Math.max(2, Math.min(navigator.hardwareConcurrency - 1, 8))` threads. Transfer `ArrayBuffer` binaries using JavaScript Transferable Objects (`postMessage(..., [buffer])`) for zero-copy memory transfers.
- **Consequences**:
  - Non-blocking asynchronous file parsing with smooth UI progress bar feedback.
  - Prevents browser tab crashes and out-of-memory spikes during large batch file drops.

---

## ADR-004: Next.js App Router with TypeScript & Tailwind CSS v4

- **Status**: ACCEPTED
- **Context**: Need modern development tooling with strict type validation for complex medical metadata and high-performance styling.
- **Decision**: Use Next.js 15 App Router (`app/layout.tsx`, `app/page.tsx`), TypeScript in strict mode, and Tailwind CSS 4.1 via `@tailwindcss/postcss`.
- **Consequences**:
  - Full compile-time validation for DICOM metadata structures.
  - Minimal CSS bundle size and responsive layout support.

---

## ADR-005: Modular UI Decomposition with Centralized Page Orchestration

- **Status**: ACCEPTED
- **Context**: The original monolithic `app/page.tsx` (>3,300 LOC) created maintenance friction and tight coupling.
- **Decision**: Deconstruct UI components into domain modules (`components/toolbar/`, `components/sidebar/`, `components/viewport/`, `components/dialogs/`) while maintaining centralized state coordination in `app/page.tsx`.
- **Consequences**:
  - Clean separation of concerns and maintainable component boundaries.
  - Simplifies component testing and incremental feature additions.

---

## ADR-006: Patient Reference Coordinate System (RCS) & Spatial Slice Sorting

- **Status**: ACCEPTED
- **Context**: DICOM slices in a series can be received out of order or with non-uniform instance numbers. Correct MPR, slice scrolling, and cross-referencing require strictly ordered spatial alignment.
- **Decision**: Sort slices along the normal vector $N = 	ext{row} 	imes 	ext{col}$ calculated from `ImageOrientationPatient` by projecting `ImagePositionPatient` onto the dominant normal axis: $d = 	ext{dot}(	ext{IPP}, N)$ in `utils/dicomGeometry.ts`.
- **Consequences**:
  - Accurate spatial ordering independent of file loading order or missing `InstanceNumber` tags.
  - Full compliance with DICOM PS 3.3 Patient Reference Coordinate System standards.

---

## ADR-007: Vitest Unit Testing Framework for Imaging Math & Layout Utilities

- **Status**: ACCEPTED
- **Context**: Critical geometric calculations (3D cross-referencing, plane intersections, slice sorting, layout splitting) require rigorous regression prevention.
- **Decision**: Integrate Vitest (`vitest.config.mts`) as the project test runner, targeting isolated unit tests for `utils/dicomGeometry.ts`, `utils/layoutHelpers.ts`, `utils/syncScroll.ts`, and `utils/reportGenerator.ts`.
- **Consequences**:
  - Fast execution (sub-second) for mathematical and algorithmic test suites.
  - Automated verification of medical imaging coordinate transformations.

---

## ADR-008: Explicit Cache & Memory Lifecycle Purging on Series/Study Deletion

- **Status**: ACCEPTED
- **Context**: Cornerstone caches decoded pixel data in memory. Removing series without clearing the cache leads to heap accumulation over extended viewing sessions.
- **Decision**: Explicitly invoke `cornerstone.imageCache.removeImageLoadObject(imageId)` and `loader.wadouri.fileManager.remove(imageId)` upon series deletion, and `purgeCache()` / `fileManager.purge()` on study removal.
- **Consequences**:
  - Immediate reclamation of browser memory upon dataset removal.
  - Prevents progressive memory leaks during long-running clinical review sessions.

### ADR-011: Viewport Interaction, Multi-Selection, Fast Linking & Relative Scaling
- **Context**: Radiologists need fast multi-viewport comparison, synchronous zoom/pan/wwc, focus magnification without losing lesion context, and persistent split layout ratios.
- **Decision**:
  1. Implemented Ctrl+Click multi-selection (1-4 viewports) with Fast Linking of Zoom, Pan, and WW/WL.
  2. Implemented Quick Windowing (Enter or Grid button) preserving source series' VOI and relative transforms.
  3. Implemented relative viewport scaling (`zoomRatio = scale / fitScale`) preserving full screen fit and magnification across maximize/focus transitions.
  4. Implemented persistent split layout ratios using `PanelSizes` object structure passed via `defaultLayout`.
  5. Implemented isolated Chord Zoom (`buttons === 3`) avoiding WW/WL modification.
  6. Documented full UI interaction rules in `UI_SPECIFICATION.md` and `.agents/rules/25-ui-interaction-specs.md`.
- **Status**: Accepted
