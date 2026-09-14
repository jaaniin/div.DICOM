export type Tool = 'paging' | 'wwc' | 'pan' | 'zoom' | 'rotate' | 'length' | 'angle' | 'roi' | 'pixel' | 'none';
export type Layout = 1 | 2 | 4; // Legacy
export type SplitDirection = 'horizontal' | 'vertical';
export type LayoutNode = 
  | { type: 'viewport', id: string, viewportIndex: number }
  | { type: 'split', id: string, direction: SplitDirection, sizes?: number[], children: LayoutNode[] };

export type Tab = 'reporting' | 'files';

export type DICOMMetadata = {
  patientName: string;
  patientId: string;
  patientBirthDate?: string;
  patientSex?: string;
  patientAge?: string;
  studyDate: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  referringPhysician?: string;
  seriesDescription: string;
  modality: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  imagePositionPatient: number[] | null;
  imageOrientationPatient: number[] | null;
  pixelSpacing: number[] | null;
  rows: number | null;
  columns: number | null;
  sliceLocation?: number | null;
  institutionName?: string;
  acquisitionDate?: string;
  acquisitionTime?: string;
  manufacturer?: string;
  model?: string;
  fieldStrength?: string;
  sliceThickness?: string;
  spacingBetweenSlices?: string;
  scanningSequence?: string;
  tr?: string;
  te?: string;
  ti?: string;
  flipAngle?: string;
  echoTrainLength?: string;
  echoNumbers?: string;
  rawTags?: Array<{tag: string, name: string, value: string}>;
};

export type DICOMInstance = {
  file: File;
  imageId: string;
  metadata: DICOMMetadata;
};

export type DICOMSeries = {
  seriesInstanceUID: string;
  seriesDescription: string;
  modality: string;
  instances: DICOMInstance[];
};

export type Point = { x: number, y: number };
export type LengthMeasurement = {
  id: string;
  imageId: string;
  type?: 'length' | 'angle' | 'roi';
  points?: Point[];
  isClosed?: boolean;
  mean?: number;
  area?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  isExpanded?: boolean;
  start: Point;
  end: Point;
  start2?: Point;
  end2?: Point;
};

export type DICOMStudy = {
  studyInstanceUID: string;
  patientName: string;
  patientId: string;
  patientBirthDate?: string;
  patientSex?: string;
  patientAge?: string;
  studyDate: string;
  studyTime?: string;
  studyDescription?: string;
  accessionNumber?: string;
  referringPhysician?: string;
  institutionName?: string;
  series: DICOMSeries[];
};

export type ViewportState = {
  studyInstanceUID: string | null;
  seriesInstanceUID: string | null;
  imageIndex: number;
};

export type DicomAppState = {
  isParsing: boolean;
  setIsParsing: React.Dispatch<React.SetStateAction<boolean>>;
  showDisclaimer: boolean;
  setShowDisclaimer: React.Dispatch<React.SetStateAction<boolean>>;
  isDisclaimerChecked: boolean;
  setIsDisclaimerChecked: React.Dispatch<React.SetStateAction<boolean>>;
  activeTool: Tool;
  setActiveTool: React.Dispatch<React.SetStateAction<Tool>>;
  layout: Layout;
  setLayout: React.Dispatch<React.SetStateAction<Layout>>;
  activeTab: Tab;
  setActiveTab: React.Dispatch<React.SetStateAction<Tab>>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  reportText: string;
  setReportText: React.Dispatch<React.SetStateAction<string>>;
  studies: DICOMStudy[];
  setStudies: React.Dispatch<React.SetStateAction<DICOMStudy[]>>;
  viewports: ViewportState[];
  setViewports: React.Dispatch<React.SetStateAction<ViewportState[]>>;
  dragOverViewport: number | null;
  setDragOverViewport: React.Dispatch<React.SetStateAction<number | null>>;
  activeViewportIndex: number | null;
  setActiveViewportIndex: React.Dispatch<React.SetStateAction<number | null>>;
  maximizedIndex: number | null;
  setMaximizedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  activeInfoViewport: number | null;
  setActiveInfoViewport: React.Dispatch<React.SetStateAction<number | null>>;
  copiedRawDataIndex: number | null;
  setCopiedRawDataIndex: React.Dispatch<React.SetStateAction<number | null>>;
  measurements: LengthMeasurement[];
  setMeasurements: React.Dispatch<React.SetStateAction<LengthMeasurement[]>>;
  isTrashOpen: boolean;
  setIsTrashOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDraggingOverTrash: boolean;
  setIsDraggingOverTrash: React.Dispatch<React.SetStateAction<boolean>>;
  selectedForDeletion: Set<string>;
  setSelectedForDeletion: React.Dispatch<React.SetStateAction<Set<string>>>;
  draggingPoint: { id: string, point: string, isNew: boolean, lastPt?: any } | null;
  setDraggingPoint: React.Dispatch<React.SetStateAction<{ id: string, point: string, isNew: boolean, lastPt?: any } | null>>;
  errorMessage: string | null;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  patientMismatchDialog: {show: boolean, pendingInstances: DICOMInstance[]};
  setPatientMismatchDialog: React.Dispatch<React.SetStateAction<{show: boolean, pendingInstances: DICOMInstance[]}>>;
  cursor3DActive: boolean;
  setCursor3DActive: React.Dispatch<React.SetStateAction<boolean>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
};

export interface StudyFilters {
  modality?: string;
  orientation?: string;
  search?: string;
  minSlices?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: 'studyDate' | 'patientName' | 'patientId' | 'seriesCount';
  sortOrder?: 'asc' | 'desc';
}

export interface BrowserSeriesInstance {
  sopInstanceUid: string;
  instanceNumber: number | null;
  sliceLocation: number | null;
  filePath: string;
}

export interface BrowserSeriesItem {
  seriesInstanceUid: string;
  seriesDescription: string;
  modality: string;
  seriesNumber: number | null;
  calculatedOrientation: string;
  sliceThickness: number | null;
  rows: number | null;
  columns: number | null;
  instanceCount: number;
  previewFilePath?: string;
  previewSopUid?: string;
}

export interface BrowserStudyItem {
  studyInstanceUid: string;
  patientName: string;
  patientId: string;
  patientBirthDate?: string;
  studyDate: string;
  studyTime?: string;
  studyDescription: string;
  accessionNumber?: string;
  modalities?: string[];
  seriesCount: number;
  totalInstances: number;
  series: BrowserSeriesItem[];
}

export interface FacetCount {
  name: string;
  count: number;
}

export interface BrowserFacets {
  modalities: FacetCount[];
  orientations: FacetCount[];
  totalStudies: number;
  totalSeries: number;
  totalInstances: number;
}

