# QA Review Report
**Date:** 2026-08-31
**Reviewer:** Imaging / QA Reviewer Agent

## Overview
This report provides a comprehensive QA review of the project architecture, code, DICOM handling, state management, and performance, as per the guidelines in qa-reviewer.md.

## Findings

### 1. Anisotropic Pixel Spacing ignored in Angle Measurements
- **What is wrong:** Angle measurements compute the angle directly from pixel coordinates (m.start.x - m.end.x, etc.) without applying pixelSpacing.
- **Why it matters:** If the image has anisotropic pixel spacing (e.g., non-square pixels like 1.0 x 0.5 mm), the physical angle differs significantly from the pixel angle. This can lead to incorrect anatomical angle measurements being presented to the user.
- **Evidence:** utils/measurements.ts:162-169 (calculateMeasurementLengthText). It computes v1, v2, and the dot product without multiplying by pixelSpacing.
- **Severity:** High
- **Recommended fix:** Extract pixelSpacing for the image (similar to the Length/ROI logic) and scale the x and y components of v1 and v2 by pixelSpacing[1] and pixelSpacing[0] respectively before computing the angle.
- **When to fix:** Now.

### 2. Missing pixelSpacing Check in Cross-Reference Math
- **What is wrong:** calculateIntersection in utils/dicomGeometry.ts correctly validates that metaB.pixelSpacing exists, but it fails to validate metaA.pixelSpacing. If metaA has no pixel spacing, it defaults to 1.
- **Why it matters:** The projection of Plane A bounds onto Plane B requires knowing the physical dimensions of Plane A. Defaulting to 1 mm means the 3D bounding box will be based on raw pixel dimensions rather than true anatomical size, causing incorrect clipping of the intersection line (scout lines may appear too short or too long).
- **Evidence:** utils/dicomGeometry.ts:135. The code uses (metaA.pixelSpacing?.[1] || 1).
- **Severity:** Medium
- **Recommended fix:** Add a check !metaA.pixelSpacing alongside !metaB.pixelSpacing at line 112, and return null if it's missing, since true physical intersection bounds cannot be computed without it.
- **When to fix:** Now.

### 3. Missing Hook Dependencies in React Effects
- **What is wrong:** Some useEffect and useCallback hooks lack exhaustive dependency arrays (e.g. ctrlPressedRef or snapshotViewportTransforms in app/page.tsx).
- **Why it matters:** Stale closures can cause the UI to interact with old state, leading to bugs like incorrect active tools, broken layout management, or missing references during keypress handlers.
- **Evidence:** app/page.tsx (as acknowledged in PROJECT.md under Technical Debt), specifically toggleMaximize and various useEffect blocks.
- **Severity:** Medium
- **Recommended fix:** Audit all useEffect and useCallback hooks in app/page.tsx, applying eslint-plugin-react-hooks exhaustive-deps rules, and use refs properly to decouple mutable state where appropriate without breaking reactivity.
- **When to fix:** Later.

### 4. Slice Ordering Uses First Instance Normal for Entire Series
- **What is wrong:** sortInstancesAnatomically extracts the projection normal exclusively from the first valid instance in the series array (refInstance). It then projects all other instances against this same normal vector.
- **Why it matters:** If a series contains a mix of orientations (e.g., a localizer scout image bundled with an axial stack, which is common in older MRI data), the scout will be projected onto the axial normal, placing it randomly in the slice stack.
- **Evidence:** utils/dicomGeometry.ts:187-265.
- **Severity:** Medium
- **Recommended fix:** Group instances by imageOrientationPatient (within a tight tolerance like 0.999 dot product) before sorting, or explicitly filter out orthogonal slices if they don't match the dominant series orientation.
- **When to fix:** Later.

### 5. Dead Code in Worker Pool Task Assignment
- **What is wrong:** workerPool.ts calculates a taskIndex = queue.length - 1 when picking up a task, but the task is popped using queue.shift() (which takes from the front). The taskIndex variable is completely unused.
- **Why it matters:** While it doesn't currently break functionality, it indicates a lack of code hygiene and could lead to bugs if the index were used later assuming it corresponds to the shifted task.
- **Evidence:** utils/workerPool.ts:92.
- **Severity:** Low
- **Recommended fix:** Remove the taskIndex variable.
- **When to fix:** Later.

### 6. Unused Packages in package.json
- **What is wrong:** cornerstone-tools, @hookform/resolvers, and ts-morph are in dependencies but are not utilized in the new architecture.
- **Why it matters:** Increases bundle size and installation time unnecessarily.
- **Evidence:** package.json and PROJECT.md.
- **Severity:** Low
- **Recommended fix:** npm uninstall cornerstone-tools @hookform/resolvers ts-morph.
- **When to fix:** Later.

## Prioritized Action List
1. **[High] Fix anisotropic angle measurements in utils/measurements.ts**: This affects diagnostic accuracy.
2. **[Medium] Fix missing metaA.pixelSpacing check in utils/dicomGeometry.ts**: Affects scout line rendering accuracy.
3. **[Medium] Fix missing hook dependencies in app/page.tsx**: Prevent subtle UI bugs.
4. **[Medium] Handle mixed-orientation slice ordering in utils/dicomGeometry.ts**.
5. **[Low] Clean up unused dependencies**.
6. **[Low] Remove dead code in workerPool.ts**.

---

REVIEW RESULT: NEEDS_REWORK

Problem:
Angle measurements do not account for anisotropic pixel spacing, rendering inaccurate anatomical angles. The intersection line bounds calculation assumes a 1x1mm default if metaA.pixelSpacing is missing.

Evidence:
- utils/measurements.ts:162-169 computes angles purely using pixel values.
- utils/dicomGeometry.ts:135-142 uses metaA.pixelSpacing?.[1] || 1 instead of failing if pixel spacing is absent.

Why it matters:
Anisotropic pixel spacing will produce mathematically incorrect angles on screen, misleading users. Incorrect cross-reference bounds will draw scout lines that don't match the actual FOV.

Required changes:
1. Apply pixelSpacing[0] and pixelSpacing[1] to vector components in angle calculation.
2. Reject calculateIntersection if metaA.pixelSpacing is undefined.

Required verification:
- Test angle math with a mock pixelSpacing of [2.0, 0.5].
- Verify scout lines don't draw if an image lacks pixel spacing.
