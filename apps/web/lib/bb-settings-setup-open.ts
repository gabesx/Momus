export const SETUP_OPEN_STORAGE_KEY = 'momus.bbSettings.setupOpen';

export const SETUP_SECTION_IDS = ['projects', 'multipliers', 'cron'] as const;
export type SetupSectionId = (typeof SETUP_SECTION_IDS)[number];

function isSetupSectionId(value: unknown): value is SetupSectionId {
  return (
    typeof value === 'string' &&
    (SETUP_SECTION_IDS as readonly string[]).includes(value)
  );
}

export function readSetupOpen(): Set<SetupSectionId> {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SETUP_OPEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isSetupSectionId));
  } catch {
    return new Set();
  }
}

export function writeSetupOpen(open: ReadonlySet<SetupSectionId>): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SETUP_OPEN_STORAGE_KEY, JSON.stringify([...open]));
}

export function toggleSetupOpen(
  id: SetupSectionId,
  isOpen: boolean,
): Set<SetupSectionId> {
  const next = readSetupOpen();
  if (isOpen) next.add(id);
  else next.delete(id);
  writeSetupOpen(next);
  return next;
}
