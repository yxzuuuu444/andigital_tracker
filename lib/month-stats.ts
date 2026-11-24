import type { AllowanceEntry, Category, Expense } from "@/lib/types";
import { cents } from "@/lib/format";
import { spentByCategory, budgetState, type BudgetState } from "@/lib/budget";

export type MonthStats = {
  totalAllowance: number;
  hasBase: boolean;
  totalSpent: number;
  remaining: number;
  pctSpent: number; // 0..∞ of total allowance
  byCategory: Array<{
    category: Category;
    spent: number;
    limit: number | null;
    remaining: number | null;
    pct: number; // 0..∞
    state: BudgetState;
  }>;
  worstOver: { name: string; overBy: number } | null;
};

export function computeMonthStats(
  categories: Category[],
  allowances: AllowanceEntry[],
  expenses: Expense[],
): MonthStats {
  const totalAllowance = cents(allowances.reduce((s, a) => s + Number(a.amount), 0));
  const hasBase = allowances.some((a) => a.kind === "base");
  const totalSpent = cents(expenses.reduce((s, e) => s + Number(e.amount), 0));
  const spent = spentByCategory(expenses);

  const byCategory = categories.map((category) => {
    const s = spent.get(category.id) ?? 0;
    const limit = category.monthly_limit;
    return {
      category,
      spent: s,
      limit,
      remaining: limit != null ? cents(limit - s) : null,
      pct: limit ? s / limit : 0,
      state: budgetState(s, limit),
    };
  });

  const overs = byCategory
    .filter((c) => c.limit != null && c.spent > (c.limit as number))
    .sort((a, b) => (b.spent - (b.limit as number)) - (a.spent - (a.limit as number)));
  const worst = overs[0];

  return {
    totalAllowance,
    hasBase,
    totalSpent,
    remaining: cents(totalAllowance - totalSpent),
    pctSpent: totalAllowance > 0 ? totalSpent / totalAllowance : totalSpent > 0 ? 1 : 0,
    byCategory,
    worstOver: worst
      ? { name: worst.category.name, overBy: cents(worst.spent - (worst.limit as number)) }
      : null,
  };
}
