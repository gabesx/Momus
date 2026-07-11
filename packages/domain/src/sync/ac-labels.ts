import { DEFAULT_QA_CHECKER_NAMES } from '../constants/defaults';

/** Derive ac_related_labels per §7.4. */
export function deriveAcRelatedLabels(
  labels: string[] | null | undefined,
  issueType: string | null | undefined,
  summary: string | null | undefined,
): string[] {
  const list = labels ?? [];
  const explicit = list.find((l) =>
    ['ac-related', 'non-ac-related', 'not-ac-related'].includes(l.toLowerCase()),
  );
  if (explicit) {
    const lower = explicit.toLowerCase();
    if (lower === 'not-ac-related') return ['non-ac-related'];
    return [lower === 'ac-related' ? 'ac-related' : 'non-ac-related'];
  }

  const type = (issueType ?? '').toLowerCase();
  const text = `${type} ${summary ?? ''}`.toLowerCase();

  if (/\b(story|epic|feature|requirement)\b/.test(text) || ['story', 'epic', 'feature', 'requirement'].includes(type)) {
    if (['story', 'epic', 'feature', 'requirement'].includes(type)) {
      return ['ac-related-inferred-from-type'];
    }
    return ['ac-related-inferred'];
  }
  if (/\b(bug|defect|hotfix)\b/.test(text) || type.includes('bug') || type.includes('defect')) {
    if (type.includes('bug') || type.includes('defect') || type === 'hotfix') {
      return ['non-ac-related-inferred-from-type'];
    }
    return ['non-ac-related-inferred'];
  }
  return [];
}

export function findQaChecker(
  names: { assignee?: string | null; reporter?: string | null; tester?: string | null },
  qaList: readonly string[] = DEFAULT_QA_CHECKER_NAMES,
): string | null {
  const set = new Set(qaList.map((n) => n.toLowerCase()));
  for (const candidate of [names.assignee, names.reporter, names.tester]) {
    if (candidate && set.has(candidate.toLowerCase())) return candidate;
  }
  return null;
}

/** Flatten Atlassian Document Format to plain text. */
export function adfToPlainText(description: unknown): string | null {
  if (description == null) return null;
  if (typeof description === 'string') return description;
  if (typeof description !== 'object') return null;

  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === 'text' && n.text) parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(description);
  const text = parts.join('').trim();
  return text || null;
}
