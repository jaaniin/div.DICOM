# UI Interaction & Viewport Behavior Rules

All UI development and refactoring in div.DICOM must adhere to the following interaction rules:

## 1. Viewport Split & Resize Separator
- Maximum limits: 6 horizontal columns, 4 vertical rows. Checked via `canSplitNode`.
- Separators (`PanelResizeHandle`) MUST maintain a constant fixed width (`w-1` / `h-1`) without hover width expansion to prevent layout jitter.
- Separators MUST stop propagation (`e.stopPropagation()`) and canvas pointer handlers must ignore clicks on separators.
- Panel split sizes MUST be preserved using `PanelSizes` object structure (`{ size0: number, size1: number }`) and passed to `PanelGroup` via `defaultLayout={{ [child0Id]: size0, [child1Id]: size1 }}`.

## 2. Multi-Viewport Selection & Fast Linking
- `Ctrl` / `Cmd` + click selects 1–4 viewports with `#1..#4` badges and `Linked` indicator for >= 2 viewports.
- Linked viewports synchronize Zoom, Pan, and WW/WL in real time during drag gestures.
- Single `Ctrl` tap down and up without clicks resets the selection, as does `Escape`.

## 3. Quick Layout
- `Enter` or clicking the pulsing blue Grid Layout button arranges 1–4 selected viewports into 1x1, 1x2, 1x3, or 2x2.
- Transforms, VOI, and relative zoom must be mapped from `srcIdx` to `targetIdx` so windowing and contrast are preserved accurately.

## 4. Focus Mode & Relative Scaling
- Double-clicking a viewport toggles 1x1 focus mode.
- Focus mode displays only a single Restore icon (`Minimize2`) in the action bar.
- Zoom scale MUST be computed relative to viewport size (`zoomRatio = scale / fitScale`) so fitted images fill the full screen and magnified lesions maintain magnification across maximize transitions.
- Reset Layout exits focus mode and resets zoom to 100% fitToWindow.

## 5. Series Drag & Drop
- Dropping a series into any viewport MUST reset prior viewport transformations and apply the new series' native DICOM `getDefaultViewportForImage(element, image)` (windowCenter, windowWidth, voiLUT).

## 6. Tools & Gestures
- Default initial tool on startup is `'none'`.
- Left+Right chord zoom (`buttons === 3`) must lock into `isChordZooming` and never affect WW/WL.
- Length, Angle, and ROI tools auto-deactivate (`setActiveTool('none')`) upon finishing measurement drawing.
