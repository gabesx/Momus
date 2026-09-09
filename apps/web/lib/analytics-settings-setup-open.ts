export const ANALYTICS_SETUP_OPEN_STORAGE_KEY =
  'momus.analyticsSettings.setupOpen';

export const ANALYTICS_SETUP_SECTION_IDS = ['kpi', 'escape'] as const;
export type AnalyticsSetupSectionId =
  (typeof ANALYTICS_SETUP_SECTION_IDS)[number];

function isAnalyticsSetupSectionId(
  value: unknown,
): value is AnalyticsSetupSectionId {
  return (
    typeof value === 'string' &&
    (ANALYTICS_SETUP_SECTION_IDS as readonly string[]).includes(value)
  );
}

export function readAnalyticsSetupOpen(): Set<AnalyticsSetupSectionId> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(ANALYTICS_SETUP_OPEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isAnalyticsSetupSectionId));
  } catch {
    return new Set();
  }
}

export function writeAnalyticsSetupOpen(
  open: ReadonlySet<AnalyticsSetupSectionId>,
): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(
    ANALYTICS_SETUP_OPEN_STORAGE_KEY,
    JSON.stringify([...open]),
  );
}

export function toggleAnalyticsSetupOpen(
  id: AnalyticsSetupSectionId,
  isOpen: boolean,
): Set<AnalyticsSetupSectionId> {
  const next = readAnalyticsSetupOpen();
  if (isOpen) next.add(id);
  else next.delete(id);
  writeAnalyticsSetupOpen(next);
  return next;
}
