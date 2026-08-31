# div.DICOM — UI Functionality and Interaction Specification (UI Specification)

This document strictly defines the behavioral models, rules, and interfaces of the agreed-upon UI functionalities for the div.DICOM viewer. The goal of this document is to ensure that application functionalities are not forgotten or broken during future development and refactoring phases.

---

## 1. Viewport Window Splitting & Layout Tree

### 1.1 Split limits and dimensions
- **Maximum limits**: The viewer allows a maximum of **6 adjacent columns** (horizontally) and a maximum of **4 stacked rows** (vertically). The limits are checked using the utility functions `canSplitNode` and `getLayoutDimensions`.
- **Index allocation**: In nested splits, the new viewport index is calculated from the root of the layout tree (`getNextAvailableViewportIndex`), which guarantees unique indices and prevents viewport mixing.

### 1.2 Split line interaction and memory (Panel Sizes)
- **Fixed width without jitter**: Split lines (`PanelResizeHandle`) have a constant width (`w-1` / `h-1`), and the bar does not thicken when hovered. This prevents adjacent images from shaking or jumping (*layout jitter*).
- **Color highlight & hit area**: When hovered, the split line is highlighted in blue (`#3584F5`). To make grabbing easier, the line has an expanded invisible hit area (`before:absolute before:-inset-x-2` / `before:-inset-y-2`) at z-index `z-40`.
- **Event isolation**: The split line stops mouse events (`e.stopPropagation()`), and the viewport canvas ignores clicks that land on the split line. Moving a split line never alters the image windowing (WW/WL) or zoom.
- **Split line memory in focus mode**: The split ratios moved by the user are saved in memory (`panelSizesMap`) as a `PanelSizes` structure (`{ size0: number, size1: number }`) and applied to the `PanelGroup` component via the `defaultLayout` parameter. When a viewport is opened in focus mode and returned to normal, the split lines remain exactly where they were set.

---

## 2. Multi-Selection (Ctrl+Click) and Fast Linking

### 2.1 Viewport selection
- **Selection**: By holding down `Ctrl` (or `Cmd` on Mac) and clicking viewports, the user can select 1–4 viewports in any order.
- **Visual feedback**: Selected viewports are highlighted with a glowing blue border (`ring-2 ring-[#3584F5]`) and receive a number badge in the top-left corner corresponding to the selection order (**#1**, **#2**, **#3**, **#4**). When at least two viewports are selected, the badge also says **Linked**.
- **Deselection**: Clicking the viewport again while holding `Ctrl` removes its selection.

### 2.2 Fast linking (Fast Linking / Syncing)
- When 2–4 viewports are selected, operations are automatically linked in real-time:
  - **Zoom**: Zooming in one selected viewport proportionally scales all linked viewports simultaneously.
  - **Pan**: Panning in one viewport pans all linked viewports.
  - **WW/WL**: Adjusting the window level and width adjusts all linked viewports and updates their HUD values in real-time.

### 2.3 Selection reset
- **Ctrl-tap**: Simply pressing and releasing the `Ctrl` key (without a mouse click) instantly resets all selections and linking.
- **Esc key**: Pressing `Escape` clears the multi-selection and linking.

---

## 3. Quick Layout

- **Activation**: When 1–4 viewports are selected, the **Grid Layout** button in the top bar turns into a pulsing blue action button with a counter.
- **Execution**: Pressing **`Enter`** or clicking the blue Grid Layout button (which in this state does not open a menu) instantly opens the selected series in a clean split layout in numerical order:
  - **1 viewport selected**: 1x1 Single
  - **2 viewports selected**: 1x2 Columns (#1 left, #2 right)
  - **3 viewports selected**: 1x3 Columns (#1 left, #2 center, #3 right)
  - **4 viewports selected**: 2x2 Grid (#1 top-left, #2 top-right, #3 bottom-left, #4 bottom-right)
- **Windowing and zoom transfer**: `handleQuickLayout` directly transfers each series' own windowing values (`windowCenter`, `windowWidth`), relative zoom (`zoomRatio`), and pan to the new target viewport (`srcIdx -> targetIdx`) so that image contrast or magnification does not change or overexpose.

---

## 4. Focus Mode (Maximize) & Relative Scaling

### 4.1 Entering and exiting focus mode
- **Double-click**: Double-clicking a viewport (or using the Maximize button on the floating action bar) enlarges the viewport to a full-screen 1x1 focus mode. Another double-click (or the Restore button) returns to the multi-viewport view.
- **Action Bar in focus mode**: In focus mode, the floating action bar shows **only one restore icon** (`Minimize2`) so the user does not confuse focus mode with a permanent 1x1 layout.

### 4.2 Relative scaling (`zoomRatio = scale / fitScale`)
- Image zoom is always calculated relative to each view's own window size:
  - If an image is in a 2x2 viewport at base fit (100%), it will fill the full screen in 1x1 focus mode (100% fit for the full screen).
  - If an image is zoomed in on a lesion (e.g., 200%), it opens in 1x1 focus mode at 200% magnification relative to the full screen area, centered on the same target.
  - When returning to the multi-viewport view, the image reverts to its relative 200% magnification in the small viewport.

### 4.3 Reset Layout
- Instantly exits focus mode back to the original Hanging Protocol layout.
- Resets the zooms and pans of all viewports back to 100% base fit (`fitToWindow`).
- Restores split line ratios to an even split.
- Clears multi-selections.

---

## 5. Series Dragging & Native DICOM LUT/VOI

- **Drag highlight**: When dragging a series from the Files panel over a viewport, the active target viewport is highlighted with a blue border and a prompt (*"Drop Series into Viewport X"*).
- **Native LUT/VOI restore**: When a series is dropped or loaded into a viewport:
  - The windowing, contrast, rotation, and zoom settings of the series previously in that viewport are completely forgotten.
  - `cornerstone.getDefaultViewportForImage(element, image)` is called for the new series, directly applying that specific series' own `windowCenter`, `windowWidth`, and `voiLUT` values.
  - The image is automatically fitted to the size of that viewport (`fitToWindow`).

---

## 6. Mouse Gestures, Tools & Measurements

### 6.1 Default tool on startup
- On application startup, the active tool is **`none`** (no locked tool).

### 6.2 Direct mouse gestures
- **Right button held**: WW/WL windowing adjustment.
- **Middle button (or scroll wheel) held**: Pan / image translation.
- **Right + Left button simultaneously (`buttons === 3`)**: Zoom (*Chord Zoom*). The gesture locks into zoom mode (`isChordZooming`), meaning windowing (WW/WL) will not change at any point during the gesture event or when buttons are released.

### 6.3 Measurement tools
- **Auto-close**: The Length, Angle, and ROI tools automatically turn off (`setActiveTool('none')`) when drawing the measurement is completed.
- **ROI polygon close**: The ROI closes when the end point is placed over the start point or by double-clicking the canvas.
- **Trash removal**: Dragging a measurement (ROI, Length, Angle) over the floating red trash can cleanly deletes the measurement.
- **Menu auto-close**: The Measurement List and Layout menus automatically close when a viewport is clicked or another tool is selected.
