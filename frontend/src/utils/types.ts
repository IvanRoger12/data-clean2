export type Row = Record<string, any>;

export type ColumnType =
  | 'number' | 'text' | 'date' | 'email' | 'phone' | 'url' | 'boolean' | 'iban';

export type ColumnIssue = {
  name: string;
  type: ColumnType;
  missingPct: number;
  duplicatePct: number;
  invalidPct: number;
  outlierPct: number;
  score: number;
  suggestions: CorrectionSuggestion[]; // actions proposées
};

export type CorrectionSuggestion = {
  id: string;
  label: string;
  apply: 'impute_mean' | 'impute_mode' | 'trim_normalize' | 'standardize_email'
       | 'standardize_date_iso' | 'standardize_phone_e164' | 'drop_duplicates'
       | 'drop_duplicates_composite' | 'keep_as_is';
  args?: any;
  selected?: boolean;   // l’utilisateur peut valider/dévalider
};

export type Dataset = {
  rows: Row[];
  columns: string[];
  sampleRows: Row[]; // preview (<=1000)
  workbookName?: string;
  sheetName?: string;
};

export type AnalysisResult = {
  issues: ColumnIssue[];
  insights: string[];
  kpis: {
    duplicates: number;     // %
    missingFixed: number;   // %
    anomalies: number;      // nb
    lines: number;
    columns: number;
  };
  globalScore: number;      // 0-100
};

export type Job = {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'cron';
  cron?: string;
  time: string; // "09:00"
  source: 'current' | 'demo' | 'url';
  url?: string;
  nextRunISO: string;
  lastDryRun?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

export type JobRun = {
  id: string;
  jobId: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'failed';
  resultNote?: string;
};
