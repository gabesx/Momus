import { CLOSED_STATUS_CATEGORIES } from '../constants/defaults';

/** BB-CALC-05: open unless status category is done/resolved/closed. */
export function isOpenStatusCategory(statusCategory: string | null | undefined): boolean {
  const normalized = (statusCategory ?? '').toLowerCase();
  return !(CLOSED_STATUS_CATEGORIES as readonly string[]).includes(normalized);
}
