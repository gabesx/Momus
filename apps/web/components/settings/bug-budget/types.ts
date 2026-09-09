export type SyncStatusData = {
  sync_run_id: number;
  status: string;
  percentage: number;
  processed: number;
  total_issues: number;
  current_batch: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
};

export type SyncActivity = {
  id: number;
  status: string;
  processed: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type JqlExample = {
  label: string;
  jql: string;
};
