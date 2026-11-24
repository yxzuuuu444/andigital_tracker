import type { Category, Expense } from "@/lib/types";
import { cents } from "@/lib/format";

export type BudgetState = "none" | "ok" | "warn" | "over";

export function spentByCategory(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.category_id, cents((map.get(e.category_id) ?? 0) + Number(e.amount)));
  }
  return map;
}

/** Status of a category given spend so far (optionally including a pending amount). */
export function budgetState(spent: number, limit: number | null | undefined): BudgetState {
  if (limit == null || limit <= 0) return limit === 0 ? (spent > 0 ? "over" : "warn") : "none";
  if (spent > limit) return "over";
  if (spent >= limit * 0.8) return "warn";
  return "ok";
}

export type Preview = {
  category: Category;
  spentBefore: number;
  projected: number; // spent + pending amount
  remainingAfter: number | null; // null when uncapped
  state: BudgetState; // state after the pending amount
  overBy: number; // > 0 if the pending amount pushes past the limit
  blocked: boolean; // hard_block and would exceed (requires override)
};

export function previewExpense(
  category: Category | undefined,
  spentBefore: number,
  pending: number,
): Preview | null {
  if (!category) return null;
  const projected = cents(spentBefore + (pending || 0));
  const limit = category.monthly_limit;
  const overBy = limit != null ? cents(Math.max(0, projected - limit)) : 0;
  return {
    category,
    spentBefore,
    projected,
    remainingAfter: limit != null ? cents(limit - projected) : null,
    state: budgetState(projected, limit),
    overBy,
    blocked: category.limit_mode === "hard_block" && limit != null && projected > limit,
  };
}
