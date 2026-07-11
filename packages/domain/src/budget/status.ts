/** BB-CALC-04: traffic-light status from remaining budget. */
export type BudgetStatus = {
  status_color: 'dark' | 'danger' | 'warning' | 'success';
  status_message: string;
};

export function getBudgetStatus(remainingBudget: number): BudgetStatus {
  if (remainingBudget === 0) {
    return {
      status_color: 'dark',
      status_message: 'Drop product initiative and Fix the debt',
    };
  }
  if (remainingBudget <= 14) {
    return {
      status_color: 'danger',
      status_message: 'Must FIX Major Issue Immediately',
    };
  }
  if (remainingBudget <= 24) {
    return {
      status_color: 'warning',
      status_message: 'Be careful with budget',
    };
  }
  if (remainingBudget <= 85) {
    return {
      status_color: 'warning',
      status_message: 'Warning',
    };
  }
  return {
    status_color: 'success',
    status_message: 'Safe',
  };
}

/** Round to 1 decimal place (BB-CALC-03 usagePercent). */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeBudgetMetrics(budget: number, totalCost: number) {
  const remaining_budget = Math.max(0, budget - totalCost);
  const budget_usage_percent = budget > 0 ? round1((totalCost / budget) * 100) : 0;
  return {
    budget,
    total_cost: totalCost,
    remaining_budget,
    budget_usage_percent,
    ...getBudgetStatus(remaining_budget),
  };
}

export function resolveDisplayName(
  projectKey: string,
  mappings: Record<string, string>,
): string {
  return mappings[projectKey] ?? projectKey;
}

export function resolveBudget(
  displayName: string,
  budgets: Record<string, number>,
  defaultBudget = 100,
): number {
  return budgets[displayName] ?? defaultBudget;
}
