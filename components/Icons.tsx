import React from 'react';

export const FastPagingIcon = ({ className = "w-5 h-5", ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Stacked DICOM slices on left */}
    <rect x="2.5" y="4" width="13" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.7" />
    <rect x="2.5" y="10.25" width="13" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.7" />
    <rect x="2.5" y="16.5" width="13" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.7" />
    {/* Vertical double chevron / fast paging browse arrows on right */}
    <path d="M 18.5 7.5 L 21 5 L 23.5 7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="21" y1="5.5" x2="21" y2="18.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M 18.5 16.5 L 21 19 L 23.5 16.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const AngleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 19H5L11 4" />
    <path d="M13 19a8.5 8.5 0 0 0 -5 -7" />
  </svg>
);

export const RoiIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Lines connecting the polygon */}
    <path d="M 5 6 L 19 8 L 18 17 L 6 19 Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
    {/* Corner points / square anchors */}
    <rect x="3" y="4" width="4" height="4" rx="0.5" fill="currentColor" />
    <rect x="17" y="6" width="4" height="4" rx="0.5" fill="currentColor" />
    <rect x="16" y="15" width="4" height="4" rx="0.5" fill="currentColor" />
    <rect x="4" y="17" width="4" height="4" rx="0.5" fill="currentColor" />
  </svg>
);

export const MeasurementListIcon = ({ className = "w-5 h-5", ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Left side ruler */}
    <rect x="2" y="2" width="8" height="20" rx="1.5" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08" />
    {/* Horizontal scale lines */}
    <line x1="2" y1="5.5" x2="6" y2="5.5" stroke="currentColor" strokeWidth="1.8" />
    <line x1="2" y1="9" x2="4.5" y2="9" stroke="currentColor" strokeWidth="1.8" />
    <line x1="2" y1="12.5" x2="6" y2="12.5" stroke="currentColor" strokeWidth="1.8" />
    <line x1="2" y1="16" x2="4.5" y2="16" stroke="currentColor" strokeWidth="1.8" />
    <line x1="2" y1="19.5" x2="6" y2="19.5" stroke="currentColor" strokeWidth="1.8" />
    {/* 3 clear checkmarks on the right */}
    <path d="M 13 6 L 15.5 8.5 L 21.5 2.5" stroke="currentColor" strokeWidth="2.2" />
    <path d="M 13 12 L 15.5 14.5 L 21.5 8.5" stroke="currentColor" strokeWidth="2.2" />
    <path d="M 13 18 L 15.5 20.5 L 21.5 14.5" stroke="currentColor" strokeWidth="2.2" />
  </svg>
);
