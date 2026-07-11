export type CostMultipliers = {
  priority: Record<string, number>;
  severity: Record<string, number>;
};

/** BB-CALC-01: cost = priorityMultiplier × severityMultiplier (null/unknown → 1). */
export function calculateCost(
  priority: string | null | undefined,
  severity: string | null | undefined,
  multipliers: CostMultipliers,
): number {
  const priorityKey = priority?.toLowerCase() ?? '';
  const severityKey = severity?.toLowerCase() ?? '';
  const priorityMultiplier = multipliers.priority[priorityKey] ?? 1;
  const severityMultiplier = multipliers.severity[severityKey] ?? 1;
  return priorityMultiplier * severityMultiplier;
}
