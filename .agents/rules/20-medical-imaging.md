---
name: medical-imaging
description: DICOM, geometry, Cornerstone, measurements, and medical imaging correctness.
alwaysApply: true
---

# Medical Imaging Rules

Medical imaging correctness has priority over implementation convenience.

Never assume that visually plausible behavior is medically or geometrically correct.

## DICOM geometry

When working with geometry, explicitly consider:

- Image Position Patient
- Image Orientation Patient
- Pixel Spacing
- slice spacing
- slice ordering
- patient coordinate system
- image coordinate system
- viewport coordinate system
- transformations

Never assume:

array indices == patient coordinates

without verification.

## Coordinate transformations

For every important transformation identify:

Input coordinate system
→ transformation
→ output coordinate system

Do not hide coordinate conversions inside unclear helper logic.

## Measurements

Measurements must be evaluated for:

- Pixel Spacing
- calibration
- coordinate transformation
- viewport scaling
- orientation
- slice position

A measurement that looks correct is not sufficient evidence of correctness.

## Viewport synchronization

Cross-reference and synchronization must represent the same anatomical location.

Do not assume that matching:

- slice number
- image index
- row/column

is sufficient.

Use the correct spatial coordinate system.

## Cornerstone

When changing Cornerstone code inspect:

- initialization
- rendering engine lifecycle
- viewport lifecycle
- image loading
- cache
- tools
- events
- synchronization
- cleanup

## Workers

When changing DICOM workers inspect:

- message contracts
- serialization
- transferable objects
- lifecycle
- errors
- cancellation
- cleanup
- memory usage

## Missing metadata

Do not silently invent missing DICOM geometry.

Handle missing or invalid metadata explicitly.

## High-risk changes

Treat changes involving these as HIGH risk:

- DICOM geometry
- patient coordinates
- image orientation
- measurements
- cross-reference
- viewport synchronization
- pixel data
- DICOM metadata
- privacy