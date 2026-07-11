/** Default multipliers & budgets from PRD §4.5C (single source of truth — D-3). */

export const DEFAULT_PRIORITY_MULTIPLIERS: Record<string, number> = {
  highest: 2,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
  lowest: 0.1,
};

export const DEFAULT_SEVERITY_MULTIPLIERS: Record<string, number> = {
  critical: 75,
  major: 50,
  moderate: 5,
  minor: 2.5,
  low: 1,
};

/** Optional tenant exclusions — empty by default; configure via settings. */
export const CONFIG_EXCLUDED_PROJECTS: readonly string[] = [];

/** Example budgets for fixtures only — runtime loads from DB / user settings. */
export const DEFAULT_PROJECT_BUDGETS: Record<string, number> = {
  SWAT: 100,
  operation: 100,
  Commercial: 100,
  FINANCE: 100,
  Core: 100,
  Warehouse: 100,
  Product: 100,
  Shopex: 100,
};

/** Example mappings for fixtures only — runtime loads from DB / user settings. */
export const DEFAULT_PROJECT_MAPPINGS: Record<string, string> = {
  AO: 'operation',
  CSE: 'Commercial',
  FIN: 'FINANCE',
  GROWPAY: 'Commercial',
  OD: 'operation',
  OPK: 'operation',
  OPUS: 'operation',
};

/** Empty by default — configure per tenant via settings / JQL. */
export const DEFAULT_EXCLUDED_PROJECTS: readonly string[] = [];

export const BUG_ISSUE_TYPES = ['Bug', 'Defect', 'Defect Sub-task', 'Defect Task'] as const;
export const BUG_GROUP_TYPES = ['Bug'] as const;
export const DEFECT_GROUP_TYPES = ['Defect', 'Defect Sub-task', 'Defect Task'] as const;

export const CLOSED_STATUS_CATEGORIES = ['done', 'resolved', 'closed'] as const;

export const SEVERITY_ORDER = [
  'Critical',
  'Major',
  'Moderate',
  'Minor',
  'Low',
  'Unknown',
] as const;

export const DEFAULT_QA_CHECKER_NAMES = [
  'Annisa Novianti',
  'Abdul Aziz',
  'Abd Aziz',
  'Dwi Fitri',
  'Hadiyanto',
  'Hanasil',
  'Fajar Kurniawan',
  'Titis',
] as const;

export const STATUS_CATEGORY_GROUPS = {
  todo: ['To Do', 'Backlog'],
  in_progress: [
    'TESTING',
    'WAITING FOR ACCEPTANCE / UAT',
    'Waiting for acceptance',
    'Waiting for deployment',
    'Waiting for test',
  ],
  done: ['Done', 'Closed', 'Canceled', 'Cancelled/Dropped', 'Dropped', 'REJECTED'],
} as const;

export const DEFAULT_BUDGET = 100;
export const TIMEZONE = 'Asia/Jakarta';
