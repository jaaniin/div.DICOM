# QA Review Report
**Date:** 2026-08-31
**Reviewer:** Imaging / QA Reviewer Agent
**Updated:** 2026-08-31 (Post-Fix Verification)

## Overview
This report provides a comprehensive QA review of the project architecture, code, DICOM handling, state management, and performance, as per the guidelines in qa-reviewer.md.

## Findings

### 1. Anisotropic Pixel Spacing ignored in Angle Measurements
- **What is wrong:** Angle measurements compute the angle directly from pixel coordinates (m.start.x - m.end.x, etc.) without applying pixelSpacing.
- **Why it matters:** If the image has anisotropic pixel spacing (e.g., non-square pixels like 1.0 x 0.5 mm), the physical angle differs significantly from the pixel angle. This can lead to incorrect anatomical angle measurements being presented to the user.
- **Severity:** High
- **Status:** **[FIXED]** `scaleX` and `scaleY` are now extracted from `pixelSpacing` and applied to angle vectors before computing the dot product.

### 2. Missing pixelSpacing Check in Cross-Reference Math
- **What is wrong:** calculateIntersection in utils/dicomGeometry.ts correctly validates that metaB.pixelSpacing exists, but it fails to validate metaA.pixelSpacing.
- **Why it matters:** The projection of Plane A bounds onto Plane B requires knowing the physical dimensions of Plane A. Defaulting to 1 mm causes incorrect clipping of the intersection line (scout lines may appear too short or too long).
- **Severity:** Medium
- **Status:** **[FIXED]** `!metaA.pixelSpacing` check has been added to `calculateIntersection` to explicitly fail if anatomical scaling is missing.

### 3. Missing Hook Dependencies in React Effects
- **What is wrong:** Some useEffect and useCallback hooks lack exhaustive dependency arrays (e.g. ctrlPressedRef or snapshotViewportTransforms in app/page.tsx).
- **Why it matters:** Stale closures can cause the UI to interact with old state, leading to bugs like incorrect active tools, broken layout management, or missing references during keypress handlers.
- **Severity:** Medium
- **Status:** **[PENDING / LATER]** To be addressed in a future refactoring phase.

### 4. Slice Ordering Uses First Instance Normal for Entire Series
- **What is wrong:** sortInstancesAnatomically extracts the projection normal exclusively from the first valid instance in the series array (refInstance). It then projects all other instances against this same normal vector.
- **Why it matters:** If a series contains a mix of orientations (e.g., a localizer scout image bundled with an axial stack), the scout will be projected onto the axial normal, placing it randomly in the slice stack.
- **Severity:** Medium
- **Status:** **[FIXED]** `sortInstancesAnatomically` now filters `validInstances` by comparing the orientation (dot product > 0.99) against the reference instance, successfully separating orthogonal scout slices from the main stack.

### 5. Dead Code in Worker Pool Task Assignment
- **What is wrong:** workerPool.ts calculates a taskIndex = queue.length - 1 when picking up a task, but the task is popped using queue.shift().
- **Severity:** Low
- **Status:** **[PENDING / LATER]**

### 6. Unused Packages in package.json
- **What is wrong:** cornerstone-tools, @hookform/resolvers, and ts-morph are in dependencies but are not utilized in the new architecture.
- **Severity:** Low
- **Status:** **[FIXED]** Unused packages were removed from `package.json`.

### 7. Localization Inconsistencies (UI Documentation)
- **What is wrong:** The project contained a mix of English and Finnish documentation (`UI_SPECIFICATION.md` was in Finnish).
- **Severity:** Low
- **Status:** **[FIXED]** `UI_SPECIFICATION.md` was translated to English. The entire codebase (UI strings and documentation) is now unified in English, making the project ready for a public repository.

## Prioritized Action List (Updated)
1. **[Medium] Fix missing hook dependencies in app/page.tsx**: Prevent subtle UI bugs.
2. **[Low] Remove dead code in workerPool.ts**.

---

REVIEW RESULT: APPROVED

The critical issues related to diagnostic accuracy (Anisotropic pixel spacing in angles) and mathematical geometric correctness (Intersection projection bounds, slice ordering for mixed-orientation series) have been successfully resolved. Additionally, documentation language has been unified to English. The project is cleared for the next milestone.
