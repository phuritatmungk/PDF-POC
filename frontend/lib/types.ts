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

export type FieldExtraction = {
  value: string;
  page: number | null;
  idx: number | null;
};

export type Fields = {
  company_name: FieldExtraction;
  registration_number: FieldExtraction;
  tax_id: FieldExtraction;
  registered_capital: FieldExtraction;
  address: FieldExtraction;
  report_date: FieldExtraction;
  business_type: FieldExtraction;
  directors: FieldExtraction;
};

export type OcrResponse = { pages: PageResult[]; fields: Fields };

export type Selection = { page: number; idx: number };
