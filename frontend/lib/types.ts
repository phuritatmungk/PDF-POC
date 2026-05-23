export type Detection = {
  text: string;
  confidence: number;
  box: [number, number][];
};

export type PageResult = {
  page: number;
  width: number;
  height: number;
  detections: Detection[];
};

export type OcrResponse = { pages: PageResult[] };

export type Selection = { page: number; idx: number };
